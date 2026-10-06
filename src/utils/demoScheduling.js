export const DEMO_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DEMO_PERMISSION_LABELS = { 'demos:book': 'Book demonstrations', 'demos:present': 'Present and manage own availability', 'demos:view_all': 'View all team demonstrations', 'demos:manage': 'Manage settings, access and all bookings' };
export function demoToday() { return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10); }
export function shiftDemoDate(date, days) { return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10); }
export function demoWeekStart(date) { return shiftDemoDate(date, -(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7); }
export function formatDemoDate(date, options = {}) { return new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', ...options }); }
export function formatDemoTime(value) { return new Date(value).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }); }
export function defaultDemoWeekly() { return Object.fromEntries(DEMO_DAYS.map((_, day) => [day, day > 0 && day < 6 ? [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '17:00' }] : []])); }
