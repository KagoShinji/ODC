# Taskboard High-Volume UX & Dual-View Design Spec

**Date:** 2026-11-08  
**Status:** In Review  
**Author:** Antigravity & User  
**Scope:** Improve the UX and scalability of the team taskboard (`AdminTasks.jsx`) to handle high task volumes (50–500+ tasks) seamlessly via a dual-view system (Sticky Kanban + High-Density Paginated Table/List View), collapsible columns, inline status editing, and quick filters ("Hide Done").

---

## 1. Problem Statement & Motivation

Currently, the taskboard (`AdminTasks.jsx`) provides two tabs: **My Tasks** and **Team Board**. As task volume scales:
1. **Vertical Runaway in Kanban**:
   - Columns have unconstrained vertical heights (`min-height: 0; align-items: start`). When a column has dozens of tasks, it expands thousands of pixels down the page.
   - Users lose visibility of the board header, filters, and other shorter columns, forcing excessive scrolling up and down.
2. **Lack of Dense Scanning**:
   - The board and My Tasks only display wide, spaced-out card components (`TaskCard`).
   - Scanning 50–200 tasks to find assignments or check deadlines is slow and visually exhausting.
3. **Completed Task Accumulation**:
   - Completed tasks remain in the active view, cluttering columns (especially the "Done" column) unless manually filtered out.
4. **Heavy DOM Footprint**:
   - Rendering hundreds of card components, icons, and listeners in a flat grid degrades browser rendering performance.

---

## 2. High-Level Architecture

To maintain code clarity and separation of concerns, the taskboard presentation will be organized into focused components:

```
src/
├── pages/
│   ├── AdminTasks.jsx              # Main controller: state, Firestore subscription, search/filters, modal dialogs
│   ├── AdminTasks.css              # Main theme, toolbar styles, sticky layout, and responsive rules
│   └── components/tasks/           # Extracted taskboard subcomponents
│       ├── TaskBoardView.jsx       # Kanban view with sticky headers, capped scroll, and collapsible columns
│       ├── TaskListView.jsx        # High-density table/list view with pagination and collapsible groups
│       └── TaskListRow.jsx         # Single interactive row with inline status selector & quick actions
```

---

## 3. Detailed Specifications

### 3.1 Toolbar & View Switcher
- **Segmented View Switcher**:
  - Positioned beside the search bar.
  - Buttons: **Kanban** (`LayoutGrid` icon) and **List** (`List` icon).
  - Persisted in browser `localStorage` (`odc_task_view_mode: 'kanban' | 'list'`) so the user's preferred view persists across reloads and tab navigations.
  - Applies universally to both the **Team board** and **My tasks** tabs.
- **"Hide Done" Quick Toggle**:
  - Switch/checkbox in the toolbar: `"Hide Done"` (defaults to `false` or previous preference).
  - When checked, excludes tasks with `status === 'done'` from active Kanban columns and List view groups, instantly decluttering the interface.
- **Quick Filter Pills**:
  - One-click toggle pills: `All`, `Overdue`, `Due Today`, and `Assigned to Me`.
  - Enables instant triage without opening dropdown menus.

---

### 3.2 High-Density List / Table View (`TaskListView`)
- **Row Columns & Layout**:
  - **Status**: Interactive dropdown/pill to cycle or select status (`To Do`, `In Progress`, `Blocked`, `Done`) with instant mutation.
  - **Title & Details**: Bold title with description preview snippet and category badge (e.g. Sales). Clicking title opens the full detail dialog.
  - **Priority**: Standardized priority badge (`Urgent`, `High`, `Medium`, `Low`).
  - **Deadline**: Relative formatted due date with urgency color coding (`Overdue`, `Due today`, `Upcoming`).
  - **Checklist**: Compact progress indicator (e.g. `ListChecks` icon + `3/5`).
  - **Assignees**: Overlapping avatar circles with tooltip showing full names.
  - **Actions**: One-click public share link button and edit button.
- **Collapsible Section Grouping**:
  - In **Team Board**: Grouped by status (*To Do*, *In Progress*, *Blocked*, *Done*).
  - In **My Tasks**: Grouped by deadline (*Overdue*, *Due Today*, *Upcoming*, *Completed*).
  - Each group header includes an accordion expand/collapse caret (`ChevronDown` / `ChevronRight`) and a pill showing the count of tasks in that group.
- **Pagination Controls**:
  - Bottom pagination bar:
    - `"Showing X–Y of Z tasks"`.
    - Page size selector: `25`, `50`, or `100` items per page.
    - Page navigation buttons: Previous / Next, and direct page indicator.
    - Slices the filtered task array in memory to keep the rendered DOM small and fast.

---

### 3.3 Enhanced Kanban Board (`TaskBoardView`)
- **Sticky Column Headers**:
  - Headers (`h3` title, count badge, accent indicator) use `position: sticky; top: 0; z-index: 5;` with an opaque background (`background: #171e2b; backdrop-filter: blur(8px)`).
  - Column headers stay in view while scrolling down through cards.
- **Independent Column Scrolling**:
  - Each column container is given a maximum height constraint:
    ```css
    .task-column-cards {
      max-height: calc(100dvh - 290px);
      min-height: 480px;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    ```
  - Columns scroll independently. A column with 60 tasks will not stretch the screen or move other columns out of sight.
- **Collapsible Columns**:
  - Minimize button (`ChevronsLeft` / `ChevronsRight`) on each column header.
  - Collapsing a column (such as "Done" or "Blocked") contracts it into a slim vertical strip (~44px wide) showing the vertical title and badge count.
  - Frees up horizontal screen real estate for active workflow columns.

---

### 3.4 Data Flow, Mutation & Error Handling
1. **Subscription**:
   - Preserves existing `subscribeTasks` from `src/services/taskService.js` (syncs up to 500 active tasks).
2. **Filtering Pipeline (`useMemo`)**:
   - `tasks` ➔ `Hide Done` filter ➔ Category / Priority / Assignee dropdowns ➔ Quick chips ➔ Search query match.
3. **Inline Mutation**:
   - Changing status via the list row calls `changeTaskStatus(firebaseUser, taskId, newStatus)`.
   - Displays a mini-spinner in the row during the update.
   - If an error occurs, the standard error alert banner displays the error and the UI state rolls back to the current server snapshot.

---

## 4. Accessibility & Responsiveness
- **Keyboard Navigation**:
  - View switcher, collapsible column buttons, and inline status dropdowns are fully keyboard accessible with visible `:focus-visible` styling.
- **Mobile & Tablet Adaptations**:
  - On screens `< 768px`, the Kanban columns horizontal scroll is maintained, while the List View stacks columns cleanly with horizontal overflow protection.

---

## 5. Verification Plan

1. **Unit & Component Testing**:
   - Verify view switcher toggles between Kanban and List views and saves selection to `localStorage`.
   - Verify pagination correctly calculates page count and slices rows.
   - Verify "Hide Done" toggle correctly filters out completed tasks.
2. **Manual & Visual Inspection**:
   - Test with 50+ mock or live tasks in both views.
   - Verify independent column scrolling in Kanban mode without full-page stretch.
   - Verify collapsing and expanding columns (e.g. Done column).
   - Verify inline status change updates Firestore and reflects immediately.
