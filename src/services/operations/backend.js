import { auth, db, functions } from '../../lib/firebase';
import { createFirestoreOperations } from './firestoreOperations';
import { createRemoteOperations } from './remoteOperations';
import { FIRESTORE_CAPABILITIES, SERVER_CAPABILITIES } from './config';

export const operationsBackendMode = import.meta.env.VITE_OPERATIONS_BACKEND || 'firestore';
export const operationsCapabilities = operationsBackendMode === 'firebase-functions' ? SERVER_CAPABILITIES : { ...FIRESTORE_CAPABILITIES, backgroundReminders: operationsBackendMode === 'http' };
let backend;
export function operationsBackend() {
  if (!backend) {
    if (operationsBackendMode === 'firestore') backend = createFirestoreOperations({ auth, db });
    else if (['firebase-functions', 'http'].includes(operationsBackendMode)) backend = createRemoteOperations({ auth, functions, mode: operationsBackendMode, baseUrl: import.meta.env.VITE_OPERATIONS_API_URL });
    else throw new Error('Choose a supported operations backend.');
  }
  return backend;
}
