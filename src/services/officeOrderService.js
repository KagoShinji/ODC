import { auth, db } from '../lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers';
import { controlMonthOf, formatControlNumber } from '../utils/officeOrderDocument';

const ordersRef = collection(db, 'officeOrders');
const nameOf = user => user.displayName || formatDisplayIdentifier(user.email);
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

function check(condition, message) { if (!condition) throw new Error(message); }

/**
 * Form values → stored fields, trimmed to the limits the security rules enforce.
 * `bodyJson` is the editor document (rendered on the page); `body` keeps its plain text for search.
 */
function orderFields(form) {
  const signers = {};
  form.signers.forEach((s, index) => {
    const name = s.name.trim().slice(0, 200);
    const title = s.title.trim().slice(0, 200);
    if (s.kind === 'acknowledger' ? name || title : name) signers[s.id] = { kind: s.kind, name, title, order: index + 1 };
  });
  check(form.subject.trim(), 'Add a subject for the office order.');
  check(form.bodyText.trim(), 'Write or paste the content of the office order.');
  check(form.bodyJson.length <= 400000, 'The office order is too long. Move long material into a separate document.');
  check(Object.values(signers).some(s => s.kind === 'issuer'), 'Add who approves the office order.');
  check(Object.keys(signers).length <= 12, 'Use at most 12 signers.');
  return {
    subject: form.subject.trim().slice(0, 300), to: form.to.trim().slice(0, 300), cc: form.cc.trim().slice(0, 300),
    fromName: form.fromName.trim().slice(0, 200), fromTitle: form.fromTitle.trim().slice(0, 200),
    date: form.date || '', effectivity: form.effectivity || '', body: form.bodyText.slice(0, 80000), bodyJson: form.bodyJson, signers,
  };
}

export function subscribeOfficeOrders(onData, onError) {
  return onSnapshot(query(ordersRef, orderBy('createdAt', 'desc')), snap => onData(rows(snap)), onError);
}
export function subscribeOfficeOrder(id, onData, onError) {
  return onSnapshot(doc(db, 'officeOrders', id), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}
/** Signatures keyed by signer slot id, with signedAt as an ISO string for the document renderer. */
export function subscribeSignatures(id, onData, onError) {
  return onSnapshot(collection(db, 'officeOrders', id, 'signatures'), snap => onData(Object.fromEntries(snap.docs.map(d => {
    const data = d.data();
    return [d.id, { ...data, signedAt: data.signedAt?.toDate?.().toISOString() || new Date().toISOString() }];
  }))), onError);
}

/** Creates a draft and reserves the next control number (OO-YYYY-MM-NNN) atomically. */
export async function createOfficeOrder(user, form) {
  const fields = orderFields(form);
  const month = controlMonthOf();
  const counter = doc(db, 'officeOrderCounters', month);
  const ref = doc(ordersRef);
  await runTransaction(db, async tx => {
    const snap = await tx.get(counter);
    const seq = (snap.exists() ? snap.data().last : 0) + 1;
    tx.set(counter, { last: seq });
    tx.set(ref, {
      ...fields, controlMonth: month, controlSeq: seq, controlNumber: formatControlNumber(month, seq), status: 'draft',
      createdAt: serverTimestamp(), createdByUid: user.uid, createdByName: nameOf(user),
      updatedAt: serverTimestamp(), updatedByUid: user.uid, issuedAt: null, revokedAt: null, revokedReason: '',
    });
  });
  return ref.id;
}

export async function updateOfficeOrder(user, id, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'officeOrders', id), { ...orderFields(form), updatedAt: serverTimestamp(), updatedByUid: user.uid });
  await batch.commit();
}

export async function issueOfficeOrder(user, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'officeOrders', id), { status: 'issued', issuedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: user.uid });
  await batch.commit();
}

export async function revokeOfficeOrder(user, id, reason) {
  check(reason?.trim(), 'Give the reason for revoking this office order.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'officeOrders', id), { status: 'revoked', revokedReason: reason.trim().slice(0, 500), revokedAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedByUid: user.uid });
  await batch.commit();
}

export async function deleteOfficeOrderDraft(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'officeOrders', id));
  await batch.commit();
}

/** Collapses spacing so "Juan  Dela Cruz " matches "Juan Dela Cruz" (the rules compare trimmed, lower-cased names). */
export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

/**
 * Records a signature for one signer slot. `user` is the signed-in admin; when signing via the link it falls back
 * to whoever is signed in on this browser, because the rules require signedByUid to match the current session
 * (empty only when nobody is signed in).
 */
export async function signOfficeOrder(id, slotId, name, user = auth.currentUser) {
  const typed = normalizeSignerName(name);
  check(typed.length >= 2, 'Type your full name to sign.');
  await setDoc(doc(db, 'officeOrders', id, 'signatures', slotId), {
    name: typed.slice(0, 200), signedAt: serverTimestamp(), signedByUid: user?.uid || '',
    userAgent: (navigator.userAgent || '').slice(0, 300),
  });
}
