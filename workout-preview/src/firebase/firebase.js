// workout-preview/src/firebase/firebase.js
const isTestEnv = process.env.NODE_ENV === 'test' || typeof window === 'undefined';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBhmDMDYdjQAt-HkuFEoMqAAUax0FcLNiE",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "personal-workout-app-1bbf9.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "personal-workout-app-1bbf9",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "personal-workout-app-1bbf9.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "95048504886",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:95048504886:web:fee7682adb31314181ea97"
};

let app = null;
let auth = null;
let db = null;
let storage = null;
let analytics = null;

if (!isTestEnv) {
  try {
    // Use runtime require to avoid static CJS/ESM module-evaluation execution during Node/Jest tests
    const { initializeApp } = require('firebase/app');
    const { getAuth } = require('firebase/auth');
    const { getFirestore } = require('firebase/firestore');
    const { getStorage } = require('firebase/storage');
    const { getAnalytics, isSupported: analyticsIsSupported } = require('firebase/analytics');

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      analyticsIsSupported()
        .then((supported) => {
          if (supported) {
            try { analytics = getAnalytics(app); } catch (_) {}
          }
        })
        .catch(() => {});
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Error initializing Firebase:", e);
  }
}

export { app, auth, db, storage, analytics };