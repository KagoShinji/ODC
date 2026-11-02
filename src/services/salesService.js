import { db } from '../lib/firebase';
import {
  collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, runTransaction, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { formatDisplayIdentifier, normalizeAuthIdentifier } from '../utils/authHelpers';
import {
  DEFAULT_SALES_SETTINGS, DEFAULT_TARGETS, OPEN_STAGES, ACTIVITY_TYPES, SALES_ACTIONS, leadKeys, validateLead, validateStageChange,
  validateDealRequest, validateDealConfirmation, validateTargets, validateAutomation, automationTask, weeklyScheduleTasks, localDateKey,
  requireSales, stageLabel, lostReasonLabel, formatPeso, zonedTime,
} from '../../functions/src/salesDomain.js';

const SUPERADMIN_EMAILS = (import.meta.env.VITE_SUPERADMIN_EMAIL || '').split(',').map(e => normalizeAuthIdentifier(e.trim())).filter(Boolean);
const OUTREACH = new Set(ACTIVITY_TYPES.filter(a => a.outreach).map(a => a.id));

const emailOf = user => (user.email || '').toLowerCase();
const nameOf = user => user.displayName || formatDisplayIdentifier(user.email);
const leadRef = id => doc(db, 'salesLeads', id);
const dealRef = id => doc(db, 'salesDeals', id);
const activitiesRef = leadId => collection(db, 'salesLeads', leadId, 'salesActivities');
const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const ts = date => (date ? Timestamp.fromDate(date) : null);

/** Lead fields every write must carry, so rule validation always sees the full shape. */
const stamp = user => ({ updatedAt: serverTimestamp(), updatedByUid: user.uid });

function activity(user, lead, type, extra = {}) {
  return {
    leadId: lead.id, type, notes: '', detail: '', fromStage: '', toStage: '', scheduledAt: null,
    byUid: user.uid, byEmail: emailOf(user), byName: nameOf(user), at: serverTimestamp(),
    attributedEmail: lead.attributedEmail, ownerEmail: lead.ownerEmail, industry: lead.industry || '', ...extra,
  };
}
function notification(user, recipientEmail, type, title, body = '', leadId = '') {
  return { recipientEmail, type, title: title.slice(0, 200), body: body.slice(0, 1000), leadId, read: false, createdAt: serverTimestamp(), createdByUid: user.uid };
}
function notify(target, user, recipients, ...args) {
  const me = emailOf(user);
  for (const email of new Set(recipients)) {
    if (email && email !== me) target.set(doc(collection(db, 'salesNotifications')), notification(user, email, ...args));
  }
}

/* ─── Configuration & roster ─── */

export async function loadSalesConfig() {
  const [settingsSnap, targetsSnap] = await Promise.all([getDoc(doc(db, 'salesSettings', 'current')), getDocs(collection(db, 'salesTargets'))]);
  const stored = settingsSnap.exists() ? settingsSnap.data() : {};
  return {
    settings: { ...DEFAULT_SALES_SETTINGS, ...stored, automation: { ...DEFAULT_SALES_SETTINGS.automation, ...(stored.automation || {}) } },
    targets: rows(targetsSnap),
  };
}

/** Active staff with any sales grant, plus whether they count as associates and who manages. */
export async function listSalesStaff() {
  const snap = await getDocs(collection(db, 'staff'));
  const staff = snap.docs.map(d => d.data()).filter(s => s.status === 'active' && s.email).map(s => {
    const actions = Array.isArray(s.allowedActions) ? s.allowedActions : [];
    return {
      email: s.email.toLowerCase(), name: s.name || formatDisplayIdentifier(s.email), role: s.role || '',
      isAssociate: actions.includes('sales:associate'),
      isManager: actions.includes('sales:manage') || actions.includes('sales:confirm'),
      inSales: actions.some(a => SALES_ACTIONS.includes(a)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { all: staff, sales: staff.filter(s => s.inSales), associates: staff.filter(s => s.isAssociate), managerEmails: [...new Set([...staff.filter(s => s.isManager).map(s => s.email), ...SUPERADMIN_EMAILS])] };
}

export async function saveTargets(user, input) {
  const targets = validateTargets(input);
  const batch = writeBatch(db);
  batch.set(doc(db, 'salesTargets', targets.effectiveFrom), { ...targets, ...stamp(user), updatedByName: nameOf(user) });
  await batch.commit();
}

export async function saveSalesSettings(user, input) {
  const categories = [...new Set((input.categories || []).map(c => String(c).trim()).filter(Boolean))].slice(0, 50);
  requireSales(categories.length > 0, 'Keep at least one lead category.');
  requireSales(categories.every(c => c.length <= 80), 'Category names must be at most 80 characters.');
  requireSales(Number.isInteger(input.weekStartsOn) && input.weekStartsOn >= 0 && input.weekStartsOn <= 6, 'Choose the first day of the reporting week.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); } catch { requireSales(false, 'Choose a valid timezone, e.g. Asia/Manila.'); }
  const days = Number(input.quotationFollowUpDays);
  requireSales(Number.isInteger(days) && days >= 1 && days <= 30, 'Quotation follow-up reminder must be from 1 to 30 days.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'salesSettings', 'current'), {
    timezone: input.timezone, weekStartsOn: input.weekStartsOn, categories, automation: validateAutomation(input.automation), quotationFollowUpDays: days,
    ...stamp(user), updatedByName: nameOf(user),
  });
  await batch.commit();
}

/* ─── Leads ─── */

/** Existing leads sharing any identifier with `form`, excluding `excludeLeadId`. */
export async function findDuplicates(form, excludeLeadId = '') {
  const keys = leadKeys(form);
  const snaps = await Promise.all(keys.map(k => getDoc(doc(db, 'salesLeadKeys', k.id))));
  return snaps.map((snap, i) => snap.exists() ? { ...keys[i], ...snap.data() } : null).filter(m => m && m.leadId !== excludeLeadId);
}

export async function createLead(user, form, { owner, settings, staff }) {
  const fields = validateLead(form, settings.categories);
  requireSales(owner?.email, 'Assign the lead to a sales associate.');
  const duplicates = await findDuplicates(fields);
  const keys = leadKeys(fields);
  const ref = doc(collection(db, 'salesLeads'));
  const lead = {
    ...fields,
    qualified: true, disqualifyReason: '',
    ownerEmail: owner.email, ownerName: owner.name, attributedEmail: owner.email, attributedName: owner.name,
    stage: 'new', stageChangedAt: serverTimestamp(), lostReason: '', lostNotes: '',
    nextFollowUpAt: ts(form.nextFollowUpAt ? zonedTime(form.nextFollowUpAt, settings.timezone, 9) : null),
    duplicateKeys: keys.map(k => k.id),
    possibleDuplicateOf: [...new Set(duplicates.map(d => d.leadId))].slice(0, 20),
    duplicateStatus: duplicates.length ? 'pending_review' : 'none',
    firstContactedAt: null, firstResponseAt: null, conversionStatus: 'none', convertedAt: null,
    createdAt: serverTimestamp(), createdByUid: user.uid, createdByEmail: emailOf(user), createdByName: nameOf(user), ...stamp(user),
  };
  const batch = writeBatch(db);
  batch.set(ref, lead);
  const taken = new Set(duplicates.map(d => d.id));
  for (const key of keys) {
    if (!taken.has(key.id)) batch.set(doc(db, 'salesLeadKeys', key.id), { leadId: ref.id, type: key.type, businessName: fields.businessName, ownerName: owner.name, createdAt: serverTimestamp() });
  }
  batch.set(doc(activitiesRef(ref.id)), activity(user, { id: ref.id, ...lead }, 'created', { notes: fields.notes.slice(0, 2000), detail: `Source: ${fields.source}` }));
  notify(batch, user, [owner.email], 'assignment', `New lead assigned: ${fields.businessName}`, `${nameOf(user)} assigned you a ${fields.industry} lead.`, ref.id);
  if (duplicates.length) notify(batch, user, staff.managerEmails, 'duplicate', `Possible duplicate lead: ${fields.businessName}`, `Matches an existing lead by ${duplicates.map(d => d.type).join(', ')}.`, ref.id);
  try {
    await batch.commit();
  } catch (error) {
    // Another lead claimed one of the identifiers between the check and the save.
    if (error?.code === 'permission-denied' && keys.length) throw new Error('This lead could not be saved. Someone may have just added the same business — search the leads list and try again.');
    throw error;
  }
  return { id: ref.id, ...fields, ownerEmail: owner.email, ownerName: owner.name, attributedEmail: owner.email };
}

export async function updateLead(user, leadId, form, settings, { canReviewDuplicates = false } = {}) {
  const fields = validateLead(form, settings.categories);
  const keys = leadKeys(fields);
  await runTransaction(db, async tx => {
    const snap = await tx.get(leadRef(leadId));
    requireSales(snap.exists(), 'This lead no longer exists.');
    const current = { id: leadId, ...snap.data() };
    const newKeys = keys.filter(k => !current.duplicateKeys?.includes(k.id));
    const keySnaps = await Promise.all(newKeys.map(k => tx.get(doc(db, 'salesLeadKeys', k.id))));
    const conflicts = keySnaps.filter(s => s.exists() && s.data().leadId !== leadId).map(s => s.data().leadId);
    newKeys.forEach((key, i) => {
      if (!keySnaps[i].exists()) tx.set(doc(db, 'salesLeadKeys', key.id), { leadId, type: key.type, businessName: fields.businessName, ownerName: current.ownerName || '', createdAt: serverTimestamp() });
    });
    const update = {
      ...fields,
      nextFollowUpAt: ts(form.nextFollowUpAt ? zonedTime(form.nextFollowUpAt, settings.timezone, 9) : null),
      duplicateKeys: [...new Set([...(current.duplicateKeys || []), ...newKeys.map(k => k.id)])].slice(0, 10),
      ...stamp(user),
    };
    // Only managers may change duplicate fields; associates see the warning in the form instead.
    if (conflicts.length && canReviewDuplicates && current.duplicateStatus !== 'duplicate') {
      update.possibleDuplicateOf = [...new Set([...(current.possibleDuplicateOf || []), ...conflicts])].slice(0, 20);
      update.duplicateStatus = 'pending_review';
    }
    if (!OPEN_STAGES.includes(current.stage)) update.nextFollowUpAt = null;
    tx.update(leadRef(leadId), update);
    tx.set(doc(activitiesRef(leadId)), activity(user, current, 'note', { detail: 'Lead details updated' }));
  });
}

export async function assignLead(user, leadId, owner) {
  requireSales(owner?.email, 'Choose a sales associate.');
  await runTransaction(db, async tx => {
    const snap = await tx.get(leadRef(leadId));
    requireSales(snap.exists(), 'This lead no longer exists.');
    const current = { id: leadId, ...snap.data() };
    requireSales(current.ownerEmail !== owner.email, 'The lead is already assigned to this associate.');
    tx.update(leadRef(leadId), { ownerEmail: owner.email, ownerName: owner.name, ...stamp(user) });
    tx.set(doc(activitiesRef(leadId)), activity(user, { ...current, ownerEmail: owner.email }, 'assignment', { detail: `${current.ownerName || current.ownerEmail} → ${owner.name}` }));
    tx.set(doc(collection(db, 'salesNotifications')), notification(user, owner.email, 'assignment', `Lead assigned to you: ${current.businessName}`, `Reassigned by ${nameOf(user)}. Credit for this lead stays with ${current.attributedName || current.attributedEmail}.`, leadId));
  });
  // Hand over the lead's open sales tasks so follow-ups are not orphaned.
  const tasks = await getDocs(query(collection(db, 'tasks'), where('salesLeadId', '==', leadId)));
  await Promise.all(tasks.docs.filter(t => t.data().status !== 'done' && t.data().salesActivity !== 'demo_endorsement').map(t => runTransaction(db, async tx => {
    const fresh = await tx.get(t.ref);
    if (!fresh.exists() || fresh.data().status === 'done') return;
    const data = fresh.data();
    tx.update(t.ref, {
      assignees: [{ email: owner.email, name: owner.name }], assigneeEmails: [owner.email], updatedAt: serverTimestamp(),
      activity: [...(data.activity || []), { type: 'edited', at: Timestamp.now(), byEmail: emailOf(user), byName: nameOf(user) }].slice(-60),
    });
  })));
}

export async function reviewDuplicate(user, leadId, decision, notes = '') {
  requireSales(['duplicate', 'not_duplicate'].includes(decision), 'Choose a review outcome.');
  await runTransaction(db, async tx => {
    const snap = await tx.get(leadRef(leadId));
    requireSales(snap.exists(), 'This lead no longer exists.');
    const current = { id: leadId, ...snap.data() };
    tx.update(leadRef(leadId), { duplicateStatus: decision, ...stamp(user) });
    tx.set(doc(activitiesRef(leadId)), activity(user, current, 'duplicate_review', { detail: decision === 'duplicate' ? 'Confirmed as duplicate — excluded from KPIs' : 'Reviewed — not a duplicate', notes: notes.slice(0, 2000) }));
  });
}

export async function setQualification(user, leadId, qualified, reason = '') {
  requireSales(qualified || reason.trim(), 'Explain why the lead is not qualified.');
  await runTransaction(db, async tx => {
    const snap = await tx.get(leadRef(leadId));
    requireSales(snap.exists(), 'This lead no longer exists.');
    const current = { id: leadId, ...snap.data() };
    tx.update(leadRef(leadId), { qualified, disqualifyReason: qualified ? '' : reason.trim().slice(0, 500), ...stamp(user) });
    tx.set(doc(activitiesRef(leadId)), activity(user, current, 'qualification', { detail: qualified ? 'Marked qualified' : 'Marked not qualified — excluded from KPIs', notes: reason.slice(0, 2000) }));
  });
}

/** Moves a lead to another pipeline stage and returns the automation task suggestion, if any. */
export async function moveLeadStage(user, leadId, toStage, options = {}) {
  let moved;
  await runTransaction(db, async tx => {
    const snap = await tx.get(leadRef(leadId));
    requireSales(snap.exists(), 'This lead no longer exists.');
    const current = { id: leadId, ...snap.data() };
    const change = validateStageChange(current, toStage, options);
    tx.update(leadRef(leadId), {
      ...change, stageChangedAt: serverTimestamp(),
      ...(['lost'].includes(toStage) ? { nextFollowUpAt: null } : {}),
      ...stamp(user),
    });
    tx.set(doc(activitiesRef(leadId)), activity(user, current, 'stage_change', {
      fromStage: current.stage, toStage,
      detail: toStage === 'lost' ? `Lost: ${lostReasonLabel(change.lostReason)}` : `${stageLabel(current.stage)} → ${stageLabel(toStage)}`,
      notes: (change.lostNotes || options.notes || '').slice(0, 2000),
    }));
    moved = { ...current, ...change };
  });
  return moved;
}

/**
 * Records an interaction the employee actually performed. Nothing here sends a message:
 * the system only logs what the associate reports.
 */
export async function logActivity(user, leadId, { type, notes = '', scheduledAt = null, nextFollowUpAt, advanceTo = '' }, settings, staff) {
  requireSales(ACTIVITY_TYPES.some(a => a.id === type), 'Choose what happened.');
  requireSales(type !== 'note' || notes.trim(), 'Write the note before saving.');
  requireSales(type !== 'consultation_scheduled' || scheduledAt, 'Set the consultation date and time.');
  let result;
  await runTransaction(db, async tx => {
    const snap = await tx.get(leadRef(leadId));
    requireSales(snap.exists(), 'This lead no longer exists.');
    const current = { id: leadId, ...snap.data() };
    requireSales(current.stage !== 'converted' || type === 'note', 'Converted clients only accept notes.');
    const update = { ...stamp(user) };
    if (OUTREACH.has(type) && !current.firstContactedAt) update.firstContactedAt = serverTimestamp();
    if (type === 'response' && !current.firstResponseAt) {
      update.firstResponseAt = serverTimestamp();
      if (!current.firstContactedAt) update.firstContactedAt = serverTimestamp();
    }
    if (nextFollowUpAt !== undefined && OPEN_STAGES.includes(current.stage)) update.nextFollowUpAt = ts(nextFollowUpAt ? zonedTime(nextFollowUpAt, settings.timezone, 9) : null);
    tx.set(doc(activitiesRef(leadId)), activity(user, current, type, { notes: notes.trim().slice(0, 2000), scheduledAt: ts(scheduledAt) }));
    if (advanceTo && advanceTo !== current.stage) {
      const change = validateStageChange(current, advanceTo);
      Object.assign(update, change, { stageChangedAt: serverTimestamp() });
      tx.set(doc(activitiesRef(leadId)), activity(user, current, 'stage_change', { fromStage: current.stage, toStage: advanceTo, detail: `${stageLabel(current.stage)} → ${stageLabel(advanceTo)}` }));
    }
    tx.update(leadRef(leadId), update);
    if (type === 'consultation_scheduled') {
      const when = scheduledAt.toLocaleString('en-PH', { timeZone: settings.timezone, dateStyle: 'medium', timeStyle: 'short' });
      notify(tx, user, [current.ownerEmail, ...staff.managerEmails], 'consultation', `Consultation scheduled: ${current.businessName}`, `${when} — recorded by ${nameOf(user)}.`, leadId);
    }
    result = { ...current, ...update, stage: advanceTo || current.stage };
  });
  return result;
}

/* ─── Conversions ─── */

export async function requestConversion(user, leadId, form, staff) {
  const deal = validateDealRequest(form);
  await runTransaction(db, async tx => {
    const [leadSnap, dealSnap] = await Promise.all([tx.get(leadRef(leadId)), tx.get(dealRef(leadId))]);
    requireSales(leadSnap.exists(), 'This lead no longer exists.');
    const lead = { id: leadId, ...leadSnap.data() };
    requireSales(['quotation', 'negotiation'].includes(lead.stage), 'Move the lead to Quotation Sent or Negotiation before requesting conversion.');
    requireSales(!dealSnap.exists() || dealSnap.data().status === 'rejected', dealSnap.data()?.status === 'confirmed' ? 'This client is already converted.' : 'A conversion request is already awaiting review.');
    tx.set(dealRef(leadId), {
      leadId, businessName: lead.businessName, industry: lead.industry, attributedEmail: lead.attributedEmail, attributedName: lead.attributedName || '', ownerEmail: lead.ownerEmail,
      leadCreatedAt: lead.createdAt, ...deal, status: 'pending',
      submittedByUid: user.uid, submittedByEmail: emailOf(user), submittedByName: nameOf(user), submittedAt: serverTimestamp(),
      reviewNotes: '', reviewedByUid: '', reviewedByName: '', reviewedAt: null, confirmedAt: null, updatedAt: serverTimestamp(),
    });
    tx.update(leadRef(leadId), { conversionStatus: 'pending', ...stamp(user) });
    tx.set(doc(activitiesRef(leadId)), activity(user, lead, 'conversion_requested', { detail: `${deal.service} — quoted ${formatPeso(deal.quotedCentavos)}`, notes: deal.requestNotes }));
    notify(tx, user, staff.managerEmails, 'conversion_request', `Conversion request: ${lead.businessName}`, `${nameOf(user)} requests confirmation for ${deal.service} (${formatPeso(deal.quotedCentavos)}).`, leadId);
  });
}

export async function rejectConversion(user, leadId, notes) {
  requireSales(notes?.trim(), 'Explain what needs to change before the request can be approved.');
  await runTransaction(db, async tx => {
    const [leadSnap, dealSnap] = await Promise.all([tx.get(leadRef(leadId)), tx.get(dealRef(leadId))]);
    requireSales(dealSnap.exists() && dealSnap.data().status === 'pending', 'This request is no longer awaiting review.');
    const lead = { id: leadId, ...leadSnap.data() };
    const deal = dealSnap.data();
    tx.update(dealRef(leadId), { status: 'rejected', industry: lead.industry, reviewNotes: notes.trim().slice(0, 1000), reviewedByUid: user.uid, reviewedByName: nameOf(user), reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(leadRef(leadId), { conversionStatus: 'rejected', ...stamp(user) });
    tx.set(doc(activitiesRef(leadId)), activity(user, lead, 'conversion_rejected', { notes: notes.trim().slice(0, 2000) }));
    tx.set(doc(collection(db, 'salesNotifications')), notification(user, deal.submittedByEmail, 'conversion_rejected', `Conversion returned: ${lead.businessName}`, notes.trim(), leadId));
  });
}

/** Management confirms the down payment; only now does the lead become a converted client. */
export async function confirmConversion(user, leadId, form, settings) {
  const confirmation = validateDealConfirmation(form, localDateKey(new Date(), settings.timezone));
  await runTransaction(db, async tx => {
    const [leadSnap, dealSnap] = await Promise.all([tx.get(leadRef(leadId)), tx.get(dealRef(leadId))]);
    requireSales(dealSnap.exists() && dealSnap.data().status === 'pending', 'This request is no longer awaiting confirmation.');
    const lead = { id: leadId, ...leadSnap.data() };
    const deal = dealSnap.data();
    tx.update(dealRef(leadId), {
      ...confirmation, status: 'confirmed', industry: lead.industry, reviewedByUid: user.uid, reviewedByName: nameOf(user), reviewedAt: serverTimestamp(), confirmedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    tx.update(leadRef(leadId), { stage: 'converted', stageChangedAt: serverTimestamp(), conversionStatus: 'confirmed', convertedAt: serverTimestamp(), nextFollowUpAt: null, lostReason: '', lostNotes: '', ...stamp(user) });
    tx.set(doc(activitiesRef(leadId)), activity(user, { ...lead, stage: 'converted' }, 'payment_confirmed', {
      detail: `Down payment ${formatPeso(confirmation.downPaymentCentavos)} received ${confirmation.paymentDate}${confirmation.paymentReference ? ` (ref ${confirmation.paymentReference})` : ''}`,
      notes: confirmation.reviewNotes,
    }));
    tx.set(doc(activitiesRef(leadId)), activity(user, lead, 'stage_change', { fromStage: lead.stage, toStage: 'converted', detail: `${stageLabel(lead.stage)} → Converted` }));
    tx.set(doc(collection(db, 'salesNotifications')), notification(user, deal.submittedByEmail, 'conversion_confirmed', `Conversion confirmed: ${lead.businessName}`, `${formatPeso(confirmation.finalCentavos)} — confirmed by ${nameOf(user)}.`, leadId));
    if (lead.attributedEmail !== deal.submittedByEmail) {
      tx.set(doc(collection(db, 'salesNotifications')), notification(user, lead.attributedEmail, 'conversion_confirmed', `Conversion confirmed: ${lead.businessName}`, 'Credited to you as the lead\'s original owner.', leadId));
    }
  });
}

/* ─── Taskboard integration ─── */

const taskEntry = user => ({ type: 'created', at: Timestamp.now(), byEmail: emailOf(user), byName: nameOf(user) });
function salesTaskDoc(user, spec, assignee, extra) {
  return {
    title: spec.title.slice(0, 160), description: (spec.description || '').slice(0, 5000), priority: spec.priority || 'medium', status: 'todo',
    dueAt: Timestamp.fromDate(spec.dueAt), assignees: [{ email: assignee.email, name: assignee.name }], assigneeEmails: [assignee.email],
    checklist: (spec.checklist || []).map((text, i) => ({ id: `c${i + 1}`, text: text.slice(0, 200), done: false })),
    activity: [taskEntry(user)], createdByUid: user.uid, createdByEmail: emailOf(user), createdByName: nameOf(user),
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), completedAt: null, category: 'sales', ...extra,
  };
}

/**
 * Creates the sales task for `spec.activity` on a lead unless an open one already exists.
 * Returns 'created' or 'exists'.
 */
export async function ensureLeadTask(user, lead, spec, assignee = { email: lead.ownerEmail, name: lead.ownerName }) {
  const existing = await getDocs(query(collection(db, 'tasks'), where('salesLeadId', '==', lead.id)));
  const same = existing.docs.filter(d => d.data().salesActivity === spec.activity);
  if (same.some(d => d.data().status !== 'done')) return 'exists';
  const ref = doc(db, 'tasks', `sales-${lead.id}-${spec.activity}-${same.length + 1}`);
  return runTransaction(db, async tx => {
    if ((await tx.get(ref)).exists()) return 'exists';
    tx.set(ref, salesTaskDoc(user, spec, assignee, { salesLeadId: lead.id, salesActivity: spec.activity }));
    return 'created';
  });
}

export const suggestedTask = (lead, stage, settings, now = new Date()) => automationTask(settings.automation, stage, lead, now, settings);

/** Applies the stage's automation rule: auto rules create the task, suggest rules return it for the user to accept. */
export async function applyAutomation(user, lead, stage, settings) {
  const task = suggestedTask(lead, stage, settings);
  if (!task) return { status: 'none' };
  if (task.mode !== 'auto') return { status: 'suggested', task };
  return { status: await ensureLeadTask(user, lead, task), task };
}

export async function endorseToDeveloper(user, lead, developer, { notes, dueDate }, settings) {
  requireSales(developer?.email, 'Choose who will handle the consultation or demo.');
  requireSales(/^\d{4}-\d{2}-\d{2}$/.test(dueDate || ''), 'Choose when the developer should be ready.');
  const spec = {
    activity: 'demo_endorsement', priority: 'high', title: `Demo / consultation support: ${lead.businessName}`,
    description: `Endorsed by ${nameOf(user)} for a technical consultation or demonstration.\nIndustry: ${lead.industry}\n${notes ? `Notes: ${notes}` : ''}`,
    dueAt: zonedTime(dueDate, settings.timezone, 17),
  };
  const status = await ensureLeadTask(user, lead, spec, developer);
  if (status === 'created') {
    const batch = writeBatch(db);
    batch.set(doc(activitiesRef(lead.id)), activity(user, lead, 'endorsed', { detail: `Endorsed to ${developer.name}`, notes: (notes || '').slice(0, 2000) }));
    await batch.commit();
  }
  return status;
}

/** Creates Mon–Sat schedule tasks for each associate; existing days are left untouched. */
export async function generateWeeklySchedule(user, weekKey, associates, settings, targets) {
  const days = weeklyScheduleTasks(weekKey, settings, targets);
  let created = 0;
  for (const associate of associates) {
    const slug = associate.email.replace(/[^a-z0-9]+/g, '_');
    for (const day of days) {
      const ref = doc(db, 'tasks', `salesweek-${weekKey}-${slug}-${day.weekday}`);
      created += await runTransaction(db, async tx => {
        if ((await tx.get(ref)).exists()) return 0;
        tx.set(ref, salesTaskDoc(user, day, associate, { salesActivity: 'weekly_schedule', salesWeek: weekKey }));
        return 1;
      });
    }
  }
  return created;
}

/* ─── Reads ─── */

/** Leads visible to the user: everything for management, own leads for associates. */
export async function loadLeads({ owner = null, range = null, max = 1500 }) {
  const clauses = [];
  if (owner) clauses.push(where('ownerEmail', '==', owner));
  if (range) clauses.push(where('createdAt', '>=', ts(range.start)), where('createdAt', '<', ts(range.end)));
  return rows(await getDocs(query(collection(db, 'salesLeads'), ...clauses, orderBy('createdAt', 'desc'), limit(max))));
}

export function subscribeLead(leadId, onData, onError) {
  return onSnapshot(leadRef(leadId), snap => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError);
}
export function subscribeLeadActivities(leadId, onData, onError) {
  return onSnapshot(query(activitiesRef(leadId), orderBy('at', 'desc'), limit(200)), snap => onData(rows(snap)), onError);
}
export async function getDeal(leadId) {
  const snap = await getDoc(dealRef(leadId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Everything KPI calculations need for a period. Associates only receive records attributed to them. */
export async function loadPeriodData(range, owner = null) {
  const mine = owner ? [where('attributedEmail', '==', owner)] : [];
  const between = field => [where(field, '>=', ts(range.start)), where(field, '<', ts(range.end))];
  const [leads, activities, periodDeals, cohortDeals] = await Promise.all([
    getDocs(query(collection(db, 'salesLeads'), ...mine, ...between('createdAt'))),
    getDocs(query(collectionGroup(db, 'salesActivities'), ...mine, ...between('at'))),
    getDocs(query(collection(db, 'salesDeals'), ...mine, ...between('confirmedAt'))),
    getDocs(query(collection(db, 'salesDeals'), ...mine, ...between('leadCreatedAt'))),
  ]);
  return { leads: rows(leads), activities: rows(activities), periodDeals: rows(periodDeals), cohortDeals: rows(cohortDeals) };
}

/** Open leads with a follow-up date, for reminders and report backlogs. */
export async function loadFollowUps(owner = null) {
  const clauses = owner ? [where('ownerEmail', '==', owner)] : [];
  const snap = await getDocs(query(collection(db, 'salesLeads'), ...clauses, where('nextFollowUpAt', '<=', Timestamp.fromDate(new Date(Date.now() + 86400000))), orderBy('nextFollowUpAt', 'asc'), limit(500)));
  return rows(snap).filter(l => OPEN_STAGES.includes(l.stage));
}

export async function loadSalesTasks(assigneeEmail = null) {
  const clauses = [where('category', '==', 'sales')];
  if (assigneeEmail) clauses.push(where('assigneeEmails', 'array-contains', assigneeEmail));
  return rows(await getDocs(query(collection(db, 'tasks'), ...clauses, limit(1000))));
}

export function subscribeDeals({ owner = null, status = null }, onData, onError) {
  const clauses = [];
  if (owner) clauses.push(where('ownerEmail', '==', owner));
  if (status) clauses.push(where('status', '==', status));
  return onSnapshot(query(collection(db, 'salesDeals'), ...clauses, limit(500)), snap => onData(rows(snap)), onError);
}

export function subscribeNotifications(email, onData, onError) {
  return onSnapshot(query(collection(db, 'salesNotifications'), where('recipientEmail', '==', email), orderBy('createdAt', 'desc'), limit(50)), snap => onData(rows(snap)), onError);
}
export async function markNotificationRead(id) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'salesNotifications', id), { read: true });
  await batch.commit();
}

/* ─── Weekly self-report ─── */

export async function submitWeeklyReport(user, weekKey, snapshot, notes) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'salesWeeklyReports', `${weekKey}_${user.uid}`), {
    weekKey, uid: user.uid, email: emailOf(user), name: nameOf(user), snapshot, notes: (notes || '').trim().slice(0, 3000), submittedAt: serverTimestamp(),
  });
  await batch.commit();
}
export async function loadWeeklyReports(weekKey, email = null) {
  const clauses = [where('weekKey', '==', weekKey)];
  if (email) clauses.push(where('email', '==', email));
  return rows(await getDocs(query(collection(db, 'salesWeeklyReports'), ...clauses)));
}

export { DEFAULT_TARGETS };
