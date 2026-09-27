import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/admin-auth';
import { fetchWikipediaSummary } from '@/lib/wikipedia';

export const dynamic = 'force-dynamic';

// Real Wikipedia enrichment (fr.wikipedia.org): geosearch near the POI (1 km) with a
// name match, or a strict title search when there are no coordinates. Nothing is generated.
async function handlePOST(request: NextRequest) {
  try {
    const { name, latitude, longitude } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const wiki = await fetchWikipediaSummary(name, latitude, longitude);
    if (!wiki) return NextResponse.json({ success: true, found: false });

    return NextResponse.json({
      success: true,
      found: true,
      title: wiki.title,
      description: wiki.extract,
      photoUrl: wiki.photoUrl,
      sourceUrl: wiki.sourceUrl,
    });
  } catch (error: any) {
    console.error('Wikipedia enrichment error:', error);
    return NextResponse.json({ error: 'Wikipedia enrichment failed: ' + error.message }, { status: 500 });
  }
}

export const POST = withAdmin(handlePOST);
