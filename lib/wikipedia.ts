import { tokenize } from './poi-derived';

// fr.wikipedia.org lookup shared by the Wikipedia button and the AI enrichment
// (the AI rewrites the article summary instead of relying on model memory).

const WIKI = 'https://fr.wikipedia.org';
const UA = { 'User-Agent': 'GuideDuDetourAdmin/1.0 (admin panel)' };
const STOP = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'et', 'en', 'au', 'aux', 'sur', 'saint', 'sainte', 'st']);

function nameScore(poiName: string, title: string): number {
  const a = tokenize(poiName).filter(t => !STOP.has(t));
  const b = new Set(tokenize(title));
  if (!a.length) return 0;
  return a.filter(t => b.has(t)).length / a.length;
}

export async function findTitle(name: string, lat?: number, lon?: number): Promise<string | null> {
  if (typeof lat === 'number' && typeof lon === 'number') {
    const url = `${WIKI}/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=1000&gslimit=30&format=json&origin=*`;
    const r = await fetch(url, { headers: UA });
    if (r.ok) {
      const pages: { title: string }[] = (await r.json())?.query?.geosearch || [];
      const best = pages
        .map(p => ({ title: p.title, s: nameScore(name, p.title) }))
        .sort((x, y) => y.s - x.s)[0];
      // >= 2/3 of significant words must match ("La Brocante de Serris" must not match "Canton de Serris")
      if (best && best.s >= 0.66) return best.title;
    }
    // With coordinates, never fall back to a France-wide title search:
    // "Église Saint-Pierre" would match a homonym in another town.
    return null;
  }
  const url = `${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name)}&srlimit=5&format=json&origin=*`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const hits: { title: string }[] = (await r.json())?.query?.search || [];
  const best = hits.map(h => ({ title: h.title, s: nameScore(name, h.title) })).sort((x, y) => y.s - x.s)[0];
  // Without coordinates we require a strong title match to avoid homonyms
  return best && best.s >= 0.8 ? best.title : null;
}


export async function fetchWikipediaSummary(name: string, latitude?: number, longitude?: number) {
  const title = await findTitle(name, latitude, longitude);
  if (!title) return null;
  const r = await fetch(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers: UA });
  if (!r.ok) return null;
  const s = await r.json();
  if (s.type === 'disambiguation' || !s.extract) return null;
  return {
    title: s.title as string,
    extract: s.extract as string,
    photoUrl: (s.originalimage?.source || s.thumbnail?.source || null) as string | null,
    sourceUrl: (s.content_urls?.desktop?.page || `${WIKI}/wiki/${encodeURIComponent(title)}`) as string,
  };
}
