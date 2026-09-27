import type { DocumentReference } from 'firebase-admin/firestore';
import { readPhotos } from './poi-photos';

// Admin-only derived fields on POI documents. They make search and content
// filters possible with plain Firestore equality queries (no composite indexes):
//   searchTokens  — lowercase, accent-free words of the name (array-contains search)
//   hasPhoto / hasDescription / hasHours — booleans for content filters and counts
// The iOS app ignores these fields.

export function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter(t => t.length >= 2)
    )
  ).slice(0, 25);
}

export function derivedFields(data: any) {
  return {
    searchTokens: tokenize(data?.name || ''),
    hasPhoto: readPhotos(data).length > 0,
    hasDescription: [data?.description, data?.shortDescription].some(d => typeof d === 'string' && d.trim().length > 0),
    hasHours: typeof data?.openingHours === 'string' && data.openingHours.trim().length > 0,
  };
}

// Recompute derived fields from the stored document (call after any admin write).
export async function refreshDerived(ref: DocumentReference) {
  const snap = await ref.get();
  if (snap.exists) await ref.update(derivedFields(snap.data()));
}
