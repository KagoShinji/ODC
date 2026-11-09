import { auth, db } from '../lib/firebase.js';
import { collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp, writeBatch, setDoc, updateDoc } from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers.js';
import { controlMonthOf, formatControlNumber, normalizeSignerName } from '../utils/acceptanceDocument.js';

export { normalizeSignerName };

const certsRef = collection(db, 'certificates');
const nameOf = user => user?.displayName || formatDisplayIdentifier(user?.email || '');
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

function check(condition, message) { if (!condition) throw new Error(message); }

/**
 * Form values → stored fields, trimmed to the limits the security rules enforce.
 * `bodyJson` is the editor document (rendered on the page); `body` keeps plain text for search.
 */
function certificateFields(form) {
  const signers = {};
  (form.signers || []).forEach((s, index) => {
    const name = normalizeSignerName(s.name).slice(0, 200);
    const title = (s.title || '').trim().slice(0, 200);
    const kind = s.kind || (index === 0 ? 'turnover' : 'acceptor');
    signers[s.id || `s${index + 1}`] = { kind, name, title, order: index + 1 };
  });

  check(form.projectName?.trim(), 'Add a project name for the certificate.');
  check(form.clientName?.trim() || form.clientBusiness?.trim(), 'Add client representative or business name.');
  check(form.bodyText?.trim() || form.body?.trim() || (form.scope && form.scope.length) || form.customText?.trim(), 'Add handover details or system scope.');
  check((form.bodyJson || '').length <= 400000, 'The certificate document is too long.');

  return {
    projectName: (form.projectName || 'Digital Engineering Project').trim().slice(0, 300),
    turnoverDate: form.turnoverDate || '',
    clientName: (form.clientName || '').trim().slice(0, 200),
    clientBusiness: (form.clientBusiness || '').trim().slice(0, 200),
    clientAddress: (form.clientAddress || '').trim().slice(0, 300),
    providerName: (form.providerName || form.providerRep || 'Jetch Merald S. Madaya').trim().slice(0, 200),
    providerBusiness: (form.providerBusiness || 'OdysseyPH IT Solutions').trim().slice(0, 200),
    customText: (form.customText || '').trim().slice(0, 2000),
    body: (form.bodyText || form.body || '').slice(0, 80000),
    bodyJson: form.bodyJson || '',
    scope: Array.isArray(form.scope) ? form.scope : [],
    signers,
  };
}

export function subscribeCertificates(onData, onError) {
  return onSnapshot(query(certsRef, orderBy('createdAt', 'desc')), snap => onData(rows(snap)), onError);
}

export function subscribeCertificate(id, onData, onError) {
  return onSnapshot(doc(db, 'certificates', id), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

/** Signatures keyed by signer slot id, with signedAt as an ISO string for the document renderer. */
export function subscribeCertificateSignatures(id, onData, onError) {
  return onSnapshot(collection(db, 'certificates', id, 'signatures'), snap => onData(Object.fromEntries(snap.docs.map(d => {
    const data = d.data();
    return [d.id, { ...data, signedAt: data.signedAt?.toDate?.()?.toISOString() || new Date().toISOString() }];
  }))), onError);
}

/** Creates a draft and reserves the next control number (COA-YYYY-MM-NNN) atomically. */
export async function createCertificate(user, form) {
  const fields = certificateFields(form);
  const month = controlMonthOf();
  const counter = doc(db, 'certificateCounters', month);
  const ref = doc(certsRef);

  await runTransaction(db, async tx => {
    const snap = await tx.get(counter);
    const seq = (snap.exists() ? snap.data().last : 0) + 1;
    tx.set(counter, { last: seq });
    tx.set(ref, {
      ...fields,
      controlMonth: month,
      controlSeq: seq,
      controlNumber: formatControlNumber(month, seq),
      certificateNumber: formatControlNumber(month, seq),
      status: 'draft',
      statusReason: '',
      providerSigned: false,
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByName: nameOf(user),
      createdBy: user.email || nameOf(user),
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      issuedAt: null,
      acceptedAt: null,
      revokedAt: null,
    });
  });
  return ref.id;
}

export async function updateCertificate(user, id, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'certificates', id), {
    ...certificateFields(form),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function issueCertificate(user, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'certificates', id), {
    status: 'issued',
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function revokeCertificate(user, id, reason = '') {
  check(reason?.trim(), 'Provide a reason for revoking this certificate.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'certificates', id), {
    status: 'revoked',
    statusReason: reason.trim().slice(0, 500),
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function deleteCertificateDraft(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'certificates', id));
  await batch.commit();
}

export async function signCertificate(id, slotId, name, user = auth.currentUser) {
  const typed = normalizeSignerName(name);
  check(typed.length >= 2, 'Type your full legal name to sign.');

  await setDoc(doc(db, 'certificates', id, 'signatures', slotId), {
    name: typed.slice(0, 200),
    signedAt: serverTimestamp(),
    signedByUid: user?.uid || '',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '').slice(0, 300),
  });

  // Dual-update legacy fields for backward compatibility
  try {
    const updates = { updatedAt: serverTimestamp() };
    if (slotId === 'acceptor' || slotId === 's2') {
      updates.status = 'Accepted';
      updates.signeeName = typed;
      updates.acceptedAt = serverTimestamp();
    }
    if (slotId === 'turnover' || slotId === 's1') {
      updates.providerSigned = true;
      updates.providerSigneeName = typed;
      updates.providerSignedAt = serverTimestamp();
    }
    await updateDoc(doc(db, 'certificates', id), updates);
  } catch {
    // Non-blocking fallback if update rule restricted
  }
}
