'use client';

import { auth } from './firebase-client';

// fetch() wrapper that attaches the current admin's Firebase ID token.
// Use for every call to /api/* from the browser.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const user = auth.currentUser;
  const headers = new Headers(init.headers || {});
  if (user) {
    const token = await user.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
