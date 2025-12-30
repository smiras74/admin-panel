import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search')?.toLowerCase() || '';
    const status = searchParams.get('status') || 'all'; // 'all', 'verified', 'cached', 'pending'
    const category = searchParams.get('category') || 'all';
    const subcategory = searchParams.get('subcategory') || 'all';
    const contentFilter = searchParams.get('content') || 'all';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get counts by status from unified collection
    const poisCollection = db.collection('pois');
    
    const [totalCount, verifiedCount, cachedCount, pendingCount] = await Promise.all([
      poisCollection.count().get(),
      poisCollection.where('status', '==', 'verified').count().get(),
      poisCollection.where('status', '==', 'cached').count().get(),
      poisCollection.where('status', '==', 'pending').count().get(),
    ]);

    const counts = {
      total: totalCount.data().count,
      verified: verifiedCount.data().count,
      cached: cachedCount.data().count,
      pending: pendingCount.data().count,
    };

    // Build query
    let query = poisCollection.limit(500);
    
    // Apply status filter
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }
    
    // Apply category filter
    if (category !== 'all') {
      query = query.where('category', '==', category);
    }

    const snapshot = await query.get();
    
    // Process documents
    const allPois: any[] = [];
    const seenIds = new Set<string>();
    const seenCoordinates = new Map<string, string>();
    const allSubcategories = new Set<string>();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      if (seenIds.has(doc.id)) return;
      
      // Apply search filter
      if (search && !data.name?.toLowerCase().includes(search)) return;

      // Apply subcategory filter
      if (subcategory !== 'all' && data.subcategory !== subcategory) return;
      
      // Get coordinates
      let lat: number | undefined;
      let lon: number | undefined;
      
      if (data.coordinate) {
        lat = data.coordinate.latitude || data.coordinate._latitude;
        lon = data.coordinate.longitude || data.coordinate._longitude;
      } else if (data.latitude !== undefined && data.longitude !== undefined) {
        lat = data.latitude;
        lon = data.longitude;
      }
      
      // Deduplicate by coordinates
      if (lat !== undefined && lon !== undefined) {
        const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
        if (seenCoordinates.has(coordKey)) return;
        seenCoordinates.set(coordKey, doc.id);
      }
      
      // Photo and description checks
      const photoUrls = data.photoUrls || (data.photoUrl ? [data.photoUrl] : []);
      const hasPhoto = photoUrls.length > 0;
      const hasDescription = !!data.description && data.description.trim().length > 0;

      // Apply content filter
      if (contentFilter === 'with-photo' && !hasPhoto) return;
      if (contentFilter === 'with-description' && !hasDescription) return;
      if (contentFilter === 'complete' && (!hasPhoto || !hasDescription)) return;
      if (contentFilter === 'empty' && (hasPhoto || hasDescription)) return;
      
      seenIds.add(doc.id);
      
      if (data.subcategory) {
        allSubcategories.add(data.subcategory);
      }
      
      // Map status to source for backward compatibility with UI
      const sourceFromStatus = {
        'verified': 'verified',
        'cached': 'osm',
        'pending': 'ugc',
      }[data.status] || 'osm';
      
      allPois.push({
        id: doc.id,
        name: data.name || 'Sans nom',
        description: data.description,
        category: data.category,
        subcategory: data.subcategory,
        latitude: lat,
        longitude: lon,
        photoUrls: photoUrls,
        hasPhoto,
        hasDescription,
        averageRating: data.averageRating,
        ratingCount: data.ratingCount || 0,
        checkInCount: data.checkInCount || 0,
        source: sourceFromStatus,
        status: data.status,
        createdAt: data.createdAt?.toDate?.() || null,
        cachedAt: data.cachedAt?.toDate?.() || null,
      });
    });

    // Sort
    allPois.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'rating':
          comparison = (a.averageRating || 0) - (b.averageRating || 0);
          break;
        case 'checkIns':
          comparison = (a.checkInCount || 0) - (b.checkInCount || 0);
          break;
        case 'createdAt':
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        default:
          comparison = (a.name || '').localeCompare(b.name || '');
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    const totalPoisCount = allPois.length;
    const totalPages = Math.ceil(totalPoisCount / limit);
    const startIndex = (page - 1) * limit;
    const pois = allPois.slice(startIndex, startIndex + limit);

    // Content stats
    const contentStats = {
      withPhoto: allPois.filter(p => p.hasPhoto).length,
      withDescription: allPois.filter(p => p.hasDescription).length,
      complete: allPois.filter(p => p.hasPhoto && p.hasDescription).length,
      empty: allPois.filter(p => !p.hasPhoto && !p.hasDescription).length,
    };

    return NextResponse.json({ 
      pois, 
      counts,
      contentStats,
      subcategories: Array.from(allSubcategories).sort(),
      pagination: {
        page,
        limit,
        totalCount: totalPoisCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      }
    });

  } catch (error) {
    console.error('Error fetching POIs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POIs' },
      { status: 500 }
    );
  }
}
