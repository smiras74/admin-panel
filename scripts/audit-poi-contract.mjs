// READ-ONLY diagnostic: how many POIs break the iOS contract (photos field, taxonomy).
// Usage: node --env-file=.env.local scripts/audit-poi-contract.mjs
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

const SUBS = {
  nature: ['forets','lacs','montagnes','grottes','cascades','plages','panoramas'],
  histoire: ['chateaux','ruines','eglises','monuments','musees','architecture','artefact','lavoirs','moulins','village_classe'],
  hedonisme: ['vignobles','brasseries','marches','fermes','fromageries','gastronomie','brocantes','chambres_dhotes','aires_repos','bars'],
  curiosites: ['abandonne','legendes','street_art','villages_fantomes','insolite','evenements','eoliennes'],
  services: ['fuel','charging_station','camp_site','caravan_site','picnic_site'],
};
const ALL_SUBS = new Set(Object.values(SUBS).flat());

const stats = { total: 0, photosOnly: 0, photoUrlsOnly: 0, both: 0, badCat: {}, badSub: {}, subWrongParent: 0, adminEditedBad: 0 };
let last = null;
while (true) {
  let q = db.collection('pois').orderBy(admin.firestore.FieldPath.documentId()).limit(5000)
    .select('photos', 'photoUrls', 'photoUrl', 'category', 'subcategory', 'updatedByAdmin');
  if (last) q = q.startAfter(last);
  const snap = await q.get();
  if (snap.empty) break;
  for (const d of snap.docs) {
    const x = d.data(); stats.total++;
    const hasP = Array.isArray(x.photos) && x.photos.length > 0;
    const hasU = (Array.isArray(x.photoUrls) && x.photoUrls.length > 0) || !!x.photoUrl;
    if (hasP && !hasU) stats.photosOnly++; else if (!hasP && hasU) stats.photoUrlsOnly++; else if (hasP && hasU) stats.both++;
    const cat = x.category, sub = x.subcategory;
    let bad = false;
    if (!SUBS[cat]) { stats.badCat[cat] = (stats.badCat[cat] || 0) + 1; bad = true; }
    if (sub) {
      if (!ALL_SUBS.has(sub)) { stats.badSub[sub] = (stats.badSub[sub] || 0) + 1; bad = true; }
      else if (SUBS[cat] && !SUBS[cat].includes(sub)) { stats.subWrongParent++; bad = true; }
    }
    if (bad && x.updatedByAdmin) stats.adminEditedBad++;
  }
  last = snap.docs[snap.docs.length - 1];
}
const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log(JSON.stringify({ ...stats, badCat: top(stats.badCat), badSub: top(stats.badSub) }, null, 1));
process.exit(0);
