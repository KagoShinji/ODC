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

/** Slices a task array into a paginated window, safely clamping pages within bounds. */
export function paginateTasks(tasks = [], page = 1, pageSize = 25) {
  const totalCount = tasks.length;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  if (totalCount === 0) {
    return { items: [], totalPages: 1, currentPage: 1, totalCount: 0, startIndex: 0, endIndex: 0 };
  }

  const startIdx = (currentPage - 1) * safePageSize;
  const items = tasks.slice(startIdx, startIdx + safePageSize);
  return {
    items,
    totalPages,
    currentPage,
    totalCount,
    startIndex: startIdx + 1,
    endIndex: Math.min(startIdx + safePageSize, totalCount),
  };
}

/** Unified filter pipeline supporting search, category, priority, assignee, hideDone, and quick chips. */
export function filterTasks(tasks = [], {
  search = '',
  category = 'all',
  priority = 'all',
  assignee = 'all',
  hideDone = false,
  quickFilter = 'all',
  myEmail = '',
  now = Date.now(),
} = {}) {
  const cleanSearch = (search || '').trim().toLowerCase();
  const lowerMyEmail = (myEmail || '').toLowerCase();

  return tasks.filter(task => {
    if (hideDone && task.status === 'done') return false;

    if (category && category !== 'all' && (task.category || 'general') !== category) return false;
    if (priority && priority !== 'all' && task.priority !== priority) return false;

    if (assignee && assignee !== 'all') {
      const emails = task.assigneeEmails || [];
      if (assignee === 'none') {
        if (emails.length > 0) return false;
      } else if (!emails.includes(assignee.toLowerCase())) {
        return false;
      }
    }

    if (quickFilter === 'overdue') {
      if (task.status === 'done' || dueState(task, now) !== 'overdue') return false;
    } else if (quickFilter === 'today') {
      if (task.status === 'done' || dueState(task, now) !== 'today') return false;
    } else if (quickFilter === 'mine') {
      if (!lowerMyEmail || !(task.assigneeEmails || []).includes(lowerMyEmail)) return false;
    }

    if (cleanSearch) {
      const matchTitle = (task.title || '').toLowerCase().includes(cleanSearch);
      const matchDesc = (task.description || '').toLowerCase().includes(cleanSearch);
      const matchAssignees = (task.assignees || []).some(a => (a.name || '').toLowerCase().includes(cleanSearch) || (a.email || '').toLowerCase().includes(cleanSearch));
      if (!matchTitle && !matchDesc && !matchAssignees) return false;
    }

    return true;
  });
}

/** Organizes tasks into structured groups by status or deadline, preserving standard sorting. */
export function groupTasksBy(tasks = [], groupBy = 'status', now = Date.now()) {
  if (groupBy === 'status') {
    const groups = { todo: [], in_progress: [], blocked: [], done: [] };
    for (const task of tasks) {
      const st = groups[task.status] ? task.status : 'todo';
      groups[st].push(task);
    }
    groups.todo.sort(byDeadline);
    groups.in_progress.sort(byDeadline);
    groups.blocked.sort(byDeadline);
    groups.done.sort((a, b) => (toDate(b.completedAt)?.getTime() || 0) - (toDate(a.completedAt)?.getTime() || 0));
    return groups;
  }

  // groupBy === 'deadline'
  const groups = { overdue: [], today: [], upcoming: [], done: [] };
  for (const task of tasks) {
    const state = dueState(task, now);
    const target = state === 'done' || state === 'overdue' || state === 'today' ? state : 'upcoming';
    groups[target].push(task);
  }
  groups.overdue.sort(byDeadline);
  groups.today.sort(byDeadline);
  groups.upcoming.sort(byDeadline);
  groups.done.sort((a, b) => (toDate(b.completedAt)?.getTime() || 0) - (toDate(a.completedAt)?.getTime() || 0));
  return groups;
}

