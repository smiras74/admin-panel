import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';

// GET - Fetch all pending counts for notifications
export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();

    const counts = {
      pois: 0,
      edits: 0,
      reviews: 0,
      reports: 0,
      total: 0,
    };

    // Pending POIs - check both 'pois' and 'custom_pois' collections
    try {
      // Check main 'pois' collection
      const poisSnapshot = await db.collection('pois')
        .where('status', '==', 'pending')
        .get();
      counts.pois = poisSnapshot.size;
      
      // Also check 'custom_pois' collection (user-submitted POIs)
      const customPoisSnapshot = await db.collection('custom_pois')
        .where('status', '==', 'pending')
        .get();
      counts.pois += customPoisSnapshot.size;
    } catch (e: any) {
      console.log('Error counting pending POIs:', e.message);
    }

    // Pending edits (poi_edits with status=pending)
    try {
      const editsSnapshot = await db.collection('poi_edits')
        .where('status', '==', 'pending')
        .get();
      counts.edits = editsSnapshot.size;
    } catch (e: any) {
      console.log('Error counting pending edits:', e.message);
    }

    // Pending reviews - fetch all and filter locally
    try {
      const reviewsSnapshot = await db.collection('reviews').limit(200).get();
      counts.reviews = reviewsSnapshot.docs.filter((doc: any) => {
        const status = doc.data().status;
        return status === 'pending';
      }).length;
    } catch (e: any) {
      console.log('Error counting pending reviews:', e.message);
    }

    // Pending reports - need to count both status=pending AND missing status
    try {
      // Get all reports and filter (because old reports might not have status field)
      const reportsSnapshot = await db.collection('reports').limit(200).get();
      counts.reports = reportsSnapshot.docs.filter((doc: any) => {
        const status = doc.data().status;
        return !status || status === 'pending';
      }).length;
    } catch (e: any) {
      console.log('Error counting pending reports:', e.message);
    }

    counts.total = counts.pois + counts.edits + counts.reviews + counts.reports;

    return NextResponse.json(counts, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('Error fetching pending counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch counts', pois: 0, edits: 0, reviews: 0, reports: 0, total: 0 },
      { status: 500, headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      }}
    );
  }
}
