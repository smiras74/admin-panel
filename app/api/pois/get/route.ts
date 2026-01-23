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

    // Try multiple ID formats (OSM IDs can be stored as node/123, way/123, or just 123)
    const idVariants = [
      id,
      `node/${id}`,
      `way/${id}`,
      `relation/${id}`,
    ];

    let doc = null;
    let foundInCollection = collection;

    // First try the specified collection
    for (const idVariant of idVariants) {
      const tryDoc = await db.collection(collection).doc(idVariant).get();
      if (tryDoc.exists) {
        doc = tryDoc;
        console.log(`Found POI with ID ${idVariant} in ${collection}`);
        break;
      }
    }

    // If not found in specified collection, try other collections
    if (!doc) {
      for (const otherCollection of validCollections) {
        if (otherCollection === collection) continue;
        for (const idVariant of idVariants) {
          const tryDoc = await db.collection(otherCollection).doc(idVariant).get();
          if (tryDoc.exists) {
            doc = tryDoc;
            foundInCollection = otherCollection;
            console.log(`Found POI with ID ${idVariant} in ${otherCollection}`);
            break;
          }
        }
        if (doc) break;
      }
    }

    // If still not found, try querying by osmId or id field
    if (!doc) {
      console.log('Trying to find by osmId/id field query...');
      for (const col of validCollections) {
        // Try osmId field (number or string)
        let querySnapshot = await db.collection(col)
          .where('osmId', '==', parseInt(id))
          .limit(1)
          .get();

        if (querySnapshot.empty) {
          querySnapshot = await db.collection(col)
            .where('osmId', '==', id)
            .limit(1)
            .get();
        }

        // Try id field
        if (querySnapshot.empty) {
          querySnapshot = await db.collection(col)
            .where('id', '==', parseInt(id))
            .limit(1)
            .get();
        }

        if (querySnapshot.empty) {
          querySnapshot = await db.collection(col)
            .where('id', '==', id)
            .limit(1)
            .get();
        }

        if (!querySnapshot.empty) {
          doc = querySnapshot.docs[0];
          foundInCollection = col;
          console.log(`Found POI by field query in ${col}, doc ID: ${doc.id}`);
          break;
        }
      }
    }

    if (!doc || !doc.exists) {
      console.log(`POI not found. Tried IDs: ${idVariants.join(', ')} and field queries in collections: ${validCollections.join(', ')}`);
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
