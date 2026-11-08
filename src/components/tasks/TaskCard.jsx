import { useState } from 'react';
import { CalendarClock, AlertTriangle, ListChecks, Share2, Check } from 'lucide-react';
import {
  statusLabel,
  priorityLabel,
  dueState,
  formatDue,
  initials,
} from '../../utils/taskTracker';

const DUE_LABELS = { overdue: 'Overdue', today: 'Due today', soon: 'Due soon' };

function SalesPill({ task }) {
  return task.category === 'sales' ? <span className="task-pill task-category-sales">Sales</span> : null;
}

function StatusPill({ status }) {
  return <span className={`task-pill task-status-${status}`}>{statusLabel(status)}</span>;
}

function PriorityPill({ priority }) {
  return <span className={`task-pill task-priority-${priority}`}>{priorityLabel(priority)}</span>;
}

function DueLabel({ task, now }) {
  const state = dueState(task, now);
  return (
    <span className={`task-due task-due-${state}`}>
      {state === 'overdue' ? <AlertTriangle size={13} aria-hidden="true" /> : <CalendarClock size={13} aria-hidden="true" />}
      {formatDue(task.dueAt, now)}
      {DUE_LABELS[state] && <span className="task-visually-hidden"> ({DUE_LABELS[state]})</span>}
    </span>
  );
}

function Avatars({ people }) {
  if (!people?.length) return <span className="task-muted">Unassigned</span>;
  return (
    <span className="task-avatars" title={people.map(p => p.name).join(', ')}>
      {people.slice(0, 4).map(p => (
        <span key={p.email} className="task-avatar" aria-hidden="true">
          {initials(p.name)}
        </span>
      ))}
      {people.length > 4 && (
        <span className="task-avatar task-avatar-more" aria-hidden="true">
          +{people.length - 4}
        </span>
      )}
      <span className="task-visually-hidden">Assigned to {people.map(p => p.name).join(', ')}</span>
    </span>
  );
}

export async function shareTaskHelper(task, now, onCopied) {
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
        console.warn('Navigator share error:', err);
      }
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl);
    onCopied?.();
  } catch (err) {
    console.warn('Clipboard write error:', err);
  }
}

export default function TaskCard({ task, now, onOpen, compact = false }) {
  const [copied, setCopied] = useState(false);
  const done = (task.checklist || []).filter(i => i.done).length;
  const total = (task.checklist || []).length;

  const handleShareClick = e => {
    e.stopPropagation();
    shareTaskHelper(task, now, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="task-card-wrapper">
      <button type="button" className={`task-card task-card-${dueState(task, now)}`} onClick={() => onOpen(task.id)}>
        <span className="task-card-top">
          <PriorityPill priority={task.priority} />
          <SalesPill task={task} />
          {!compact && <StatusPill status={task.status} />}
        </span>
        <strong className="task-card-title">{task.title}</strong>
        <span className="task-card-meta">
          <DueLabel task={task} now={now} />
          {total > 0 && (
            <span className="task-checklist-count">
              <ListChecks size={13} aria-hidden="true" />
              {done}/{total}
            </span>
          )}
        </span>
        <Avatars people={task.assignees} />
      </button>
      {task.category !== 'sales' && (
        <button
          type="button"
          className="task-card-share-btn"
          title={copied ? 'Link copied!' : 'Share task link'}
          aria-label={`Share link for ${task.title}`}
          onClick={handleShareClick}
        >
          {copied ? <Check size={13} style={{ color: 'var(--task-done)' }} /> : <Share2 size={13} />}
        </button>
      )}
    </div>
  );
}
