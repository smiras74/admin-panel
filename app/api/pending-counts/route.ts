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
        .count()
        .get();
      counts.pois = poisSnapshot.data().count;
    } catch (e) {
      // Index might not exist
    }

    // Pending edits (poi_edits with status=pending)
    try {
      const editsSnapshot = await db.collection('poi_edits')
        .where('status', '==', 'pending')
        .count()
        .get();
      counts.edits = editsSnapshot.data().count;
    } catch (e) {
      // Index might not exist
    }

    // Pending reviews
    try {
      const reviewsSnapshot = await db.collection('reviews')
        .where('status', '==', 'pending')
        .count()
        .get();
      counts.reviews = reviewsSnapshot.data().count;
    } catch (e) {
      // Index might not exist
    }

    // Pending reports
    try {
      const reportsSnapshot = await db.collection('reports')
        .where('status', '==', 'pending')
        .count()
        .get();
      counts.reports = reportsSnapshot.data().count;
    } catch (e) {
      // Index might not exist
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
