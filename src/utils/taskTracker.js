export const TASK_STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Done' },
];

export const TASK_PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

export const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
export const TASK_LIMITS = { title: 160, description: 5000, assignees: 30, checklist: 50, checklistText: 200, activity: 60, note: 1000 };

export const statusLabel = id => TASK_STATUSES.find(s => s.id === id)?.label || id;
export const priorityLabel = id => TASK_PRIORITIES.find(p => p.id === id)?.label || id;

export const toDate = value => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pad = n => String(n).padStart(2, '0');
export const dateInputValue = date => date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : '';
export const timeInputValue = date => date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '';

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** overdue | today | soon (within 2 days) | later | done */
export function dueState(task, now) {
  if (task.status === 'done') return 'done';
  const due = toDate(task.dueAt);
  if (!due) return 'later';
  if (due.getTime() < now) return 'overdue';
  const dayDiff = Math.round((startOfDay(due) - startOfDay(new Date(now))) / 86400000);
  if (dayDiff === 0) return 'today';
  if (dayDiff <= 2) return 'soon';
  return 'later';
}

export function formatDue(value, now) {
  const due = toDate(value);
  if (!due) return 'No deadline';
  const time = due.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const dayDiff = Math.round((startOfDay(due) - startOfDay(new Date(now))) / 86400000);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  const sameYear = due.getFullYear() === new Date(now).getFullYear();
  return `${due.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })}, ${time}`;
}

export function formatStamp(value) {
  const date = toDate(value);
  return date ? date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}

export const initials = name => String(name || '?').split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?';

export const byDeadline = (a, b) => (toDate(a.dueAt)?.getTime() ?? Infinity) - (toDate(b.dueAt)?.getTime() ?? Infinity) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
