import { auth, db } from '../lib/firebase';
import { collection, doc, onSnapshot, query, orderBy, runTransaction, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers';
import { controlMonthOf, formatControlNumber, toIsoDate } from '../utils/incidentReportDocument';

const reportsRef = collection(db, 'incidentReports');
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
      signers[s.id || `s${index + 1}`] = { kind: s.kind || 'reporter', name, title, order: index + 1 };
    }
  });

  check(form.title?.trim(), 'Add a title for the incident report.');
  check(form.bodyText?.trim(), 'Write or paste the content of the incident report.');
  check((form.bodyJson || '').length <= 400000, 'The incident report is too long. Move long attachments into a separate file.');
  check(form.reportedByName?.trim() || Object.values(signers).some(s => s.kind === 'reporter' && s.name), 'Add who filed this incident report.');
  check(Object.values(signers).some(s => s.kind === 'approver' && s.name), 'Add an approver for this incident report.');
  check(Object.keys(signers).length <= 12, 'Use at most 12 signers.');

  const category = ['operational', 'security', 'conduct', 'safety', 'equipment', 'other'].includes(form.category)
    ? form.category : 'operational';
  const severity = ['low', 'medium', 'high', 'critical'].includes(form.severity)
    ? form.severity : 'medium';

  return {
    title: form.title.trim().slice(0, 300),
    incidentDate: toIsoDate(form.incidentDate) || form.incidentDate || '',
    incidentTime: (form.incidentTime || '').trim().slice(0, 30),
    dateReported: toIsoDate(form.dateReported) || form.dateReported || '',
    location: (form.location || '').trim().slice(0, 200),
    category,
    severity,
    reportedByName: (form.reportedByName || '').trim().slice(0, 200),
    reportedByTitle: (form.reportedByTitle || '').trim().slice(0, 200),
    personsInvolved: (form.personsInvolved || '').trim().slice(0, 300),
    body: (form.bodyText || '').slice(0, 80000),
    bodyJson: form.bodyJson || '',
    signers,
  };
}

export function subscribeIncidentReports(onData, onError) {
  return onSnapshot(query(reportsRef, orderBy('createdAt', 'desc')), snap => onData(rows(snap)), onError);
}

export function subscribeIncidentReport(id, onData, onError) {
  return onSnapshot(doc(db, 'incidentReports', id), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}

/** Signatures keyed by signer slot id, with signedAt as an ISO string for the document renderer. */
export function subscribeIncidentSignatures(id, onData, onError) {
  return onSnapshot(collection(db, 'incidentReports', id, 'signatures'), snap => onData(Object.fromEntries(snap.docs.map(d => {
    const data = d.data();
    return [d.id, { ...data, signedAt: data.signedAt?.toDate?.().toISOString() || new Date().toISOString() }];
  }))), onError);
}

/** Creates a draft and reserves the next control number (IR-YYYY-MM-NNN) atomically. */
export async function createIncidentReport(user, form) {
  const fields = reportFields(form);
  const month = controlMonthOf();
  const counter = doc(db, 'incidentReportCounters', month);
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

export async function updateIncidentReport(user, id, form) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'incidentReports', id), {
    ...reportFields(form),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function issueIncidentReport(user, id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'incidentReports', id), {
    status: 'issued',
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function closeIncidentReport(user, id, reason = '') {
  const batch = writeBatch(db);
  batch.update(doc(db, 'incidentReports', id), {
    status: 'closed',
    statusReason: (reason || '').trim().slice(0, 500),
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function revokeIncidentReport(user, id, reason) {
  check(reason?.trim(), 'State the reason for revoking this incident report.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'incidentReports', id), {
    status: 'revoked',
    statusReason: reason.trim().slice(0, 500),
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByUid: user.uid,
  });
  await batch.commit();
}

export async function deleteIncidentReportDraft(id) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'incidentReports', id));
  await batch.commit();
}

/**
 * Records a signature for one signer slot in incidentReports/{id}/signatures/{slotId}.
 */
export async function signIncidentReport(id, slotId, name, user = auth.currentUser) {
  const typed = normalizeSignerName(name);
  check(typed.length >= 2, 'Type your full name to sign.');
  await setDoc(doc(db, 'incidentReports', id, 'signatures', slotId), {
    name: typed.slice(0, 200),
    signedAt: serverTimestamp(),
    signedByUid: user?.uid || '',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '').slice(0, 300),
  });
}

