// READ-ONLY: list junk-named POIs and plain-id / osm_-id duplicate pairs.
// Usage: node --env-file=.env.local scripts/list-junk-duplicates.mjs > /tmp/junk.txt
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const JUNK = ['POI', 'Sans nom', 'Unnamed', 'Unknown', ''];

const all = [];
let last = null;
while (true) {
  let q = db.collection('pois').orderBy(admin.firestore.FieldPath.documentId()).limit(5000)
    .select('name', 'category', 'subcategory', 'status', 'source', 'latitude', 'longitude', 'description', 'photos', 'photoUrls', 'wikidataId', 'ratingCount', 'checkInCount');
  if (last) q = q.startAfter(last);
  const s = await q.get();
  if (s.empty) break;
  s.docs.forEach(d => all.push({ id: d.id, ...d.data() }));
  last = s.docs[s.docs.length - 1];
}
const byId = new Map(all.map(p => [p.id, p]));

const junk = all.filter(p => JUNK.includes((p.name || '').trim()) || (p.name || '').trim().length < 2);
console.log(`=== JUNK NAMES: ${junk.length}`);
junk.forEach(p => console.log([p.id, JSON.stringify(p.name), p.category, p.subcategory || '', p.source || '', p.status || '',
  `${p.latitude?.toFixed?.(5)},${p.longitude?.toFixed?.(5)}`].join(' | ')));

const pairs = all.filter(p => !p.id.startsWith('osm_') && byId.has('osm_' + p.id));
console.log(`\n=== DUPLICATE PAIRS (plain id + osm_id): ${pairs.length}`);
const info = p => `desc:${(p.description || '').length} photos:${(p.photos || p.photoUrls || []).length} wd:${p.wikidataId ? 'Y' : '-'} ratings:${p.ratingCount || 0} checkins:${p.checkInCount || 0} src:${p.source || ''}`;
pairs.forEach(p => {
  const o = byId.get('osm_' + p.id);
  console.log(`${p.id} "${p.name}" [${info(p)}]  <->  osm_${p.id} "${o.name}" [${info(o)}]`);
});
process.exit(0);
