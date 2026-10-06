import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ACTIONS, DEFAULT_POLICY, check, idValue } from '../../../functions/src/domain.js';
import { DEMO_ACTIONS, DEFAULT_DEMO_POLICY, requireDemo, demoDate, demoSlots, clockMinutes } from '../../../functions/src/demoDomain.js';
import { executeCommand } from '../../../functions/src/commands.js';
import { executeDemoCommand, demoAuthority, activePresenter, canManageBooking } from '../../../functions/src/demoCommands.js';
import { firestoreRepository, financialValue, toWire } from './firestoreRepository.js';
import { OPERATIONS_ROOT_UID, FIRESTORE_CAPABILITIES } from './config.js';

const configs = { demos: { collection: 'demoAccess', actions: DEMO_ACTIONS }, allowances: { collection: 'allowanceAccess', actions: ACTIONS } };
const slotsFor = ranges => [...new Set((ranges || []).flatMap(range => Array.from({ length: (clockMinutes(range.end) - clockMinutes(range.start)) / 15 }, (_, index) => String(clockMinutes(range.start) / 15 + index))))];
const bookingSlots = booking => Array.from({ length: (booking.occupiedEndMinute - booking.startMinute) / 15 }, (_, index) => String(booking.startMinute / 15 + index));
const grantRevision = (uid, grant) => grant ? JSON.stringify([uid, grant.staffId || '', grant.active === true, [...(grant.actions || [])].sort(), grant.presenterEnabled === true]) : 'none';
const summarize = (uid, grant) => ({ uid, active: grant.active === true, actions: grant.actions || [], presenterEnabled: grant.presenterEnabled === true, revision: grantRevision(uid, grant) });

