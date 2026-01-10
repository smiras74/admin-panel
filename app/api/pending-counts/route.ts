import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

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

    // Pending POIs (custom_pois with status=pending)
    try {
      const poisSnapshot = await db.collection('custom_pois')
        .where('status', '==', 'pending')
        .get();
      counts.pois = poisSnapshot.size;
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

    // Pending reviews
    try {
      const reviewsSnapshot = await db.collection('reviews')
        .where('status', '==', 'pending')
        .get();
      counts.reviews = reviewsSnapshot.size;
    } catch (e: any) {
      console.log('Error counting pending reviews:', e.message);
    }

    // Pending reports
    try {
      const reportsSnapshot = await db.collection('reports')
        .where('status', '==', 'pending')
        .get();
      counts.reports = reportsSnapshot.size;
    } catch (e: any) {
      console.log('Error counting pending reports:', e.message);
    }

    counts.total = counts.pois + counts.edits + counts.reviews + counts.reports;

    return NextResponse.json(counts);

  } catch (error) {
    console.error('Error fetching pending counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch counts', pois: 0, edits: 0, reviews: 0, reports: 0, total: 0 },
      { status: 500 }
    );
  }
}
