import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCWQJtzHMksDG5UgLVma8LnYiOxYYcv_AQ",
  authDomain: "guide-du-detour.firebaseapp.com",
  projectId: "guide-du-detour",
  storageBucket: "guide-du-detour.firebasestorage.app",
  messagingSenderId: "182479723840",
  appId: "1:182479723840:web:866963483cf1bca6f9aea5",
  measurementId: "G-17851JKM7F"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
