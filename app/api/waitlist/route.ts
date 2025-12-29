import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    
    const snapshot = await db.collection('waitlist')
      .orderBy('date', 'desc')
      .limit(500)
      .get();
    
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
