// Clean junk-named POIs and merge plain-id / osm_-id duplicates.
// Dry-run by default; --apply writes. Nothing is hard-deleted.
//
// Canonical copy = the PLAIN id: it is what the iOS app shows today
// (POIService.deduplicatePOIs prefers non-osm_ docs) and where the app writes
// check-in / rating counters (CheckInService strips "osm_"). The osm_ copy is merged
// into it and hidden (status rejected + mergedInto), NOT blocked.
// Junk names are soft-deleted like everywhere in the admin (status rejected +
// deleted:true + blocked_pois).
// Usage: node --env-file=.env.local scripts/clean-junk-merge-dups.mjs [--apply]
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const JUNK = ['POI', 'Sans nom', 'Unnamed', 'Unknown', ''];
const now = new Date();

const tokenize = t => Array.from(new Set((t || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(x => x.length >= 2))).slice(0, 25);
const readPhotos = d => {
  const out = []; const push = u => { if (typeof u === 'string' && u.trim() && !out.includes(u)) out.push(u); };
  [d.photos, d.photoUrls].forEach(a => Array.isArray(a) && a.forEach(push)); push(d.photoUrl); push(d.photoURL); return out;
};
const empty = v => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

// Load all pois
const all = new Map();
let last = null;
while (true) {
  let q = db.collection('pois').orderBy(admin.firestore.FieldPath.documentId()).limit(5000);
  if (last) q = q.startAfter(last);
  const s = await q.get();
  if (s.empty) break;
  s.docs.forEach(d => all.set(d.id, d.data()));
  last = s.docs[s.docs.length - 1];
}

// ---------- user references to the ids we are about to hide ----------
async function refCount(ids) {
  const out = {};
  const chunks = []; for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  for (const [label, q] of [
    ['ratings', c => db.collection('ratings').where('poiId', 'in', c)],
    ['reviews', c => db.collection('reviews').where('poiId', 'in', c)],
    ['visited', c => db.collectionGroup('visited').where('poiId', 'in', c)],
    ['favorites', c => db.collectionGroup('favorites').where('poiId', 'in', c)],
    ['poi_edits', c => db.collection('poi_edits').where('poiId', 'in', c)],
    ['reports', c => db.collection('reports').where('poiId', 'in', c)],
  ]) {
    let n = 0;
    for (const c of chunks) n += (await q(c).get().catch(() => ({ size: 0 }))).size;
    out[label] = n;
  }
  return out;
}

const junk = [...all.entries()].filter(([, p]) => JUNK.includes((p.name || '').trim()) || (p.name || '').trim().length < 2);
const pairs = [...all.keys()].filter(id => !id.startsWith('osm_') && all.has('osm_' + id)).map(id => [id, 'osm_' + id]);

console.log(`junk=${junk.length} pairs=${pairs.length} apply=${APPLY}`);
console.log('refs to junk ids:', await refCount(junk.map(([id]) => id)));
console.log('refs to osm_ ids to hide:', await refCount(pairs.map(([, o]) => o)));

const MERGE_FIELDS = ['description', 'shortDescription', 'subcategory', 'openingHours', 'website', 'phone',
  'wikidataId', 'wikipediaId', 'wikipedia', 'geohash'];
const batch = db.bulkWriter();
const conflicts = [];
let merged = 0, hidden = 0, deleted = 0;

for (const [plainId, osmId] of pairs) {
  const p = all.get(plainId), o = all.get(osmId);
  const upd = {};
  for (const f of MERGE_FIELDS) if (empty(p[f]) && !empty(o[f])) upd[f] = o[f];
  const photos = [...readPhotos(p), ...readPhotos(o)].filter((u, i, a) => a.indexOf(u) === i);
  if (photos.length !== readPhotos(p).length) Object.assign(upd, { photos, photoUrls: photos, photoUrl: photos[0] || '' });
  upd.checkInCount = Math.max(p.checkInCount || 0, 0) + Math.max(o.checkInCount || 0, 0);
  if (!p.ratingCount && o.ratingCount) Object.assign(upd, { averageRating: o.averageRating, ratingCount: o.ratingCount });
  if ((p.name || '').trim() !== (o.name || '').trim()) {
    conflicts.push(`${plainId}: gardé "${p.name}" (osm: "${o.name}")`);
    upd.osmName = o.name; // keep the OSM name visible for manual review
  }
  const final = { ...p, ...upd };
  Object.assign(upd, {
    searchTokens: tokenize(final.name),
    hasPhoto: photos.length > 0,
    hasDescription: [final.description, final.shortDescription].some(d => typeof d === 'string' && d.trim()),
    hasHours: typeof final.openingHours === 'string' && final.openingHours.trim().length > 0,
    mergedFrom: osmId, mergedAt: now,
  });
  merged++;
  if (APPLY) {
    batch.update(db.collection('pois').doc(plainId), upd);
    batch.update(db.collection('pois').doc(osmId), {
      status: 'rejected', mergedInto: plainId, mergedAt: now, hiddenReason: 'duplicate',
    });
  }
  hidden++;
}

for (const [id, p] of junk) {
  deleted++;
  if (!APPLY) continue;
  batch.update(db.collection('pois').doc(id), {
    status: 'rejected', deleted: true, deletedAt: now, deletedByAdmin: true, deletedReason: 'junk-name',
  });
  const block = { poiId: id, poiName: p.name || '', reason: 'junk-name', blockedAt: now, blockedByAdmin: true };
  if (p.latitude != null) block.location = { latitude: p.latitude, longitude: p.longitude };
  batch.set(db.collection('blocked_pois').doc(id), block);
  // Also block the Overpass form of the id (iOS OverpassService uses "osm_<id>")
  if (!id.startsWith('osm_')) batch.set(db.collection('blocked_pois').doc('osm_' + id), { ...block, poiId: 'osm_' + id });
}

if (APPLY) await batch.close();
console.log(`merged=${merged} hiddenDuplicates=${hidden} junkDeleted=${deleted}`);
console.log('name conflicts:\n  ' + conflicts.join('\n  '));
process.exit(0);
