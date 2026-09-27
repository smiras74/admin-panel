// Backfill admin-only derived fields (searchTokens, hasPhoto, hasDescription, hasHours)
// on pois + verified_pois. Adds fields only — never changes existing data.
// Also mirrors photoUrls into `photos` where iOS would otherwise not see admin photos.
// Usage: node --env-file=.env.local scripts/backfill-derived.mjs [--apply]
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

const tokenize = t => Array.from(new Set((t || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(x => x.length >= 2))).slice(0, 25);
const readPhotos = d => {
  const out = []; const push = u => { if (typeof u === 'string' && u.trim() && !out.includes(u)) out.push(u); };
  (Array.isArray(d.photos) ? d.photos : []).forEach(push);
  (Array.isArray(d.photoUrls) ? d.photoUrls : []).forEach(push);
  push(d.photoUrl); return out;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const writer = db.bulkWriter();
let scanned = 0, toWrite = 0, photoSync = 0;
for (const col of ['pois', 'verified_pois']) {
  let last = null;
  while (true) {
    let q = db.collection(col).orderBy(admin.firestore.FieldPath.documentId()).limit(5000);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      scanned++;
      const d = doc.data();
      const photos = readPhotos(d);
      const upd = {
        searchTokens: tokenize(d.name),
        hasPhoto: photos.length > 0,
        hasDescription: typeof d.description === 'string' && d.description.trim().length > 0,
        hasHours: typeof d.openingHours === 'string' && d.openingHours.trim().length > 0,
      };
      if (photos.length && !same(d.photos, photos)) { upd.photos = photos; photoSync++; }
      const changed = Object.keys(upd).some(k => !same(d[k], upd[k]));
      if (!changed) continue;
      toWrite++;
      if (APPLY) writer.update(doc.ref, upd);
    }
    last = snap.docs[snap.docs.length - 1];
    process.stdout.write(`\r${col}: scanned ${scanned}, to write ${toWrite}`);
  }
}
if (APPLY) await writer.close();
console.log(`\nDone. scanned=${scanned} toWrite=${toWrite} photosMirrored=${photoSync} applied=${APPLY}`);
process.exit(0);
