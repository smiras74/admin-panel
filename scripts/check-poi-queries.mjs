// READ-ONLY: verify that the /api/pois query shapes run without composite indexes.
// Usage: node --env-file=.env.local scripts/check-poi-queries.mjs
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const P = db.collection('pois');
const DOC = admin.firestore.FieldPath.documentId();
const run = async (label, fn) => {
  try { console.log('OK  ', label, '→', await fn()); }
  catch (e) { console.log('FAIL', label, '→', e.message.split('\n')[0].slice(0, 160)); }
};
await run('browse all by name p3', async () => (await P.orderBy('name').offset(100).limit(50).get()).size);
await run('count orderBy averageRating', async () => (await P.orderBy('averageRating').count().get()).data().count);
await run('cat+sub+hasPhoto by docId', async () =>
  (await P.where('category', '==', 'histoire').where('subcategory', '==', 'chateaux').where('hasPhoto', '==', true)
    .orderBy(DOC).limit(50).get()).size);
await run('count cat + complete', async () =>
  (await P.where('category', '==', 'nature').where('hasPhoto', '==', true).where('hasDescription', '==', true).count().get()).data().count);
await run('count empty', async () =>
  (await P.where('hasPhoto', '==', false).where('hasDescription', '==', false).count().get()).data().count);
await run('search token "brocante"', async () =>
  (await P.where('searchTokens', 'array-contains', 'brocante').limit(300).get()).docs.map(d => d.data().name).slice(0, 5));
await run('search token "serris"', async () =>
  (await P.where('searchTokens', 'array-contains', 'serris').limit(300).get()).docs.map(d => d.data().name).slice(0, 5));
process.exit(0);
