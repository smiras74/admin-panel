import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const body = await request.json();
    
    // Support both formats: direct fields or nested in "updates"
    const { id, source, updates, collection: specifiedCollection } = body;
    const name = updates?.name ?? body.name;
    const description = updates?.description ?? body.description;
    const category = updates?.category ?? body.category;
    const subcategory = updates?.subcategory ?? body.subcategory;
    const photoUrls = updates?.photoUrls ?? body.photoUrls;
    const newStatus = updates?.status ?? body.status;
    const openingHours = updates?.openingHours ?? body.openingHours;
    
    console.log('Update POI request:', { id, source, name, description: description?.substring(0, 50), photoUrls: photoUrls?.length });
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing POI id' },
        { status: 400 }
      );
    }

    // If collection is specified, try that first
    let docRef: any;
    let docSnap: any;
    let collectionName = specifiedCollection || 'pois';

    if (specifiedCollection) {
      docRef = db.collection(specifiedCollection).doc(id);
      docSnap = await docRef.get();
      console.log(`Checking specified collection ${specifiedCollection}: exists=${docSnap.exists}`);
    }

    // If not found in specified collection or no collection specified, search all
    if (!docSnap?.exists) {
      const collectionsToSearch = ['pois', 'verified_pois', 'cached_pois', 'custom_pois'];

      for (const col of collectionsToSearch) {
        const tryDoc = await db.collection(col).doc(id).get();
        if (tryDoc.exists) {
          collectionName = col;
          docRef = db.collection(col).doc(id);
          docSnap = tryDoc;
          console.log(`Found POI in collection: ${col}`);
          break;
        }
      }

      if (!docSnap?.exists) {
        return NextResponse.json(
          { error: 'POI not found in any collection' },
          { status: 404 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
      updatedByAdmin: true,
    };

    if (name !== undefined && name !== '') {
      updateData.name = name;
    }

    if (category !== undefined && category !== '') {
      updateData.category = category;
    }

    if (subcategory !== undefined) {
      updateData.subcategory = subcategory;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (photoUrls !== undefined) {
      updateData.photoUrls = photoUrls;
      // Set first photo as main photoUrl for compatibility
      if (photoUrls.length > 0) {
        updateData.photoUrl = photoUrls[0];
      } else {
        updateData.photoUrl = '';
      }
    }

    // Opening hours
    if (openingHours !== undefined) {
      updateData.openingHours = openingHours;
    }

    // Allow status update (e.g., verify a cached POI)
    if (newStatus !== undefined) {
      updateData.status = newStatus;
    }

    console.log('Updating document:', collectionName, id, 'with fields:', Object.keys(updateData));

    // Update the document
    await docRef.update(updateData);

    console.log(`POI updated: ${collectionName}/${id}`);

    return NextResponse.json({
      success: true,
      id,
      collection: collectionName,
      updatedFields: Object.keys(updateData),
    });

  } catch (error: any) {
    console.error('Error updating POI:', error);
    
    // Check if document doesn't exist
    if (error.code === 5 || error.message?.includes('NOT_FOUND') || error.message?.includes('No document to update')) {
      return NextResponse.json(
        { error: 'POI not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update POI: ' + error.message },
      { status: 500 }
    );
  }
}
