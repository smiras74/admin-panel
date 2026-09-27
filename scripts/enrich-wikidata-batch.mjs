// Batch enrichment of POIs from Wikidata / fr.wikipedia / Wikimedia Commons.
// Only real sources, only EMPTY fields are filled, every write is tagged with
// `enrichmentBatch` so the batch can be reviewed (/pois?batch=...) and rolled back.
//
// Usage:
//   node --env-file=.env.local scripts/enrich-wikidata-batch.mjs --limit 200 --batch trial-2026-09-27 [--apply]
//   node --env-file=.env.local scripts/enrich-wikidata-batch.mjs --rollback trial-2026-09-27 [--apply]
import admin from 'firebase-admin';
import fs from 'node:fs';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(arg('--limit', '200'));
const BATCH = arg('--batch', `wd-${new Date().toISOString().slice(0, 10)}`);
const ROLLBACK = arg('--rollback', null);
const MIN_DESC = 80; // shorter intros are stubs ("église située à X") — not worth a description
const UA = { 'User-Agent': 'GuideDuDetourAdmin/1.0 (https://detours.studio) POI-batch-enrichment' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
  const r = await fetch(url, { headers: UA });
  if ((r.status === 429 || r.status >= 500) && attempt < 4) { await sleep(2000 * (attempt + 1)); return getJson(url, attempt + 1); }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.slice(0, 90)}`);
  return r.json();
}
const tokenize = t => Array.from(new Set((t || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(x => x.length >= 2))).slice(0, 25);
const readPhotos = d => {
  const out = []; const push = u => { if (typeof u === 'string' && u.trim() && !out.includes(u)) out.push(u); };
  [d.photos, d.photoUrls].forEach(a => Array.isArray(a) && a.forEach(push)); push(d.photoUrl); push(d.photoURL); return out;
};
const hasText = d => [d.description, d.shortDescription].some(x => typeof x === 'string' && x.trim());
const stripHtml = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function cleanIntro(text, max = 1400) {
  const paras = text.replace(/\s*\(\s*(?:Écouter|prononcé)[^)]*\)/g, '').split(/\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let out = '';
  for (const p of paras) {
    if ((out + '\n\n' + p).length > max) {
      if (!out) { const c = p.slice(0, max); const e = c.lastIndexOf('. '); out = e > 200 ? c.slice(0, e + 1) : c; }
      break;
    }
    out = out ? `${out}\n\n${p}` : p;
  }
  return out;
}

// ---------------- ROLLBACK ----------------
if (ROLLBACK) {
  const snap = await db.collection('pois').where('enrichmentBatch', '==', ROLLBACK).get();
  const w = db.bulkWriter();
  for (const d of snap.docs) {
    const fields = d.data().enrichment?.fields || [];
    const upd = { enrichmentBatch: FV.delete(), enrichment: FV.delete() };
    if (fields.includes('description')) Object.assign(upd, { description: FV.delete(), descriptionSource: FV.delete(), descriptionSourceUrl: FV.delete(), hasDescription: false });
    if (fields.includes('photo')) Object.assign(upd, { photos: FV.delete(), photoUrls: FV.delete(), photoUrl: FV.delete(), photoSource: FV.delete(), photoCredit: FV.delete(), photoLicense: FV.delete(), photoSourceUrl: FV.delete(), hasPhoto: false });
    if (APPLY) w.update(d.ref, upd);
  }
  if (APPLY) await w.close();
  console.log(`rollback ${ROLLBACK}: ${snap.size} docs ${APPLY ? 'reverted' : '(dry run)'}`);
  process.exit(0);
}

// ---------------- SELECT CANDIDATES ----------------
const cands = [];
let last = null;
while (true) {
  let q = db.collection('pois').orderBy(admin.firestore.FieldPath.documentId()).limit(5000)
    .select('name', 'category', 'wikidataId', 'status', 'deleted', 'mergedInto', 'enrichmentBatch',
      'description', 'shortDescription', 'photos', 'photoUrls', 'photoUrl', 'photoURL', 'latitude', 'longitude');
  if (last) q = q.startAfter(last);
  const s = await q.get();
  if (s.empty) break;
  for (const d of s.docs) {
    const x = d.data();
    if (!/^Q\d+$/.test(x.wikidataId || '')) continue;
    if ((x.status && x.status !== 'published') || x.deleted || x.mergedInto || x.enrichmentBatch) continue;
    const needText = !hasText(x), needPhoto = readPhotos(x).length === 0;
    if (!needText && !needPhoto) continue;
    cands.push({ id: d.id, ref: d.ref, x, needText, needPhoto });
  }
  last = s.docs[s.docs.length - 1];
}
const stride = Math.max(1, Math.floor(cands.length / LIMIT));
const pick = cands.filter((_, i) => i % stride === 0).slice(0, LIMIT);
console.log(`candidates=${cands.length} picked=${pick.length} batch=${BATCH} apply=${APPLY}`);

// ---------------- WIKIDATA (50 per call) ----------------
const wd = new Map();
for (let i = 0; i < pick.length; i += 50) {
  const ids = pick.slice(i, i + 50).map(p => p.x.wikidataId);
  const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=sitelinks|claims|labels&languages=fr&sitefilter=frwiki&format=json`);
  for (const [q, e] of Object.entries(j.entities || {})) {
    const file = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const p31 = (e?.claims?.P31 || []).map(c => c?.mainsnak?.datavalue?.value?.id).filter(Boolean);
    wd.set(q, { title: e?.sitelinks?.frwiki?.title || null, label: e?.labels?.fr?.value || '', p31, file: typeof file === 'string' ? file : null });
  }
  await sleep(1000);
}

