// Photo fields contract with the iOS app.
// iOS writes `photos` (array) on POI creation and reads `photos` first,
// then `photoUrls`, then `photoUrl` (POIService.parse). Some screens read only `photos`.
// Admin therefore reads the union of all three and always writes all three.

export function readPhotos(data: any): string[] {
  const out: string[] = [];
  const push = (u: unknown) => {
    if (typeof u === 'string' && u.trim() && !out.includes(u)) out.push(u);
  };
  if (Array.isArray(data?.photos)) data.photos.forEach(push);
  if (Array.isArray(data?.photoUrls)) data.photoUrls.forEach(push);
  push(data?.photoUrl);
  push(data?.photoURL); // legacy field (read by iOS WikipediaService)
  return out;
}

export function photoWriteFields(urls: string[]) {
  const clean = urls.filter((u, i) => typeof u === 'string' && u.trim() && urls.indexOf(u) === i);
  return { photos: clean, photoUrls: clean, photoUrl: clean[0] || '' };
}
