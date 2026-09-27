// READ-ONLY: measure Wikipedia enrichment quality on real POIs without description.
// Usage: node --env-file=.env.local scripts/wiki-quality.mjs
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const UA = { 'User-Agent': 'GuideDuDetourAdmin/1.0 (admin panel)' };
const tok = t => Array.from(new Set((t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9]+/).filter(x => x.length >= 2)));
const STOP = new Set(['le','la','les','de','du','des','et','en','au','aux','sur','saint','sainte','st']);
const score = (n, t) => { const a = tok(n).filter(x => !STOP.has(x)); const b = new Set(tok(t)); return a.length ? a.filter(x => b.has(x)).length / a.length : 0; };

const snap = await db.collection('pois').where('category', '==', 'histoire').where('hasDescription', '==', false).limit(400).get();
const sample = snap.docs.filter((_, i) => i % 10 === 0).slice(0, 40);
let geoHit = 0, geo3Hit = 0, lens = [], fullLens = [];
for (const d of sample) {
  const x = d.data();
  const lat = x.latitude ?? x.coordinate?.latitude, lon = x.longitude ?? x.coordinate?.longitude;
  if (lat == null) continue;
  const best = async radius => {
    const r = await fetch(`https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=50&format=json`, { headers: UA });
    const p = ((await r.json()).query?.geosearch || []).map(g => ({ t: g.title, s: score(x.name, g.title) })).sort((a, b) => b.s - a.s)[0];
    return p && p.s >= 0.66 ? p.t : null;
  };
  const t1 = await best(1000); const t3 = t1 || await best(3000);
  if (t1) geoHit++; if (t3) geo3Hit++;
  let line = `${x.name.slice(0, 40).padEnd(40)} | 1km:${t1 ? 'Y' : '-'} 3km:${t3 ? 'Y' : '-'}`;
  if (t3) {
    const s = await (await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t3.replace(/ /g, '_'))}`, { headers: UA })).json();
    const e = await (await fetch(`https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exintro=1&titles=${encodeURIComponent(t3)}&format=json`, { headers: UA })).json();
    const full = Object.values(e.query.pages)[0].extract || '';
    lens.push((s.extract || '').length); fullLens.push(full.length);
    line += ` | summary ${(s.extract || '').length} ch, full intro ${full.length} ch | ${t3}`;
  }
  console.log(line);
}
const avg = a => a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0;
console.log(`\nsample=${sample.length} found@1km=${geoHit} found@3km=${geo3Hit} avgSummary=${avg(lens)} avgFullIntro=${avg(fullLens)}`);
process.exit(0);
