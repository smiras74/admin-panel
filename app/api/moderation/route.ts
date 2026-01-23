import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const results: any = {
      pois: [],
      edits: [],
      reviews: [],
    };

    // Pending POIs - check both 'custom_pois' and 'pois' collections
    if (type === 'all' || type === 'pois') {
      const allPendingPois: any[] = [];
      
      // Check custom_pois collection (user-submitted)
      try {
        const customPoisSnapshot = await db.collection('custom_pois')
          .where('status', '==', 'pending')
          .limit(100)
          .get();

        customPoisSnapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          allPendingPois.push({
            id: doc.id,
            type: 'new_poi',
            collection: 'custom_pois',
            name: data.name || 'Sans nom',
            description: data.description || '',
            category: data.category || '',
            subcategory: data.subcategory || '',
            openingHours: data.openingHours || '',
            latitude: data.latitude,
            longitude: data.longitude,
            photoUrls: data.photoUrls || (data.photoUrl ? [data.photoUrl] : []),
            userId: data.createdBy || data.userId,
            status: data.status,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          });
        });
        console.log(`Found ${customPoisSnapshot.size} pending custom_pois`);
      } catch (e: any) {
        console.log('Error fetching custom_pois:', e.message);
      }
      
      // Also check main 'pois' collection
      try {
        const poisSnapshot = await db.collection('pois')
          .where('status', '==', 'pending')
          .limit(100)
          .get();

        poisSnapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          allPendingPois.push({
            id: doc.id,
            type: 'new_poi',
            collection: 'pois',
            name: data.name || 'Sans nom',
            description: data.description || '',
            category: data.category || '',
            subcategory: data.subcategory || '',
            openingHours: data.openingHours || '',
            latitude: data.latitude || data.coordinate?._latitude,
            longitude: data.longitude || data.coordinate?._longitude,
            photoUrls: data.photoUrls || (data.photoUrl ? [data.photoUrl] : []),
            userId: data.createdBy || data.userId,
            status: data.status,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          });
        });
        console.log(`Found ${poisSnapshot.size} pending pois`);
      } catch (e: any) {
        console.log('Error fetching pois:', e.message);
      }
      
      results.pois = allPendingPois;
    }

    // Pending edits (poi_edits with status=pending)
    if (type === 'all' || type === 'edits') {
      try {
        const editsSnapshot = await db.collection('poi_edits')
          .where('status', '==', 'pending')
          .limit(100)
          .get();

        console.log(`Found ${editsSnapshot.size} pending edits`);

        // For each edit, fetch the original POI to show diff
        const editsWithOriginal = await Promise.all(
          editsSnapshot.docs.map(async (doc: any) => {
            const data = doc.data();
            
            // Fetch original POI
            let original = null;
            const poiCollection = data.poiCollection || 'cached_pois';
            const poiId = data.poiId;
            
            if (poiId) {
              try {
                const originalDoc = await db.collection(poiCollection).doc(poiId).get();
                if (originalDoc.exists) {
                  const origData = originalDoc.data();
                  original = {
                    name: origData?.name || '',
                    description: origData?.description || origData?.shortDescription || '',
                    category: origData?.category || '',
                    subcategory: origData?.subcategory || '',
                    openingHours: origData?.openingHours || '',
                    latitude: origData?.latitude || origData?.coordinate?._latitude,
                    longitude: origData?.longitude || origData?.coordinate?._longitude,
                    photoUrls: origData?.photoUrls || (origData?.photoUrl ? [origData.photoUrl] : []),
                  };
                }
              } catch (e) {
                console.log('Could not fetch original POI');
              }
            }

            // Merge changes from data.changes object AND root-level fields
            // Mobile app may store fields at root level or inside changes object
            const changes: any = {};

            // Check data.changes first
            if (data.changes) {
              if (data.changes.name !== undefined) changes.name = data.changes.name;
              if (data.changes.description !== undefined) changes.description = data.changes.description;
              if (data.changes.category !== undefined) changes.category = data.changes.category;
              if (data.changes.subcategory !== undefined) changes.subcategory = data.changes.subcategory;
              if (data.changes.openingHours !== undefined) changes.openingHours = data.changes.openingHours;
              if (data.changes.latitude !== undefined) changes.latitude = data.changes.latitude;
              if (data.changes.longitude !== undefined) changes.longitude = data.changes.longitude;
              if (data.changes.photoUrls !== undefined) changes.photoUrls = data.changes.photoUrls;
            }

            // Also check root-level fields (fallback for older mobile app versions)
            if (changes.name === undefined && data.name !== undefined) changes.name = data.name;
            if (changes.description === undefined && data.description !== undefined) changes.description = data.description;
            if (changes.category === undefined && data.category !== undefined) changes.category = data.category;
            if (changes.subcategory === undefined && data.subcategory !== undefined) changes.subcategory = data.subcategory;
            if (changes.openingHours === undefined && data.openingHours !== undefined) changes.openingHours = data.openingHours;
            if (changes.latitude === undefined && data.latitude !== undefined) changes.latitude = data.latitude;
            if (changes.longitude === undefined && data.longitude !== undefined) changes.longitude = data.longitude;
            if (changes.photoUrls === undefined && data.photoUrls !== undefined) changes.photoUrls = data.photoUrls;

            return {
              id: doc.id,
              type: 'edit',
              poiId: data.poiId,
              poiCollection: poiCollection,
              poiName: data.poiName || original?.name || 'POI inconnu',
              changes: changes,
              original: original,
              userId: data.userId || data.createdBy,
              status: data.status,
              createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            };
          })
        );

        results.edits = editsWithOriginal;
      } catch (e) {
        console.log('No pending edits or index needed:', e);
      }
    }

    // Pending reviews
    if (type === 'all' || type === 'reviews') {
      try {
        const reviewsSnapshot = await db.collection('reviews')
          .where('status', '==', 'pending')
          .limit(100)
          .get();

        console.log(`Found ${reviewsSnapshot.size} pending reviews`);

        results.reviews = reviewsSnapshot.docs.map((doc: any) => {
          const data = doc.data();
          // Collect photos from various possible fields
          const photoUrls: string[] = [];
          if (data.photoUrls && Array.isArray(data.photoUrls)) {
            photoUrls.push(...data.photoUrls);
          }
          if (data.photoUrl && typeof data.photoUrl === 'string') {
            if (!photoUrls.includes(data.photoUrl)) photoUrls.push(data.photoUrl);
          }
          if (data.photos && Array.isArray(data.photos)) {
            photoUrls.push(...data.photos);
          }
          if (data.imageUrl && typeof data.imageUrl === 'string') {
            if (!photoUrls.includes(data.imageUrl)) photoUrls.push(data.imageUrl);
          }
          
          return {
            id: doc.id,
            type: 'review',
            poiId: data.poiId,
            poiName: data.poiName || 'POI inconnu',
            rating: data.rating,
            comment: data.comment || data.text || '',
            photoUrls: photoUrls,
            userId: data.userId,
            status: data.status,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          };
        });
      } catch (e: any) {
        console.log('Error fetching reviews:', e.message);
      }
    }

    // Sort all results by date (newest first)
    const sortByDate = (a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    };
    
    results.pois.sort(sortByDate);
    results.edits.sort(sortByDate);
    results.reviews.sort(sortByDate);

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error fetching moderation items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moderation items' },
      { status: 500 }
    );
  }
}

