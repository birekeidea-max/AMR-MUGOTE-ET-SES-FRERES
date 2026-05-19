import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

// Log config keys for diagnostic (not values)
console.log('Firebase Config Keys:', Object.keys(firebaseConfig));

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

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
  
  // Create a clean error message for the UI
  const finalError = new Error(message);
  (finalError as any).code = code;
  throw finalError;
}
