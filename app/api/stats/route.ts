import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    
    const poisCollection = db.collection('pois');
    
    // Get counts in parallel
    const [
      usersCount,
      totalPoisCount,
      pendingModerationCount,
      waitlistCount,
      // Content stats - POI с фото
      withPhotoCount,
      // Content stats - POI с описанием
      withDescriptionCount,
    ] = await Promise.all([
      db.collection('users').count().get(),
      poisCollection.count().get(),
      poisCollection.where('status', '==', 'pending').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('waitlist').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      // POI с фото (photoUrls существует и не пустой)
      poisCollection.where('photoUrls', '!=', []).count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      // POI с описанием
      poisCollection.where('description', '!=', '').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
    ]);
    
    // Get aggregated stats from users
    const usersSnapshot = await db.collection('users').select('totalCheckIns', 'totalKm', 'totalKmTraveled').get();
    
    let totalCheckIns = 0;
    let totalKm = 0;
    
    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalCheckIns += data.totalCheckIns || 0;
      const km = data.totalKmTraveled || data.totalKm || 0;
      totalKm += km;
    });

    console.log(`Stats: ${usersSnapshot.size} users, totalCheckIns=${totalCheckIns}, totalKm=${totalKm}`);
    
    // Count pending edits and reviews
    let pendingEdits = 0;
    let pendingReviews = 0;
    let totalReviews = 0;
    
    try {
      const editsCount = await db.collection('poi_edits').where('status', '==', 'pending').count().get();
      pendingEdits = editsCount.data().count;
    } catch (e) {
      // Collection might not exist
    }
    
    try {
      const [totalReviewsCount, pendingReviewsCount] = await Promise.all([
        db.collection('reviews').count().get(),
        db.collection('reviews').where('status', '==', 'pending').count().get(),
      ]);
      totalReviews = totalReviewsCount.data().count;
      pendingReviews = pendingReviewsCount.data().count;
    } catch (e) {
      // Collection might not exist
    }
    
    const total = totalPoisCount.data().count;
    const withPhoto = withPhotoCount.data().count;
    const withDescription = withDescriptionCount.data().count;
    
    const stats = {
      totalUsers: usersCount.data().count,
      totalPOIs: total,
      // Content stats
      contentStats: {
        withPhoto,
        withDescription,
        toEnrich: total - withDescription, // POI без описания
      },
      pendingModeration: pendingModerationCount.data().count,
      pendingEdits,
      pendingReviews,
      totalReviews,
      totalCheckIns,
      totalKm,
      waitlistCount: waitlistCount.data().count,
    };
    
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
