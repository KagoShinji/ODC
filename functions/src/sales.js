import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { featureOptions as options } from './accessConfig.js';
import { DEFAULT_SALES_SETTINGS, OPEN_STAGES, periodRange, computeKpis, targetsFor, localDateKey, weekdayOf } from './salesDomain.js';

// Optional server reminders for the Blaze plan. On Spark the web app derives the same reminders live.
// Notification ids are deterministic, so a retried run never notifies twice.

async function salesContext(db) {
  const [settingsSnap, targetsSnap, staffSnap] = await Promise.all([db.doc('salesSettings/current').get(), db.collection('salesTargets').get(), db.collection('staff').get()]);
  const settings = { ...DEFAULT_SALES_SETTINGS, ...(settingsSnap.data() || {}) };
  const staff = staffSnap.docs.map(d => d.data()).filter(s => s.status === 'active' && s.email);
  const has = (s, actions) => (s.allowedActions || []).some(a => actions.includes(a));
  return {
    settings,
    targets: targetsSnap.docs.map(d => d.data()),
    associates: staff.filter(s => has(s, ['sales:associate'])).map(s => ({ email: s.email.toLowerCase(), name: s.name || s.email })),
    managers: staff.filter(s => has(s, ['sales:manage', 'sales:confirm'])).map(s => s.email.toLowerCase()),
  };
}

function notice(recipientEmail, type, title, body = '', leadId = '') {
  return { recipientEmail, type, title: title.slice(0, 200), body: body.slice(0, 1000), leadId, read: false, createdAt: Timestamp.now(), createdByUid: 'system' };
}
const safe = value => value.replace(/[^a-zA-Z0-9_-]+/g, '_');

export async function deliverSalesReminders(db, now = new Date()) {
  const { settings, associates } = await salesContext(db);
  const today = localDateKey(now, settings.timezone);
  const writes = new Map();
  const endOfDay = new Date(now.getTime() + 86400000);
  const followUps = await db.collection('salesLeads').where('nextFollowUpAt', '<=', Timestamp.fromDate(endOfDay)).get();
  for (const doc of followUps.docs) {
    const lead = doc.data();
    if (!OPEN_STAGES.includes(lead.stage)) continue;
    writes.set(`salesfu_${doc.id}_${today}`, notice(lead.ownerEmail, 'follow_up', `Follow-up due: ${lead.businessName}`, `Scheduled for ${localDateKey(lead.nextFollowUpAt.toDate(), settings.timezone)}.`, doc.id));
  }
  const quotationCutoff = Timestamp.fromDate(new Date(now.getTime() - (settings.quotationFollowUpDays || 3) * 86400000));
  const quotations = await db.collection('salesLeads').where('stage', '==', 'quotation').where('stageChangedAt', '<=', quotationCutoff).get();
  for (const doc of quotations.docs) {
    writes.set(`salesq_${doc.id}_${today}`, notice(doc.data().ownerEmail, 'quotation', `Quotation needs follow-up: ${doc.data().businessName}`, '', doc.id));
  }
  const tasks = await db.collection('tasks').where('category', '==', 'sales').where('dueAt', '<', Timestamp.fromDate(now)).get();
  for (const doc of tasks.docs) {
    const task = doc.data();
    if (task.status === 'done') continue;
    for (const email of task.assigneeEmails || []) writes.set(`salestask_${doc.id}_${safe(email)}_${today}`, notice(email, 'task_overdue', `Overdue task: ${task.title}`, '', task.salesLeadId || ''));
  }
  if (weekdayOf(today) === 6) {
    for (const a of associates) writes.set(`salesreport_${today}_${safe(a.email)}`, notice(a.email, 'report_due', 'Weekly sales report is due today', 'Submit it from Sales reports.'));
  }
  const entries = [...writes];
  let delivered = 0;
  for (let i = 0; i < entries.length; i += 400) {
    const chunk = entries.slice(i, i + 400);
    const refs = chunk.map(([id]) => db.doc(`salesNotifications/${id}`));
    const existing = await db.getAll(...refs);
    const batch = db.batch();
    chunk.forEach(([, data], index) => { if (!existing[index].exists) { batch.set(refs[index], data); delivered += 1; } });
    await batch.commit();
  }
  return delivered;
}

export async function deliverWeeklySummary(db, now = new Date()) {
  const { settings, targets, associates, managers } = await salesContext(db);
  const range = periodRange('week', now, settings);
  const between = field => [field, '>=', Timestamp.fromDate(range.start)];
  const before = field => [field, '<', Timestamp.fromDate(range.end)];
  const [leads, activities, periodDeals, cohortDeals] = await Promise.all([
    db.collection('salesLeads').where(...between('createdAt')).where(...before('createdAt')).get(),
    db.collectionGroup('salesActivities').where(...between('at')).where(...before('at')).get(),
    db.collection('salesDeals').where(...between('confirmedAt')).where(...before('confirmedAt')).get(),
    db.collection('salesDeals').where(...between('leadCreatedAt')).where(...before('leadCreatedAt')).get(),
  ]);
  const data = { leads: leads.docs.map(d => ({ id: d.id, ...d.data() })), activities: activities.docs.map(d => d.data()), periodDeals: periodDeals.docs.map(d => d.data()), cohortDeals: cohortDeals.docs.map(d => d.data()) };
  const t = targetsFor(targets, range.startKey);
  const team = computeKpis({ ...data, range, targets: t, associateCount: Math.max(1, associates.length) });
  const lines = associates.map(a => {
    const k = computeKpis({ ...data, range, targets: t, owner: a.email });
    return `${a.name}: ${k.leadsGenerated}/${k.leadTarget} leads, ${k.convertedInPeriod} converted`;
  });
  const body = [`Team: ${team.leadsGenerated}/${team.leadTarget} leads, ${team.contacted} contacted, ${team.quotations} quotations, ${team.convertedInPeriod}/${team.conversionTarget} converted.`, ...lines].join('\n');
  const batch = db.batch();
  for (const email of new Set(managers)) batch.set(db.doc(`salesNotifications/salessummary_${range.startKey}_${safe(email)}`), notice(email, 'weekly_summary', `Weekly sales KPI summary — ${range.label}`, body));
  await batch.commit();
}

export const sendSalesReminders = onSchedule({ schedule: 'every day 08:00', region: options.region, timeZone: 'Asia/Manila', maxInstances: 1 }, async () => { await deliverSalesReminders(getFirestore()); });
export const sendSalesWeeklySummary = onSchedule({ schedule: 'every saturday 18:00', region: options.region, timeZone: 'Asia/Manila', maxInstances: 1 }, async () => { await deliverWeeklySummary(getFirestore()); });
