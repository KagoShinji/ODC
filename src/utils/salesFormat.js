// Formatting and small browser helpers for the Sales Management module.
import { periodRange, customRange, localDateKey, addDays } from '../../functions/src/salesDomain.js';

export const pct = value => value == null ? '—' : `${value}%`;

export function errorText(err) {
  if (err?.code === 'permission-denied') return 'You do not have permission to make this change, or the record changed. Refresh and try again.';
  if (err?.code === 'failed-precondition' && /index/i.test(err?.message || '')) {
    // Firestore's message names the missing index and links to create it; keep it visible for admins.
    console.error('Sales query needs a Firestore index:', err.message);
    const link = (err.message.match(/https:\/\/\S+/) || [])[0];
    return `This report needs a database index that is not ready yet. If this persists after the indexes finish building, an index is missing.${link ? ` Create it here: ${link}` : ''}`;
  }
  return err?.message || 'Something went wrong. Please try again.';
}

export const toMillis = value => !value ? null : typeof value.toMillis === 'function' ? value.toMillis() : new Date(value).getTime();
export function formatWhen(value, timeZone = 'Asia/Manila') {
  const t = toMillis(value);
  return t == null ? '—' : new Date(t).toLocaleString('en-PH', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function formatDay(value, timeZone = 'Asia/Manila') {
  const t = toMillis(value);
  return t == null ? '—' : new Date(t).toLocaleDateString('en-PH', { timeZone, month: 'short', day: 'numeric', year: 'numeric' });
}

export function downloadCsv(filename, headers, lines) {
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const blob = new Blob([[headers.map(cell).join(','), ...lines.map(line => line.map(cell).join(','))].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Date-added filter presets used by the leads list and reports. */
export function rangeFor(period, settings, from, to) {
  if (period === 'week' || period === 'month') return periodRange(period, new Date(), settings);
  if (period === '90') { const today = localDateKey(new Date(), settings.timezone); return customRange(addDays(today, -89), today, settings); }
  if (period === 'custom' && from && to && from <= to) return customRange(from, to, settings);
  return null;
}
