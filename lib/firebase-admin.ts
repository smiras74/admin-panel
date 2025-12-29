import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let app: App;
let db: Firestore;
let auth: Auth;

function initFirebaseAdmin() {
  if (getApps().length === 0) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY is not set');
    }

    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    });
  } else {
    app = getApps()[0];
  }

  db = getFirestore();
  auth = getAuth();
  
  return { app, db, auth };
}

export function getFirebaseAdmin() {
  const { app, db, auth } = initFirebaseAdmin();
  
  return { app, db, auth };
}

// Separate function for storage - specify bucket name explicitly
export function getFirebaseStorage() {
  initFirebaseAdmin();
  const bucketName = `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
  return getStorage().bucket(bucketName);
}
