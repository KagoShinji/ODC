import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { isDemoAdmin as isBootstrap, featureOptions as options } from './accessConfig.js';
import { createHash } from 'node:crypto';
import { DEMO_ACTIONS, DEFAULT_DEMO_POLICY, DemoError, requireDemo, demoId, demoDate, demoSlots, manilaDate } from './demoDomain.js';
import { executeDemoCommand, demoAuthority, activePresenter, canManageBooking } from './demoCommands.js';

function actorFor(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to use demo scheduling.');
  return { uid: request.auth.uid, email: request.auth.token.email || '', name: request.auth.token.name || request.auth.token.email || 'Team member', bootstrapAdmin: isBootstrap(request.auth.uid) };
}
function report(error) {
  if (error instanceof HttpsError) throw error;
  if (error instanceof DemoError) throw new HttpsError(error.code, error.message);
  console.error('Demo scheduling failed', error);
  throw new HttpsError('internal', 'Demo scheduling could not complete this operation. Please retry.');
}
function trustedAccess(id, value) { return value?.bootstrapAdmin && !isBootstrap(id) ? { ...value, active: false } : value; }
function repository(db, transaction = null) {
  const writes = new Map();
  const read = reference => transaction ? transaction.get(reference) : reference.get();
  return {
    writes,
    async get(collection, id) {
      const value = (await read(db.collection(collection).doc(demoId(id)))).data();
      return collection === 'demoAccess' ? trustedAccess(id, value) : value;
    },
    async query(collection, filters, maximum = 200) {
      let query = db.collection(collection);
      for (const filter of filters) query = query.where(...filter);
      return (await read(query.limit(maximum))).docs.map(document => ({ ...document.data(), id: document.id }));
    },
    set(collection, id, value) { writes.set(`${collection}/${demoId(id)}`, value); },
  };
}
async function presenterRoster(db, repo) {
  const records = await db.collection('demoAccess').where('active', '==', true).where('presenterEnabled', '==', true).limit(200).get();
  const presenters = await Promise.all(records.docs.map(async doc => {
    try { const access = await activePresenter(repo, doc.id); return { uid: doc.id, name: access.name }; }
    catch (error) { if (error instanceof DemoError) return null; throw error; }
  }));
  return presenters.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
}

export const demoContext = onCall(options, async request => {
  try {
    const actor = actorFor(request); const db = getFirestore();
    const ref = db.doc(`demoAccess/${actor.uid}`);
    if (actor.bootstrapAdmin) {
      await db.runTransaction(async tx => {
        const old = (await tx.get(ref)).data();
        const value = { uid: actor.uid, name: actor.name, email: actor.email, staffId: '', active: true, actions: DEMO_ACTIONS, bootstrapAdmin: true, presenterEnabled: old?.presenterEnabled === true };
        if (JSON.stringify(old) !== JSON.stringify(value)) tx.set(ref, value);
      });
    } else if ((await ref.get()).data()?.bootstrapAdmin) await ref.set({ active: false, presenterEnabled: false }, { merge: true });
    const repo = repository(db);
    let access = null;
    try { access = await demoAuthority(repo, actor); access = { ...(await repo.get('demoAccess', actor.uid)), ...access }; }
    catch (error) { if (!(error instanceof DemoError) || error.code !== 'permission-denied') throw error; }
    const settings = access ? await repo.get('demoSettings', 'current') : null;
    return { access, enabled: settings?.enabled === true, policy: settings?.policy || DEFAULT_DEMO_POLICY, bootstrapAdmin: actor.bootstrapAdmin };
  } catch (error) { report(error); }
});

