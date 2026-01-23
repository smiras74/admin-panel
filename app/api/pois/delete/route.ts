import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const body = await request.json();
    
    const { id, source } = body;
    
    console.log('Delete POI request:', { id, source });
    
    if (!id) {
      return NextResponse.json(
        { error: 'Missing POI id' },
        { status: 400 }
      );
    }

    // Try to find the POI in various collections
    const collectionsToCheck = ['pois', 'verified_pois', 'cached_pois', 'custom_pois'];
    let deletedFrom: string | null = null;
    
    for (const collectionName of collectionsToCheck) {
      const docRef = db.collection(collectionName).doc(id);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        // Found the document - delete it
        await docRef.delete();
        deletedFrom = collectionName;
        console.log(`POI deleted from ${collectionName}: ${id}`);
        break;
      }
    }
    
    if (!deletedFrom) {
      return NextResponse.json(
        { error: 'POI not found in any collection' },
        { status: 404 }
      );
    }

    // Also delete related data (optional but recommended)
    try {
      // Delete ratings for this POI
      const ratingsSnapshot = await db.collection('ratings')
        .where('poiId', '==', id)
        .get();
      
      const ratingDeletes = ratingsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(ratingDeletes);
      console.log(`Deleted ${ratingsSnapshot.size} ratings for POI ${id}`);
      
      // Delete check-ins for this POI
      const checkInsSnapshot = await db.collection('checkIns')
        .where('poiId', '==', id)
        .get();
      
      const checkInDeletes = checkInsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(checkInDeletes);
      console.log(`Deleted ${checkInsSnapshot.size} check-ins for POI ${id}`);
      
      // Delete comments/reviews for this POI
      const commentsSnapshot = await db.collection('comments')
        .where('poiId', '==', id)
        .get();
      
      const commentDeletes = commentsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(commentDeletes);
      console.log(`Deleted ${commentsSnapshot.size} comments for POI ${id}`);
      
    } catch (cleanupError) {
      // Log but don't fail if cleanup has issues
      console.warn('Error cleaning up related data:', cleanupError);
    }

    return NextResponse.json({
      success: true,
      id,
      deletedFrom,
      message: `POI successfully deleted from ${deletedFrom}`,
    });

  } catch (error: any) {
    console.error('Error deleting POI:', error);
    
    return NextResponse.json(
      { error: 'Failed to delete POI: ' + error.message },
      { status: 500 }
    );
  }
}
