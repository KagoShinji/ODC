import { DEMO_ACTIONS, DEFAULT_DEMO_POLICY, requireDemo, demoId, demoText, validateAvailability, validateDemoPolicy, validateBookingTime, withinAvailability, overlapsReservation } from './demoDomain.js';

export async function demoAuthority(repo, actor) {
  if (actor.bootstrapAdmin) return { uid: actor.uid, name: actor.name || actor.email || 'Administrator', active: true, actions: DEMO_ACTIONS, bootstrapAdmin: true };
  const access = await repo.get('demoAccess', actor.uid);
  requireDemo(access?.active && !access.bootstrapAdmin, 'Demo scheduling access has not been granted.', 'permission-denied');
  if (access.staffId) {
    const staff = await repo.get('staff', access.staffId);
    requireDemo(staff?.status === 'active', 'Your staff account is inactive.', 'permission-denied');
  }
  return access;
}
export async function activePresenter(repo, uid) {
  const access = await repo.get('demoAccess', demoId(uid));
  requireDemo(access?.active && access.presenterEnabled && access.actions?.includes('demos:present'), 'This presenter is unavailable. Choose another presenter.');
  if (access.staffId) requireDemo((await repo.get('staff', access.staffId))?.status === 'active', 'This presenter is inactive.');
  return access;
}
export function canManageBooking(access, uid, booking) {
  return access.actions.includes('demos:manage') || booking.bookedByUid === uid && access.actions.includes('demos:book') || booking.presenterUid === uid && access.actions.includes('demos:present');
}
const dayId = (uid, date) => `${uid}_${date}`;
const upcoming = (repo, uid, now) => repo.query('demoBookings', [['presenterUid', '==', uid], ['status', '==', 'confirmed'], ['endAt', '>=', now]], 501);
function audit(repo, actor, command, id, now, bookingId = '', before = null, after = null) {
  repo.set('demoAuditEvents', `${actor.uid}_${id}`, { actorUid: actor.uid, actorName: actor.name || actor.email, command, bookingId, before, after, createdAt: now });
}
function scheduleSummary(booking) {
  return { date: booking.date, time: booking.time, presenterUid: booking.presenterUid, presenterName: booking.presenterName, status: booking.status, startAt: booking.startAt, endAt: booking.endAt };
}
function notify(repo, booking, recipients, id, type, now) {
  for (const uid of [...new Set(recipients)]) {
    repo.set('demoNotifications', `${id}_${uid}`, { recipientUid: uid, bookingId: booking.id, type, title: `${booking.clientName} — ${type.replaceAll('_', ' ')}`, message: `${booking.date} at ${booking.time} PHT · ${booking.presenterName}`, createdAt: now, read: false });
  }
}
function createReminders(repo, booking, now) {
  for (const hours of [24, 1]) {
    const dueAt = new Date(new Date(booking.startAt).getTime() - hours * 3600000).toISOString();
    if (dueAt > now) repo.set('demoReminders', `${booking.id}_${booking.version}_${hours}`, { bookingId: booking.id, version: booking.version, hours, dueAt, active: true });
  }
}

