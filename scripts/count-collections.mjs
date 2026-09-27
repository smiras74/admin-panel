// READ-ONLY: sizes of POI collections and status breakdown.
// Usage: node --env-file=.env.local scripts/count-collections.mjs
import admin from 'firebase-admin';
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
for (const c of ['pois', 'verified_pois', 'cached_pois', 'custom_pois', 'blocked_pois', 'poi_edits', 'reviews', 'reports', 'waitlist', 'users']) {
  const n = (await db.collection(c).count().get()).data().count;
  console.log(c.padEnd(14), n);
}
for (const s of ['published', 'pending', 'rejected', 'deleted', 'approved']) {
  const n = (await db.collection('pois').where('status', '==', s).count().get()).data().count;
  console.log('pois status=' + s, n);
}
const noDate = (await db.collection('waitlist').get()).docs.filter(d => !d.data().date).length;
console.log('waitlist without date:', noDate);
const noCreated = (await db.collection('users').get()).docs.filter(d => !d.data().createdAt).length;
console.log('users without createdAt:', noCreated);
process.exit(0);