export const demoDashboard = onCall(options, async request => {
  try {
    const actor = actorFor(request); const db = getFirestore(); const repo = repository(db);
    const access = await demoAuthority(repo, actor);
    const manager = access.actions.includes('demos:manage');
    const start = demoDate(request.data?.start || manilaDate());
    const end = demoDate(request.data?.end || start);
    requireDemo(start <= end && new Date(end) - new Date(start) <= 92 * 86400000, 'Choose a calendar range of up to 92 days.', 'invalid-argument');
    let query = db.collection('demoBookings').where('date', '>=', start).where('date', '<=', end).orderBy('date');
    if (!manager && !access.actions.includes('demos:view_all')) query = query.where('recipientUids', 'array-contains', actor.uid);
    const [page, presenters, ownAvailability] = await Promise.all([query.limit(201).get(), presenterRoster(db, repo), repo.get('demoAvailability', actor.uid)]);
    const result = { bookings: page.docs.slice(0, 200).map(d => ({ ...d.data(), id: d.id })).sort((a, b) => a.startAt.localeCompare(b.startAt)), truncated: page.size > 200, presenters, availability: ownAvailability || { weekly: {}, overrides: {} }, grants: [], staff: [], clients: [] };
    if (manager) {
      const [grants, staff] = await Promise.all([db.collection('demoAccess').limit(500).get(), db.collection('staff').where('status', '==', 'active').limit(500).get()]);
      result.grants = grants.docs.map(d => ({ ...trustedAccess(d.id, d.data()), uid: d.id }));
      result.staff = staff.docs.map(d => ({ id: d.id, name: d.data().name || d.data().email, email: d.data().email }));
    }
    if (manager || access.actions.includes('demos:book')) {
      const clients = await db.collection('clients').limit(100).get();
      result.clients = clients.docs.map(d => ({ id: d.id, name: d.data().business || d.data().companyName || d.data().company || d.data().name || 'Client', contactName: d.data().contactPerson || d.data().name || '', email: d.data().email || '', phone: d.data().phone || '' }));
    }
    return result;
  } catch (error) { report(error); }
});

export const demoAvailableSlots = onCall(options, async request => {
  try {
    const actor = actorFor(request); const db = getFirestore(); const repo = repository(db);
    const access = await demoAuthority(repo, actor);
    const settings = await repo.get('demoSettings', 'current');
    requireDemo(settings?.enabled, 'Demonstration booking is currently disabled.');
    const payload = request.data || {};
    const date = demoDate(payload.date);
    requireDemo(settings.policy.durations.includes(payload.duration), 'Choose an allowed duration.', 'invalid-argument');
    let booking = null;
    if (payload.bookingId) {
      booking = await repo.get('demoBookings', demoId(payload.bookingId));
      requireDemo(booking && booking.status === 'confirmed' && canManageBooking(access, actor.uid, booking), 'You cannot reschedule this demonstration.', 'permission-denied');
    } else requireDemo(access.actions.includes('demos:book') || access.actions.includes('demos:manage'), 'You cannot book demonstrations.', 'permission-denied');
    const presenters = payload.presenterUid ? [{ uid: demoId(payload.presenterUid) }] : await presenterRoster(db, repo);
    const pages = await Promise.all(presenters.map(async ({ uid }) => {
      const presenter = await activePresenter(repo, uid);
      const [availability, day] = await Promise.all([repo.get('demoAvailability', uid), repo.get('demoDays', `${uid}_${date}`)]);
      const reservations = day?.reservations || {};
      return { uid, name: presenter.name, load: Object.keys(reservations).length, slots: demoSlots(availability, reservations, date, payload.duration, settings.policy, new Date().toISOString(), booking?.id) };
    }));
    // The sales view receives times and names, never other clients' bookings or private notes.
    return { presenters: pages.sort((a, b) => a.load - b.load || a.uid.localeCompare(b.uid)) };
  } catch (error) { report(error); }
});

export const demoBookingHistory = onCall(options, async request => {
  try {
    const actor = actorFor(request); const db = getFirestore(); const repo = repository(db);
    const access = await demoAuthority(repo, actor); const id = demoId(request.data?.id);
    const booking = await repo.get('demoBookings', id);
    requireDemo(booking && (canManageBooking(access, actor.uid, booking) || access.actions.includes('demos:view_all')), 'You cannot view this demonstration.', 'permission-denied');
    const events = await db.collection('demoAuditEvents').where('bookingId', '==', id).orderBy('createdAt', 'desc').limit(100).get();
    return { booking, events: events.docs.map(d => ({ ...d.data(), id: d.id })) };
  } catch (error) { report(error); }
});