// Approve or reject
export async function POST(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const body = await request.json();
    
    const { id, type, action, poiId, poiCollection, changes, collection } = body;
    
    if (!id || !type || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      if (type === 'new_poi') {
        // Determine source collection (from request or default to custom_pois)
        const sourceCollection = collection || 'custom_pois';
        
        if (sourceCollection === 'pois') {
          // POI is already in 'pois' collection, just update status
          await db.collection('pois').doc(id).update({
            status: 'published',
            approvedAt: new Date(),
            approvedByAdmin: true,
            publishedAt: new Date(),
          });
        } else {
          // POI is in custom_pois, copy to main 'pois' collection
          const pendingDoc = await db.collection(sourceCollection).doc(id).get();
          
          if (pendingDoc.exists) {
            const poiData = pendingDoc.data();
            
            // Prepare data for main collection
            const publishedData = {
              ...poiData,
              status: 'published',
              approvedAt: new Date(),
              approvedByAdmin: true,
              publishedAt: new Date(),
              // Ensure coordinate format for geoqueries
              coordinate: poiData?.latitude && poiData?.longitude 
                ? new (require('firebase-admin').firestore.GeoPoint)(poiData.latitude, poiData.longitude)
                : null,
            };
            
            // Copy to main pois collection
            await db.collection('pois').doc(id).set(publishedData);
            
            // Update status in source collection
            await db.collection(sourceCollection).doc(id).update({
              status: 'approved',
              approvedAt: new Date(),
              approvedByAdmin: true,
            });
          }
        }
      } else if (type === 'edit') {
        // Approve edit - apply changes to original POI
        if (poiId && poiCollection && changes) {
          const updateData: any = {
            updatedAt: new Date(),
            updatedFromEdit: id,
          };
          
          if (changes.name !== undefined) updateData.name = changes.name;
          if (changes.description !== undefined) {
            updateData.description = changes.description;
            if (poiCollection === 'cached_pois') {
              updateData.shortDescription = changes.description;
            }
          }
          if (changes.category !== undefined) updateData.category = changes.category;
          if (changes.subcategory !== undefined) updateData.subcategory = changes.subcategory;
          if (changes.openingHours !== undefined) updateData.openingHours = changes.openingHours;
          if (changes.latitude !== undefined) updateData.latitude = changes.latitude;
          if (changes.longitude !== undefined) updateData.longitude = changes.longitude;
          if (changes.photoUrls !== undefined) {
            updateData.photoUrls = changes.photoUrls;
            updateData.photoUrl = changes.photoUrls[0] || '';
          }

          await db.collection(poiCollection).doc(poiId).update(updateData);
        }
        
        // Mark edit as approved
        await db.collection('poi_edits').doc(id).update({
          status: 'approved',
          approvedAt: new Date(),
          approvedByAdmin: true,
        });
      } else if (type === 'review') {
        await db.collection('reviews').doc(id).update({
          status: 'approved',
          approvedAt: new Date(),
        });
      }
    } else if (action === 'reject') {
      // Use collection from request for new_poi, otherwise determine from type
      const rejectCollection = type === 'new_poi' ? (collection || 'custom_pois') : 
                              type === 'edit' ? 'poi_edits' : 'reviews';
      
      await db.collection(rejectCollection).doc(id).update({
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedByAdmin: true,
      });
    }

    return NextResponse.json({ success: true, action, id });

  } catch (error) {
    console.error('Error processing moderation action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
