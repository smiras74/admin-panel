import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withAdmin } from '@/lib/admin-auth';
import { softDeletePOI } from '@/lib/poi-delete';

export const dynamic = 'force-dynamic';

// GET - Fetch reports
async function handleGET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // Always fetch all reports then filter (because old reports might not have status field)
    // No orderBy/limit before filtering: old reports may lack createdAt/status
    const snapshot = await db.collection('reports').limit(2000).get();
    
    let reports = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        poiId: data.poiId,
        poiName: data.poiName || 'POI inconnu',
        type: data.type || 'incorrect',
        comment: data.comment || null,
        photoUrl: data.photoUrl || null,
        userId: data.userId,
        // Treat missing status as 'pending'
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        poiLocation: data.poiLocation ? {
          latitude: data.poiLocation.latitude || data.poiLocation._latitude,
          longitude: data.poiLocation.longitude || data.poiLocation._longitude,
        } : null,
      };
    });

    // Filter by status (on server side)
    if (status !== 'all') {
      reports = reports.filter(r => r.status === status);
    }
    reports.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

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
async function handlePOST(request: NextRequest) {
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

      case 'delete_poi': {
        // Same deletion path as the POIs page (see lib/poi-delete.ts)
        const targetPoiId = poiId || reportData?.poiId;
        if (targetPoiId) {
          await softDeletePOI(db, targetPoiId, {
            reason: `report:${reportData?.type || 'closed'}`,
            reportId,
            fallbackName: reportData?.poiName,
            fallbackLocation: reportData?.poiLocation,
          });
        }

        // Mark report as resolved
        await reportRef.update({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedByAdmin: true,
          poiDeleted: true,
        });
        break;
      }

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

export const GET = withAdmin(handleGET);
export const POST = withAdmin(handlePOST);
