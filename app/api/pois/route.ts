import { NextRequest, NextResponse } from 'next/server';
import { FieldPath, Query } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withAdmin } from '@/lib/admin-auth';
import { readPhotos } from '@/lib/poi-photos';
import { tokenize } from '@/lib/poi-derived';
import { SUBCATEGORIES } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

// Browse: real Firestore pagination over the whole collection (equality filters only,
// served by single-field indexes). Search: searchTokens + id + name prefix, then
// filtered/sorted in memory (result set is small).

const BROWSE_COLLECTIONS = ['pois', 'verified_pois'];

function contentWhere(q: Query, content: string): Query {
  switch (content) {
    case 'with-photo': return q.where('hasPhoto', '==', true);
    case 'with-description': return q.where('hasDescription', '==', true);
    case 'with-hours': return q.where('hasHours', '==', true);
    case 'without-description': return q.where('hasDescription', '==', false);
    case 'complete': return q.where('hasPhoto', '==', true).where('hasDescription', '==', true);
    case 'empty': return q.where('hasPhoto', '==', false).where('hasDescription', '==', false);
    default: return q;
  }
}

function toItem(doc: FirebaseFirestore.DocumentSnapshot, colName: string) {
  const data: any = doc.data() || {};
  let lat: number | undefined;
  let lon: number | undefined;
  if (data.coordinate) {
    lat = data.coordinate.latitude ?? data.coordinate._latitude;
    lon = data.coordinate.longitude ?? data.coordinate._longitude;
  } else if (data.latitude !== undefined && data.longitude !== undefined) {
    lat = data.latitude;
    lon = data.longitude;
  }
  const photoUrls = readPhotos(data);
  const hasDescription = !!(data.description || data.shortDescription) && String(data.description || data.shortDescription).trim().length > 0;
  return {
    id: doc.id,
    collection: colName,
    name: data.name || 'Sans nom',
    description: data.description || data.shortDescription,
    category: data.category,
    subcategory: data.subcategory,
    latitude: lat,
    longitude: lon,
    photoUrls,
    hasPhoto: photoUrls.length > 0,
    hasDescription,
    hasOpeningHours: !!data.openingHours,
    openingHours: data.openingHours,
    averageRating: data.averageRating,
    ratingCount: data.ratingCount || 0,
    checkInCount: data.checkInCount || 0,
    source: data.source || 'osm',
    status: data.status,
    deleted: data.deleted === true,
    createdAt: data.createdAt?.toDate?.() || null,
  };
}

function sortItems(items: any[], sortBy: string, sortOrder: string) {
  items.sort((a, b) => {
    let c = 0;
    if (sortBy === 'rating') c = (a.averageRating || 0) - (b.averageRating || 0);
    else if (sortBy === 'checkIns') c = (a.checkInCount || 0) - (b.checkInCount || 0);
    else if (sortBy === 'createdAt') c = (a.createdAt ? +new Date(a.createdAt) : 0) - (b.createdAt ? +new Date(b.createdAt) : 0);
    else c = (a.name || '').localeCompare(b.name || '');
    return sortOrder === 'desc' ? -c : c;
  });
}

const SORT_FIELDS: Record<string, string> = {
  name: 'name',
  rating: 'averageRating',
  checkIns: 'checkInCount',
  createdAt: 'createdAt',
};

