import type { Firestore } from 'firebase-admin/firestore';

export const POI_COLLECTIONS = ['pois', 'verified_pois', 'cached_pois', 'custom_pois'] as const;

// Single deletion path for the whole admin (POIs page and reports).
//
// Why status 'rejected' and not 'deleted': the iOS app maps any unknown status
// to .published (POIService.parsePOIDocument), so 'deleted' POIs stay visible.
// 'rejected' is a known status and is filtered out (published only).
// `deleted: true` marks it as an admin deletion (vs. a moderation rejection).
//
// blocked_pois prevents the OSM tile copy of the same place from reappearing
// (POIService.mergePOIs skips blocked IDs).
//
// User data (visited, reviews, ratings) is intentionally kept: deletion is
// reversible and users keep their history/XP.
export async function softDeletePOI(
  db: Firestore,
  poiId: string,
  opts: { reason: string; reportId?: string; fallbackName?: string; fallbackLocation?: any }
) {
  const deletedFrom: string[] = [];
  let found: any = null;

  for (const col of POI_COLLECTIONS) {
    const ref = db.collection(col).doc(poiId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    found = found || snap.data();
    await ref.update({
      status: 'rejected',
      deleted: true,
      deletedAt: new Date(),
      deletedByAdmin: true,
      deletedReason: opts.reason,
    });
    deletedFrom.push(col);
  }

  const osmId =
    (found?.osmId != null ? String(found.osmId) : null) ||
    (/^(node|way|relation)\//.test(poiId) ? poiId : null);

  let location = opts.fallbackLocation || null;
  if (!location && found?.coordinate) location = found.coordinate;
  if (!location && found?.latitude != null && found?.longitude != null) {
    location = { latitude: found.latitude, longitude: found.longitude };
  }

  const block: Record<string, any> = {
    poiId,
    poiName: found?.name || opts.fallbackName || 'Unknown',
    reason: opts.reason,
    blockedAt: new Date(),
    blockedByAdmin: true,
  };
  if (osmId) block.osmId = osmId;
  if (location) block.location = location;
  if (opts.reportId) block.reportId = opts.reportId;
  await db.collection('blocked_pois').doc(poiId.replace(/\//g, '_')).set(block);

  return { deletedFrom, found: !!found };
}
