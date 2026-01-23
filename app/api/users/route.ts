import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { searchParams } = new URL(request.url);
    
    const search = searchParams.get('search')?.toLowerCase() || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';

    // Fetch users
    let query: any = db.collection('users');
    
    // Sort
    if (sortBy === 'createdAt') {
      query = query.orderBy('createdAt', 'desc');
    } else if (sortBy === 'totalCheckIns') {
      query = query.orderBy('totalCheckIns', 'desc');
    } else if (sortBy === 'totalKmTraveled') {
      query = query.orderBy('totalKmTraveled', 'desc');
    }
    
    const snapshot = await query.limit(200).get();
    
    let users = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email,
        displayName: data.displayName,
        firstName: data.firstName,
        lastName: data.lastName,
        avatarURL: data.avatarURL,
        role: data.role,
        level: data.level,
        points: data.points,
        totalCheckIns: data.totalCheckIns || data.checkInCount || 0,
        totalKmTraveled: data.totalKmTraveled || data.totalKm || 0,
        totalPOIsCreated: data.totalPOIsCreated || 0,
        totalRatings: data.totalRatings || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Filter by search (client-side for simplicity)
    if (search) {
      users = users.filter((user: any) => {
        const searchStr = `${user.displayName || ''} ${user.firstName || ''} ${user.lastName || ''} ${user.email || ''}`.toLowerCase();
        return searchStr.includes(search);
      });
    }

    return NextResponse.json({
      users,
      total: users.length,
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
