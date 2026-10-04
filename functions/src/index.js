import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineString } from 'firebase-functions/params';
import { createHash } from 'node:crypto';
import { ACTIONS, DEFAULT_POLICY, DomainError, check, idValue } from './domain.js';
import { executeCommand } from './commands.js';

initializeApp();
const db = getFirestore();
const adminUids = defineString('ALLOWANCE_ADMIN_UIDS', { default: '', description: 'Comma-separated Firebase Auth UIDs authorized to bootstrap allowance administration.' });
// All feature endpoints share the same region and production App Check requirement.
const options = { region: 'asia-southeast1', enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true', maxInstances: 10 };
const isBootstrap = uid => adminUids.value().split(',').map(x => x.trim()).filter(Boolean).includes(uid);
const toWire = value => value instanceof Timestamp ? value.toDate().toISOString() : Array.isArray(value) ? value.map(toWire) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toWire(v)])) : value;
const timestampKeys = new Set(['createdAt', 'updatedAt', 'submittedAt', 'reviewedAt', 'releasedAt', 'correctedAt', 'frozenAt']);
function toFirestore(value) {
  if (Array.isArray(value)) return value.map(toFirestore);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, timestampKeys.has(k) && typeof v === 'string' && v.includes('T') ? Timestamp.fromDate(new Date(v)) : toFirestore(v)]));
}
function authenticated(request) { if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to use allowances.'); return request.auth.uid; }
function handle(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof DomainError) throw new HttpsError(error.code, error.message);
  console.error('Allowance command failed', error);
  throw new HttpsError('internal', 'The allowance operation could not be completed. Retry with the same submission.');
}

export const allowanceContext = onCall(options, async request => {
  const uid = authenticated(request);
  try {
    const bootstrapAdmin = isBootstrap(uid);
    const accessRef = db.doc(`allowanceAccess/${uid}`);
    let access = (await accessRef.get()).data();
    if (bootstrapAdmin) {
      // Rules and browser reads use the same trusted authority as backend commands.
      access = { ...access, ownerUid: uid, active: true, actions: ACTIONS, bootstrapAdmin: true };
      await accessRef.set(access, { merge: true });
    } else if (access?.bootstrapAdmin) {
      // Removing a bootstrap UID must revoke its old materialized administrator grant.
      access = { ...access, active: false, actions: [], bootstrapAdmin: false };
      await accessRef.set(access);
    }
    const settings = (await db.doc('allowanceSettings/current').get()).data();
    if (!bootstrapAdmin && access?.staffId) {
      const roster = (await db.doc(`staff/${access.staffId}`).get()).data();
      if (roster?.status !== 'active') access = null;
    }
    return { access: access?.active ? toWire(access) : null, enabled: settings?.enabled === true, policy: settings?.policy || DEFAULT_POLICY, policyVersion: settings?.policyVersion || '', bootstrapAdmin };
  } catch (error) { handle(error); }
});

