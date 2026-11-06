import { auth, db } from '../lib/firebase.js';
import { collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers.js';
import { controlMonthOf, formatControlNumber, toIsoDate } from '../utils/auditReportDocument.js';

const reportsRef = collection(db, 'auditReports');
const nameOf = user => user?.displayName || formatDisplayIdentifier(user?.email || '');
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

function check(condition, message) { if (!condition) throw new Error(message); }

/** Collapses spacing so "Maria  Santos " matches "Maria Santos" (the rules compare trimmed, lower-cased names). */
export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

/**
 * Form values → stored fields, trimmed to the limits the security rules enforce.
 * `bodyJson` is the editor document (rendered on the page); `body` keeps its plain text for search.
 */
function reportFields(form) {
  const signers = {};
  (form.signers || []).forEach((s, index) => {
    const name = normalizeSignerName(s.name).slice(0, 200);
    const title = (s.title || '').trim().slice(0, 200);
    if (s.kind === 'acknowledger' ? name || title : name) {
      signers[s.id || `s${index + 1}`] = { kind: s.kind || 'auditor', name, title, order: index + 1 };
    }
  });

  check(form.title?.trim(), 'Add a title for the audit report.');
  check(form.bodyText?.trim(), 'Write or paste the content of the audit report.');
  check((form.bodyJson || '').length <= 400000, 'The audit report is too long. Move long attachments into a separate file.');
  check(form.leadAuditorName?.trim() || Object.values(signers).some(s => s.kind === 'auditor' && s.name), 'Add who served as lead auditor for this report.');
  check(Object.values(signers).some(s => s.kind === 'approver' && s.name), 'Add an approver for this audit report.');
  check(Object.keys(signers).length <= 12, 'Use at most 12 signers.');

  const category = ['it_security', 'operations', 'financial', 'compliance', 'inventory', 'quality', 'other'].includes(form.category)
    ? form.category : 'it_security';
  const rating = ['satisfactory', 'needs_improvement', 'unsatisfactory'].includes(form.rating)
    ? form.rating : 'satisfactory';

  return {
    title: form.title.trim().slice(0, 300),
    referenceNo: (form.referenceNo || '').trim().slice(0, 100),
    classification: (form.classification || '').trim().slice(0, 200),
    venueDomain: (form.venueDomain || '').trim().slice(0, 200),
    category,
    rating,
    auditPeriodStart: toIsoDate(form.auditPeriodStart) || form.auditPeriodStart || '',
    auditPeriodEnd: toIsoDate(form.auditPeriodEnd) || form.auditPeriodEnd || '',
    auditDate: toIsoDate(form.auditDate) || form.auditDate || '',
    dateIssued: toIsoDate(form.dateIssued) || form.dateIssued || '',
    leadAuditorName: (form.leadAuditorName || '').trim().slice(0, 200),
    leadAuditorTitle: (form.leadAuditorTitle || '').trim().slice(0, 200),
    auditeeEntity: (form.auditeeEntity || '').trim().slice(0, 200),
    auditeeContact: (form.auditeeContact || '').trim().slice(0, 200),
    auditTeam: (form.auditTeam || '').trim().slice(0, 300),
    body: (form.bodyText || '').slice(0, 80000),
    bodyJson: form.bodyJson || '',
    signers,
  };
}

export function subscribeAuditReports(onData, onError) {
  return onSnapshot(query(reportsRef, orderBy('createdAt', 'desc')), snap => onData(rows(snap)), onError);
}

export function subscribeAuditReport(id, onData, onError) {
  return onSnapshot(doc(db, 'auditReports', id), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

/** Signatures keyed by signer slot id, with signedAt as an ISO string for the document renderer. */
export function subscribeAuditSignatures(id, onData, onError) {
  return onSnapshot(collection(db, 'auditReports', id, 'signatures'), snap => onData(Object.fromEntries(snap.docs.map(d => {
    const data = d.data();
    return [d.id, { ...data, signedAt: data.signedAt?.toDate?.().toISOString() || new Date().toISOString() }];
  }))), onError);
}

/** Creates a draft and reserves the next control number (AR-YYYY-MM-NNN) atomically. */
export async function createAuditReport(user, form) {
  const fields = reportFields(form);
  const month = controlMonthOf();
  const counter = doc(db, 'auditReportCounters', month);
  const ref = doc(reportsRef);

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
      createdAt: serverTimestamp(),
      createdByUid: user.uid,
      createdByName: nameOf(user),
      updatedAt: serverTimestamp(),
      updatedByUid: user.uid,
      issuedAt: null,
      closedAt: null,
      revokedAt: null,
    });
  });
  return ref.id;
}

export async function updateAuditReport(user, id, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'auditReports', id), {
    ...reportFields(form),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function issueAuditReport(user, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'auditReports', id), {
    status: 'issued',
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function closeAuditReport(user, id, reason = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'auditReports', id), {
    status: 'closed',
    statusReason: (reason || '').trim().slice(0, 500),
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function revokeAuditReport(user, id, reason) {
  check(reason?.trim(), 'State the reason for revoking this audit report.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'auditReports', id), {
    status: 'revoked',
    statusReason: reason.trim().slice(0, 500),
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function deleteAuditReportDraft(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'auditReports', id));
  await batch.commit();
}

/**
 * Records a signature for one signer slot in auditReports/{id}/signatures/{slotId}.
 */
export async function signAuditReport(id, slotId, name, user = auth.currentUser) {
  const typed = normalizeSignerName(name);
  check(typed.length >= 2, 'Type your full name to sign.');
  await setDoc(doc(db, 'auditReports', id, 'signatures', slotId), {
    name: typed.slice(0, 200),
    signedAt: serverTimestamp(),
    signedByUid: user?.uid || '',
    userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 300) : '',
  });
}
