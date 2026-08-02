// workout-preview/src/firebase/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBhmDMDYdjQAt-HkuFEoMqAAUax0FcLNiE",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "personal-workout-app-1bbf9.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "personal-workout-app-1bbf9",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "personal-workout-app-1bbf9.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "95048504886",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:95048504886:web:b23e732f46a08cae81ea97"
};

// Silence internal Firestore backoff retry logs
setLogLevel('error');

// Prevent re-initialization errors during React Hot Module Replacement (HMR)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const storage = getStorage(app);

export { app, auth, db, storage };