export const ACTIONS = ['manage', 'meeting', 'liquidate', 'review', 'request', 'approve', 'release', 'reports', 'reverse'].map(x => `allowances:${x}`);
export const DEFAULT_POLICY = Object.freeze({ targetCentavos: 200000, meetingCapCentavos: 100000, singleFuelCentavos: 20000, dailyFuelCentavos: 40000, thresholdPercent: 70, impendingDays: 7, maxFileBytes: 10485760, maxAttachments: 20, fuelIncluded: true, timezone: 'Asia/Manila' });
export const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export class DomainError extends Error {
  constructor(message, code = 'failed-precondition') { super(message); this.code = code; }
}
export function check(condition, message, code) { if (!condition) throw new DomainError(message, code); }
export function textValue(value, name, max = 1000) {
  check(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is required (maximum ${max} characters).`, 'invalid-argument');
  return value.trim();
}
export function idValue(value) { const id = textValue(value, 'Record ID', 128); check(/^[a-zA-Z0-9_-]+$/.test(id), 'Invalid record identifier.', 'invalid-argument'); return id; }
export function centavos(value, name = 'Amount', allowZero = false) {
  check(Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= 100000000, `${name} must be a valid amount in centavos.`, 'invalid-argument');
  return value;
}
export function toCentavos(value) {
  const s = String(value).trim();
  check(/^\d+(\.\d{1,2})?$/.test(s), 'Enter an amount with at most two decimal places.', 'invalid-argument');
  const [whole, fraction = ''] = s.split('.');
  return centavos(Number(whole) * 100 + Number(fraction.padEnd(2, '0')), 'Amount', true);
}
export function dateValue(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value, 'Enter a valid date.', 'invalid-argument');
  return value;
}
export function manilaDate(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function withinWindow(date, today, days) { const diff = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000; return diff >= 0 && diff <= days; }
export function estimatedCash(account) { return account.reviewedBalanceCentavos - account.unreviewedCentavos; }
export function topUp(account) { return Math.max(0, account.policy.targetCentavos - account.reviewedBalanceCentavos); }
export function eligible(account, type, meeting, today) {
  if (account.status !== 'active') return 'This allowance is not active.';
  if (account.reconciliationHold) return 'Resolve the cash discrepancy first.';
  if (type === 'scheduled') return account.nextScheduledDate && today >= account.nextScheduledDate ? '' : 'Wait for the scheduled replenishment date.';
  if (type !== 'early') return 'Select early or scheduled replenishment.';
  if ((account.policy.targetCentavos - account.reviewedBalanceCentavos) * 100 < account.policy.targetCentavos * account.policy.thresholdPercent) return `Wait until ${account.policy.thresholdPercent}% of the allowance is depleted.`;
  if (!meeting || meeting.accountId !== account.id || meeting.status !== 'planned' || !withinWindow(meeting.date, today, account.policy.impendingDays)) return `Link an upcoming meeting within ${account.policy.impendingDays} days.`;
  return '';
}
export function normalizedPolicy(input) {
  const p = { ...DEFAULT_POLICY };
  for (const key of ['targetCentavos', 'meetingCapCentavos', 'singleFuelCentavos', 'dailyFuelCentavos', 'maxFileBytes']) if (input[key] !== undefined) p[key] = centavos(input[key], key);
  for (const [key, min, max] of [['thresholdPercent', 1, 100], ['impendingDays', 0, 90], ['maxAttachments', 1, 50]]) {
    if (input[key] !== undefined) { check(Number.isInteger(input[key]) && input[key] >= min && input[key] <= max, `Invalid ${key}.`, 'invalid-argument'); p[key] = input[key]; }
  }
  check(p.meetingCapCentavos <= p.targetCentavos && p.singleFuelCentavos <= p.dailyFuelCentavos && p.dailyFuelCentavos <= p.targetCentavos && p.maxFileBytes <= 10485760, 'Policy caps must fit the allowance and file limit.');
  check(input.fuelIncluded !== false, 'The current policy includes fuel in the meeting cap.');
  return p;
}
export function normalizeLines(lines, date, policy, attachments) {
  check(Array.isArray(lines) && lines.length <= 30, 'Use at most 30 expense lines.', 'invalid-argument');
  const used = new Set();
  const result = lines.map((line, index) => {
    const amountCentavos = centavos(line.amountCentavos);
    const attachmentIds = Array.isArray(line.attachmentIds) ? [...new Set(line.attachmentIds)] : [];
    check(attachmentIds.length > 0 && attachmentIds.every(id => attachments.has(id)), `Expense ${index + 1} needs finalized evidence.`);
    attachmentIds.forEach(id => used.add(id));
    const category = ['Fuel', 'Meals', 'Transport', 'Other'].includes(line.category) ? line.category : 'Other';
    for (const fileId of attachmentIds) check(attachments.get(fileId).liquidationId === line.slipId || category === 'Fuel' && attachments.get(fileId).date === date && attachments.get(fileId).purchaseCentavos > 0, 'Only fuel purchases can share evidence across meetings on the same day.');
    const fuelPurchaseId = category === 'Fuel' ? idValue(line.fuelPurchaseId) : '';
    if (category === 'Fuel') check(attachmentIds.includes(fuelPurchaseId) && attachments.get(fuelPurchaseId)?.purchaseCentavos > 0, 'Select the fuel receipt and its full purchase amount.');
    return { description: textValue(line.description, 'Expense description', 200), category, amountCentavos, date, attachmentIds, fuelPurchaseId };
  });
  const totalCentavos = result.reduce((sum, line) => sum + line.amountCentavos, 0);
  check(totalCentavos <= policy.meetingCapCentavos, 'Combined spending exceeds the per-meeting cap.');
  return { lines: result, totalCentavos, fuelCentavos: result.filter(x => x.category === 'Fuel').reduce((s, x) => s + x.amountCentavos, 0), attachmentIds: [...used] };
}