// ---------------- fr.wikipedia intros (20 per call) ----------------
const intro = new Map();
const titles = [...new Set([...wd.values()].map(v => v.title).filter(Boolean))];
for (let i = 0; i < titles.length; i += 20) {
  const chunk = titles.slice(i, i + 20);
  const j = await getJson(`https://fr.wikipedia.org/w/api.php?action=query&prop=extracts|pageprops&exintro=1&explaintext=1&exlimit=20&redirects=1&format=json&titles=${encodeURIComponent(chunk.join('|'))}`);
  const alias = new Map();
  (j.query?.normalized || []).forEach(n => alias.set(n.to, n.from));
  (j.query?.redirects || []).forEach(r => alias.set(r.to, alias.get(r.from) || r.from));
  for (const p of Object.values(j.query?.pages || {})) {
    if (p.missing !== undefined || p.pageprops?.disambiguation !== undefined || !p.extract) continue;
    const orig = alias.get(p.title) || p.title;
    intro.set(orig, { finalTitle: p.title, text: cleanIntro(p.extract), url: `https://fr.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}` });
  }
  await sleep(1000);
}

// ---------------- Commons images with author/licence (50 per call) ----------------
const img = new Map();
const files = [...new Set([...wd.values()].map(v => v.file).filter(Boolean))];
for (let i = 0; i < files.length; i += 50) {
  const chunk = files.slice(i, i + 50).map(f => 'File:' + f);
  const j = await getJson(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&iiextmetadatafilter=Artist|LicenseShortName&format=json&titles=${encodeURIComponent(chunk.join('|'))}`);
  const alias = new Map();
  (j.query?.normalized || []).forEach(n => alias.set(n.to, n.from));
  for (const p of Object.values(j.query?.pages || {})) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const key = (alias.get(p.title) || p.title).replace(/^File:/, '');
    img.set(key, {
      url: ii.thumburl || ii.url,
      credit: stripHtml(ii.extmetadata?.Artist?.value) || 'Wikimedia Commons',
      license: ii.extmetadata?.LicenseShortName?.value || '',
      page: ii.descriptionurl,
    });
  }
  await sleep(1000);
}

// ---------------- GUARD: OSM wikidata tag sometimes points to the town, not the place ----------------
// e.g. "Église Saint-Nicolas" tagged with the Wikidata item of the commune Fieulaine.
const ADMIN_AREAS = new Set(['Q484170', 'Q747074', 'Q515', 'Q3957', 'Q532', 'Q1549591', 'Q15284', 'Q6465', 'Q36784',
  'Q702842', 'Q2989454', 'Q1115575', 'Q22927291', 'Q3266850', 'Q2074737', 'Q5119', 'Q486972']);
const STOP = new Set(['le','la','les','de','du','des','et','en','au','aux','sur','saint','sainte','st','l','d']);
const sig = t => tokenize(t).filter(x => !STOP.has(x));
function sameThing(poiName, w) {
  if (w.p31?.some(id => ADMIN_AREAS.has(id))) return false;
  const a = sig(poiName); if (!a.length) return true;
  const b = new Set([...sig(w.title || ''), ...sig(w.label || '')]);
  return a.some(t => b.has(t));
}
let nMismatch = 0, nRedirect = 0;

// ---------------- BUILD UPDATES ----------------
const writer = db.bulkWriter();
const now = new Date();
const rows = [];
let nDesc = 0, nPhoto = 0, nStub = 0, nNone = 0;
for (const p of pick) {
  const w = wd.get(p.x.wikidataId) || {};
  if (w.p31 && !sameThing(p.x.name, w)) { nMismatch++; rows.push({ p, fields: [], it: null, im: null, mismatch: `${w.title || w.label}` }); continue; }
  let it = w.title ? intro.get(w.title) : null;
  // Small church articles are often redirects to the commune article: text is about the town
  if (it && sig(p.x.name).length && !sig(p.x.name).some(t => new Set(sig(it.finalTitle)).has(t))) { it = null; nRedirect++; }
  const im = w.file ? img.get(w.file) : null;
  const upd = {};
  const fields = [];
  if (p.needText && it?.text) {
    if (it.text.length >= MIN_DESC) {
      Object.assign(upd, { description: it.text, descriptionSource: 'wikipedia', descriptionSourceUrl: it.url, hasDescription: true });
      fields.push('description'); nDesc++;
    } else nStub++;
  }
  if (p.needPhoto && im?.url) {
    Object.assign(upd, {
      photos: [im.url], photoUrls: [im.url], photoUrl: im.url, hasPhoto: true,
      photoSource: 'wikimedia', photoCredit: im.credit, photoLicense: im.license, photoSourceUrl: im.page,
    });
    fields.push('photo'); nPhoto++;
  }
  if (!fields.length) { nNone++; rows.push({ p, fields, it, im }); continue; }
  Object.assign(upd, {
    enrichmentBatch: BATCH,
    enrichment: { source: 'wikidata', wikidataId: p.x.wikidataId, fields, at: now },
    searchTokens: tokenize(p.x.name),
  });
  if (APPLY) writer.update(p.ref, upd);
  rows.push({ p, fields, it, im });
}
if (APPLY) await writer.close();

// ---------------- REPORT ----------------
const esc = s => String(s || '').replace(/\|/g, '/').replace(/\n+/g, ' ');
const lines = [
  `# Enrichment batch ${BATCH}${APPLY ? '' : ' (DRY RUN)'}`,
  '',
  `Candidates with wikidataId and missing text or photo: ${cands.length}. Picked: ${pick.length} (spread over the collection).`,
  '',
  `- Description added: **${nDesc}** (intro ≥ ${MIN_DESC} chars)`,
  `- Photo added: **${nPhoto}**`,
  `- Stub article skipped (< ${MIN_DESC} chars): ${nStub}`,
  `- Nothing found: ${nNone}`,
  `- Rejected, Wikidata item is another thing (town, etc.): ${nMismatch}`,
  `- Text rejected, article redirects to another subject (usually the commune): ${nRedirect}`,
  '',
  `Review in admin: /pois?batch=${BATCH} — rollback: \`node --env-file=.env.local scripts/enrich-wikidata-batch.mjs --rollback ${BATCH} --apply\``,
  '',
  '| POI | cat | description | photo (credit, licence) |',
  '|---|---|---|---|',
  ...rows.map(({ p, fields, it, im, mismatch }) => mismatch ? `| ${esc(p.x.name)} (${p.id}) | ${p.x.category || ''} | ✗ rejeté : Wikidata = « ${esc(mismatch)} » | — |` :
    `| ${esc(p.x.name)} (${p.id}) | ${p.x.category || ''} | ${fields.includes('description') ? `${it.text.length} ch — ${esc(it.text.slice(0, 110))}…` : (it?.text ? `stub ${it.text.length} ch` : '—')} | ${fields.includes('photo') ? `✓ ${esc(im.credit).slice(0, 40)}, ${esc(im.license)}` : '—'} |`),
];
const out = `/Volumes/WORK_SSD_2Tb/Guide du Detour app/_RALPH/instrumentation/enrichment_${BATCH}${APPLY ? '' : '_dryrun'}.md`;
fs.writeFileSync(out, lines.join('\n'));
console.log(`desc=${nDesc} photo=${nPhoto} stubSkipped=${nStub} none=${nNone} mismatch=${nMismatch} redirectText=${nRedirect}\nreport: ${out}`);
process.exit(0);
