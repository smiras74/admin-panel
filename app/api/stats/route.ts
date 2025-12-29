import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();

    // Get counts in parallel
    const [
      usersCount,
      verifiedPoisCount,
      cachedPoisCount,
      customPoisCount,
      pendingModerationCount,
      waitlistCount,
    ] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('verified_pois').count().get(),
      db.collection('cached_pois').count().get(),
      db.collection('custom_pois').count().get(),
      db.collection('custom_pois').where('status', '==', 'pending').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('waitlist').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    ]);

    // Get aggregated stats from users
    const usersSnapshot = await db.collection('users').select('totalCheckIns', 'totalKm', 'totalKmTraveled').get();
    
    let totalCheckIns = 0;
    let totalKm = 0;
    
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalCheckIns += data.totalCheckIns || 0;
      totalKm += data.totalKm || data.totalKmTraveled || 0;
    });

    // Count pending edits and reviews (if collections exist)
    let pendingEdits = 0;
    let pendingReviews = 0;
    
    try {
      const editsCount = await db.collection('poi_edits').where('status', '==', 'pending').count().get();
      pendingEdits = editsCount.data().count;
    } catch (e) {
      // Collection might not exist
    }
    
    try {
      const reviewsCount = await db.collection('reviews').where('status', '==', 'pending').count().get();
      pendingReviews = reviewsCount.data().count;
    } catch (e) {
      // Collection might not exist
    }

    const stats = {
      totalUsers: usersCount.data().count,
      totalPOIs: {
        verified: verifiedPoisCount.data().count,
        cached: cachedPoisCount.data().count,
        custom: customPoisCount.data().count,
      },
      verifiedPOIs: verifiedPoisCount.data().count,
      cachedPOIs: cachedPoisCount.data().count,
      pendingModeration: pendingModerationCount.data().count,
      pendingEdits,
      pendingReviews,
      totalCheckIns,
      totalKm,
      waitlistCount: waitlistCount.data().count,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
