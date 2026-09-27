import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin-auth';
import { tokenize } from '@/lib/poi-derived';

export const dynamic = 'force-dynamic';

// Real Wikipedia enrichment (fr.wikipedia.org). Finds the article by geosearch near the
// POI (1 km) and requires a name match; falls back to a title search. Returns the
// article summary and its main image. Nothing is generated.

const WIKI = 'https://fr.wikipedia.org';
const UA = { 'User-Agent': 'GuideDuDetourAdmin/1.0 (admin panel)' };
const STOP = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'et', 'en', 'au', 'aux', 'sur', 'saint', 'sainte', 'st']);

function nameScore(poiName: string, title: string): number {
  const a = tokenize(poiName).filter(t => !STOP.has(t));
  const b = new Set(tokenize(title));
  if (!a.length) return 0;
  return a.filter(t => b.has(t)).length / a.length;
}

async function findTitle(name: string, lat?: number, lon?: number): Promise<string | null> {
  if (typeof lat === 'number' && typeof lon === 'number') {
    const url = `${WIKI}/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=1000&gslimit=30&format=json&origin=*`;
    const r = await fetch(url, { headers: UA });
    if (r.ok) {
      const pages: { title: string }[] = (await r.json())?.query?.geosearch || [];
      const best = pages
        .map(p => ({ title: p.title, s: nameScore(name, p.title) }))
        .sort((x, y) => y.s - x.s)[0];
      // >= 2/3 of significant words must match ("La Brocante de Serris" must not match "Canton de Serris")
      if (best && best.s >= 0.66) return best.title;
    }
    // With coordinates, never fall back to a France-wide title search:
    // "Église Saint-Pierre" would match a homonym in another town.
    return null;
  }
  const url = `${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=5&format=json&origin=*`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const hits: { title: string }[] = (await r.json())?.query?.search || [];
  const best = hits.map(h => ({ title: h.title, s: nameScore(name, h.title) })).sort((x, y) => y.s - x.s)[0];
  // Without coordinates we require a strong title match to avoid homonyms
  return best && best.s >= 0.8 ? best.title : null;
}

async function handlePOST(request: NextRequest) {
  try {
    const { name, latitude, longitude } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const title = await findTitle(name, latitude, longitude);
    if (!title) return NextResponse.json({ success: true, found: false });

    const r = await fetch(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers: UA });
    if (!r.ok) return NextResponse.json({ success: true, found: false });
    const s = await r.json();
    if (s.type === 'disambiguation') return NextResponse.json({ success: true, found: false });

    return NextResponse.json({
      success: true,
      found: true,
      title: s.title,
      description: s.extract || null,
      photoUrl: s.originalimage?.source || s.thumbnail?.source || null,
      sourceUrl: s.content_urls?.desktop?.page || `${WIKI}/wiki/${encodeURIComponent(title)}`,
    });
  } catch (error: any) {
    console.error('Wikipedia enrichment error:', error);
    return NextResponse.json({ error: 'Wikipedia enrichment failed: ' + error.message }, { status: 500 });
  }
}

export const POST = withAdmin(handlePOST);
