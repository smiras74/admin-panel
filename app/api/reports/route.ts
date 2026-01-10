import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// GET - Fetch reports
export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let query = db.collection('reports').orderBy('createdAt', 'desc').limit(100);
    
    if (status !== 'all') {
      query = db.collection('reports')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(100);
    }

    const snapshot = await query.get();
    
    const reports = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        poiId: data.poiId,
        poiName: data.poiName || 'POI inconnu',
        type: data.type || 'incorrect',
        comment: data.comment || null,
        photoUrl: data.photoUrl || null,
        userId: data.userId,
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        poiLocation: data.poiLocation ? {
          latitude: data.poiLocation.latitude || data.poiLocation._latitude,
          longitude: data.poiLocation.longitude || data.poiLocation._longitude,
        } : null,
      };
    });

    return NextResponse.json({ reports });

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// POST - Handle report actions
export async function POST(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const body = await request.json();
    
    const { reportId, action, poiId } = body;
    
    if (!reportId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const reportRef = db.collection('reports').doc(reportId);
    const reportDoc = await reportRef.get();
    
    if (!reportDoc.exists) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const reportData = reportDoc.data();

    switch (action) {
      case 'resolve':
        // Mark report as resolved (confirmed issue)
        await reportRef.update({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedByAdmin: true,
        });
        break;

      case 'reject':
        // Mark report as reviewed but not actioned (false report)
        await reportRef.update({
          status: 'reviewed',
          reviewedAt: new Date(),
          reviewedByAdmin: true,
        });
        break;

      case 'delete_poi':
        // Delete the POI and mark report as resolved
        const targetPoiId = poiId || reportData?.poiId;
        
        if (targetPoiId) {
          // Try to delete from multiple collections
          const collections = ['pois', 'cached_pois', 'custom_pois', 'verified_pois'];
          
          for (const collection of collections) {
            try {
              const poiDoc = await db.collection(collection).doc(targetPoiId).get();
              if (poiDoc.exists) {
                // Option 1: Hard delete
                // await db.collection(collection).doc(targetPoiId).delete();
                
                // Option 2: Soft delete (mark as deleted)
                await db.collection(collection).doc(targetPoiId).update({
                  status: 'deleted',
                  deletedAt: new Date(),
                  deletedByAdmin: true,
                  deletedReason: `Report: ${reportData?.type || 'closed'}`,
                });
                
                console.log(`POI ${targetPoiId} marked as deleted in ${collection}`);
              }
            } catch (e) {
              // Collection might not have this POI, continue
            }
          }
        }
        
        // Mark report as resolved
        await reportRef.update({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedByAdmin: true,
          poiDeleted: true,
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, action, reportId });

  } catch (error) {
    console.error('Error processing report action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
