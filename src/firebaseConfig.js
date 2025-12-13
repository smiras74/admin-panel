import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "СЮДА_ВСТАВЬ_API_KEY",
  authDomain: "СЮДА_ВСТАВЬ_AUTH_DOMAIN",
  projectId: "СЮДА_ВСТАВЬ_PROJECT_ID",
  storageBucket: "СЮДА_ВСТАВЬ_STORAGE_BUCKET",
  messagingSenderId: "СЮДА_ВСТАВЬ_SENDER_ID",
  appId: "СЮДА_ВСТАВЬ_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
