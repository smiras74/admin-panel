// READ-ONLY: run the production Wikipedia enrichment on real POIs without description.
// Usage: node --env-file=.env.local scripts/wiki-prod-check.mjs
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const BASE = 'https://admin-panel-orcin-one.vercel.app';
const adminDoc = (await db.collection('users').where('role', '==', 'admin').limit(1).get()).docs[0];
const custom = await admin.auth().createCustomToken(adminDoc.id);
const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
const H = { Authorization: `Bearer ${(await ex.json()).idToken}`, 'Content-Type': 'application/json' };

const pool = (await db.collection('pois').where('category', '==', 'histoire').where('hasDescription', '==', false).limit(3000).get()).docs;
const withWd = pool.filter(d => d.data().wikidataId);
const plain = pool.filter(d => !d.data().wikidataId);
const sample = [...withWd.filter((_, i) => i % 20 === 0).slice(0, 10), ...plain.filter((_, i) => i % 60 === 0).slice(0, 10)];

let found = 0, withText = 0, withPhoto = 0, chars = [];
for (const d of sample) {
  const x = d.data();
  const r = await fetch(BASE + '/api/pois/enrich', { method: 'POST', headers: H,
    body: JSON.stringify({ id: d.id, collection: 'pois', name: x.name, latitude: x.latitude, longitude: x.longitude }) });
  const j = await r.json();
  if (j.found) found++;
  if (j.description) { withText++; chars.push(j.description.length); }
  if (j.photoUrl) withPhoto++;
  console.log(`${(x.wikidataId ? 'WD ' : '   ')}${x.name.slice(0, 38).padEnd(38)} ${r.status} ${j.found ? j.matchedBy.padEnd(8) : '—'.padEnd(8)} ${j.description ? j.description.length + ' ch' : ''} ${j.photoUrl ? '📷' : ''} ${j.title || j.error || ''}`);
  await new Promise(res => setTimeout(res, 800));
}
const avg = chars.length ? Math.round(chars.reduce((a, b) => a + b, 0) / chars.length) : 0;
console.log(`\nsample=${sample.length} found=${found} withText=${withText} withPhoto=${withPhoto} avgChars=${avg}`);
process.exit(0);
