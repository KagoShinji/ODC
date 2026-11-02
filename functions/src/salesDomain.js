// Sales management domain: shared by the web app, scheduled jobs and tests.
// Pure functions only — no Firestore access here.

export const SALES_ACTIONS = ['sales:associate', 'sales:manage', 'sales:confirm', 'sales:targets'];

export const SALES_STAGES = [
  { id: 'new', label: 'New Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'interested', label: 'Interested' },
  { id: 'consultation', label: 'Consultation / Demo' },
  { id: 'quotation', label: 'Quotation Sent' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'converted', label: 'Converted' },
  { id: 'lost', label: 'Lost' },
];
export const STAGE_IDS = SALES_STAGES.map(s => s.id);
export const OPEN_STAGES = ['new', 'contacted', 'interested', 'consultation', 'quotation', 'negotiation'];

export const LOST_REASONS = [
  { id: 'not_interested', label: 'Not interested' },
  { id: 'no_response', label: 'No response' },
  { id: 'budget', label: 'Budget constraints' },
  { id: 'existing_system', label: 'Already has an existing system' },
  { id: 'postponed', label: 'Project postponed' },
  { id: 'other_provider', label: 'Chose another provider' },
  { id: 'other', label: 'Other' },
];

export const DEFAULT_CATEGORIES = ['Pickleball Courts', 'Restaurants', 'Food Businesses', 'Car Rentals', 'Dress Rentals', 'Clinics', 'Retail Businesses', 'Inventory-Based Businesses', 'Other'];
export const LEAD_SOURCES = ['Facebook', 'Google Maps', 'Website', 'Instagram', 'Referral', 'Walk-in', 'Event', 'Directory', 'Other'];

// `outreach` marks a contact attempt, `response` a reply from the prospect.
export const ACTIVITY_TYPES = [
  { id: 'initial_contact', label: 'Initial contact', outreach: true },
  { id: 'follow_up', label: 'Follow-up message', outreach: true },
  { id: 'call', label: 'Call', outreach: true },
  { id: 'email', label: 'Email', outreach: true },
  { id: 'response', label: 'Response received', response: true },
  { id: 'consultation_scheduled', label: 'Consultation scheduled' },
  { id: 'consultation', label: 'Consultation held' },
  { id: 'demo', label: 'Product demonstration' },
  { id: 'quotation_sent', label: 'Quotation sent' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'note', label: 'Note' },
];
// Written by the system as a side effect of workflow actions; never picked manually.
export const SYSTEM_ACTIVITY_TYPES = ['created', 'stage_change', 'assignment', 'conversion_requested', 'conversion_rejected', 'payment_confirmed', 'endorsed', 'duplicate_review', 'qualification'];
export const ALL_ACTIVITY_TYPES = [...ACTIVITY_TYPES.map(a => a.id), ...SYSTEM_ACTIVITY_TYPES];
const OUTREACH = new Set(ACTIVITY_TYPES.filter(a => a.outreach).map(a => a.id));
const RESPONSE = new Set(ACTIVITY_TYPES.filter(a => a.response).map(a => a.id));

/** Official ODC targets, used until management saves its own. */
export const DEFAULT_TARGETS = Object.freeze({
  weeklyLeadsPerAssociate: 100,
  monthlyLeadsPerAssociate: 400,
  minConversionPercent: 5,
  weeklyConversionTarget: 10,
  monthlyConversionTarget: 40,
  effectiveFrom: '2000-01-01',
});

export const TASK_ACTIVITIES = ['contact', 'follow_up', 'consultation', 'quotation', 'quotation_follow_up', 'negotiation_follow_up', 'demo_endorsement', 'weekly_schedule'];

// New and contacted leads arrive ~100 per associate per week, so their tasks are offered rather than
// created automatically to keep the shared task board usable. Management can change every rule.
export const DEFAULT_AUTOMATION = Object.freeze({
  new: { mode: 'suggest', activity: 'contact', title: 'Contact {business}', dueInDays: 1, priority: 'high' },
  contacted: { mode: 'suggest', activity: 'follow_up', title: 'Follow up with {business}', dueInDays: 2, priority: 'medium' },
  interested: { mode: 'auto', activity: 'consultation', title: 'Schedule consultation with {business}', dueInDays: 1, priority: 'high' },
  consultation: { mode: 'suggest', activity: 'quotation', title: 'Prepare quotation for {business}', dueInDays: 1, priority: 'high' },
  quotation: { mode: 'auto', activity: 'quotation_follow_up', title: 'Follow up on quotation for {business}', dueInDays: 3, priority: 'medium' },
  negotiation: { mode: 'suggest', activity: 'negotiation_follow_up', title: 'Follow up on negotiation with {business}', dueInDays: 2, priority: 'high' },
});

export const DEFAULT_SALES_SETTINGS = Object.freeze({
  timezone: 'Asia/Manila',
  weekStartsOn: 1, // 0 = Sunday … 6 = Saturday
  categories: DEFAULT_CATEGORIES,
  automation: DEFAULT_AUTOMATION,
  quotationFollowUpDays: 3,
});

// Weekday (0 = Sunday) → the team's standing weekly plan. Sunday is a rest day.
export const WEEKLY_SCHEDULE = [
  { weekday: 1, title: 'Lead generation', priority: 'high', target: true, checklist: ['Research potential businesses', 'Collect business contact information', 'Qualify prospects', 'Add {target} leads to the system', 'Ensure each lead has an assigned owner'] },
  { weekday: 2, title: 'Initial outreach', priority: 'high', checklist: ['Contact newly generated prospects', 'Send personalized introductory messages', 'Record contact attempts', 'Update lead status', 'Record responses'] },
  { weekday: 3, title: 'Initial outreach continuation', priority: 'medium', checklist: ['Complete remaining initial outreach', 'Contact prospects not yet reached', 'Record all communications', 'Update interested prospects'] },
  { weekday: 4, title: 'Follow-ups and consultations', priority: 'medium', checklist: ['Follow up with interested prospects', 'Schedule consultations', 'Coordinate technical demonstrations with the development team', 'Record meeting outcomes'] },
  { weekday: 5, title: 'Quotations and closing', priority: 'high', checklist: ['Follow up on quotations', 'Handle objections', 'Coordinate with management on pricing', 'Encourage interested prospects to proceed'] },
  { weekday: 6, title: 'Final follow-ups and reporting', priority: 'high', checklist: ['Follow up with pending prospects', 'Update the pipeline', 'Submit weekly sales performance report', 'Review weekly KPI achievement'] },
];

export class SalesError extends Error {
  constructor(message, code = 'failed-precondition') { super(message); this.code = code; }
}
export function requireSales(condition, message, code = 'invalid-argument') { if (!condition) throw new SalesError(message, code); }

export const stageLabel = id => SALES_STAGES.find(s => s.id === id)?.label || id;
export const lostReasonLabel = id => LOST_REASONS.find(r => r.id === id)?.label || id;
export const activityLabel = id => ACTIVITY_TYPES.find(a => a.id === id)?.label || ({
  created: 'Lead created', stage_change: 'Status changed', assignment: 'Assignment changed', conversion_requested: 'Conversion requested',
  conversion_rejected: 'Conversion returned', payment_confirmed: 'Payment confirmed', endorsed: 'Endorsed to developer', duplicate_review: 'Duplicate review', qualification: 'Qualification changed',
}[id] || id);

/* ─── Periods (timezone aware) ─── */

const pad = n => String(n).padStart(2, '0');
function zonedParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
}
/** YYYY-MM-DD of `date` as seen in `timeZone`. */
export function localDateKey(date, timeZone = 'Asia/Manila') {
  const p = zonedParts(new Date(date), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
function offsetMs(instant, timeZone) {
  const p = zonedParts(new Date(instant), timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant / 1000) * 1000;
}
/** The instant a local wall-clock time occurs in `timeZone`. */
export function zonedTime(dateKey, timeZone = 'Asia/Manila', hours = 0, minutes = 0) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hours, minutes);
  const first = guess - offsetMs(guess, timeZone);
  return new Date(guess - offsetMs(first, timeZone));
}
export function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
export const weekdayOf = dateKey => new Date(`${dateKey}T12:00:00Z`).getUTCDay();
export function weekStartKey(date, timeZone = 'Asia/Manila', weekStartsOn = 1) {
  const key = localDateKey(date, timeZone);
  return addDays(key, -((weekdayOf(key) - weekStartsOn + 7) % 7));
}

