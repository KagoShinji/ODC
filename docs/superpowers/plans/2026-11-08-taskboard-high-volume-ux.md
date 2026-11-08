# Taskboard High-Volume UX & Dual-View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the taskboard in `AdminTasks.jsx` to effortlessly manage 50–500+ tasks by introducing a dual-view system (Sticky Kanban + High-Density Paginated Table/List View), collapsible columns, inline status mutation, and quick filters ("Hide Done" and triage chips).

**Architecture:** Pure utility functions for pagination, filtering, and grouping in `src/utils/taskTracker.js`; modular UI subcomponents in `src/components/tasks/` (`TaskBoardView.jsx`, `TaskListView.jsx`, `TaskListRow.jsx`); and controller integration in `AdminTasks.jsx` with persistent user preferences in `localStorage` and independent column scrolling in `AdminTasks.css`.

**Tech Stack:** React 19, Lucide React icons, Node 22 native test runner (`node:test`, `node:assert/strict`), Vite, Tailwind/CSS.

**Spec:** [docs/superpowers/specs/2026-11-08-taskboard-high-volume-ux-design.md](file:///Users/jetchmerald/Documents/jetch/ODC/docs/superpowers/specs/2026-11-08-taskboard-high-volume-ux-design.md)

## Global Constraints

- Preserve all existing task capabilities: public share link, checklist management, activity tracking, notes, and permission gates (`isManager`, `canEditTask`, `canUpdateTask`).
- Backward compatibility: Existing `subscribeTasks` query contract remains untouched (fetching up to 500 active tasks).
- No new external runtime npm dependencies: use existing React, Lucide-react, and CSS variables.
- Design theme consistency: Maintain dark mode palette (`--task-accent: #5eead4`, `--task-muted: #a3abb9`, `--task-line: #ffffff18`, Outfit font, tabular numbers).
- Zero regression on existing tests and production build (`npm run build`).

## Review Focus

1. **Empty / Filtered-out State in List View**: When search or filters yield 0 tasks across all groups, display a helpful empty state with a "Clear filters" action rather than blank tables.
2. **Page Bounds during Filter Changes**: When currently on page 4 and filters change so total pages becomes 2, automatically clamp current page back to valid range (page 1 or max page).
3. **Optimistic Inline Status Mutation Error Handling**: If an inline status update fails (e.g. offline, permission denied), revert UI smoothly and display the standard error alert without corrupting state.
4. **Independent Column Scroll Isolation**: Column scrolling in Kanban must have its own scroll container so wheel scrolling inside one column does not jitter the entire page or jump other columns.
5. **Local Storage Preference Fault Tolerance**: Handle environments where `localStorage` is disabled or throws `SecurityError` (e.g. incognito iframe) gracefully with fallback defaults.

---

### Task 1: Task Filter & Pagination Utilities

**Files:**
- Modify: `src/utils/taskTracker.js`
- Test: `tests/taskTracker.test.js`

**Interfaces:**
- Produces:
  - `paginateTasks(tasks: Array, page: number, pageSize: number) -> { items: Array, totalPages: number, currentPage: number, totalCount: number, startIndex: number, endIndex: number }`
  - `filterTasks(tasks: Array, options: { search?: string, category?: string, priority?: string, assignee?: string, hideDone?: boolean, quickFilter?: string, myEmail?: string, now?: number }) -> Array`
  - `groupTasksBy(tasks: Array, groupBy: 'status' | 'deadline', now: number) -> Object`

- [ ] **Step 1: Write the failing tests in `tests/taskTracker.test.js`**

```javascript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/taskTracker.test.js`  
Expected: FAIL with "paginateTasks is not a function"

- [ ] **Step 3: Implement `paginateTasks`, `filterTasks`, and `groupTasksBy` in `src/utils/taskTracker.js`**

Implement pure functions supporting safe pagination, multi-attribute filtering with `hideDone`, search, and status/deadline grouping.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/taskTracker.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/taskTracker.js tests/taskTracker.test.js
git commit -m "feat(tasks): add pagination, filtering, and grouping utilities"
```

---

### Task 2: High-Density Task List Row & Table Subcomponents

**Files:**
- Create: `src/components/tasks/TaskListRow.jsx`
- Create: `src/components/tasks/TaskListView.jsx`
- Test: `tests/taskComponents.test.js`

**Interfaces:**
- Consumes: `paginateTasks`, `statusLabel`, `priorityLabel`, `dueState`, `formatDue`, `initials` from `src/utils/taskTracker.js`.
- Produces:
  - `<TaskListRow task, now, canUpdate, canEdit, onStatusChange, onOpenTask />`
  - `<TaskListView tasks, now, groupBy, page, pageSize, onPageChange, onPageSizeChange, onStatusChange, onOpenTask, canUpdateTask, canEditTask />`

- [ ] **Step 1: Write the failing tests in `tests/taskComponents.test.js`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTasksBy, paginateTasks } from '../src/utils/taskTracker.js';

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
```

- [ ] **Step 2: Run test to verify it passes / establishes component contract**

Run: `node --test tests/taskComponents.test.js`  
Expected: PASS

- [ ] **Step 3: Implement `src/components/tasks/TaskListRow.jsx`**

Render a compact single-line table row containing:
- Clickable inline status dropdown (`TASK_STATUSES`) with immediate change callback.
- Priority badge (`PriorityPill`).
- Title, category pill (e.g. Sales), and optional description preview.
- Urgency-colored due date badge (`DueLabel`).
- Checklist fraction (e.g. `ListChecks` + `2/4`).
- Overlapping assignee avatars.
- Quick share link button (`Share2`) with copy toast feedback and edit button (`Pencil`).

- [ ] **Step 4: Implement `src/components/tasks/TaskListView.jsx`**

Render the high-density table:
- Table header row with column labels: Status, Title & Details, Priority, Due Date, Checklist, Assignees, Actions.
- Collapsible section headers for each group (by Status on Team Board, by Deadline on My Tasks) with expand/collapse chevron and count pill.
- Pagination bar footer: Showing count range, page size switcher (`25 / 50 / 100`), and Previous / Next page controls.
- Clean empty state with search reset when no tasks match current filters.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskListRow.jsx src/components/tasks/TaskListView.jsx tests/taskComponents.test.js
git commit -m "feat(tasks): create high-density TaskListRow and TaskListView components"
```

---

### Task 3: Enhanced Kanban Board with Sticky Headers & Collapsible Columns

**Files:**
- Create: `src/components/tasks/TaskBoardView.jsx`
- Modify: `src/pages/AdminTasks.css`

**Interfaces:**
- Consumes: `TASK_STATUSES`, `TaskCard`, `byDeadline`, `toDate`
- Produces:
  - `<TaskBoardView tasks, now, onOpenTask />`

- [ ] **Step 1: Implement `src/components/tasks/TaskBoardView.jsx`**

Build the enhanced Kanban board:
- Tracks `collapsedColumns` set in local state (e.g., allow collapsing "Done" or "Blocked" into a slim 44px vertical strip).
- Each column header renders:
  - Status name & count badge.
  - Collapse / Expand icon button (`ChevronsLeft` / `ChevronsRight`).
- When collapsed: Renders vertical status text, count badge, and click-to-expand behavior.
- When expanded: Renders scrollable card list container (`task-column-cards`) with independent vertical scroll.

- [ ] **Step 2: Add CSS rules in `src/pages/AdminTasks.css`**

Add styles for:
- Sticky column header: `position: sticky; top: 0; z-index: 5; background: #171e2b; backdrop-filter: blur(8px);`
- Scrollable cards container: `max-height: calc(100dvh - 290px); min-height: 480px; overflow-y: auto; scrollbar-width: thin;`
- Collapsed column styling: `.task-column-collapsed { width: 44px; min-width: 44px; padding: 12px 6px; }`

- [ ] **Step 3: Verify build passes without syntax errors**

Run: `npm run build`  
Expected: PASS with 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/TaskBoardView.jsx src/pages/AdminTasks.css
git commit -m "feat(tasks): create TaskBoardView with sticky headers and collapsible columns"
```

---

### Task 4: AdminTasks Controller Integration & Toolbar Controls

**Files:**
- Modify: `src/pages/AdminTasks.jsx`
- Modify: `src/pages/AdminTasks.css`

**Interfaces:**
- Consumes: `TaskBoardView`, `TaskListView`, `paginateTasks`, `filterTasks`
- Updates: Toolbar controls with View Switcher (`kanban` | `list`), "Hide Done" toggle, and Quick Filter Chips.

- [ ] **Step 1: Integrate View Switcher & "Hide Done" into `AdminTasks.jsx`**

- Add state with `localStorage` persistence:
  ```javascript
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('odc_task_view_mode') || 'kanban');
  const [hideDone, setHideDone] = useState(() => localStorage.getItem('odc_task_hide_done') === 'true');
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'overdue' | 'today' | 'mine'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  ```
- Reset `page` to 1 whenever filters, search, or tabs change.
- In toolbar:
  - Add segmented view toggle buttons with `LayoutGrid` and `List` icons.
  - Add "Hide Done" checkbox/switch with count badge of hidden tasks.
  - Add quick filter chips (*All*, *Overdue*, *Due Today*, *Assigned to Me*).
- Conditionally render `TaskBoardView` or `TaskListView` based on `viewMode`.
- Pass inline status updater to `TaskListView` wiring `changeTaskStatus`.

- [ ] **Step 2: Add List View & Toolbar Styles in `AdminTasks.css`**

Add polished styles:
- Toolbar segmented buttons & quick chips (`.task-chip`, `.task-view-switcher`).
- List table styles: `.task-table`, `.task-table-row`, `.task-inline-select`, `.task-pagination`.
- Responsive behavior: table horizontal scroll wrappers on mobile.

- [ ] **Step 3: Run all tests and production build**

Run: `node --test tests/*.test.js && npm run build`  
Expected: All tests pass, build succeeds cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminTasks.jsx src/pages/AdminTasks.css
git commit -m "feat(tasks): integrate dual-view switcher, quick filters, and list view into AdminTasks"
```
