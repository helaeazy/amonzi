import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const authDisabled = import.meta.env.VITE_DISABLE_AUTH === "true";
const isConfigured = !authDisabled && Object.values(firebaseConfig).every(Boolean);
const app = isConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account",
});

function shouldUseRedirectAuth() {
  if (typeof window === "undefined") {
    return false;
  }

  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const smallViewport = window.innerWidth < 1024;
  const userAgent = navigator.userAgent || "";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(userAgent);

  return coarsePointer || (smallViewport && mobileUa);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle() {
  if (!auth) {
    throw new Error("Firebase is not configured.");
  }
  if (shouldUseRedirectAuth()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error.code === "auth/popup-blocked" ||
        error.code === "auth/web-storage-unsupported" ||
        error.code === "auth/operation-not-supported-in-this-environment")
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutFromGoogle() {
  if (!auth) {
    return;
  }
  await signOut(auth);
}

export function isFirebaseConfigured() {
  return isConfigured;
}

export function isAuthDisabled() {
  return authDisabled;
}
