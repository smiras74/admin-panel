import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withAdmin } from '@/lib/admin-auth';
import { softDeletePOI } from '@/lib/poi-delete';

export const dynamic = 'force-dynamic';

async function handlePOST(request: NextRequest) {
  try {
    const { db } = getFirebaseAdmin();
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing POI id' }, { status: 400 });
    }

    const result = await softDeletePOI(db, id, { reason: 'admin' });

    if (!result.found) {
      return NextResponse.json({ error: 'POI not found in any collection' }, { status: 404 });
    }

    return NextResponse.json({ success: true, id, deletedFrom: result.deletedFrom });
  } catch (error: any) {
    console.error('Error deleting POI:', error);
    return NextResponse.json({ error: 'Failed to delete POI: ' + error.message }, { status: 500 });
  }
}

export const POST = withAdmin(handlePOST);
