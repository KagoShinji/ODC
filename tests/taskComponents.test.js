import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupTasksBy,
  paginateTasks,
  TASK_STATUSES,
  TASK_PRIORITIES,
  statusLabel,
  priorityLabel,
} from '../src/utils/taskTracker.js';

test('groupTasksBy organizes into status categories with counts', () => {
  const tasks = [
    { id: '1', title: 'A', status: 'todo' },
    { id: '2', title: 'B', status: 'todo' },
    { id: '3', title: 'C', status: 'in_progress' },
    { id: '4', title: 'D', status: 'done' },
  ];
  const groups = groupTasksBy(tasks, 'status', Date.now());
  assert.equal(groups.todo.length, 2);
  assert.equal(groups.in_progress.length, 1);
  assert.equal(groups.done.length, 1);
  assert.equal(groups.blocked.length, 0);
});

test('paginateTasks correctly slices tasks for list view pages', () => {
  const tasks = Array.from({ length: 42 }, (_, i) => ({ id: `${i + 1}`, title: `Task ${i + 1}` }));
  const page1 = paginateTasks(tasks, 1, 20);
  assert.equal(page1.items.length, 20);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.startIndex, 1);
  assert.equal(page1.endIndex, 20);

  const page2 = paginateTasks(tasks, 2, 20);
  assert.equal(page2.items.length, 20);
  assert.equal(page2.startIndex, 21);
  assert.equal(page2.endIndex, 40);

  const page3 = paginateTasks(tasks, 3, 20);
  assert.equal(page3.items.length, 2);
  assert.equal(page3.startIndex, 41);
  assert.equal(page3.endIndex, 42);
});

test('statusLabel and priorityLabel resolve correctly for table columns', () => {
  assert.equal(statusLabel('todo'), 'To do');
  assert.equal(statusLabel('in_progress'), 'In progress');
  assert.equal(statusLabel('blocked'), 'Blocked');
  assert.equal(statusLabel('done'), 'Done');

  assert.equal(priorityLabel('urgent'), 'Urgent');
  assert.equal(priorityLabel('high'), 'High');
  assert.equal(priorityLabel('medium'), 'Medium');
  assert.equal(priorityLabel('low'), 'Low');
});
