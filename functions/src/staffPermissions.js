import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { ACTIONS } from './domain.js';
import { DEMO_ACTIONS } from './demoDomain.js';
import { isAllowanceAdmin, isDemoAdmin, featureOptions } from './accessConfig.js';

const modules = {
  allowances: { collection: 'allowanceAccess', actions: ACTIONS, bootstrap: isAllowanceAdmin },
  demos: { collection: 'demoAccess', actions: DEMO_ACTIONS, bootstrap: isDemoAdmin },
};
const requireValue = (value, message, code = 'failed-precondition') => { if (!value) throw new HttpsError(code, message); };
const revision = (uid, grant) => grant ? createHash('sha256').update(JSON.stringify([uid, grant.staffId || '', grant.active === true, [...(grant.actions || [])].sort(), grant.presenterEnabled === true, grant.bootstrapAdmin === true])).digest('hex') : 'none';
const summarize = (uid, grant) => ({ uid, active: grant.active === true, actions: grant.actions || [], presenterEnabled: grant.presenterEnabled === true, revision: revision(uid, grant) });

async function canManage(read, db, uid, module) {
  const config = modules[module];
  if (config.bootstrap(uid)) return true;
  const grant = (await read(db.doc(`${config.collection}/${uid}`))).data();
  if (!grant?.active || grant.bootstrapAdmin || !grant.actions?.includes(`${module}:manage`)) return false;
  return !grant.staffId || (await read(db.doc(`staff/${grant.staffId}`))).data()?.status === 'active';
}

// Shared by the Staff Management editor; legacy staff checkboxes never authorize this endpoint.
export const staffModulePermissions = onCall(featureOptions, async request => {
  requireValue(request.auth, 'Sign in to manage staff permissions.', 'unauthenticated');
  const uid = request.auth.uid;
  const db = getFirestore();
  const operation = request.data?.operation;
  requireValue(['context', 'save'].includes(operation), 'Choose a valid permission operation.', 'invalid-argument');
  if (operation === 'context') {
    const result = {};
    for (const [module, config] of Object.entries(modules)) {
      const editable = await canManage(ref => ref.get(), db, uid, module);
      const grants = {};
      if (editable) {
        const records = await db.collection(config.collection).get();
        for (const record of records.docs) {
          const grant = record.data();
          if (!grant.staffId) continue;
          requireValue(!grants[grant.staffId], 'Resolve duplicate staff access mappings before editing permissions.');
          grants[grant.staffId] = summarize(record.id, grant);
        }
      }
      result[module] = { editable, grants };
    }
    return result;
  }

  const { staffId, changes } = request.data;
  requireValue(typeof staffId === 'string' && /^[a-zA-Z0-9_-]+$/.test(staffId), 'Select a valid staff record.', 'invalid-argument');
  requireValue(changes && typeof changes === 'object' && !Array.isArray(changes) && Object.keys(changes).length > 0 && Object.keys(changes).every(key => Object.hasOwn(modules, key)), 'Select valid module permissions.', 'invalid-argument');
  for (const module of Object.keys(changes)) requireValue(await canManage(ref => ref.get(), db, uid, module), 'You cannot manage these module permissions.', 'permission-denied');
  // Resolve the login on the server. No caller-supplied Auth UID is accepted.
  const staff = (await db.doc(`staff/${staffId}`).get()).data();
  requireValue(staff?.email, 'This staff member needs an existing portal login.');
  let user;
  try { user = await getAuth().getUserByEmail(staff.email.trim().toLowerCase()); }
  catch (error) {
    if (error.code === 'auth/user-not-found') throw new HttpsError('failed-precondition', 'Create a portal login for this staff member before assigning these permissions.');
    throw error;
  }
  const auditId = db.collection('staffPermissionAuditEvents').doc().id;
  return db.runTransaction(async tx => {
    const currentStaff = (await tx.get(db.doc(`staff/${staffId}`))).data();
    requireValue(currentStaff?.email === staff.email, 'The staff login changed. Reload the editor and retry.', 'aborted');
    const matches = await tx.get(db.collection('staff').where('email', '==', staff.email));
    requireValue(matches.size === 1, 'Resolve duplicate staff login records before granting access.');
    const writes = [];
    const result = {};
    for (const [module, change] of Object.entries(changes)) {
      const config = modules[module];
      requireValue(await canManage(ref => tx.get(ref), db, uid, module), `Only ${module === 'demos' ? 'scheduling' : 'allowance'} administrators can change these permissions.`, 'permission-denied');
      requireValue(change && typeof change.active === 'boolean' && Array.isArray(change.actions) && change.actions.every(action => config.actions.includes(action)) && typeof change.expectedRevision === 'string', 'Choose valid module permissions.', 'invalid-argument');
      requireValue(!config.bootstrap(user.uid), 'This login is a configured administrator; its access is managed by server configuration.');
      requireValue(!change.active || currentStaff.status === 'active' && !user.disabled, 'Activate the staff account and portal login before granting access.');
      const reference = db.doc(`${config.collection}/${user.uid}`);
      const previous = (await tx.get(reference)).data();
      requireValue(!previous?.staffId || previous.staffId === staffId, 'This login is already mapped to another staff record.');
      const linked = await tx.get(db.collection(config.collection).where('staffId', '==', staffId));
      requireValue(linked.docs.every(record => record.id === user.uid), 'This staff record is linked to a different login. Restore its original login before changing module permissions.');
      requireValue(change.expectedRevision === revision(user.uid, previous), 'Module permissions changed elsewhere. Reload the editor before saving.', 'aborted');
      const actions = [...new Set(change.actions)];
      if (module === 'allowances') {
        const account = (await tx.get(db.doc(`allowanceAccounts/${staffId}`))).data();
        requireValue(!account || account.ownerUid === user.uid, 'This allowance account belongs to a different login.');
      }
      if (module === 'demos') {
        requireValue(typeof change.presenterEnabled === 'boolean' && (!change.presenterEnabled || change.active && actions.includes('demos:present')), 'Bookable presenters need active presenter permissions.', 'invalid-argument');
      }
      const presenterEnabled = module === 'demos' && change.presenterEnabled;
      if (module === 'demos' && previous?.presenterEnabled && !presenterEnabled && currentStaff.status === 'active') {
        const meetings = await tx.get(db.collection('demoBookings').where('presenterUid', '==', user.uid).where('status', '==', 'confirmed').where('endAt', '>=', new Date().toISOString()).limit(1));
        requireValue(meetings.empty, 'Reassign or cancel this presenter’s upcoming demonstrations before removing presenter access.');
      }
      const value = { ...(previous || {}), staffId, active: change.active, actions, bootstrapAdmin: false, updatedAt: module === 'demos' ? new Date().toISOString() : Timestamp.now(), updatedByUid: uid };
      if (module === 'demos') Object.assign(value, { uid: user.uid, name: currentStaff.name || staff.email, email: staff.email, presenterEnabled });
      else Object.assign(value, { ownerUid: user.uid, staffName: currentStaff.name || staff.email });
      writes.push([reference, value]);
      result[module] = summarize(user.uid, value);
    }
    // Commit both modules together; one rejected change cannot partially grant the other.
    for (const [reference, value] of writes) tx.set(reference, value);
    tx.set(db.doc(`staffPermissionAuditEvents/${auditId}`), { actorUid: uid, staffId, targetUid: user.uid, modules: Object.keys(changes), changes: result, createdAt: Timestamp.now() });
    return result;
  });
});
