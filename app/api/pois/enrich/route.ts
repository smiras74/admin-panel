import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { withAdmin } from '@/lib/admin-auth';
import { fetchWikipediaSummary } from '@/lib/wikipedia';
import { findPoiData } from '@/lib/poi-lookup';

export const dynamic = 'force-dynamic';

// Real Wikipedia enrichment. Uses the POI's OSM wikidataId when present (exact article),
// otherwise geosearch 1 km -> 3 km with a name match. Nothing is generated.
async function handlePOST(request: NextRequest) {
  try {
    const { id, collection, name, latitude, longitude } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const { db } = getFirebaseAdmin();
    const poi = await findPoiData(db, id, collection).catch(() => null);
    const lat = typeof latitude === 'number' ? latitude : poi?.latitude;
    const lon = typeof longitude === 'number' ? longitude : poi?.longitude;

    const wiki = await fetchWikipediaSummary(name, lat, lon, poi?.wikidataId || null);
    if (!wiki) return NextResponse.json({ success: true, found: false });

    return NextResponse.json({
      success: true,
      found: true,
      title: wiki.title,
      description: wiki.extract,
      photoUrl: wiki.photoUrl,
      sourceUrl: wiki.sourceUrl,
      matchedBy: wiki.matchedBy,
    });
  } catch (error: any) {
    console.error('Wikipedia enrichment error:', error);
    return NextResponse.json({ error: 'Wikipedia enrichment failed: ' + error.message }, { status: 500 });
  }
}

export const POST = withAdmin(handlePOST);
