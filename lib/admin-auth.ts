import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Server-side admin guard for every /api/* route.
// Verifies the Firebase ID token from the Authorization header and
// checks users/{uid}.role === 'admin' (or isAdmin === true).

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000;
const adminCache = new Map<string, number>(); // uid -> expiresAt

export type AdminContext = { uid: string; email?: string };

async function verifyAdmin(request: NextRequest): Promise<AdminContext | NextResponse> {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = header.slice(7);
  const { auth, db } = getFirebaseAdmin();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const cached = adminCache.get(decoded.uid);
  if (cached && cached > Date.now()) {
    return { uid: decoded.uid, email: decoded.email };
  }

  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const data = userDoc.data();
  const isAdmin = data?.role === 'admin' || data?.isAdmin === true;
  if (!isAdmin) {
    adminCache.delete(decoded.uid);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  adminCache.set(decoded.uid, Date.now() + ADMIN_CACHE_TTL_MS);
  return { uid: decoded.uid, email: decoded.email };
}

type Handler = (request: NextRequest, admin: AdminContext) => Promise<Response>;

// Wrap a route handler so it only runs for authenticated admins.
export function withAdmin(handler: Handler) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const result = await verifyAdmin(request);
      if (result instanceof NextResponse) return result;
      return await handler(request, result);
    } catch (error) {
      console.error('Admin auth error:', error);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
  };
}