export const allowanceCommand = onCall(options, async request => {
  const uid = authenticated(request);
  try {
    check(request.data && typeof request.data === 'object', 'Invalid command.', 'invalid-argument');
    const { command, payload = {}, commandId } = request.data;
    check(typeof command === 'string' && command.length < 64, 'Invalid command.', 'invalid-argument');
    check(typeof commandId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(commandId), 'Invalid submission key.', 'invalid-argument');
    check(JSON.stringify(payload).length <= 150000, 'Submission is too large.', 'invalid-argument');
    const actor = { uid, email: request.auth.token.email || '', bootstrapAdmin: isBootstrap(uid) };
    // Resolve identities and Storage metadata on the server, never trust caller-supplied verification.
    if (command === 'grantAccess') {
      const access = (await db.doc(`allowanceAccess/${uid}`).get()).data();
      check(actor.bootstrapAdmin || access?.active && access.actions?.includes('allowances:manage'), 'Only allowance administrators can grant access.', 'permission-denied');
      const staffId = idValue(payload.staffId);
      const staff = (await db.doc(`staff/${staffId}`).get()).data();
      check(staff?.email, 'The staff record needs an existing Firebase login.');
      const user = await getAuth().getUserByEmail(staff.email.trim().toLowerCase());
      check(!user.disabled, 'This Firebase login is disabled.');
      const matchingStaff = await db.collection('staff').where('email', '==', staff.email).get();
      check(matchingStaff.size === 1, 'Resolve duplicate staff email records before granting access.');
      payload.authUid = user.uid;
    }
    if (command === 'finalizeAttachment') {
      const file = (await db.doc(`allowanceAttachments/${idValue(payload.id)}`).get()).data();
      check(file && file.ownerUid === uid, 'You cannot access this attachment.', 'permission-denied');
      const [metadata] = await getStorage().bucket().file(file.objectPath).getMetadata();
      actor.fileMetadata = { size: metadata.size, contentType: metadata.contentType, md5Hash: metadata.md5Hash };
    }
    const digest = createHash('sha256').update(JSON.stringify({ command, payload })).digest('hex');
    const result = await db.runTransaction(async transaction => {
      const resultRef = db.doc(`allowanceCommandResults/${uid}_${commandId}`);
      const previous = (await transaction.get(resultRef)).data();
      if (previous) { check(previous.digest === digest, 'A submission key cannot be reused for a different operation.', 'invalid-argument'); return previous.result; }
      const writes = new Map();
      const repo = {
        async get(collection, id) { check(typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id), 'Invalid record identifier.', 'invalid-argument'); return toWire((await transaction.get(db.collection(collection).doc(id))).data()); },
        set(collection, id, value) { writes.set(`${collection}/${id}`, value); },
      };
      const output = await executeCommand(repo, actor, command, payload, commandId);
      for (const [path, value] of writes) transaction.set(db.doc(path), toFirestore(value));
      transaction.set(resultRef, { digest, result: output, ownerUid: uid, createdAt: Timestamp.now() });
      return output;
    });
    return result;
  } catch (error) { handle(error); }
});

// Remove only abandoned draft uploads. Submitted/returned/approved evidence is retained.
export const cleanupAllowanceDraftUploads = onSchedule({ schedule: 'every 24 hours', region: options.region, timeZone: 'Asia/Manila', maxInstances: 1 }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - 30 * 86400000);
  const files = await db.collection('allowanceAttachments').where('cleanupCandidate', '==', true).where('createdAt', '<', cutoff).limit(200).get();
  for (const document of files.docs) {
    // Serialize with submission on the slip document. Deny uploading while deletion is pending.
    const claimed = await db.runTransaction(async tx => {
      const ref = db.doc(`allowanceLiquidations/${document.data().liquidationId}`);
      const slip = (await tx.get(ref)).data();
      const file = (await tx.get(document.ref)).data();
      if (!file?.cleanupCandidate || slip && (slip.status !== 'draft' || slip.attachmentIds?.includes(document.id))) return false;
      tx.update(document.ref, { deleting: true });
      return true;
    });
    if (claimed) {
      await getStorage().bucket().file(document.data().objectPath).delete({ ignoreNotFound: true });
      await document.ref.delete();
    }
  }
});

// A legacy staff suspension revokes trusted feature grants. Reactivation requires an explicit grant.
export const revokeSuspendedAllowanceAccess = onDocumentWritten({ document: 'staff/{staffId}', region: options.region, maxInstances: 2 }, async event => {
  const current = (await db.doc(`staff/${event.params.staffId}`).get()).data();
  if (current?.status === 'active') return;
  const grants = await db.collection('allowanceAccess').where('staffId', '==', event.params.staffId).get();
  const batch = db.batch();
  for (const grant of grants.docs) batch.update(grant.ref, { active: false, updatedAt: Timestamp.now() });
  await batch.commit();
});
