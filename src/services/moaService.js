import { auth, db } from '../lib/firebase.js';
import { collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers.js';
import { controlMonthOf, formatControlNumber, normalizeSignerName } from '../utils/moaDocument.js';

export { normalizeSignerName };

const moasRef = collection(db, 'moas');
const nameOf = user => user?.displayName || formatDisplayIdentifier(user?.email || '');
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

function check(condition, message) { if (!condition) throw new Error(message); }

/**
 * Form values → stored fields, trimmed to the limits the security rules enforce.
 * `bodyJson` is the editor document (rendered on the page); `body` keeps plain text for search.
 */
function moaFields(form) {
  const signers = {};
  (form.signers || []).forEach((s, index) => {
    const name = normalizeSignerName(s.name).slice(0, 200);
    const title = (s.title || '').trim().slice(0, 200);
    const kind = s.kind || (index === 0 ? 'provider' : 'client');
    signers[s.id || `s${index + 1}`] = { kind, name, title, order: index + 1 };
  });

  check(form.title?.trim() || form.purpose?.trim(), 'Add a title or purpose for the agreement.');
  check(form.clientName?.trim() || form.clientBusiness?.trim(), 'Add client representative or business name.');
  check(form.bodyText?.trim() || form.body?.trim() || form.purpose?.trim(), 'Write or paste the content of the agreement.');
  check((form.bodyJson || '').length <= 400000, 'The agreement document is too long.');

  const projectCost = typeof form.projectCost === 'number'
    ? form.projectCost
    : parseFloat(String(form.projectCost || '0').replace(/[^\d.]/g, '')) || 0;

  return {
    title: (form.title || form.purpose || 'Memorandum of Agreement').trim().slice(0, 300),
    purpose: (form.purpose || form.title || '').trim().slice(0, 500),
    clientName: (form.clientName || '').trim().slice(0, 200),
    clientBusiness: (form.clientBusiness || '').trim().slice(0, 200),
    clientAddress: (form.clientAddress || '').trim().slice(0, 300),
    providerName: (form.providerName || 'Jetch Merald S. Madaya').trim().slice(0, 200),
    providerBusiness: (form.providerBusiness || 'OdysseyPH IT Solutions').trim().slice(0, 200),
    projectCost,
    timeline: (form.timeline || '').trim().slice(0, 200),
    body: (form.bodyText || form.body || '').slice(0, 80000),
    bodyJson: form.bodyJson || '',
    signers,
  };
}

export function subscribeMoas(onData, onError) {
  return onSnapshot(query(moasRef, orderBy('createdAt', 'desc')), snap => onData(rows(snap)), onError);
}

export function subscribeMoa(id, onData, onError) {
  return onSnapshot(doc(db, 'moas', id), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

/** Signatures keyed by signer slot id, with signedAt as an ISO string for the document renderer. */
export function subscribeMoaSignatures(id, onData, onError) {
  return onSnapshot(collection(db, 'moas', id, 'signatures'), snap => onData(Object.fromEntries(snap.docs.map(d => {
    const data = d.data();
    return [d.id, { ...data, signedAt: data.signedAt?.toDate?.()?.toISOString() || new Date().toISOString() }];
  }))), onError);
}

/** Creates a draft and reserves the next control number (MOA-YYYY-MM-NNN) atomically. */
export async function createMoa(user, form) {
  const fields = moaFields(form);
  const month = controlMonthOf();
  const counter = doc(db, 'moaCounters', month);
  const ref = doc(moasRef);

  await runTransaction(db, async tx => {
    const snap = await tx.get(counter);
    const seq = (snap.exists() ? snap.data().last : 0) + 1;
    tx.set(counter, { last: seq });
    tx.set(ref, {
      ...fields,
      controlMonth: month,
      controlSeq: seq,
      controlNumber: formatControlNumber(month, seq),
      moaNumber: formatControlNumber(month, seq),
      status: 'draft',
      statusReason: '',
      clientSigned: false,
      providerSigned: false,
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByName: nameOf(user),
      createdBy: user.email || nameOf(user),
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      issuedAt: null,
      executedAt: null,
      revokedAt: null,
    });
  });
  return ref.id;
}

export async function updateMoa(user, id, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'moas', id), {
    ...moaFields(form),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function issueMoa(user, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'moas', id), {
    status: 'issued',
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function revokeMoa(user, id, reason = '') {
  check(reason?.trim(), 'Provide a reason for revoking this agreement.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'moas', id), {
    status: 'revoked',
    statusReason: reason.trim().slice(0, 500),
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function deleteMoaDraft(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'moas', id));
  await batch.commit();
}

export async function signMoa(id, slotId, name, user = auth.currentUser) {
  const typed = normalizeSignerName(name);
  check(typed.length >= 2, 'Type your full legal name to sign.');

  await setDoc(doc(db, 'moas', id, 'signatures', slotId), {
    name: typed.slice(0, 200),
    signedAt: serverTimestamp(),
    signedByUid: user?.uid || '',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '').slice(0, 300),
  });

  // Dual-update legacy fields for backward compatibility
  try {
    const updates = { updatedAt: serverTimestamp() };
    if (slotId === 'provider' || slotId === 's1') {
      updates.providerSigned = true;
      updates.providerSigneeName = typed;
      updates.providerSignedAt = serverTimestamp();
    }
    if (slotId === 'client' || slotId === 's2') {
      updates.clientSigned = true;
      updates.clientSigneeName = typed;
      updates.clientSignedAt = serverTimestamp();
    }
    await updateDoc(doc(db, 'moas', id), updates);
  } catch {
    // Non-blocking fallback if update rule restricted
  }
}
