import test from 'node:test';
import assert from 'node:assert/strict';
import {
  paginateTasks,
  filterTasks,
  groupTasksBy,
  TASK_STATUSES,
} from '../src/utils/taskTracker.js';

test('paginateTasks calculates correct bounds and slices items', () => {
  const items = Array.from({ length: 55 }, (_, i) => ({ id: `task-${i + 1}`, title: `Task ${i + 1}` }));
  const page1 = paginateTasks(items, 1, 25);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.currentPage, 1);
  assert.equal(page1.totalCount, 55);
  assert.equal(page1.startIndex, 1);
  assert.equal(page1.endIndex, 25);
  assert.equal(page1.items.length, 25);
  assert.equal(page1.items[0].id, 'task-1');

  const page3 = paginateTasks(items, 3, 25);
  assert.equal(page3.currentPage, 3);
  assert.equal(page3.startIndex, 51);
  assert.equal(page3.endIndex, 55);
  assert.equal(page3.items.length, 5);

  // Clamping when page exceeds bounds
  const clamped = paginateTasks(items, 99, 25);
  assert.equal(clamped.currentPage, 3);

  // Empty list
  const empty = paginateTasks([], 1, 25);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.currentPage, 1);
  assert.equal(empty.totalCount, 0);
  assert.equal(empty.items.length, 0);
  assert.equal(empty.startIndex, 0);
  assert.equal(empty.endIndex, 0);
});

test('filterTasks correctly filters by hideDone, quickFilter, and search', () => {
  const now = Date.now();
  const tasks = [
    { id: '1', title: 'Fix bug', status: 'done', priority: 'high', assigneeEmails: ['alex@odc.ph'], dueAt: new Date(now + 86400000) },
    { id: '2', title: 'Write specs', status: 'in_progress', priority: 'urgent', assigneeEmails: ['alex@odc.ph'], dueAt: new Date(now - 3600000) }, // overdue
    { id: '3', title: 'Deploy site', status: 'todo', priority: 'low', assigneeEmails: ['sam@odc.ph'], dueAt: new Date(now + 10000) }, // today
  ];

  // hideDone
  const activeOnly = filterTasks(tasks, { hideDone: true, now });
  assert.equal(activeOnly.length, 2);
  assert.ok(!activeOnly.some(t => t.status === 'done'));

  // quickFilter: overdue
  const overdueOnly = filterTasks(tasks, { quickFilter: 'overdue', now });
  assert.equal(overdueOnly.length, 1);
  assert.equal(overdueOnly[0].id, '2');

  // quickFilter: mine
  const mineOnly = filterTasks(tasks, { quickFilter: 'mine', myEmail: 'sam@odc.ph', now });
  assert.equal(mineOnly.length, 1);
  assert.equal(mineOnly[0].id, '3');

  // search filter
  const searched = filterTasks(tasks, { search: 'specs', now });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, '2');
});

test('groupTasksBy groups tasks by status or deadline', () => {
  const now = Date.now();
  const tasks = [
    { id: '1', title: 'A', status: 'todo', dueAt: new Date(now + 86400000 * 5) },
    { id: '2', title: 'B', status: 'todo', dueAt: new Date(now - 3600000) },
    { id: '3', title: 'C', status: 'in_progress', dueAt: new Date(now + 10000) },
    { id: '4', title: 'D', status: 'done', dueAt: new Date(now) },
  ];

  const statusGroups = groupTasksBy(tasks, 'status', now);
  assert.equal(statusGroups.todo.length, 2);
  assert.equal(statusGroups.in_progress.length, 1);
  assert.equal(statusGroups.done.length, 1);
  assert.equal(statusGroups.blocked.length, 0);

  const deadlineGroups = groupTasksBy(tasks, 'deadline', now);
  assert.equal(deadlineGroups.overdue.length, 1);
  assert.equal(deadlineGroups.today.length, 1);
  assert.equal(deadlineGroups.upcoming.length, 1);
  assert.equal(deadlineGroups.done.length, 1);
});

