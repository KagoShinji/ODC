import { useState } from 'react';
import { CalendarClock, AlertTriangle, ListChecks, Share2, Check, Pencil, Loader2 } from 'lucide-react';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  statusLabel,
  priorityLabel,
  dueState,
  formatDue,
  initials,
} from '../../utils/taskTracker';

function PriorityPill({ priority }) {
  return <span className={`task-pill task-priority-${priority}`}>{priorityLabel(priority)}</span>;
}

function SalesPill({ task }) {
  return task.category === 'sales' ? <span className="task-pill task-category-sales">Sales</span> : null;
}

function DueLabel({ task, now }) {
  const state = dueState(task, now);
  return (
    <span className={`task-due task-due-${state}`}>
      {state === 'overdue' ? <AlertTriangle size={13} aria-hidden="true" /> : <CalendarClock size={13} aria-hidden="true" />}
      <span>{formatDue(task.dueAt, now)}</span>
    </span>
  );
}

function Avatars({ people }) {
  if (!people?.length) return <span className="task-muted">Unassigned</span>;
  return (
    <span className="task-avatars" title={people.map(p => p.name).join(', ')}>
      {people.slice(0, 3).map(p => (
        <span key={p.email} className="task-avatar" aria-hidden="true">
          {initials(p.name)}
        </span>
      ))}
      {people.length > 3 && (
        <span className="task-avatar task-avatar-more" aria-hidden="true">
          +{people.length - 3}
        </span>
      )}
      <span className="task-visually-hidden">Assigned to {people.map(p => p.name).join(', ')}</span>
    </span>
  );
}

export default function TaskListRow({
  task,
  now,
  canUpdate = false,
  canEdit = false,
  onStatusChange,
  onOpenTask,
  onEditTask,
}) {
  const [copied, setCopied] = useState(false);
  const [mutating, setMutating] = useState(false);

  const doneCount = (task.checklist || []).filter(i => i.done).length;
  const totalCount = (task.checklist || []).length;
  const state = dueState(task, now);

  const handleShareClick = async e => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/task/${task.id}`;
    const shareTitle = `Task: ${task.title}`;
    const assigneesText = task?.assignees?.length
      ? `Assigned to: ${task.assignees.map(a => a.name).join(', ')}`
      : 'ODC Team Workspace';
    const shareText = `Task: "${task.title}". ${assigneesText}. Due: ${formatDue(task.dueAt, now)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const handleStatusSelect = async e => {
    e.stopPropagation();
    const newStatus = e.target.value;
    if (newStatus === task.status || !onStatusChange) return;
    setMutating(true);
    try {
      await onStatusChange(task.id, newStatus);
    } finally {
      setMutating(false);
    }
  };

  return (
    <tr
      className={`task-table-row task-row-${state} ${task.status === 'done' ? 'task-row-done' : ''}`}
      onClick={() => onOpenTask?.(task.id)}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onOpenTask?.(task.id);
        }
      }}
    >
      {/* 1. Status with inline selector */}
      <td className="task-col-status" onClick={e => e.stopPropagation()}>
        <div className="task-status-cell">
          {mutating ? (
            <span className="task-status-loading">
              <Loader2 size={13} className="task-spin" />
            </span>
          ) : canUpdate ? (
            <select
              className={`task-table-status-select task-status-${task.status}`}
              value={task.status}
              onChange={handleStatusSelect}
              aria-label={`Update status for ${task.title}`}
            >
              {TASK_STATUSES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`task-pill task-status-${task.status}`}>
              {statusLabel(task.status)}
            </span>
          )}
        </div>
      </td>

      {/* 2. Title & Details preview */}
      <td className="task-col-title">
        <div className="task-title-cell">
          <div className="task-title-row">
            <strong className="task-row-title-text">{task.title}</strong>
            <SalesPill task={task} />
          </div>
          {task.description && (
            <p className="task-row-desc-preview">{task.description}</p>
          )}
        </div>
      </td>

      {/* 3. Priority */}
      <td className="task-col-priority">
        <PriorityPill priority={task.priority} />
      </td>

      {/* 4. Due Date */}
      <td className="task-col-due">
        <DueLabel task={task} now={now} />
      </td>

      {/* 5. Checklist progress */}
      <td className="task-col-checklist">
        {totalCount > 0 ? (
          <span className="task-checklist-count" title={`${doneCount} of ${totalCount} steps completed`}>
            <ListChecks size={13} aria-hidden="true" />
            <span>{doneCount}/{totalCount}</span>
          </span>
        ) : (
          <span className="task-muted-dash">—</span>
        )}
      </td>

      {/* 6. Assignees */}
      <td className="task-col-assignees">
        <Avatars people={task.assignees} />
      </td>

      {/* 7. Quick Actions */}
      <td className="task-col-actions" onClick={e => e.stopPropagation()}>
        <div className="task-actions-cell">
          {task.category !== 'sales' && (
            <button
              type="button"
              className="task-row-action-btn"
              title={copied ? 'Link copied!' : 'Share task link'}
              aria-label={`Share link for ${task.title}`}
              onClick={handleShareClick}
            >
              {copied ? <Check size={13} style={{ color: 'var(--task-done)' }} /> : <Share2 size={13} />}
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              className="task-row-action-btn"
              title="Edit task"
              aria-label={`Edit ${task.title}`}
              onClick={() => onEditTask?.(task.id)}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
