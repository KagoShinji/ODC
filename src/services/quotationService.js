import { auth, db } from '../lib/firebase.js';
import {
  collection, doc, onSnapshot, query, orderBy, runTransaction,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers.js';
import {
  controlMonthOf, formatControlNumber, calcQuotationTotals,
  calcLineAmount, defaultValidUntil,
} from '../utils/quotationDocument.js';

const quotationsRef = collection(db, 'quotations');
const nameOf = user => user.displayName || formatDisplayIdentifier(user.email);
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

/**
 * Validates and converts form values into sanitized quotation fields matching Firestore rules.
 */
export function quotationFields(form) {
  check(form.projectName?.trim(), 'Add a project name for the quotation.');
  check(form.clientBusiness?.trim(), 'Add the client business or enterprise name.');

  const signers = {};
  (form.signers || []).forEach((s, index) => {
    const name = (s.name || '').trim().slice(0, 200);
    const title = (s.title || '').trim().slice(0, 200);
    if (s.kind === 'accepted' ? name || title : name) {
      signers[s.id] = { kind: s.kind, name, title, order: index + 1 };
    }
  });

  check(Object.keys(signers).length <= 12, 'Use at most 12 signers.');

  const sanitizedItems = (form.items || []).slice(0, 50).map((item, idx) => {
    const desc = (item.description || '').trim().slice(0, 300) || `Item ${idx + 1}`;
    const rawQty = Number(item.quantity);
    const qty = Number.isNaN(rawQty) || rawQty < 0 ? 0 : rawQty;
    const rawPrice = Number(item.unitPrice);
    const unitPrice = Number.isNaN(rawPrice) || rawPrice < 0 ? 0 : rawPrice;
    return {
      id: item.id || `item_${idx + 1}`,
      description: desc,
      quantity: qty,
      unitPrice,
      amount: calcLineAmount(qty, unitPrice),
    };
  });

  const totals = calcQuotationTotals(
    sanitizedItems,
    form.discountPercent || 0,
    form.taxPercent || 0,
  );

  return {
    projectName: form.projectName.trim().slice(0, 300),
    clientBusiness: form.clientBusiness.trim().slice(0, 300),
    clientName: (form.clientName || '').trim().slice(0, 200),
    clientAddress: (form.clientAddress || '').trim().slice(0, 300),
    clientEmail: (form.clientEmail || '').trim().slice(0, 100),
    clientPhone: (form.clientPhone || '').trim().slice(0, 50),
    date: form.date || '',
    validUntil: form.validUntil || defaultValidUntil(form.date),
    paymentTerms: (form.paymentTerms || '').trim().slice(0, 200),
    items: sanitizedItems,
    subtotal: totals.subtotal,
    discountPercent: totals.discountPercent,
    discountAmount: totals.discountAmount,
    taxPercent: totals.taxPercent,
    taxAmount: totals.taxAmount,
    total: totals.total,
    totalWords: totals.totalWords.slice(0, 300),
    scopeText: (form.scopeText || '').slice(0, 80000),
    scopeJson: (form.scopeJson || '').slice(0, 400000),
    signers,
  };
}

export function subscribeQuotations(onData, onError) {
  return onSnapshot(query(quotationsRef, orderBy('createdAt', 'desc')), snap => onData(rows(snap)), onError);
}

export function subscribeQuotation(id, onData, onError) {
  return onSnapshot(doc(db, 'quotations', id), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

export function subscribeQuotationSignatures(id, onData, onError) {
  return onSnapshot(collection(db, 'quotations', id, 'signatures'), snap => onData(Object.fromEntries(snap.docs.map(d => {
    const data = d.data();
    return [d.id, { ...data, signedAt: data.signedAt?.toDate?.().toISOString() || new Date().toISOString() }];
  }))), onError);
}

/**
 * Creates a quotation draft and reserves the sequential control number atomically.
 */
export async function createQuotation(user, form) {
  const fields = quotationFields(form);
  const month = controlMonthOf();
  const counter = doc(db, 'quotationCounters', month);
  const ref = doc(quotationsRef);

  await runTransaction(db, async tx => {
    const snap = await tx.get(counter);
    const seq = (snap.exists() ? snap.data().last : 0) + 1;
    tx.set(counter, { last: seq });
    tx.set(ref, {
      ...fields,
      controlMonth: month,
      controlSeq: seq,
      controlNumber: formatControlNumber(month, seq),
      status: 'draft',
      statusReason: '',
      revokedReason: '',
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByName: nameOf(user),
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      issuedAt: null,
      acceptedAt: null,
      revokedAt: null,
    });
  });

  return ref.id;
}

export async function updateQuotation(user, id, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'quotations', id), {
    ...quotationFields(form),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function issueQuotation(user, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'quotations', id), {
    status: 'issued',
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function revokeQuotation(user, id, reason) {
  check(reason?.trim(), 'Provide a reason for revoking this quotation.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'quotations', id), {
    status: 'revoked',
    revokedReason: reason.trim().slice(0, 500),
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function deleteQuotationDraft(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'quotations', id));
  await batch.commit();
}

export const isConformeSlot = (slotId, signatureData = {}) =>
  (signatureData.kind ? signatureData.kind === 'accepted' : slotId === 's2');

/**
 * Signs the quotation as client or issuer, recording an immutable audit entry and marking document accepted
 * when signed by the client Conforme slot.
 */
export async function signQuotation(id, slotId, signatureData) {
  const typed = normalizeSignerName(signatureData?.name);
  check(typed.length >= 2, 'Type your full name (at least 2 characters) to sign.');
  const currentUser = auth.currentUser;
  const sigRef = doc(db, 'quotations', id, 'signatures', slotId);
  const quoteRef = doc(db, 'quotations', id);

  const payload = {
    name: typed.slice(0, 200),
    title: (signatureData.title || '').trim().slice(0, 200),
    signedAt: serverTimestamp(),
    signedByUid: currentUser?.uid || '',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 300),
  };
  if (signatureData.signatureImage) {
    payload.signatureImage = signatureData.signatureImage;
  }

  const batch = writeBatch(db);
  batch.set(sigRef, payload);
  // Only client Conforme acceptance transitions the parent quotation to accepted;
  // issuer / prepared signatures only append the immutable signature entry.
  if (isConformeSlot(slotId, signatureData)) {
    batch.update(quoteRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: currentUser?.uid || 'client-conforme',
    });
  }
  await batch.commit();
}
