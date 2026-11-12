import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const env = (typeof import.meta !== 'undefined' && import.meta.env) || (typeof globalThis !== 'undefined' && globalThis.process?.env) || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'test-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'test-domain',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'test-project',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'test-bucket',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'test-sender',
  appId: env.VITE_FIREBASE_APP_ID || 'test-app',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-southeast1');
const emulatorMode = env.DEV && (env.VITE_FIREBASE_EMULATORS === 'true' || env.VITE_ALLOWANCE_EMULATORS === 'true');
if (emulatorMode) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
} else if (env.VITE_FIREBASE_APPCHECK_SITE_KEY && typeof window !== 'undefined') {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(env.VITE_FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}

// Secondary app used for creating accounts without signing out the current admin
const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
if (emulatorMode) connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
