import { useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { TASK_STATUSES, byDeadline, toDate } from '../../utils/taskTracker';
import TaskCard from './TaskCard';

export default function TaskBoardView({ tasks = [], now = Date.now(), onOpenTask }) {
  const [collapsedColumns, setCollapsedColumns] = useState(() => new Set());

  const toggleColumnCollapse = statusId => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) next.delete(statusId);
      else next.add(statusId);
      return next;
    });
  };

  return (
    <div className="task-board" role="region" aria-label="Team task board">
      {TASK_STATUSES.map(status => {
        const columnTasks = tasks.filter(t => t.status === status.id);
        const ordered = status.id === 'done'
          ? [...columnTasks].sort((a, b) => (toDate(b.completedAt)?.getTime() || 0) - (toDate(a.completedAt)?.getTime() || 0))
          : [...columnTasks].sort(byDeadline);

        const isCollapsed = collapsedColumns.has(status.id);

        if (isCollapsed) {
          return (
            <section
              key={status.id}
              className={`task-column task-column-${status.id} task-column-collapsed`}
              aria-label={`${status.label} (${columnTasks.length} tasks, collapsed)`}
              onClick={() => toggleColumnCollapse(status.id)}
            >
              <button
                type="button"
                className="task-col-expand-btn"
                title={`Expand ${status.label} column`}
                aria-label={`Expand ${status.label} column`}
                onClick={e => {
                  e.stopPropagation();
                  toggleColumnCollapse(status.id);
                }}
              >
                <ChevronsRight size={14} />
              </button>
              <div className="task-collapsed-label">
                <span className="task-collapsed-text">{status.label}</span>
                <span className="task-count">{columnTasks.length}</span>
              </div>
            </section>
          );
        }

        return (
          <section
            key={status.id}
            className={`task-column task-column-${status.id}`}
            aria-labelledby={`task-col-${status.id}`}
          >
            <div className="task-column-header">
              <h3 id={`task-col-${status.id}`}>
                <span>{status.label}</span>
                <span className="task-count">{columnTasks.length}</span>
              </h3>
              <button
                type="button"
                className="task-col-collapse-btn"
                title={`Minimize ${status.label} column`}
                aria-label={`Minimize ${status.label} column`}
                onClick={() => toggleColumnCollapse(status.id)}
              >
                <ChevronsLeft size={14} />
              </button>
            </div>

            <div className="task-column-cards">
              {ordered.length === 0 ? (
                <p className="task-column-empty">No tasks</p>
              ) : (
                ordered.map(task => (
                  <TaskCard key={task.id} task={task} now={now} onOpen={onOpenTask} compact />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
