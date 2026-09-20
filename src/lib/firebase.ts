import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase config for ileadit-app project.
// Actual values must be added to .env.local — see .env.example.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Everything below is lazily initialized (function-based, not a top-level
// `const x = getAuth(app)`) DELIBERATELY: `getAuth()` validates the API key
// format the instant it is called, so an eager top-level call throws
// `auth/invalid-api-key` the moment this module is evaluated anywhere with
// no `.env.local` present - including during `next build`'s server-side
// prerendering of EVERY route (root layout mounts `EngineBootstrap`, which
// pulls this module in transitively). Lazy getters mean the module can be
// imported freely; the actual Firebase call only happens when a client
// component calls one of these functions at runtime in the browser.
let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

/**
 * The config keys without which `getAuth()` throws `auth/invalid-api-key`
 * and every callable fails. `storageBucket` and `messagingSenderId` are
 * deliberately NOT in this list: nothing in this repo uses Storage or FCM
 * yet, and an absent value there does not break auth.
 */
const REQUIRED_CONFIG_KEYS = ["apiKey", "authDomain", "projectId", "appId"] as const;

/**
 * Names the missing `NEXT_PUBLIC_FIREBASE_*` variables, or returns an empty
 * array when the config is complete.
 *
 * Exists because the failure mode without it is genuinely misleading: with
 * no `.env.local`, `apiKey` is `undefined`, and the Firebase SDK reports
 * that as `auth/invalid-api-key` - which reads like a wrong or revoked key
 * rather than an absent file. Callers use this to say which variable is
 * actually missing instead of letting the SDK's error stand.
 */
export function missingFirebaseConfigKeys(): string[] {
  return REQUIRED_CONFIG_KEYS.filter((key) => !firebaseConfig[key]).map(
    (key) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`,
  );
}

export function isFirebaseConfigured(): boolean {
  return missingFirebaseConfigKeys().length === 0;
}

export function getFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return appInstance;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}
