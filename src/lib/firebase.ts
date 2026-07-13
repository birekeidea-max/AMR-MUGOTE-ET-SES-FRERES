import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAnalytics, logEvent, Analytics } from 'firebase/analytics';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Exact Firebase config provided by user with the corrected uppercase X in API Key from image
const firebaseConfig = {
  apiKey: "AIzaSyA4pBmVjX08ph7JdvJbmurOa_rMNYpy1MA",
  authDomain: "mugote2.firebaseapp.com",
  projectId: "mugote2",
  storageBucket: "mugote2.firebasestorage.app",
  messagingSenderId: "131875304989",
  appId: "1:131875304989:web:e0a83c6073e2ace063b8f4",
  measurementId: "G-BG9Q2L3LMG",
  firestoreDatabaseId: (firebaseConfigJson as any).firestoreDatabaseId || "ai-studio-020b031e-1447-4f1b-8ef0-ab4a23c0b6ab"
};

// Log config keys for diagnostic (not values)
console.log('Firebase Config Keys:', Object.keys(firebaseConfig));

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Safe Google Analytics initialization
// In sandboxed frames, test environments, or under aggressive ad blockers, getAnalytics() can throw.
// Wrapping it in a try-catch ensures the app remains fully functional and never crashes on load.
export let analytics: Analytics | null = null;
try {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname || "";
    const isLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1');
    const isStudioPreview = hostname.includes('.run.app');
    const isOffline = !navigator.onLine;

    if (!isLocal && !isStudioPreview && !isOffline) {
      analytics = getAnalytics(app);
    } else {
      console.log("[Firebase] Skipping Google Analytics initialization in local, sandbox (AI Studio), or offline environment.");
    }
  }
} catch (e) {
  console.warn("Google Analytics could not be initialized (likely restricted by sandbox iframe or blocker):", e);
}

/**
 * Fonction globale pour envoyer les crashs et exceptions à Google Analytics.
 * Elle remplace Crashlytics qui n'est pas disponible nativement sur le Web.
 * 
 * @param {any} error - L'objet d'erreur ou le message du plantage.
 * @param {string} context - Le contexte ou le composant où l'erreur a eu lieu.
 */
export const logWebCrash = (error: any, context: string = "Non spécifié") => {
  if (!error) {
    return;
  }
  let errMsg = "";
  let errCode = "";
  let errStack = "";

  if (error) {
    if (typeof error === 'object') {
      errMsg = error.message || error.description || "";
      errCode = error.code || "";
      errStack = error.stack || "";
      if (!errMsg || errMsg === '[object Object]') {
        try {
          errMsg = JSON.stringify(error);
        } catch (e) {
          errMsg = String(error);
        }
      }
    } else {
      errMsg = String(error);
    }
  }

  const fullText = [
    errMsg,
    errCode,
    errStack,
    String(error)
  ].join(' ').toLowerCase();

  // Ignore harmless, non-fatal background Firebase installations/analytics offline/permission errors
  if (
    fullText.includes('installations/app-offline') ||
    fullText.includes('installations/validation-failed') ||
    fullText.includes('installations/') ||
    fullText.includes('analytics/') ||
    fullText.includes('app-offline') ||
    fullText.includes('app offline') ||
    fullText.includes('offline') ||
    fullText.includes('network') ||
    fullText.includes('fetch') ||
    fullText.includes('permission') ||
    fullText.includes('unimplemented') ||
    fullText.includes('unavailable') ||
    fullText.includes('failed-precondition') ||
    fullText.includes('storage/') ||
    fullText.includes('auth/') ||
    fullText.includes('istrusted')
  ) {
    console.warn(`[Firebase Background Activity Suppressed]: ${errMsg || String(error)} (${context})`);
    return;
  }

  if (context.includes('Global') || context.includes('Rejection') || context.includes('Window')) {
    console.warn(`[Web Warn - ${context}]:`, error);
  } else {
    console.error(`[Web Crash - ${context}]:`, error);
  }
  if (analytics) {
    try {
      logEvent(analytics, 'exception', {
        description: errMsg,
        fatal: true, // Marque l'erreur comme critique (plantage)
        error_context: context
      });
    } catch (e) {
      console.warn("Failed to log exception to Google Analytics:", e);
    }
  }
};

// Enable offline persistence
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
} catch (error) {
  console.warn('Firestore persistence initialization error:', error);
}

/**
 * Uploads a file to Firebase Storage and returns its download URL.
 */
export async function uploadToStorage(
  file: File | Blob, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const storageRef = ref(storage, path);
      console.log(`Starting resumable upload to: ${path}, size: ${file.size} bytes`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload is ${progress.toFixed(2)}% done`);
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error(`Storage upload failed for ${path}:`, error);
          reject(error);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          console.log(`Upload successful: ${path}`);
          resolve(url);
        }
      );
    } catch (error: any) {
      console.error(`Storage initialization failed for ${path}:`, error);
      reject(error);
    }
  });
}

// --- Error Handling Utility ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  code?: string;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  let message = error instanceof Error ? error.message : String(error);
  const code = error?.code;

  if (code === 'unavailable') {
    message = "Impossible de contacter le serveur. Le service sera rétabli dès que possible. Vérifiez votre connexion ou essayez de cliquer sur 'Ouvrir dans un nouvel onglet' en haut à droite.";
  } else if (code === 'permission-denied') {
    message = "Accès refusé. Vous n'avez pas les permissions pour effectuer cette opération.";
  }

  const errInfo: FirestoreErrorInfo = {
    error: message,
    code,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  
  console.error('Firestore Error details:', errInfo);
  
  // Track this database exception with Google Analytics
  try {
    logWebCrash(error || message, `Firestore: ${operationType} ${path || ''}`);
  } catch (analyticsErr) {
    console.warn("Could not log Firestore error to analytics:", analyticsErr);
  }
  
  // Create a clean error message for the UI
  const finalError = new Error(message);
  (finalError as any).code = code;
  throw finalError;
}

export default app;
