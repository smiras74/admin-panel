import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);

    const id = searchParams.get('id');
    const collection = searchParams.get('collection') || 'pois';

    if (!id) {
      return NextResponse.json(
        { error: 'Missing POI ID' },
        { status: 400 }
      );
    }

    // Validate collection name
    const validCollections = ['pois', 'cached_pois', 'custom_pois'];
    if (!validCollections.includes(collection)) {
      return NextResponse.json(
        { error: 'Invalid collection' },
        { status: 400 }
      );
    }

    const doc = await db.collection(collection).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'POI not found' },
        { status: 404 }
      );
    }

    const data = doc.data();

    // Get coordinates
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (data?.coordinate) {
      latitude = data.coordinate.latitude || data.coordinate._latitude;
      longitude = data.coordinate.longitude || data.coordinate._longitude;
    } else if (data?.latitude !== undefined && data?.longitude !== undefined) {
      latitude = data.latitude;
      longitude = data.longitude;
    }

    const poi = {
      id: doc.id,
      name: data?.name || 'Sans nom',
      description: data?.description || data?.shortDescription || '',
      category: data?.category || '',
      subcategory: data?.subcategory || '',
      openingHours: data?.openingHours || '',
      latitude,
      longitude,
      photoUrls: data?.photoUrls || (data?.photoUrl ? [data.photoUrl] : []),
      hasPhoto: (data?.photoUrls?.length > 0) || !!data?.photoUrl,
      hasDescription: !!(data?.description || data?.shortDescription),
      averageRating: data?.averageRating,
      ratingCount: data?.ratingCount || 0,
      checkInCount: data?.checkInCount || 0,
      source: data?.source || 'osm',
      status: data?.status,
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
      cachedAt: data?.cachedAt?.toDate?.()?.toISOString() || null,
    };

    return NextResponse.json({ poi });

  } catch (error) {
    console.error('Error fetching POI:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POI' },
      { status: 500 }
    );
  }
}
