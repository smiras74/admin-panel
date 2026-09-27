// Smoke test of the production admin API as an admin user. GET/read-only calls only
// (enrich endpoints do not write). Prints counts, never personal data.
// Usage: node --env-file=.env.local scripts/smoke-prod.mjs
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const BASE = 'https://admin-panel-orcin-one.vercel.app';
const adminDoc = (await admin.firestore().collection('users').where('role', '==', 'admin').limit(1).get()).docs[0];
const custom = await admin.auth().createCustomToken(adminDoc.id);
const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
const idToken = (await ex.json()).idToken;
const H = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };

const get = async p => { const r = await fetch(BASE + p, { headers: H }); return [r.status, await r.json()]; };
const post = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }); return [r.status, await r.json()]; };

let [s, d] = await get('/api/stats');
console.log('stats', s, { pois: d.totalPOIs, pendingModeration: d.pendingModeration, withPhoto: d.contentStats?.withPhoto, withDescription: d.contentStats?.withDescription, waitlist: d.waitlistCount });
[s, d] = await get('/api/pois?page=1&limit=50&sortBy=name&sortOrder=asc');
console.log('pois browse', s, { listed: d.pagination?.totalCount, pages: d.pagination?.totalPages, got: d.pois?.length, sortApplied: d.sortApplied });
[s, d] = await get('/api/pois?page=40&limit=50&category=histoire&content=with-photo');
console.log('pois histoire+photo p40', s, { total: d.pagination?.totalCount, got: d.pois?.length, stats: d.contentStats });
[s, d] = await get('/api/pois?search=' + encodeURIComponent('brocante serris'));
console.log('search "brocante serris"', s, d.pois?.map(p => p.name));
[s, d] = await get('/api/waitlist');
console.log('waitlist', s, { listed: d.total });
[s, d] = await get('/api/pending-counts');
console.log('pending-counts', s, d);
[s, d] = await get('/api/reports?status=all');
console.log('reports', s, { listed: d.reports?.length });
[s, d] = await post('/api/pois/enrich', { name: 'Château de Fontainebleau', latitude: 48.4021, longitude: 2.6997 });
console.log('wiki Fontainebleau', s, { found: d.found, title: d.title, hasPhoto: !!d.photoUrl });
[s, d] = await post('/api/pois/enrich', { name: 'La Brocante de Serris', latitude: 48.8537, longitude: 2.7856 });
console.log('wiki Brocante Serris', s, { found: d.found, title: d.title });
[s, d] = await post('/api/pois/enrich-ai', { name: 'Lavoir du Ru de Zzqx', category: 'histoire', latitude: 48.9, longitude: 2.9 });
console.log('AI unknown place', s, d.error || d.description?.slice(0, 80));
process.exit(0);
