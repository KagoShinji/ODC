export const DEMO_ACTIONS = ['demos:book', 'demos:present', 'demos:view_all', 'demos:manage'];
export const DEFAULT_DEMO_POLICY = { durations: [30, 45, 60, 90, 120], bufferMinutes: 15, minimumNoticeMinutes: 120, bookingWindowDays: 30 };
export class DemoError extends Error {
  constructor(message, code = 'failed-precondition') { super(message); this.code = code; }
}
export function requireDemo(condition, message, code) { if (!condition) throw new DemoError(message, code); }
export function demoId(value) {
  requireDemo(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,512}$/.test(value), 'Invalid record identifier.', 'invalid-argument');
  return value;
}
export function demoText(value, label, maximum = 200, required = true) {
  requireDemo(typeof value === 'string', `${label} must be text.`, 'invalid-argument');
  const text = value.trim();
  requireDemo((!required || text.length > 0) && text.length <= maximum, `${label} is required and must be at most ${maximum} characters.`, 'invalid-argument');
  return text;
}
export function demoDate(value) {
  requireDemo(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Choose a valid date.', 'invalid-argument');
  const date = new Date(`${value}T00:00:00+08:00`);
  requireDemo(Number.isFinite(date.getTime()) && manilaDate(date) === value, 'Choose a valid date.', 'invalid-argument');
  return value;
}
export function manilaDate(value = new Date()) { return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10); }
export function clockMinutes(value) {
  requireDemo(typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value), 'Use a valid time in HH:MM format.', 'invalid-argument');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function minutesClock(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
export function validateRanges(ranges) {
  requireDemo(Array.isArray(ranges) && ranges.length <= 4, 'Use up to four availability windows per day.', 'invalid-argument');
  const result = ranges.map(range => {
    const start = clockMinutes(range.start); const end = clockMinutes(range.end);
    requireDemo(start < end && start % 15 === 0 && end % 15 === 0, 'Availability must use 15-minute intervals with the end after the start.', 'invalid-argument');
    return { start: range.start, end: range.end };
  }).sort((a, b) => a.start.localeCompare(b.start));
  result.forEach((range, index) => requireDemo(index === 0 || result[index - 1].end <= range.start, 'Availability windows cannot overlap.', 'invalid-argument'));
  return result;
}
export function validateAvailability(value) {
  requireDemo(value && typeof value === 'object', 'Availability is required.', 'invalid-argument');
  const weekly = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index), validateRanges(value.weekly?.[index] || [])]));
  const entries = Object.entries(value.overrides || {});
  requireDemo(entries.length <= 120, 'Keep at most 120 date overrides. Remove old dates before adding more.', 'invalid-argument');
  const overrides = Object.fromEntries(entries.map(([date, ranges]) => [demoDate(date), validateRanges(ranges)]));
  return { weekly, overrides };
}
export function validateDemoPolicy(value) {
  requireDemo(value && typeof value === 'object', 'Booking settings are required.', 'invalid-argument');
  requireDemo(Array.isArray(value.durations) && value.durations.length > 0 && value.durations.length <= 5 && value.durations.every(v => [30, 45, 60, 90, 120].includes(v)), 'Choose supported meeting durations.', 'invalid-argument');
  for (const [key, min, max] of [['bufferMinutes', 0, 60], ['minimumNoticeMinutes', 0, 10080], ['bookingWindowDays', 1, 90]]) {
    requireDemo(Number.isInteger(value[key]) && value[key] >= min && value[key] <= max, `${key} is outside the supported range.`, 'invalid-argument');
  }
  requireDemo(value.bufferMinutes % 15 === 0, 'Buffer must use 15-minute intervals.', 'invalid-argument');
  return { durations: [...new Set(value.durations)].sort((a, b) => a - b), bufferMinutes: value.bufferMinutes, minimumNoticeMinutes: value.minimumNoticeMinutes, bookingWindowDays: value.bookingWindowDays };
}
export function availableRanges(availability, date) {
  demoDate(date);
  if (Object.hasOwn(availability?.overrides || {}, date)) return availability.overrides[date];
  const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  return availability?.weekly?.[weekday] || [];
}
export function withinAvailability(availability, date, startMinute, occupiedEndMinute) {
  return availableRanges(availability, date).some(range => clockMinutes(range.start) <= startMinute && occupiedEndMinute <= clockMinutes(range.end));
}
export function bookingInterval(date, time, duration, buffer) {
  demoDate(date); const startMinute = clockMinutes(time);
  requireDemo(startMinute % 15 === 0, 'Bookings must start on a 15-minute interval.', 'invalid-argument');
  const endMinute = startMinute + duration;
  const occupiedEndMinute = endMinute + buffer;
  requireDemo(occupiedEndMinute < 1440, 'The meeting and buffer must finish on the same day.', 'invalid-argument');
  const startAt = new Date(`${date}T${time}:00+08:00`).toISOString();
  return { startMinute, endMinute, occupiedEndMinute, startAt, endAt: new Date(new Date(startAt).getTime() + duration * 60000).toISOString() };
}
export function validateBookingTime(date, time, duration, policy, now) {
  requireDemo(policy.durations.includes(duration), 'Choose an allowed demonstration duration.', 'invalid-argument');
  const interval = bookingInterval(date, time, duration, policy.bufferMinutes);
  requireDemo(new Date(interval.startAt).getTime() >= new Date(now).getTime() + policy.minimumNoticeMinutes * 60000, 'This slot is too soon. Choose a later time.');
  const lastDate = manilaDate(new Date(new Date(now).getTime() + policy.bookingWindowDays * 86400000));
  requireDemo(date <= lastDate, `Bookings are available through ${lastDate}.`);
  return interval;
}
export function overlapsReservation(reservations, start, end, ignoreId = '') {
  return Object.entries(reservations || {}).some(([id, value]) => id !== ignoreId && start < value.occupiedEndMinute && end > value.startMinute);
}
export function demoSlots(availability, reservations, date, duration, policy, now, ignoreId = '') {
  const result = [];
  for (const range of availableRanges(availability, date)) {
    for (let minute = clockMinutes(range.start); minute + duration + policy.bufferMinutes <= clockMinutes(range.end); minute += 15) {
      const time = minutesClock(minute);
      try {
        const interval = validateBookingTime(date, time, duration, policy, now);
        if (!overlapsReservation(reservations, minute, interval.occupiedEndMinute, ignoreId)) result.push({ time, startAt: interval.startAt, endAt: interval.endAt });
      } catch (error) { if (!(error instanceof DemoError)) throw error; }
    }
  }
  return result;
}