export const demoCommand = onCall(options, async request => {
  try {
    const actor = actorFor(request); const db = getFirestore();
    const { command, payload = {}, commandId } = request.data || {};
    requireDemo(typeof command === 'string' && command.length < 64 && payload && typeof payload === 'object' && !Array.isArray(payload), 'Invalid scheduling command.', 'invalid-argument');
    requireDemo(typeof commandId === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(commandId), 'Invalid submission key.', 'invalid-argument');
    requireDemo(JSON.stringify(payload).length <= 100000, 'The submission is too large.', 'invalid-argument');
    if (command === 'grantAccess') {
      const access = await demoAuthority(repository(db), actor);
      requireDemo(access.actions.includes('demos:manage'), 'Only administrators can grant scheduling access.', 'permission-denied');
      const staffId = demoId(payload.staffId); const staff = (await db.doc(`staff/${staffId}`).get()).data();
      requireDemo(staff?.status === 'active' && staff.email, 'Select an active staff member with an existing login.');
      const email = staff.email.trim().toLowerCase();
      const user = await getAuth().getUserByEmail(email);
      requireDemo(!user.disabled, 'This staff login is disabled.');
      const matches = await db.collection('staff').where('email', '==', staff.email).get();
      requireDemo(matches.size === 1, 'Resolve duplicate staff login records before granting scheduling access.');
      actor.verifiedTarget = { uid: user.uid, name: staff.name || email, email, staffId, bootstrapAdmin: isBootstrap(user.uid) };
    }
    const digest = createHash('sha256').update(JSON.stringify({ command, payload })).digest('hex');
    return await db.runTransaction(async tx => {
      const repo = repository(db, tx);
      // Authorization is checked even when returning an earlier submission result.
      await demoAuthority(repo, actor);
      const resultRef = db.doc(`demoCommandResults/${actor.uid}_${commandId}`);
      const old = (await tx.get(resultRef)).data();
      if (old) { requireDemo(old.digest === digest, 'A submission key cannot be reused for a different action.', 'invalid-argument'); return old.result; }
      const result = await executeDemoCommand(repo, actor, command, payload, commandId);
      for (const [path, value] of repo.writes) tx.set(db.doc(path), value);
      tx.set(resultRef, { digest, result, createdAt: new Date().toISOString() });
      return result;
    });
  } catch (error) { report(error); }
});

// Durable reminders are versioned: a changed or cancelled meeting cannot send an old reminder.
export async function deliverDemoReminders(db, now = new Date().toISOString()) {
  const page = await db.collection('demoReminders').where('active', '==', true).where('dueAt', '<=', now).orderBy('dueAt').limit(200).get();
  for (const document of page.docs) {
    await db.runTransaction(async tx => {
      const job = (await tx.get(document.ref)).data();
      if (!job?.active) return;
      const booking = (await tx.get(db.doc(`demoBookings/${job.bookingId}`))).data();
      const recipients = [];
      if (booking?.status === 'confirmed' && booking.version === job.version && booking.startAt > now) {
        for (const uid of booking.recipientUids) {
          const access = trustedAccess(uid, (await tx.get(db.doc(`demoAccess/${uid}`))).data());
          const staff = access?.staffId ? (await tx.get(db.doc(`staff/${access.staffId}`))).data() : null;
          if (access?.active && (!access.staffId || staff?.status === 'active')) recipients.push(uid);
        }
      }
      for (const uid of recipients) tx.set(db.doc(`demoNotifications/reminder_${document.id}_${uid}`), { recipientUid: uid, bookingId: booking.id, type: 'reminder', title: `${booking.clientName} — upcoming demonstration`, message: `${booking.date} at ${booking.time} PHT · ${booking.presenterName}`, createdAt: now, read: false });
      tx.update(document.ref, { active: false, processedAt: now });
    });
  }
}
export const sendDemoReminders = onSchedule({ schedule: 'every 5 minutes', region: options.region, timeZone: 'Asia/Manila', maxInstances: 1 }, async () => deliverDemoReminders(getFirestore()));

export const revokeSuspendedDemoAccess = onDocumentWritten({ document: 'staff/{staffId}', region: options.region, maxInstances: 2 }, async event => {
  const db = getFirestore();
  if ((await db.doc(`staff/${event.params.staffId}`).get()).data()?.status === 'active') return;
  const grants = await db.collection('demoAccess').where('staffId', '==', event.params.staffId).get();
  const batch = db.batch();
  for (const grant of grants.docs) batch.update(grant.ref, { active: false, presenterEnabled: false });
  await batch.commit();
});
