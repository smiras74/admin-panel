import type { Firestore } from 'firebase-admin/firestore';
import { POI_COLLECTIONS } from './poi-delete';

// Load a POI document by id, trying the given collection first.
export async function findPoiData(db: Firestore, id?: string, collection?: string): Promise<any | null> {
  if (!id || id.includes('/')) return null;
  const order = [collection, ...POI_COLLECTIONS].filter((c, i, a): c is string => !!c && a.indexOf(c) === i);
  for (const c of order) {
    if (!(POI_COLLECTIONS as readonly string[]).includes(c)) continue;
    const snap = await db.collection(c).doc(id).get();
    if (snap.exists) return snap.data();
  }
  return null;
}
