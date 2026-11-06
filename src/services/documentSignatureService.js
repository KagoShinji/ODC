import { auth, db } from '../lib/firebase';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

function check(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Subscribes to signatures in {collectionName}/{docId}/signatures,
 * returning a map of { [slotId]: { name, signedAt, signedByUid, userAgent } }.
 */
export function subscribeDocumentSignatures(collectionName, docId, onData, onError) {
  if (!docId) return () => {};
  return onSnapshot(
    collection(db, collectionName, docId, 'signatures'),
    snap => {
      const sigs = Object.fromEntries(
        snap.docs.map(d => {
          const data = d.data();
          return [
            d.id,
            {
              ...data,
              signedAt: data.signedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            },
          ];
        })
      );
      onData(sigs);
    },
    onError
  );
}

/**
 * Records an electronic signature into {collectionName}/{docId}/signatures/{slotId}.
 */
export async function signDocumentSlot(collectionName, docId, slotId, name, user = auth.currentUser) {
  const typed = normalizeSignerName(name);
  check(typed.length >= 2, 'Type your full name to sign.');

  await setDoc(doc(db, collectionName, docId, 'signatures', slotId), {
    name: typed.slice(0, 200),
    signedAt: serverTimestamp(),
    signedByUid: user?.uid || '',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '').slice(0, 300),
  });
}