// All writes are queued by the repository and committed only after every read.
export async function executeDemoCommand(repo, actor, command, payload, commandId) {
  const now = actor.now || new Date().toISOString();
  const access = await demoAuthority(repo, actor);
  const manager = access.actions.includes('demos:manage');
  if (command === 'markRead') {
    const id = demoId(payload.id); const notification = await repo.get('demoNotifications', id);
    requireDemo(notification?.recipientUid === actor.uid, 'You cannot access this notification.', 'permission-denied');
    repo.set('demoNotifications', id, { ...notification, read: true });
    return { id };
  }
  if (command === 'saveSettings') {
    requireDemo(manager, 'Only scheduling administrators can change settings.', 'permission-denied');
    requireDemo(typeof payload.enabled === 'boolean', 'Specify whether booking is enabled.', 'invalid-argument');
    const settings = { enabled: payload.enabled, policy: validateDemoPolicy(payload.policy), updatedAt: now, updatedByUid: actor.uid };
    repo.set('demoSettings', 'current', settings);
    audit(repo, actor, command, commandId, now);
    return { id: 'current' };
  }
  if (command === 'grantAccess' || command === 'setMyPresenter') {
    requireDemo(manager, 'Only scheduling administrators can manage access.', 'permission-denied');
    const self = command === 'setMyPresenter';
    requireDemo(self || typeof payload.active === 'boolean', 'Specify whether scheduling access is active.', 'invalid-argument');
    const target = self ? { uid: actor.uid, name: actor.name || actor.email, email: actor.email, bootstrapAdmin: actor.bootstrapAdmin } : actor.verifiedTarget;
    requireDemo(target?.uid, 'Select a staff member with an existing login.', 'invalid-argument');
    requireDemo(typeof payload.presenterEnabled === 'boolean', 'Specify presenter availability.', 'invalid-argument');
    const current = await repo.get('demoAccess', target.uid);
    const actions = self ? access.actions : payload.actions;
    requireDemo(Array.isArray(actions) && actions.every(a => DEMO_ACTIONS.includes(a)), 'Choose valid scheduling permissions.', 'invalid-argument');
    const active = self || payload.active === true;
    if (target.staffId) requireDemo((await repo.get('staff', target.staffId))?.status === 'active', 'Only active staff can receive scheduling access.');
    if ((!active || !payload.presenterEnabled || !actions.includes('demos:present')) && current?.presenterEnabled) {
      requireDemo((await upcoming(repo, target.uid, now)).length === 0, 'Reassign or cancel this presenter’s upcoming demonstrations before disabling their presenter access.');
    }
    requireDemo(!payload.presenterEnabled || active && actions.includes('demos:present'), 'Presenter access must be active and include the presenter permission.', 'invalid-argument');
    repo.set('demoAccess', target.uid, { uid: target.uid, name: target.name, email: target.email, staffId: target.staffId || '', bootstrapAdmin: target.bootstrapAdmin === true, active, actions: [...new Set(actions)], presenterEnabled: payload.presenterEnabled, updatedAt: now, updatedByUid: actor.uid });
    audit(repo, actor, command, commandId, now);
    return { id: target.uid };
  }
  if (command === 'saveAvailability') {
    const uid = demoId(payload.presenterUid);
    requireDemo(manager || actor.uid === uid && access.actions.includes('demos:present'), 'You can only change your own availability.', 'permission-denied');
    await activePresenter(repo, uid);
    const value = validateAvailability(payload.availability);
    const meetings = await upcoming(repo, uid, now);
    requireDemo(meetings.length <= 500, 'Too many upcoming meetings to update availability. Contact an administrator.');
    const affected = meetings.filter(b => !withinAvailability(value, b.date, b.startMinute, b.occupiedEndMinute));
    requireDemo(affected.length === 0, `Availability overlaps ${affected.length} confirmed meeting(s). Reassign or reschedule first: ${affected.slice(0, 5).map(b => `${b.clientName} (${b.date} ${b.time})`).join(', ')}`);
    repo.set('demoAvailability', uid, { ...value, updatedAt: now, updatedByUid: actor.uid });
    audit(repo, actor, command, commandId, now);
    return { id: uid };
  }

  requireDemo(['book', 'reschedule', 'cancel', 'complete', 'noShow'].includes(command), 'Unknown scheduling action.', 'invalid-argument');
  let previous = null;
  if (command !== 'book') {
    previous = await repo.get('demoBookings', demoId(payload.id));
    requireDemo(previous, 'This demonstration no longer exists.', 'not-found');
    requireDemo(canManageBooking(access, actor.uid, previous), 'You cannot change this demonstration.', 'permission-denied');
    requireDemo(previous.status === 'confirmed', 'Only confirmed demonstrations can be changed.');
    requireDemo(Number.isInteger(payload.version) && payload.version === previous.version, 'This demonstration changed. Refresh before trying again.', 'aborted');
  }
  if (['cancel', 'complete', 'noShow'].includes(command)) {
    if (command !== 'cancel') {
      requireDemo(manager || actor.uid === previous.presenterUid && access.actions.includes('demos:present'), 'Only the presenter or an administrator can record outcomes.', 'permission-denied');
      requireDemo(previous.endAt <= now, 'Record the outcome after the demonstration has ended.');
    }
    const notes = demoText(payload.notes || '', 'Outcome notes', 2000, false);
    const day = await repo.get('demoDays', dayId(previous.presenterUid, previous.date));
    const reservations = { ...(day?.reservations || {}) }; delete reservations[previous.id];
    const booking = { ...previous, status: command === 'cancel' ? 'cancelled' : command === 'complete' ? 'completed' : 'no_show', outcomeNotes: notes, version: previous.version + 1, updatedAt: now, updatedByUid: actor.uid };
    repo.set('demoDays', dayId(previous.presenterUid, previous.date), { reservations });
    repo.set('demoBookings', booking.id, booking);
    notify(repo, booking, booking.recipientUids, `${actor.uid}_${commandId}`, booking.status, now);
    audit(repo, actor, command, commandId, now, booking.id, scheduleSummary(previous), scheduleSummary(booking));
    return { id: booking.id };
  }
  requireDemo(command !== 'book' || manager || access.actions.includes('demos:book'), 'You do not have permission to book demonstrations.', 'permission-denied');
  const settings = await repo.get('demoSettings', 'current');
  requireDemo(settings?.enabled, 'Demonstration booking is currently disabled.');
  const policy = settings.policy || DEFAULT_DEMO_POLICY;
  if (previous) requireDemo(previous.startAt > now, 'A demonstration that has started cannot be rescheduled.');
  const presenterUid = demoId(payload.presenterUid);
  const presenter = await activePresenter(repo, presenterUid);
  const availability = await repo.get('demoAvailability', presenterUid);
  const interval = validateBookingTime(payload.date, payload.time, payload.duration, policy, now);
  requireDemo(withinAvailability(availability, payload.date, interval.startMinute, interval.occupiedEndMinute), 'This presenter is unavailable at that time. Choose another slot.');
  const id = previous?.id || `${actor.uid}_${commandId}`;
  const targetDayId = dayId(presenterUid, payload.date);
  const targetDay = await repo.get('demoDays', targetDayId);
  requireDemo(!overlapsReservation(targetDay?.reservations, interval.startMinute, interval.occupiedEndMinute, previous?.id), 'That time was just booked. Choose another available slot.', 'already-exists');
  let oldDay = null;
  const oldDayId = previous && dayId(previous.presenterUid, previous.date);
  if (previous && oldDayId !== targetDayId) oldDay = await repo.get('demoDays', oldDayId);
  const client = previous || {
    clientName: demoText(payload.clientName, 'Client name'),
    contactName: demoText(payload.contactName, 'Contact person'),
    contactEmail: demoText(payload.contactEmail || '', 'Contact email', 254, false),
    contactPhone: demoText(payload.contactPhone || '', 'Contact phone', 11, false),
    topic: demoText(payload.topic, 'Demonstration topic', 300),
    mode: payload.mode,
    location: demoText(payload.location, 'Meeting link or location', 1000),
    notes: demoText(payload.notes || '', 'Preparation notes', 3000, false),
    clientId: payload.clientId ? demoId(payload.clientId) : '',
  };
  requireDemo(['online', 'onsite'].includes(client.mode), 'Choose online or on-site.', 'invalid-argument');
  requireDemo(client.contactEmail || client.contactPhone, 'Provide a contact email or phone.', 'invalid-argument');
  requireDemo(!client.contactEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.contactEmail), 'Enter a valid contact email.', 'invalid-argument');
  requireDemo(!client.contactPhone || /^\d{11}$/.test(client.contactPhone), 'Contact phone must contain exactly 11 digits.', 'invalid-argument');
  if (client.mode === 'online') {
    let url;
    try { url = new URL(client.location); } catch { /* Validation reports a friendly message below. */ }
    requireDemo(url?.protocol === 'https:' && url.hostname, 'Online demonstrations need a valid HTTPS meeting link.', 'invalid-argument');
  }
  if (!previous && client.clientId) requireDemo(await repo.get('clients', client.clientId), 'The selected client no longer exists.', 'not-found');
  const booking = { ...client, ...interval, id, date: payload.date, time: payload.time, duration: payload.duration, bufferMinutes: policy.bufferMinutes, presenterUid, presenterName: presenter.name, bookedByUid: previous?.bookedByUid || actor.uid, bookedByName: previous?.bookedByName || access.name || actor.name || actor.email, recipientUids: [...new Set([previous?.bookedByUid || actor.uid, presenterUid])], status: 'confirmed', version: (previous?.version || 0) + 1, createdAt: previous?.createdAt || now, updatedAt: now, updatedByUid: actor.uid };
  const reservations = { ...(targetDay?.reservations || {}), [id]: { startMinute: interval.startMinute, occupiedEndMinute: interval.occupiedEndMinute } };
  requireDemo(Object.keys(reservations).length <= 100, 'This presenter has reached the daily booking limit.');
  if (oldDay) { const oldReservations = { ...oldDay.reservations }; delete oldReservations[id]; repo.set('demoDays', oldDayId, { reservations: oldReservations }); }
  repo.set('demoDays', targetDayId, { reservations });
  repo.set('demoBookings', id, booking);
  createReminders(repo, booking, now);
  notify(repo, booking, [...booking.recipientUids, ...(previous?.recipientUids || [])], `${actor.uid}_${commandId}`, previous ? 'rescheduled' : 'confirmed', now);
  audit(repo, actor, command, commandId, now, id, previous ? scheduleSummary(previous) : null, scheduleSummary(booking));
  return { id };
}
