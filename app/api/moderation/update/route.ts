import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// POST - Update a pending POI before approval
export async function POST(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const body = await request.json();
    
    const { id, collection, updates } = body;

    if (!id || !collection || !updates) {
      return NextResponse.json(
        { error: 'Missing required fields: id, collection, updates' },
        { status: 400 }
      );
    }

    // Validate collection
    const allowedCollections = ['custom_pois', 'pois', 'cached_pois', 'verified_pois'];
    if (!allowedCollections.includes(collection)) {
      return NextResponse.json(
        { error: 'Invalid collection' },
        { status: 400 }
      );
    }

    // Get the document
    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'POI not found' },
        { status: 404 }
      );
    }

    // Check if still pending
    const data = doc.data();
    if (data?.status !== 'pending') {
      return NextResponse.json(
        { error: 'POI is not in pending status' },
        { status: 400 }
      );
    }

    // Prepare clean updates (only allowed fields)
    const cleanUpdates: Record<string, any> = {};
    
    if (updates.name?.trim()) {
      cleanUpdates.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      cleanUpdates.description = updates.description.trim();
    }
    if (updates.category?.trim()) {
      cleanUpdates.category = updates.category.trim();
    }
    if (updates.subcategory !== undefined) {
      cleanUpdates.subcategory = updates.subcategory.trim();
    }
    if (updates.openingHours !== undefined) {
      cleanUpdates.openingHours = updates.openingHours.trim();
    }

    // Add modification timestamp
    cleanUpdates.modifiedAt = new Date();
    cleanUpdates.modifiedBy = 'admin';

    // Update the document
    await docRef.update(cleanUpdates);

    console.log(`Updated POI ${id} in ${collection}:`, cleanUpdates);

    return NextResponse.json({
      success: true,
      id,
      collection,
      updates: cleanUpdates,
    });

  } catch (error) {
    console.error('Error updating POI:', error);
    return NextResponse.json(
      { error: 'Failed to update POI' },
      { status: 500 }
    );
  }
}
