import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

async function handleGET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    
    // No orderBy: it silently drops docs without `date` (older entries use createdAt)
    const snapshot = await db.collection('waitlist').limit(2000).get();
    
    const waitlist = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        name: data.name || '',
        lang: data.lang || 'fr',
        source: data.source || 'landing_page',
        createdAt: data.date?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    waitlist.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return NextResponse.json({
      waitlist,
      total: waitlist.length,
    });

  } catch (error) {
    console.error('Error fetching waitlist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch waitlist' },
      { status: 500 }
    );
  }
}

export const GET = withAdmin(handleGET);