/**
 * Reporting period containing `anchor`. Weeks start on `weekStartsOn`; months are calendar
 * months in the organisation's timezone. `end` is exclusive.
 */
export function periodRange(type, anchor = new Date(), settings = DEFAULT_SALES_SETTINGS) {
  const timeZone = settings.timezone || 'Asia/Manila';
  if (type === 'week') {
    const startKey = weekStartKey(anchor, timeZone, settings.weekStartsOn ?? 1);
    const endKey = addDays(startKey, 7);
    return { type, key: startKey, startKey, endKey, start: zonedTime(startKey, timeZone), end: zonedTime(endKey, timeZone), label: `Week of ${formatDateKey(startKey)}` };
  }
  requireSales(type === 'month', 'Unknown reporting period.');
  const local = localDateKey(anchor, timeZone);
  const startKey = `${local.slice(0, 7)}-01`;
  const [y, m] = startKey.split('-').map(Number);
  const endKey = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { type, key: startKey.slice(0, 7), startKey, endKey, start: zonedTime(startKey, timeZone), end: zonedTime(endKey, timeZone), label: new Date(`${startKey}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}
/** Custom inclusive date range picked by the user, e.g. from a filter. */
export function customRange(fromKey, toKey, settings = DEFAULT_SALES_SETTINGS) {
  requireSales(/^\d{4}-\d{2}-\d{2}$/.test(fromKey) && /^\d{4}-\d{2}-\d{2}$/.test(toKey) && fromKey <= toKey, 'Choose a valid date range.');
  const timeZone = settings.timezone || 'Asia/Manila';
  const endKey = addDays(toKey, 1);
  return { type: 'custom', key: `${fromKey}_${toKey}`, startKey: fromKey, endKey, start: zonedTime(fromKey, timeZone), end: zonedTime(endKey, timeZone), label: `${formatDateKey(fromKey)} – ${formatDateKey(toKey)}` };
}
/** Human label for when a target set took effect. */
export const targetsSince = t => (t.effectiveFrom === DEFAULT_TARGETS.effectiveFrom ? 'ODC default targets' : `targets in force from ${formatDateKey(t.effectiveFrom)}`);
export const formatDateKey = key => new Date(`${key}T12:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Number of reporting weeks a range spans, used to scale weekly targets for custom ranges. */
export const rangeWeeks = range => Math.max(1, Math.round((range.end - range.start) / (7 * 86400000)));

/* ─── Duplicate detection ─── */

export const normalizeName = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/\b(inc|corp|corporation|co|ltd|llc|opc|the)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, '');
export function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 7 ? digits : '';
}
export function normalizeWebsite(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//.test(text) ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, '');
    // Social and link-in-bio hosts are shared, so keep the path for them.
    const path = /(facebook|fb|instagram|linktr)\./.test(host) ? url.pathname.replace(/\/+$/, '') : '';
    return `${host}${path}`;
  } catch { return ''; }
}
export function normalizeFacebook(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  try {
    const url = new URL(/^https?:\/\//.test(text) ? text : `https://${text}`);
    if (!/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me)$/.test(url.hostname)) return '';
    const id = url.searchParams.get('id');
    const path = url.pathname.replace(/\/+$/, '').replace(/^\/(pg|pages)\//, '/');
    return id ? `id:${id}` : path.length > 1 ? path.slice(1) : '';
  } catch { return ''; }
}
export const normalizeEmail = value => {
  const text = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : '';
};
const keyId = (type, value) => `${type}_${value.replace(/[^a-z0-9]+/g, '_').slice(0, 300)}`;
/** Identifier keys used for duplicate detection; each maps to a `salesLeadKeys` document id. */
export function leadKeys(lead) {
  const keys = [];
  const add = (type, value) => { if (value) keys.push({ type, value, id: keyId(type, value) }); };
  const name = normalizeName(lead.businessName);
  add('name', name.length >= 3 ? name : '');
  add('phone', normalizePhone(lead.contactNumber));
  add('web', normalizeWebsite(lead.websiteUrl));
  add('fb', normalizeFacebook(lead.facebookUrl));
  add('email', normalizeEmail(lead.email));
  return keys;
}
export const DUPLICATE_KEY_LABELS = { name: 'business name', phone: 'phone number', web: 'website', fb: 'Facebook page', email: 'email address' };

/* ─── Validation ─── */

function text(value, label, max, required = false) {
  requireSales(value == null || typeof value === 'string', `${label} must be text.`);
  const result = String(value || '').trim();
  requireSales(!required || result.length > 0, `${label} is required.`);
  requireSales(result.length <= max, `${label} must be at most ${max} characters.`);
  return result;
}
function url(value, label) {
  const result = text(value, label, 500);
  if (!result) return '';
  const withScheme = /^https?:\/\//i.test(result) ? result : `https://${result}`;
  try { const parsed = new URL(withScheme); requireSales(parsed.hostname.includes('.'), `${label} is not a valid link.`); } catch (error) {
    if (error instanceof SalesError) throw error;
    throw new SalesError(`${label} is not a valid link.`);
  }
  return withScheme;
}

/** Validates lead form input and returns the clean, storable fields. */
export function validateLead(input, categories = DEFAULT_CATEGORIES) {
  requireSales(input && typeof input === 'object', 'Lead details are required.');
  const lead = {
    businessName: text(input.businessName, 'Business name', 200, true),
    industry: text(input.industry, 'Industry', 80, true),
    location: text(input.location, 'Business location', 200),
    contactName: text(input.contactName, "Contact person's name", 120),
    contactNumber: text(input.contactNumber, 'Contact number', 40),
    facebookUrl: url(input.facebookUrl, 'Facebook page URL'),
    websiteUrl: url(input.websiteUrl, 'Website URL'),
    email: text(input.email, 'Email address', 200).toLowerCase(),
    source: text(input.source, 'Lead source', 80, true),
    notes: text(input.notes, 'Notes', 5000),
  };
  requireSales(categories.includes(lead.industry), 'Choose an industry from the configured categories.');
  requireSales(normalizeName(lead.businessName).length >= 2, 'Enter a real business name.');
  requireSales(!lead.email || normalizeEmail(lead.email), 'Email address is not valid.');
  requireSales(!lead.contactNumber || normalizePhone(lead.contactNumber), 'Contact number must have at least 7 digits.');
  requireSales(!lead.facebookUrl || normalizeFacebook(lead.facebookUrl), 'Facebook page URL must be a facebook.com link.');
  requireSales(lead.contactNumber || lead.email || lead.facebookUrl || lead.websiteUrl, 'Add at least one contact channel: phone, email, Facebook page or website.');
  return lead;
}

/** Validates a requested pipeline move. Converted can only be reached through payment confirmation. */
export function validateStageChange(lead, toStage, { lostReason = '', lostNotes = '' } = {}) {
  requireSales(STAGE_IDS.includes(toStage), 'Unknown pipeline stage.');
  requireSales(lead.stage !== toStage, 'The lead is already in this stage.');
  requireSales(lead.stage !== 'converted', 'Converted clients are locked. Ask management to correct the record.', 'failed-precondition');
  requireSales(toStage !== 'converted', 'A lead becomes Converted only after management confirms the down payment. Submit a conversion request instead.', 'failed-precondition');
  requireSales(lead.conversionStatus !== 'pending' || toStage === 'negotiation', 'This lead has a conversion request awaiting review. Wait for management before moving it.', 'failed-precondition');
  if (toStage === 'lost') {
    requireSales(LOST_REASONS.some(r => r.id === lostReason), 'Choose why the lead was lost.');
    requireSales(lostReason !== 'other' || String(lostNotes).trim(), 'Describe the reason when choosing "Other".');
  }
  return { stage: toStage, lostReason: toStage === 'lost' ? lostReason : '', lostNotes: toStage === 'lost' ? text(lostNotes, 'Lost notes', 1000) : '' };
}

export function toCentavos(value, label, { allowZero = false, required = true } = {}) {
  if ((value === '' || value == null) && !required) return 0;
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[,\s₱]/g, ''));
  requireSales(Number.isFinite(number) && number >= 0 && number <= 100000000, `${label} must be a valid amount.`);
  const centavos = Math.round(number * 100);
  requireSales(allowZero || centavos > 0, `${label} must be greater than zero.`);
  return centavos;
}
export const formatPeso = centavos => `₱${(Number(centavos || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Conversion request submitted by the associate. */
export function validateDealRequest(input) {
  const deal = {
    service: text(input.service, 'Service purchased', 200, true),
    quotedCentavos: toCentavos(input.quoted, 'Quoted project value'),
    finalCentavos: toCentavos(input.final, 'Final agreed amount', { required: false, allowZero: true }),
    downPaymentCentavos: toCentavos(input.downPayment, 'Down payment amount', { required: false, allowZero: true }),
    paymentDate: text(input.paymentDate, 'Payment date', 10),
    paymentReference: text(input.paymentReference, 'Payment reference', 120),
    requestNotes: text(input.notes, 'Notes', 1000),
  };
  requireSales(!deal.paymentDate || /^\d{4}-\d{2}-\d{2}$/.test(deal.paymentDate), 'Choose a valid payment date.');
  return deal;
}
/** Management confirmation: requires a verified down payment. */
export function validateDealConfirmation(input, today) {
  const confirmation = {
    finalCentavos: toCentavos(input.final, 'Final agreed amount'),
    downPaymentCentavos: toCentavos(input.downPayment, 'Down payment amount'),
    paymentDate: text(input.paymentDate, 'Payment date', 10, true),
    paymentReference: text(input.paymentReference, 'Payment reference', 120),
    reviewNotes: text(input.notes, 'Review notes', 1000),
  };
  requireSales(/^\d{4}-\d{2}-\d{2}$/.test(confirmation.paymentDate), 'Choose a valid payment date.');
  requireSales(!today || confirmation.paymentDate <= today, 'The payment date cannot be in the future.');
  requireSales(confirmation.downPaymentCentavos <= confirmation.finalCentavos, 'The down payment cannot exceed the final agreed amount.');
  requireSales(input.paymentVerified === true, 'Confirm that the down payment was received before approving.');
  return confirmation;
}

export function validateTargets(input) {
  const integer = (key, label, min, max) => {
    const value = Number(input[key]);
    requireSales(Number.isInteger(value) && value >= min && value <= max, `${label} must be a whole number from ${min} to ${max}.`);
    return value;
  };
  const minConversionPercent = Number(input.minConversionPercent);
  requireSales(Number.isFinite(minConversionPercent) && minConversionPercent > 0 && minConversionPercent <= 100, 'Minimum conversion must be between 0 and 100 percent.');
  requireSales(/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom || ''), 'Choose the date these targets take effect.');
  return {
    weeklyLeadsPerAssociate: integer('weeklyLeadsPerAssociate', 'Weekly lead target', 1, 10000),
    monthlyLeadsPerAssociate: integer('monthlyLeadsPerAssociate', 'Monthly lead target', 1, 50000),
    minConversionPercent: Math.round(minConversionPercent * 100) / 100,
    weeklyConversionTarget: integer('weeklyConversionTarget', 'Weekly conversion target', 0, 10000),
    monthlyConversionTarget: integer('monthlyConversionTarget', 'Monthly conversion target', 0, 50000),
    effectiveFrom: input.effectiveFrom,
  };
}

/** Target set in force on `dateKey`: the latest one whose effective date is not after it. */
export function targetsFor(targetDocs, dateKey) {
  const applicable = (targetDocs || []).filter(t => t.effectiveFrom <= dateKey).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return { ...DEFAULT_TARGETS, ...(applicable[0] || {}) };
}

/* ─── KPI calculations ─── */

const ms = value => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
const within = (value, range) => { const t = ms(value); return t != null && t >= range.start.getTime() && t < range.end.getTime(); };
export const rate = (numerator, denominator) => denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
/** A lead counts toward targets only if it is qualified and not confirmed as a duplicate. */
export const eligibleLead = lead => lead.qualified !== false && lead.duplicateStatus !== 'duplicate';

function distinctLeads(activities, predicate) { return new Set(activities.filter(predicate).map(a => a.leadId)).size; }

/**
 * KPI figures for one associate or the combined team.
 *
 * - leads: leads created in the period (the period's lead cohort)
 * - activities: activities recorded in the period
 * - periodDeals: deals confirmed in the period (calendar sales)
 * - cohortDeals: confirmed deals whose lead was created in the period, whenever confirmed
 * Every record is attributed to the lead's original owner (`attributedEmail`), never the current assignee.
 * `owner` is that email, or null for the combined team.
 */
export function computeKpis({ leads = [], activities = [], periodDeals = [], cohortDeals = [], range, targets = DEFAULT_TARGETS, owner = null, associateCount = 1 }) {
  const mine = record => owner == null || record.attributedEmail === owner;
  const cohort = leads.filter(l => mine(l) && within(l.createdAt, range));
  const eligible = cohort.filter(eligibleLead);
  const eligibleIds = new Set(eligible.map(l => l.id));
  const acts = activities.filter(a => mine(a) && within(a.at, range));
  const confirmed = deal => deal.status === 'confirmed';
  const converted = periodDeals.filter(d => mine(d) && confirmed(d) && within(d.confirmedAt, range));
  const cohortConverted = new Set(cohortDeals.filter(d => mine(d) && confirmed(d) && eligibleIds.has(d.leadId)).map(d => d.leadId)).size;
  const fromThisCohort = converted.filter(d => within(d.leadCreatedAt, range)).length;

  const weeks = range.type === 'month' ? null : rangeWeeks(range);
  const perHead = owner == null ? Math.max(1, associateCount) : 1;
  const leadTarget = range.type === 'month' ? targets.monthlyLeadsPerAssociate * perHead : targets.weeklyLeadsPerAssociate * perHead * weeks;
  const conversionTarget = owner == null
    ? (range.type === 'month' ? targets.monthlyConversionTarget : targets.weeklyConversionTarget * weeks)
    : Math.ceil(leadTarget * targets.minConversionPercent / 100);

  const contactedCohort = eligible.filter(l => l.firstContactedAt).length;
  const respondedCohort = eligible.filter(l => l.firstContactedAt && l.firstResponseAt).length;
  return {
    leadsGenerated: eligible.length,
    leadsAdded: cohort.length,
    excludedLeads: cohort.length - eligible.length,
    leadTarget,
    leadAchievement: rate(eligible.length, leadTarget),
    contacted: distinctLeads(acts, a => OUTREACH.has(a.type)),
    responses: distinctLeads(acts, a => RESPONSE.has(a.type)),
    interested: distinctLeads(acts, a => a.type === 'stage_change' && a.toStage === 'interested'),
    consultations: distinctLeads(acts, a => a.type === 'consultation' || a.type === 'demo'),
    quotations: distinctLeads(acts, a => a.type === 'quotation_sent'),
    lost: distinctLeads(acts, a => a.type === 'stage_change' && a.toStage === 'lost'),
    convertedInPeriod: converted.length,
    convertedFromThisCohort: fromThisCohort,
    convertedFromPreviousCohorts: converted.length - fromThisCohort,
    convertedValueCentavos: converted.reduce((sum, d) => sum + (d.finalCentavos || 0), 0),
    cohortConverted,
    cohortConversionRate: rate(cohortConverted, eligible.length),
    contactRate: rate(contactedCohort, eligible.length),
    responseRate: rate(respondedCohort, contactedCohort),
    conversionTarget,
    conversionAchievement: rate(converted.length, conversionTarget),
    minConversionPercent: targets.minConversionPercent,
    meetsConversionMinimum: eligible.length > 0 ? rate(cohortConverted, eligible.length) >= targets.minConversionPercent : null,
  };
}

/** Pending follow-ups and overdue sales tasks at `now`, for a report. */
export function followUpSummary({ leads = [], tasks = [], owner = null, now = Date.now() }) {
  const mine = l => owner == null || l.ownerEmail === owner;
  const open = leads.filter(l => mine(l) && OPEN_STAGES.includes(l.stage));
  const myTasks = tasks.filter(t => t.category === 'sales' && t.status !== 'done' && (owner == null || (t.assigneeEmails || []).includes(owner)));
  return {
    pendingFollowUps: open.filter(l => ms(l.nextFollowUpAt) != null && ms(l.nextFollowUpAt) <= now).length,
    scheduledFollowUps: open.filter(l => ms(l.nextFollowUpAt) != null && ms(l.nextFollowUpAt) > now).length,
    overdueTasks: myTasks.filter(t => ms(t.dueAt) != null && ms(t.dueAt) < now).length,
    openTasks: myTasks.length,
  };
}

/* ─── Taskboard automation ─── */

export const fillTemplate = (template, lead) => String(template || '').replaceAll('{business}', lead.businessName).slice(0, 160);

/** Task to create (or suggest) when a lead enters `stage`, or null when no rule applies. */
export function automationTask(automation, stage, lead, now = new Date(), settings = DEFAULT_SALES_SETTINGS) {
  const rule = (automation || DEFAULT_AUTOMATION)[stage];
  if (!rule || rule.mode === 'off' || !TASK_ACTIVITIES.includes(rule.activity)) return null;
  const dueKey = addDays(localDateKey(now, settings.timezone), Math.max(0, Math.min(30, Number(rule.dueInDays) || 0)));
  return {
    mode: rule.mode,
    activity: rule.activity,
    title: fillTemplate(rule.title, lead),
    description: `Sales lead: ${lead.businessName}${lead.industry ? ` (${lead.industry})` : ''}\nPipeline stage: ${stageLabel(stage)}`,
    priority: ['low', 'medium', 'high', 'urgent'].includes(rule.priority) ? rule.priority : 'medium',
    dueAt: zonedTime(dueKey, settings.timezone, 17, 0),
  };
}

export function validateAutomation(input) {
  const result = {};
  for (const stage of OPEN_STAGES) {
    const rule = input?.[stage] || DEFAULT_AUTOMATION[stage];
    requireSales(['auto', 'suggest', 'off'].includes(rule.mode), 'Choose how each stage creates tasks.');
    requireSales(TASK_ACTIVITIES.includes(rule.activity), 'Unknown task activity.');
    const dueInDays = Number(rule.dueInDays);
    requireSales(Number.isInteger(dueInDays) && dueInDays >= 0 && dueInDays <= 30, 'Task due days must be from 0 to 30.');
    requireSales(['low', 'medium', 'high', 'urgent'].includes(rule.priority), 'Choose a task priority.');
    const title = text(rule.title, 'Task title', 120, true);
    requireSales(title.includes('{business}'), 'Task titles must include {business}.');
    result[stage] = { mode: rule.mode, activity: rule.activity, title, dueInDays, priority: rule.priority };
  }
  return result;
}

/** The six daily schedule tasks (Mon–Sat) for one associate in the week starting `weekKey`. */
export function weeklyScheduleTasks(weekKey, settings = DEFAULT_SALES_SETTINGS, targets = DEFAULT_TARGETS) {
  return WEEKLY_SCHEDULE.map(day => {
    const offset = (day.weekday - (settings.weekStartsOn ?? 1) + 7) % 7;
    const dateKey = addDays(weekKey, offset);
    const dayName = new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', timeZone: 'UTC' });
    return {
      weekday: day.weekday,
      dateKey,
      title: `${dayName}: ${day.title}`.slice(0, 160),
      description: day.target ? `Target: ${targets.weeklyLeadsPerAssociate} qualified leads this week.` : `Weekly sales schedule — ${day.title.toLowerCase()}.`,
      priority: day.priority,
      dueAt: zonedTime(dateKey, settings.timezone, 18, 0),
      checklist: day.checklist.map(item => item.replace('{target}', String(targets.weeklyLeadsPerAssociate))),
    };
  });
}

/* ─── Reminders ─── */

/** In-app reminders derived from live data for one user. */
export function deriveReminders({ leads = [], tasks = [], deals = [], email, now = Date.now(), settings = DEFAULT_SALES_SETTINGS, reportSubmitted = false, isAssociate = true }) {
  const reminders = [];
  const day = 86400000;
  for (const lead of leads) {
    if (lead.ownerEmail !== email || !OPEN_STAGES.includes(lead.stage)) continue;
    const due = ms(lead.nextFollowUpAt);
    if (due != null && due <= now + day) reminders.push({ id: `fu-${lead.id}`, tone: due < now ? 'overdue' : 'today', kind: 'follow_up', leadId: lead.id, title: `${due < now ? 'Overdue follow-up' : 'Follow-up due'}: ${lead.businessName}`, at: due });
    const changed = ms(lead.stageChangedAt);
    if (lead.stage === 'quotation' && changed != null && changed + (settings.quotationFollowUpDays || 3) * day <= now) {
      reminders.push({ id: `q-${lead.id}`, tone: 'today', kind: 'quotation', leadId: lead.id, title: `Quotation needs follow-up: ${lead.businessName}`, at: changed });
    }
  }
  for (const task of tasks) {
    if (task.category !== 'sales' || task.status === 'done' || !(task.assigneeEmails || []).includes(email)) continue;
    const due = ms(task.dueAt);
    if (due != null && due < now) reminders.push({ id: `t-${task.id}`, tone: 'overdue', kind: 'task', taskId: task.id, title: `Overdue task: ${task.title}`, at: due });
  }
  for (const deal of deals) {
    if (deal.submittedByEmail === email && deal.status === 'rejected') reminders.push({ id: `d-${deal.leadId}`, tone: 'overdue', kind: 'deal', leadId: deal.leadId, title: `Conversion returned: ${deal.businessName}`, at: ms(deal.reviewedAt) });
  }
  if (isAssociate && weekdayOf(localDateKey(now, settings.timezone)) === 6 && !reportSubmitted) {
    reminders.push({ id: 'weekly-report', tone: 'today', kind: 'report', title: 'Weekly sales report is due today', at: now });
  }
  return reminders.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}