async function handleGET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const sp = new URL(request.url).searchParams;
    const search = (sp.get('search') || '').trim();
    const category = sp.get('category') || 'all';
    const subcategory = sp.get('subcategory') || 'all';
    const content = sp.get('content') || 'all';
    const sortBy = sp.get('sortBy') || 'name';
    const sortOrder = sp.get('sortOrder') === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50')));
    const colName = BROWSE_COLLECTIONS.includes(sp.get('collection') || '') ? sp.get('collection')! : 'pois';

    const totalInDatabase = (await db.collection('pois').count().get()).data().count;

    // Base query with equality filters (category/subcategory)
    let base: Query = db.collection(colName);
    if (category !== 'all') base = base.where('category', '==', category);
    if (subcategory !== 'all') base = base.where('subcategory', '==', subcategory);

    // Content stats for the current category/subcategory scope (count aggregations)
    const cnt = async (q: Query) => (await q.count().get()).data().count;
    const [withPhoto, withDescription, complete, empty] = await Promise.all([
      cnt(contentWhere(base, 'with-photo')),
      cnt(contentWhere(base, 'with-description')),
      cnt(contentWhere(base, 'complete')),
      cnt(contentWhere(base, 'empty')),
    ]);
    const contentStats = { withPhoto, withDescription, complete, empty };

    const subcategories = (category !== 'all'
      ? SUBCATEGORIES[category] || []
      : Object.values(SUBCATEGORIES).flat()
    ).map(s => s.value);

    // ---------- SEARCH MODE ----------
    if (search) {
      const tokens = tokenize(search);
      const candidates = new Map<string, any>();
      const add = (doc: FirebaseFirestore.DocumentSnapshot, c: string) => {
        if (doc.exists && !candidates.has(doc.id)) candidates.set(doc.id, toItem(doc, c));
      };

      const jobs: Promise<void>[] = [];
      // 1) exact document id (all collections, OSM id variants)
      for (const c of [...BROWSE_COLLECTIONS, 'custom_pois', 'cached_pois']) {
        // Document ids never contain '/', and doc('a/b') throws synchronously
        if (search.includes('/')) continue;
        jobs.push(db.collection(c).doc(search).get().then(d => add(d, c)).catch(() => {}));
      }
      // 2) word search on searchTokens (longest token is the most selective)
      if (tokens.length) {
        const key = [...tokens].sort((a, b) => b.length - a.length)[0];
        for (const c of BROWSE_COLLECTIONS) {
          jobs.push(db.collection(c).where('searchTokens', 'array-contains', key).limit(300).get()
            .then(s => s.docs.forEach(d => add(d, c))).catch(() => {}));
        }
      }
      // 3) name prefix fallback (docs without searchTokens, e.g. fresh imports)
      const variants = Array.from(new Set([search, search.charAt(0).toUpperCase() + search.slice(1)]));
      for (const v of variants) {
        jobs.push(db.collection('pois').where('name', '>=', v).where('name', '<', v + '\uf8ff').limit(50).get()
          .then(s => s.docs.forEach(d => add(d, 'pois'))).catch(() => {}));
      }
      await Promise.all(jobs);

      let items = Array.from(candidates.values()).filter(p => {
        const nameTokens = tokenize(p.name);
        const byName = tokens.every(t => nameTokens.some(n => n.startsWith(t)));
        const byId = p.id.toLowerCase().includes(search.toLowerCase());
        if (!byName && !byId) return false;
        if (category !== 'all' && p.category !== category) return false;
        if (subcategory !== 'all' && p.subcategory !== subcategory) return false;
        if (content === 'with-photo' && !p.hasPhoto) return false;
        if (content === 'with-description' && !p.hasDescription) return false;
        if (content === 'with-hours' && !p.hasOpeningHours) return false;
        if (content === 'without-description' && p.hasDescription) return false;
        if (content === 'complete' && !(p.hasPhoto && p.hasDescription)) return false;
        if (content === 'empty' && (p.hasPhoto || p.hasDescription)) return false;
        return true;
      });
      sortItems(items, sortBy, sortOrder);
      const totalCount = items.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / limit));
      items = items.slice((page - 1) * limit, page * limit);
      return NextResponse.json({
        pois: items, totalInDatabase, contentStats, subcategories, sortApplied: true,
        pagination: { page, limit, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      });
    }

    // ---------- BROWSE MODE ----------
    let q = contentWhere(base, content);
    const hasFilters = category !== 'all' || subcategory !== 'all' || content !== 'all';
    const sortField = SORT_FIELDS[sortBy] || 'name';
    // Ordering by a field together with equality filters would need composite indexes;
    // with filters we page in document-id order instead (reported via sortApplied=false).
    const sortApplied = !hasFilters;
    const ordered = sortApplied ? q.orderBy(sortField, sortOrder) : q.orderBy(FieldPath.documentId());
    const totalCount = await cnt(sortApplied ? q.orderBy(sortField) : q);
    const snap = await ordered.offset((page - 1) * limit).limit(limit).get();
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return NextResponse.json({
      pois: snap.docs.map(d => toItem(d, colName)),
      totalInDatabase, contentStats, subcategories, sortApplied,
      pagination: { page, limit, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error: any) {
    console.error('Error fetching POIs:', error);
    return NextResponse.json({ error: 'Failed to fetch POIs: ' + error.message }, { status: 500 });
  }
}

export const GET = withAdmin(handleGET);
