import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search')?.toLowerCase() || '';
    const source = searchParams.get('source') || 'all';
    const category = searchParams.get('category') || 'all';
    const subcategory = searchParams.get('subcategory') || 'all';
    const contentFilter = searchParams.get('content') || 'all'; // 'all', 'with-photo', 'with-description', 'complete', 'empty'
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get counts
    const [verifiedCount, cachedCount, customCount] = await Promise.all([
      db.collection('verified_pois').count().get(),
      db.collection('cached_pois').count().get(),
      db.collection('custom_pois').count().get(),
    ]);

    const counts = {
      verified: verifiedCount.data().count,
      cached: cachedCount.data().count,
      custom: customCount.data().count,
    };

    // Determine which collections to query
    const collections: { name: string; sourceValue: string }[] = [];
    
    if (source === 'all' || source === 'verified') {
      collections.push({ name: 'verified_pois', sourceValue: 'verified' });
    }
    if (source === 'all' || source === 'cached') {
      collections.push({ name: 'cached_pois', sourceValue: 'osm' });
    }
    if (source === 'all' || source === 'custom') {
      collections.push({ name: 'custom_pois', sourceValue: 'ugc' });
    }

    // Fetch from each collection
    const allPois: any[] = [];
    const seenIds = new Set<string>();
    const seenCoordinates = new Map<string, string>();
    const allSubcategories = new Set<string>();
    
    for (const col of collections) {
      let query = db.collection(col.name).limit(500); // Get more for filtering
      
      // Apply category filter if specified
      if (category !== 'all') {
        query = query.where('category', '==', category);
      }
      
      const snapshot = await query.get();
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Skip if already seen this ID
        if (seenIds.has(doc.id)) {
          return;
        }
        
        // Apply search filter
        if (search && !data.name?.toLowerCase().includes(search)) {
          return;
        }

        // Apply subcategory filter
        if (subcategory !== 'all' && data.subcategory !== subcategory) {
          return;
        }
        
        // Get coordinates for deduplication
        let lat: number | undefined;
        let lon: number | undefined;
        
        if (data.coordinate) {
          lat = data.coordinate.latitude || data.coordinate._latitude;
          lon = data.coordinate.longitude || data.coordinate._longitude;
        } else if (data.latitude !== undefined && data.longitude !== undefined) {
          lat = data.latitude;
          lon = data.longitude;
        }
        
        // Check for coordinate-based duplicates
        if (lat !== undefined && lon !== undefined) {
          const coordKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          
          if (seenCoordinates.has(coordKey)) {
            return;
          }
          
          seenCoordinates.set(coordKey, doc.id);
        }
        
        // Determine if has photo and description
        const photoUrls = data.photoUrls || (data.photoUrl ? [data.photoUrl] : []);
        const hasPhoto = photoUrls.length > 0;
        const hasDescription = !!data.description && data.description.trim().length > 0;

        // Apply content filter
        if (contentFilter === 'with-photo' && !hasPhoto) return;
        if (contentFilter === 'with-description' && !hasDescription) return;
        if (contentFilter === 'complete' && (!hasPhoto || !hasDescription)) return;
        if (contentFilter === 'empty' && (hasPhoto || hasDescription)) return;
        
        seenIds.add(doc.id);
        
        // Collect subcategories
        if (data.subcategory) {
          allSubcategories.add(data.subcategory);
        }
        
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
          source: col.sourceValue,
          status: data.status,
          createdAt: data.createdAt?.toDate?.() || null,
          cachedAt: data.cachedAt?.toDate?.() || null,
        });
      });
    }

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
    const totalCount = allPois.length;
    const totalPages = Math.ceil(totalCount / limit);
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
        totalCount,
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