export function createFirestoreOperations({ auth, db }) {
  async function user() {
    const value = auth.currentUser;
    check(value, 'Sign in to use this feature.', 'unauthenticated');
    return value;
  }
  async function registerStaffIdentity(staffId, identity) {
    const current = await user();
    const target = identity || { uid: current.uid, email: current.email };
    await runTransaction(db, async tx => {
      const ref = doc(db, 'staffLoginIdentities', target.uid);
      const existing = (await tx.get(ref)).data();
      check(!existing || existing.staffId === staffId && existing.email === target.email.toLowerCase(), 'This login is already linked to another staff record.');
      if (!existing) tx.set(ref, { uid: target.uid, staffId, email: target.email.toLowerCase(), createdAt: serverTimestamp() });
    });
  }
  async function actor(module) {
    const current = await user();
    const bootstrapAdmin = current.uid === OPERATIONS_ROOT_UID;
    if (bootstrapAdmin) {
      const config = configs[module];
      await runTransaction(db, async tx => {
        const reference = doc(db, config.collection, current.uid);
        const previous = (await tx.get(reference)).data();
        if (!previous?.active || !previous.bootstrapAdmin || previous.staffId || !config.actions.every(action => previous.actions?.includes(action))) {
          tx.set(reference, { uid: current.uid, ownerUid: current.uid, name: current.displayName || current.email, email: current.email, staffId: '', active: true, actions: config.actions, bootstrapAdmin: true, presenterEnabled: previous?.presenterEnabled === true });
        }
      });
    } else {
      const identity = await getDoc(doc(db, 'staffLoginIdentities', current.uid));
      if (!identity.exists()) {
        const staff = await getDocs(query(collection(db, 'staff'), where('email', '==', current.email.toLowerCase()), limit(2)));
        if (staff.size === 1) await registerStaffIdentity(staff.docs[0].id);
      }
    }
    return { uid: current.uid, email: current.email, name: current.displayName || current.email, bootstrapAdmin, capabilities: FIRESTORE_CAPABILITIES };
  }
  async function context(module) {
    const current = await actor(module);
    const repo = firestoreRepository(db);
    let access = await repo.get(configs[module].collection, current.uid);
    if (access?.staffId) {
      const staff = await repo.get('staff', access.staffId);
      if (staff?.status !== 'active' || staff.email?.toLowerCase() !== current.email.toLowerCase() || access.email?.toLowerCase() !== current.email.toLowerCase()) access = null;
    }
    if (access?.bootstrapAdmin && !current.bootstrapAdmin) access = null;
    const settings = access?.active ? await repo.get(module === 'demos' ? 'demoSettings' : 'allowanceSettings', 'current') : null;
    return { access: access?.active ? access : null, enabled: settings?.enabled === true, policy: settings?.policy || (module === 'demos' ? DEFAULT_DEMO_POLICY : DEFAULT_POLICY), policyVersion: settings?.policyVersion || '', bootstrapAdmin: current.bootstrapAdmin, capabilities: FIRESTORE_CAPABILITIES };
  }
  async function targetFor(repo, staffId) {
    const staff = await repo.get('staff', idValue(staffId));
    check(staff?.email, 'Select a staff member with a portal login.');
    const mappings = await repo.query('staffLoginIdentities', [['staffId', '==', staffId]], 2);
    check(mappings.length > 0, 'This staff login is not linked yet. Have the staff member sign out and sign back in at /odc, then reopen this record and save the permissions again.', 'staff/login-not-linked');
    check(mappings.length === 1, 'Multiple logins are linked to this staff record. Ask the project administrator to resolve the duplicate links before assigning permissions.');
    check(mappings[0].email === staff.email.toLowerCase(), 'The staff email no longer matches its linked login. Restore the original login email before assigning permissions.');
    return { ...mappings[0], name: staff.name || staff.email };
  }
  async function command(module, name, payload, commandId) {
    const current = await actor(module);
    check(typeof commandId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(commandId), 'Invalid submission key.', 'invalid-argument');
    const clean = JSON.parse(JSON.stringify(payload));
    if (module === 'allowances' && name === 'saveLiquidation') {
      check(clean.lines?.length <= FIRESTORE_CAPABILITIES.maxExpenseLines, 'Use at most three expense lines per meeting in this version. Combine matching purchases into one item.');
      check(clean.lines.every(line => (line.attachmentIds || []).length <= 1), 'Use one evidence reference per expense line.');
    }
    const signature = JSON.stringify({ name, payload: clean });
    return runTransaction(db, async tx => {
      const repo = firestoreRepository(db, tx, { authorizationOutsideTransaction: true });
      if (module === 'demos') await demoAuthority(repo, current);
      else {
        const access = await repo.get('allowanceAccess', current.uid);
        check(current.bootstrapAdmin || access?.active, 'Allowance access has not been granted.', 'permission-denied');
        if (!current.bootstrapAdmin && access?.staffId) check((await repo.get('staff', access.staffId))?.status === 'active', 'Your staff account is inactive.', 'permission-denied');
      }
      const operationId = `${current.uid}_${commandId}`;
      const resultRef = doc(db, `${module === 'demos' ? 'demo' : 'allowance'}CommandResults`, operationId);
      const old = (await tx.get(resultRef)).data();
      if (old) { check(old.signature === signature, 'A submission key cannot be reused for another action.', 'invalid-argument'); return old.result; }
      // Read a presenter lock before upcoming-meeting queries; booking writes touch the same lock.
      if (module === 'demos') {
        const presenter = clean.presenterUid || (name === 'setMyPresenter' ? current.uid : null);
        if (presenter) await repo.get('demoPresenterState', presenter);
      }
      let target;
      if (name === 'grantAccess') {
        target = await targetFor(repo, clean.staffId);
        if (module === 'allowances') clean.authUid = target.uid;
        else { current.verifiedTarget = { ...target, bootstrapAdmin: target.uid === OPERATIONS_ROOT_UID }; await repo.get('demoPresenterState', target.uid); }
      }
      const result = module === 'demos' ? await executeDemoCommand(repo, current, name, clean, commandId) : await executeCommand(repo, current, name, clean, commandId);
      if (module === 'allowances' && name === 'grantAccess') {
        const path = `allowanceAccess/${target.uid}`;
        repo.writes.set(path, { ...repo.writes.get(path), email: target.email });
      }
      if (module === 'demos') await enrichDemoWrites(repo, name, operationId);
      else await enrichAllowanceWrites(repo, name, clean, operationId);
      for (const [path, value] of repo.writes) tx.set(doc(db, path), module === 'allowances' ? financialValue({ ...value, lastOperationId: operationId }) : { ...value, lastOperationId: operationId });
      tx.set(resultRef, { actorUid: current.uid, ownerUid: current.uid, command: name, payload: clean, signature, result, accountId: clean.accountId || clean.staffId || '', createdAt: serverTimestamp() });
      return result;
    });
  }
  async function enrichDemoWrites(repo, name, operationId) {
    const bookings = [...repo.writes].filter(([path]) => path.startsWith('demoBookings/'));
    const deltas = new Map();
    for (const [path, booking] of bookings) {
      const previous = await repo.get('demoBookings', booking.id);
      const slotKeys = bookingSlots(booking);
      repo.writes.set(path, { ...booking, slotKeys, startsAt: Timestamp.fromDate(new Date(booking.startAt)), endsAt: Timestamp.fromDate(new Date(booking.endAt)), dayAt: Timestamp.fromDate(new Date(`${booking.date}T00:00:00Z`)), weekday: new Date(`${booking.date}T12:00:00+08:00`).getUTCDay() });
      for (const value of [previous, booking]) {
        if (!value) continue;
        const dayId = `${value.presenterUid}_${value.date}`;
        const dayPath = `demoDays/${dayId}`;
        const old = await repo.get('demoDays', dayId);
        const pending = repo.writes.get(dayPath);
        if (pending) {
          const claims = { ...(pending.claims || old?.claims || {}) };
          if (value === previous) for (const key of previous.slotKeys || bookingSlots(previous)) { if (claims[key] === previous.id) delete claims[key]; }
          if (value === booking && booking.status === 'confirmed') for (const key of slotKeys) claims[key] = booking.id;
          repo.writes.set(dayPath, { ...old, ...pending, claims, presenterUid: value.presenterUid, date: value.date, dayAt: Timestamp.fromDate(new Date(`${value.date}T00:00:00Z`)), changedBookingId: booking.id, override: old?.override === true, availableSlots: old?.availableSlots || [] });
        }
      }
      if (previous?.status === 'confirmed') deltas.set(previous.presenterUid, (deltas.get(previous.presenterUid) || 0) - 1);
      if (booking.status === 'confirmed') deltas.set(booking.presenterUid, (deltas.get(booking.presenterUid) || 0) + 1);
    }
    for (const [uid, delta] of deltas) {
      const state = await repo.get('demoPresenterState', uid);
      repo.set('demoPresenterState', uid, { confirmedCount: (state?.confirmedCount || 0) + delta, version: (state?.version || 0) + 1, bookingId: bookings[0][1].id, lastOperationId: operationId });
    }
    for (const [path, value] of [...repo.writes]) {
      if (path.startsWith('demoAccess/') && !value.presenterEnabled) {
        const state = await repo.get('demoPresenterState', path.split('/')[1]);
        check(!state?.confirmedCount, 'Reassign or finish confirmed demonstrations before removing presenter access.');
      }
      if (path.startsWith('demoAvailability/')) {
        const uid = path.split('/')[1];
        const previous = await repo.get('demoAvailability', uid);
        const state = await repo.get('demoPresenterState', uid);
        const weeklySlots = Object.fromEntries(Object.entries(value.weekly).map(([weekday, ranges]) => [weekday, slotsFor(ranges)]));
        if (state?.confirmedCount > 0) {
          check(Object.entries(previous?.weeklySlots || {}).every(([weekday, keys]) => keys.every(key => weeklySlots[weekday].includes(key))), 'While meetings are confirmed, use date changes to reduce available hours. Weekly hours can still be expanded.');
        }
        const dates = new Set([...Object.keys(previous?.overrides || {}), ...Object.keys(value.overrides || {})]);
        for (const date of dates) {
          if (JSON.stringify(previous?.overrides?.[date]) === JSON.stringify(value.overrides?.[date])) continue;
          const day = await repo.get('demoDays', `${uid}_${date}`);
          const keys = slotsFor(value.overrides[date] || value.weekly[new Date(`${date}T12:00:00+08:00`).getUTCDay()]);
          check(Object.keys(day?.claims || {}).every(key => keys.includes(key)), 'Reassign or cancel the confirmed demonstrations before closing this time.');
          repo.set('demoDays', `${uid}_${date}`, { ...(day || { reservations: {}, claims: {} }), presenterUid: uid, date, dayAt: Timestamp.fromDate(new Date(`${date}T00:00:00Z`)), override: Object.hasOwn(value.overrides, date), availableSlots: keys });
        }
        repo.writes.set(path, { ...value, weeklySlots });
      }
    }
    // Free mode has no background scheduler; notifications are created with the booking instead.
    for (const path of [...repo.writes.keys()]) if (path.startsWith('demoReminders/')) repo.writes.delete(path);
  }
  async function enrichAllowanceWrites(repo, name, payload, operationId) {
    if (['saveLiquidation', 'correctLiquidation'].includes(name)) {
      const slipId = name === 'saveLiquidation' ? payload.meetingId : payload.id;
      const before = await repo.get('allowanceLiquidations', slipId);
      const after = repo.writes.get(`allowanceLiquidations/${slipId}`);
      if (after && (after.status === 'submitted' || name === 'correctLiquidation')) {
        const oldPurchases = before?.status === 'returned' || name === 'correctLiquidation' ? fuelPurchases(before) : {};
        const nextPurchases = repo.writes.get(`allowanceDailyFuel/${after.accountId}_${after.date}`)?.allocations?.[slipId] || {};
        for (const id of new Set([...Object.keys(oldPurchases), ...Object.keys(nextPurchases)])) {
          const reference = await repo.get('allowanceAttachments', id);
          const previous = await repo.get('allowanceReferenceFuelClaims', id);
          const allocatedCentavos = (previous?.allocatedCentavos || 0) - (oldPurchases[id] || 0) + (nextPurchases[id] || 0);
          check(allocatedCentavos >= 0 && allocatedCentavos <= reference.purchaseCentavos, 'This fuel purchase has already been fully allocated.');
          repo.set('allowanceReferenceFuelClaims', id, { ownerUid: after.ownerUid, accountId: after.accountId, date: after.date, allocatedCentavos, slipId, lastOperationId: operationId });
        }
      }
    }
  }
  function fuelPurchases(slip) { const purchases = {}; for (const line of slip?.lines || []) if (line.category === 'Fuel') purchases[line.fuelPurchaseId] = (purchases[line.fuelPurchaseId] || 0) + line.amountCentavos; return purchases; }

  async function demoDashboard(start, end) {
    const current = await actor('demos'); const repo = firestoreRepository(db); const access = await demoAuthority(repo, current);
    const manager = access.actions.includes('demos:manage');
    demoDate(start); demoDate(end); requireDemo(start <= end && new Date(end) - new Date(start) <= 92 * 86400000, 'Choose a calendar range of up to 92 days.');
    const page = await getDocs(query(collection(db, 'demoBookings'), where('date', '>=', start), where('date', '<=', end), ...(!manager && !access.actions.includes('demos:view_all') ? [where('recipientUids', 'array-contains', current.uid)] : []), orderBy('date'), limit(201)));
    const result = { bookings: page.docs.slice(0, 200).map(record => ({ ...toWire(record.data()), id: record.id })), truncated: page.size > 200, presenters: await roster(repo), availability: await repo.get('demoAvailability', current.uid) || { weekly: {}, overrides: {} }, grants: [], staff: [], clients: [] };
    if (manager) { result.grants = await repo.query('demoAccess', [], 500); result.staff = await repo.query('staff', [['status', '==', 'active']], 500); }
    if (manager || access.actions.includes('demos:book')) result.clients = (await repo.query('clients', [], 100)).map(client => ({ ...client, name: client.business || client.companyName || client.company || client.name || 'Client', contactName: client.contactPerson || client.name || '' }));
    return result;
  }
  async function roster(repo) {
    const grants = await repo.query('demoAccess', [['active', '==', true], ['presenterEnabled', '==', true]], 200);
    const results = await Promise.all(grants.map(async grant => { try { const value = await activePresenter(repo, grant.id); return { uid: grant.id, name: value.name }; } catch (error) { if (error.code === 'permission-denied' || error.code === 'failed-precondition') return null; throw error; } }));
    return results.filter(Boolean);
  }
  async function demoAvailableSlots(payload) {
    const current = await actor('demos'); const repo = firestoreRepository(db); const access = await demoAuthority(repo, current);
    const settings = await repo.get('demoSettings', 'current'); requireDemo(settings?.enabled, 'Demonstration booking is currently disabled.');
    let booking;
    if (payload.bookingId) { booking = await repo.get('demoBookings', payload.bookingId); requireDemo(booking && canManageBooking(access, current.uid, booking), 'You cannot reschedule this demonstration.', 'permission-denied'); }
    else requireDemo(access.actions.includes('demos:book') || access.actions.includes('demos:manage'), 'You cannot book demonstrations.', 'permission-denied');
    requireDemo(settings.policy.durations.includes(payload.duration), 'Choose an allowed duration.');
    const presenters = payload.presenterUid ? [{ uid: payload.presenterUid }] : await roster(repo);
    return { presenters: await Promise.all(presenters.map(async presenter => {
      const grant = await activePresenter(repo, presenter.uid);
      const availability = await repo.get('demoAvailability', presenter.uid); const day = await repo.get('demoDays', `${presenter.uid}_${payload.date}`);
      return { uid: presenter.uid, name: grant.name, load: Object.keys(day?.reservations || {}).length, slots: demoSlots(availability, day?.reservations, payload.date, payload.duration, settings.policy, new Date().toISOString(), booking?.id) };
    })) };
  }
  async function demoBookingHistory(id) {
    const current = await actor('demos'); const repo = firestoreRepository(db); const access = await demoAuthority(repo, current);
    const booking = await repo.get('demoBookings', id); requireDemo(booking && (canManageBooking(access, current.uid, booking) || access.actions.includes('demos:view_all')), 'You cannot view this demonstration.', 'permission-denied');
    const page = await getDocs(query(collection(db, 'demoAuditEvents'), where('bookingId', '==', id), orderBy('createdAt', 'desc'), limit(100)));
    return { booking, events: page.docs.map(record => ({ ...record.data(), id: record.id })) };
  }
  async function staffPermissionContext() {
    const result = {};
    for (const [module, config] of Object.entries(configs)) {
      const value = await context(module); const editable = value.access?.actions.includes(`${module}:manage`) === true;
      const grants = {};
      if (editable) for (const grant of await firestoreRepository(db).query(config.collection, [], 1000)) if (grant.staffId) grants[grant.staffId] = summarize(grant.id, grant);
      result[module] = { editable, grants };
    }
    return result;
  }
  async function saveStaffPermissions(staffId, changes) {
    const current = await actor('demos'); await actor('allowances');
    const key = crypto.randomUUID().replaceAll('-', '_');
    return runTransaction(db, async tx => {
      const repo = firestoreRepository(db, tx); const target = await targetFor(repo, staffId); const staff = await repo.get('staff', staffId);
      check(target.uid !== OPERATIONS_ROOT_UID, 'Configured administrator access is managed by the deployed rules.');
      const result = {};
      for (const [module, change] of Object.entries(changes)) {
        check(Object.hasOwn(configs, module) && typeof change.active === 'boolean' && Array.isArray(change.actions), 'Select valid module permissions.');
        const mine = await repo.get(configs[module].collection, current.uid);
        check(current.bootstrapAdmin || mine?.active && mine.actions.includes(`${module}:manage`), 'You cannot manage these permissions.', 'permission-denied');
        if (!current.bootstrapAdmin && mine.staffId) check((await repo.get('staff', mine.staffId))?.status === 'active', 'Your staff account is inactive.', 'permission-denied');
        const previous = await repo.get(configs[module].collection, target.uid);
        check(change.expectedRevision === grantRevision(target.uid, previous), 'Permissions changed elsewhere. Reopen the editor before saving.', 'aborted');
        check(!change.active || staff.status === 'active', 'Activate the staff account before granting access.');
        check(change.actions.every(action => configs[module].actions.includes(action)), 'Choose valid permissions.');
        if (module === 'demos') {
          const state = await repo.get('demoPresenterState', target.uid);
          check(!previous?.presenterEnabled || change.active && change.presenterEnabled && change.actions.includes('demos:present') || !state?.confirmedCount, 'Reassign or finish confirmed demonstrations before removing presenter access.');
        }
        if (module === 'allowances') {
          const account = await repo.get('allowanceAccounts', staffId);
          check(!account || account.ownerUid === target.uid, 'This allowance belongs to a different login.');
        }
        const value = { ...(previous || {}), uid: target.uid, ownerUid: target.uid, staffId, staffName: staff.name, name: staff.name, email: staff.email, bootstrapAdmin: false, active: change.active, actions: [...new Set(change.actions)], presenterEnabled: module === 'demos' && change.presenterEnabled === true };
        repo.set(configs[module].collection, target.uid, value); result[module] = summarize(target.uid, value);
      }
      for (const [path, value] of repo.writes) tx.set(doc(db, path), value);
      tx.set(doc(db, 'staffPermissionAuditEvents', `${current.uid}_${key}`), { actorUid: current.uid, staffId, targetUid: target.uid, modules: Object.keys(changes), changes: result, createdAt: serverTimestamp() });
      return result;
    });
  }
  return { allowanceContext: () => context('allowances'), demoContext: () => context('demos'), allowanceCommand: (name, payload, key) => command('allowances', name, payload, key), demoCommand: (name, payload, key) => command('demos', name, payload, key), demoDashboard, demoAvailableSlots, demoBookingHistory, staffPermissionContext, saveStaffPermissions, registerStaffIdentity };
}
