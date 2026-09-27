import { tokenize } from './poi-derived';

// Wikipedia/Wikidata lookup shared by the Wikipedia button and the AI enrichment.
// Order of confidence:
//   1. wikidataId from OSM (19k+ POIs have it) -> exact frwiki article + P18 image
//   2. geosearch 1 km, then 3 km, with a name match (>= 2/3 significant words)
//   3. strict title search — only when the POI has no coordinates
// Text = the full lead section of the article (not the 1–3 sentence REST summary).

const WIKI = 'https://fr.wikipedia.org';
const WIKIDATA = 'https://www.wikidata.org';
// Wikimedia throttles generic user agents hard; a contact URL is required by their policy
const UA = { 'User-Agent': 'GuideDuDetourAdmin/1.0 (https://detours.studio) POI-enrichment' };
const STOP = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'et', 'en', 'au', 'aux', 'sur', 'saint', 'sainte', 'st']);
const MAX_CHARS = 1400;

function nameScore(poiName: string, title: string): number {
  const a = tokenize(poiName).filter(t => !STOP.has(t));
  const b = new Set(tokenize(title));
  if (!a.length) return 0;
  return a.filter(t => b.has(t)).length / a.length;
}

export class WikiRateLimitError extends Error {}

// Retries on 429/5xx; a persistent 429 surfaces as WikiRateLimitError instead of "not found"
async function getJson(url: string, attempt = 0): Promise<any> {
  const r = await fetch(url, { headers: UA });
  if (r.status === 429 || r.status >= 500) {
    if (attempt < 2) {
      await new Promise(res => setTimeout(res, 800 * (attempt + 1)));
      return getJson(url, attempt + 1);
    }
    if (r.status === 429) throw new WikiRateLimitError('Wikimedia rate limit');
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url.split('?')[0]}`);
  return r.json();
}

const softFail = <T>(fallback: T) => (e: unknown): T => {
  if (e instanceof WikiRateLimitError) throw e;
  return fallback;
};

function commonsUrl(file: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=1600`;
}

async function fromWikidata(qid: string): Promise<{ title: string | null; image: string | null }> {
  const d = await getJson(
    `${WIKIDATA}/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks|claims&sitefilter=frwiki&format=json`
  );
  const e = d?.entities?.[qid];
  const title = e?.sitelinks?.frwiki?.title || null;
  const file = e?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return { title, image: typeof file === 'string' ? commonsUrl(file) : null };
}

async function geoTitle(name: string, lat: number, lon: number, radius: number): Promise<string | null> {
  const d = await getJson(
    `${WIKI}/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${radius}&gslimit=50&format=json`
  );
  const best = ((d?.query?.geosearch || []) as { title: string }[])
    .map(p => ({ title: p.title, s: nameScore(name, p.title) }))
    .sort((x, y) => y.s - x.s)[0];
  // "La Brocante de Serris" must not match "Canton de Serris"
  return best && best.s >= 0.66 ? best.title : null;
}

async function searchTitle(name: string): Promise<string | null> {
  const d = await getJson(
    `${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=5&format=json`
  );
  const best = ((d?.query?.search || []) as { title: string }[])
    .map(h => ({ title: h.title, s: nameScore(name, h.title) }))
    .sort((x, y) => y.s - x.s)[0];
  return best && best.s >= 0.8 ? best.title : null;
}

function cleanIntro(text: string): string {
  const paragraphs = text
    .replace(/\s*\(\s*(?:Écouter|prononcé)[^)]*\)/g, '')
    .split(/\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0);
  let out = '';
  for (const p of paragraphs) {
    if ((out + '\n\n' + p).length > MAX_CHARS) {
      if (!out) {
        // First paragraph alone is too long: cut at the last sentence end
        const cut = p.slice(0, MAX_CHARS);
        const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.»'));
        out = end > 200 ? cut.slice(0, end + 1) : cut;
      }
      break;
    }
    out = out ? `${out}\n\n${p}` : p;
  }
  return out;
}

export type WikiResult = {
  title: string | null;
  extract: string | null;
  photoUrl: string | null;
  sourceUrl: string | null;
  matchedBy: 'wikidata' | 'geo-1km' | 'geo-3km' | 'title';
};

export async function fetchWikipediaSummary(
  name: string,
  latitude?: number,
  longitude?: number,
  wikidataId?: string | null
): Promise<WikiResult | null> {
  let title: string | null = null;
  let image: string | null = null;
  let matchedBy: WikiResult['matchedBy'] | null = null;

  if (wikidataId && /^Q\d+$/.test(wikidataId)) {
    const wd = await fromWikidata(wikidataId).catch(softFail({ title: null as string | null, image: null as string | null }));
    title = wd.title;
    image = wd.image;
    if (title || image) matchedBy = 'wikidata';
  }
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
  // Generic one-word names ("Calvaire", "Cimetière", "Synagogue") match any nearby article:
  // only accept an article practically at the same spot.
  const generic = tokenize(name).filter(t => !STOP.has(t)).length < 2;
  if (!title && hasCoords && generic) {
    title = await geoTitle(name, latitude!, longitude!, 250).catch(softFail(null));
    if (title) matchedBy = 'geo-1km';
  } else if (!title && hasCoords) {
    title = await geoTitle(name, latitude!, longitude!, 1000).catch(softFail(null));
    if (title) matchedBy = 'geo-1km';
    else {
      title = await geoTitle(name, latitude!, longitude!, 3000).catch(softFail(null));
      if (title) matchedBy = 'geo-3km';
    }
  }
  // With coordinates, never fall back to a France-wide title search (homonyms)
  if (!title && !hasCoords && !matchedBy) {
    title = await searchTitle(name).catch(softFail(null));
    if (title) matchedBy = 'title';
  }
  if (!matchedBy) return null;

  let extract: string | null = null;
  let sourceUrl: string | null = null;
  if (title) {
    const d = await getJson(
      `${WIKI}/w/api.php?action=query&prop=extracts|pageimages|pageprops&exintro=1&explaintext=1&piprop=original&redirects=1&format=json&titles=${encodeURIComponent(title)}`
    ).catch(softFail(null));
    const page: any = d ? Object.values(d?.query?.pages || {})[0] : null;
    if (page && page.missing === undefined && page.pageprops?.disambiguation === undefined) {
      extract = page.extract ? cleanIntro(page.extract) || null : null;
      image = image || page.original?.source || null;
      title = page.title;
      sourceUrl = `${WIKI}/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;
    } else {
      title = null;
    }
  }
  if (!extract && !image) return null;
  return { title, extract, photoUrl: image, sourceUrl, matchedBy };
}
