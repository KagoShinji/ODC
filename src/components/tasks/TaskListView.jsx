import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, ListChecks } from 'lucide-react';
import { paginateTasks, groupTasksBy, statusLabel } from '../../utils/taskTracker';
import TaskListRow from './TaskListRow';

const STATUS_GROUP_CONFIG = [
  { key: 'todo', label: 'To do', tone: 'todo' },
  { key: 'in_progress', label: 'In progress', tone: 'in_progress' },
  { key: 'blocked', label: 'Blocked', tone: 'blocked' },
  { key: 'done', label: 'Done', tone: 'done' },
];

const DEADLINE_GROUP_CONFIG = [
  { key: 'overdue', label: 'Overdue', tone: 'overdue' },
  { key: 'today', label: 'Due today', tone: 'today' },
  { key: 'upcoming', label: 'Upcoming', tone: 'upcoming' },
  { key: 'done', label: 'Completed', tone: 'done' },
];

export default function TaskListView({
  tasks = [],
  now = Date.now(),
  groupBy = 'status',
  page = 1,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  onStatusChange,
  onOpenTask,
  onEditTask,
  canUpdateTask,
  canEditTask,
  onClearFilters,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());

  // Safe pagination
  const pagination = useMemo(
    () => paginateTasks(tasks, page, pageSize),
    [tasks, page, pageSize],
  );

  // Group paginated items
  const groupedItems = useMemo(
    () => groupTasksBy(pagination.items, groupBy, now),
    [pagination.items, groupBy, now],
  );

  const toggleGroup = groupKey => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const groupConfigs = groupBy === 'deadline' ? DEADLINE_GROUP_CONFIG : STATUS_GROUP_CONFIG;

  if (tasks.length === 0) {
    return (
      <div className="task-empty">
        <ListChecks size={32} aria-hidden="true" />
        <h3>No matching tasks</h3>
        <p>There are no tasks matching your current search or filter criteria.</p>
        {onClearFilters && (
          <button type="button" className="task-primary" style={{ marginTop: '10px' }} onClick={onClearFilters}>
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="task-list-wrapper">
      <div className="task-table-container">
        <table className="task-table" role="table" aria-label="Tasks list">
          <thead>
            <tr>
              <th scope="col" className="task-th-status">Status</th>
              <th scope="col" className="task-th-title">Task & Description</th>
              <th scope="col" className="task-th-priority">Priority</th>
              <th scope="col" className="task-th-due">Deadline</th>
              <th scope="col" className="task-th-checklist">Checklist</th>
              <th scope="col" className="task-th-assignees">Assigned To</th>
              <th scope="col" className="task-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groupConfigs.map(({ key, label, tone }) => {
              const itemsInGroup = groupedItems[key] || [];
              if (itemsInGroup.length === 0) return null;
              const isCollapsed = collapsedGroups.has(key);

              return (
                <tbody key={key} className="task-group-tbody">
                  <tr className="task-group-header-row">
                    <td colSpan={7}>
                      <button
                        type="button"
                        className={`task-group-accordion-btn task-group-${tone}`}
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleGroup(key)}
                      >
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        <span>{label}</span>
                        <span className="task-count">{itemsInGroup.length}</span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    itemsInGroup.map(task => (
                      <TaskListRow
                        key={task.id}
                        task={task}
                        now={now}
                        canUpdate={canUpdateTask ? canUpdateTask(task) : true}
                        canEdit={canEditTask ? canEditTask(task) : true}
                        onStatusChange={onStatusChange}
                        onOpenTask={onOpenTask}
                        onEditTask={onEditTask}
                      />
                    ))}
                </tbody>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <footer className="task-pagination-bar">
        <div className="task-pagination-info">
          Showing <span className="task-text-highlight">{pagination.startIndex}–{pagination.endIndex}</span> of{' '}
          <span className="task-text-highlight">{pagination.totalCount}</span> tasks
        </div>

        <div className="task-pagination-controls">
          <label className="task-pagination-size">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange?.(Number(e.target.value))}
              aria-label="Rows per page"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <div className="task-pagination-nav">
            <button
              type="button"
              disabled={pagination.currentPage <= 1}
              onClick={() => onPageChange?.(pagination.currentPage - 1)}
              aria-label="Previous page"
              className="task-pagination-btn"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="task-pagination-page-indicator">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.currentPage + 1)}
              aria-label="Next page"
              className="task-pagination-btn"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

