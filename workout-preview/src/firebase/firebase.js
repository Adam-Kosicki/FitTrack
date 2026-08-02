import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as analyticsIsSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "your-app.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "your-app-id",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "your-app.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "00000000000",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:00000000000:web:0000000000000"
};

let app;
let auth;
let db;
let storage;
let analytics;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    // Only initialize analytics when supported and measurementId is present
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
        analyticsIsSupported().then((supported) => {
            if (supported) {
                try { analytics = getAnalytics(app); } catch (_) {}
            }
        }).catch(() => {});
    }
} catch (e) {
    console.error("Error initializing Firebase:", e);
}

export { app, auth, db, storage, analytics }; 