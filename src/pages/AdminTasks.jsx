import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, X, Search, CalendarClock, CheckCircle2, Circle, ListChecks,
  AlertTriangle, Clock, Trash2, Pencil, MessageSquarePlus, Share2, Check,
  LayoutGrid, List, Eye, EyeOff, Filter,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import { formatDisplayIdentifier } from '../utils/authHelpers';
import {
  TASK_STATUSES, TASK_PRIORITIES, TASK_LIMITS, statusLabel, priorityLabel,
  toDate, dateInputValue, timeInputValue, dueState, formatDue, formatStamp, initials, byDeadline,
  filterTasks, groupTasksBy,
} from '../utils/taskTracker';
import {
  subscribeTasks, listAssignableStaff, createTask, editTask, changeTaskStatus, addTaskNote, toggleChecklistItem, deleteTask,
} from '../services/taskService';
import TaskBoardView from '../components/tasks/TaskBoardView';
import TaskListView from '../components/tasks/TaskListView';
import TaskCard, { shareTaskHelper } from '../components/tasks/TaskCard';
import './AdminTasks.css';

const SECTIONS = [{ id: 'mine', label: 'My tasks' }, { id: 'board', label: 'Team board' }];
const DUE_LABELS = { overdue: 'Overdue', today: 'Due today', soon: 'Due soon' };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const errorText = err => err?.code === 'permission-denied'
  ? 'You do not have permission to make this change.'
  : err?.message || 'Something went wrong. Please try again.';

function TaskDialog({ title, busy, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={ref} className="task-dialog" aria-labelledby="task-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
      <header>
        <h3 id="task-dialog-title">{title}</h3>
        <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      {children}
    </dialog>
  );
}

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
      {people.slice(0, 4).map(p => <span key={p.email} className="task-avatar" aria-hidden="true">{initials(p.name)}</span>)}
      {people.length > 4 && <span className="task-avatar task-avatar-more" aria-hidden="true">+{people.length - 4}</span>}
      <span className="task-visually-hidden">Assigned to {people.map(p => p.name).join(', ')}</span>
    </span>
  );
}

function emptyForm(task) {
  const due = toDate(task?.dueAt);
  const fallback = new Date(); fallback.setDate(fallback.getDate() + 1);
  return {
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'medium',
    dueDate: dateInputValue(due || fallback),
    dueTime: due ? timeInputValue(due) : '17:00',
    assignees: task?.assignees || [],
    checklist: task?.checklist || [],
  };
}

function TaskForm({ task, staff, busy, error, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => emptyForm(task));
  const [filter, setFilter] = useState('');
  const [newItem, setNewItem] = useState('');
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const selected = new Set(form.assignees.map(a => a.email));
  // Keep assignees who are no longer in the active roster visible so they can be removed.
  const roster = [...staff, ...form.assignees.filter(a => !staff.some(s => s.email === a.email))];
  const visibleRoster = roster.filter(s => `${s.name} ${s.email} ${s.role || ''}`.toLowerCase().includes(filter.toLowerCase()));

  const toggleAssignee = person => set('assignees', selected.has(person.email)
    ? form.assignees.filter(a => a.email !== person.email)
    : [...form.assignees, { email: person.email, name: person.name }]);
  const addItem = () => {
    if (!newItem.trim() || form.checklist.length >= TASK_LIMITS.checklist) return;
    set('checklist', [...form.checklist, { id: newId(), text: newItem.trim(), done: false }]);
    setNewItem('');
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      {error && <p className="task-error" role="alert">{error}</p>}
      <label className="task-field">
        <span>Task title</span>
        <input required data-autofocus="true" maxLength={TASK_LIMITS.title} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Prepare March billing report" />
      </label>
      <label className="task-field">
        <span>Details <small>(optional)</small></span>
        <textarea maxLength={TASK_LIMITS.description} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What needs to be done, links, acceptance notes…" />
      </label>
      <div className="task-form-grid">
        <label className="task-field">
          <span>Priority</span>
          <select value={form.priority} onChange={e => set('priority', e.target.value)}>
            {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="task-field">
          <span>Deadline date</span>
          <input type="date" required value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </label>
        <label className="task-field">
          <span>Deadline time</span>
          <input type="time" required value={form.dueTime} onChange={e => set('dueTime', e.target.value)} />
        </label>
      </div>

      <fieldset className="task-field">
        <legend>Assign to <small>({form.assignees.length} selected)</small></legend>
        <input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search staff…" aria-label="Search staff to assign" />
        <div className="task-assignee-list">
          {visibleRoster.length === 0 && <p className="task-muted">No matching staff.</p>}
          {visibleRoster.map(person => (
            <label key={person.email} className="task-assignee-option">
              <input type="checkbox" checked={selected.has(person.email)} onChange={() => toggleAssignee(person)}
                disabled={!selected.has(person.email) && form.assignees.length >= TASK_LIMITS.assignees} />
              <span className="task-avatar" aria-hidden="true">{initials(person.name)}</span>
              <span>{person.name}<small>{person.role || formatDisplayIdentifier(person.email)}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="task-field">
        <legend>Checklist <small>(optional)</small></legend>
        {form.checklist.length > 0 && (
          <ul className="task-checklist-edit">
            {form.checklist.map(item => (
              <li key={item.id}>
                <input aria-label="Checklist item" maxLength={TASK_LIMITS.checklistText} value={item.text}
                  onChange={e => set('checklist', form.checklist.map(i => i.id === item.id ? { ...i, text: e.target.value } : i))} />
                <button type="button" aria-label={`Remove ${item.text || 'item'}`} onClick={() => set('checklist', form.checklist.filter(i => i.id !== item.id))}><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="task-inline">
          <input value={newItem} maxLength={TASK_LIMITS.checklistText} onChange={e => setNewItem(e.target.value)} placeholder="Add a step…"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} aria-label="New checklist item" />
          <button type="button" onClick={addItem} disabled={!newItem.trim()}><Plus size={14} /> Add</button>
        </div>
      </fieldset>

      <footer className="task-form-footer">
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Saving…">{task ? 'Save changes' : 'Post task'}</LoadingButton>
      </footer>
    </form>
  );
}

function activityText(item) {
  if (item.type === 'created') return 'created this task';
  if (item.type === 'edited') return 'edited the task details';
  if (item.type === 'status') return `moved it from ${statusLabel(item.from)} to ${statusLabel(item.to)}`;
  return 'posted an update';
}

function TaskDetail({ task, now, canEdit, canUpdate, onEdit, onDelete, onStatus, onNote, onToggleItem, busy, error }) {
  const [note, setNote] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const checklist = task.checklist || [];
  const activity = [...(task.activity || [])].reverse();

  const handleShare = () => {
    shareTaskHelper(task, now, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="task-detail">
      {error && <p className="task-error" role="alert">{error}</p>}
      <div className="task-detail-pills">
        <StatusPill status={task.status} />
        <PriorityPill priority={task.priority} />
        <SalesPill task={task} />
        <DueLabel task={task} now={now} />
        {task.category !== 'sales' && <button
          type="button"
          className={`task-detail-share-btn ${copied ? 'is-copied' : ''}`}
          onClick={handleShare}
          title="Share or copy public task link"
          style={{ marginLeft: 'auto' }}
        >
          {copied ? <Check size={13} /> : <Share2 size={13} />}
          <span>{copied ? 'Link Copied' : 'Share Task'}</span>
        </button>}
      </div>
      <dl className="task-detail-grid">
        <dt>Assigned to</dt>
        <dd>{task.assignees?.length ? task.assignees.map(a => a.name).join(', ') : 'Unassigned'}</dd>
        <dt>Posted by</dt>
        <dd>{task.createdByName}<span>{formatStamp(task.createdAt)}</span></dd>
        {task.completedAt && <><dt>Completed</dt><dd>{formatStamp(task.completedAt)}</dd></>}
      </dl>
      {task.description && <p className="task-description">{task.description}</p>}

      {canUpdate && (
        <section aria-labelledby="task-status-heading">
          <h4 id="task-status-heading">Update status</h4>
          <div className="task-status-picker" role="group" aria-labelledby="task-status-heading">
            {TASK_STATUSES.map(s => (
              <button type="button" key={s.id} aria-pressed={task.status === s.id} disabled={busy} onClick={() => onStatus(s.id)}>{s.label}</button>
            ))}
          </div>
        </section>
      )}

      {checklist.length > 0 && (
        <section aria-labelledby="task-checklist-heading">
          <h4 id="task-checklist-heading">Checklist <small>{checklist.filter(i => i.done).length}/{checklist.length}</small></h4>
          <ul className="task-checklist">
            {checklist.map(item => (
              <li key={item.id}>
                <label>
                  <input type="checkbox" checked={item.done} disabled={!canUpdate || busy} onChange={() => onToggleItem(item.id)} />
                  <span className={item.done ? 'task-done-text' : ''}>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canUpdate && (
        <section aria-labelledby="task-note-heading">
          <h4 id="task-note-heading">Post a progress update</h4>
          <form className="task-note-form" onSubmit={async e => { e.preventDefault(); if (await onNote(note)) setNote(''); }}>
            <textarea aria-labelledby="task-note-heading" maxLength={TASK_LIMITS.note} value={note} onChange={e => setNote(e.target.value)} placeholder="What changed, what's blocking you…" />
            <LoadingButton type="submit" loading={busy} disabled={!note.trim()} loadingLabel="Posting…"><MessageSquarePlus size={14} /> Post update</LoadingButton>
          </form>
        </section>
      )}

      <section aria-labelledby="task-activity-heading">
        <h4 id="task-activity-heading">Activity</h4>
        <ol className="task-activity">
          {activity.map((item, index) => (
            <li key={`${item.type}-${index}`}>
              <p><strong>{item.byName}</strong> {activityText(item)}</p>
              {item.note && <p className="task-activity-note">{item.note}</p>}
              <small>{formatStamp(item.at)}</small>
            </li>
          ))}
        </ol>
      </section>

      {canEdit && (
        <footer className="task-form-footer">
          {confirmingDelete ? (
            <div className="task-inline task-confirm" role="group" aria-label="Confirm delete">
              <span>Delete this task and its history?</span>
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy}>Keep</button>
              <LoadingButton type="button" className="task-danger" loading={busy} loadingLabel="Deleting…" onClick={onDelete}>Delete task</LoadingButton>
            </div>
          ) : (
            <>
              <button type="button" className="task-danger" onClick={() => setConfirmingDelete(true)} disabled={busy}><Trash2 size={14} /> Delete</button>
              <button type="button" onClick={onEdit} disabled={busy}><Pencil size={14} /> Edit task</button>
            </>
          )}
        </footer>
      )}
    </div>
  );
}

/**
 * The team task board. With `category` it becomes a focused board for one kind of work
 * (e.g. My Sales Tasks): only that category is loaded and new tasks are filed under it.
 * `heading` replaces the page title with a one-line description when the board is embedded in another module.
 */
export default function AdminTasks({ firebaseUser, can, initialSection, onSectionChange, category = null, onlyMine = false, heading = null, canCreateInCategory = false }) {
  const modal = useSystemModal();
  const myEmail = (firebaseUser.email || '').toLowerCase();
  const isManager = can('tasks:manage');
  const canCreate = isManager || can('tasks:create') || canCreateInCategory;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [staff, setStaff] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [localSection, setLocalSection] = useState('mine');
  const [mineScope, setMineScope] = useState('assigned');
  const [showDone, setShowDone] = useState(false);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialog, setDialog] = useState(null); // { type: 'form', taskId? } | { type: 'detail', taskId }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // High-volume UX additions
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('odc_task_view_mode') || 'kanban'; } catch { return 'kanban'; }
  });
  const [hideDone, setHideDone] = useState(() => {
    try { return localStorage.getItem('odc_task_hide_done') === 'true'; } catch { return false; }
  });
  const [quickFilter, setQuickFilter] = useState('all'); // 'all' | 'overdue' | 'today' | 'mine'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const section = SECTIONS.some(s => s.id === initialSection) ? initialSection : localSection;
  const selectSection = id => { setLocalSection(id); onSectionChange?.(id); setPage(1); };

  const handleViewModeChange = mode => {
    setViewMode(mode);
    try { localStorage.setItem('odc_task_view_mode', mode); } catch {}
  };

  const handleHideDoneToggle = () => {
    setHideDone(prev => {
      const next = !prev;
      try { localStorage.setItem('odc_task_hide_done', String(next)); } catch {}
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearch('');
    setAssigneeFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setQuickFilter('all');
    setHideDone(false);
    try { localStorage.setItem('odc_task_hide_done', 'false'); } catch {}
    setPage(1);
  };

  // Reset page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, assigneeFilter, priorityFilter, categoryFilter, quickFilter, hideDone, mineScope, section]);

  useEffect(() => subscribeTasks(
    list => { setTasks(list); setLoading(false); setLoadError(''); },
    err => { setLoading(false); setLoadError(errorText(err)); },
    { category, assigneeEmail: onlyMine ? myEmail : null },
  ), [category, onlyMine, myEmail]);

  useEffect(() => {
    listAssignableStaff().then(setStaff).catch(err => console.error('Could not load staff roster:', err));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const isAssignee = task => (task.assigneeEmails || []).includes(myEmail);
  const canEditTask = task => isManager || task.createdByUid === firebaseUser.uid;
  const canUpdateTask = task => canEditTask(task) || isAssignee(task);

  // Filtered dataset for "My Tasks"
  const mineRaw = useMemo(() => tasks
    .filter(t => mineScope === 'assigned' ? (t.assigneeEmails || []).includes(myEmail) : t.createdByUid === firebaseUser.uid)
    .sort(byDeadline), [tasks, mineScope, myEmail, firebaseUser.uid]);

  const mineTasks = useMemo(() => filterTasks(mineRaw, {
    search,
    category: category || categoryFilter,
    priority: priorityFilter,
    assignee: 'all',
    hideDone,
    quickFilter,
    myEmail,
    now,
  }), [mineRaw, search, category, categoryFilter, priorityFilter, hideDone, quickFilter, myEmail, now]);

  const mineGroups = useMemo(() => groupTasksBy(mineTasks, 'deadline', now), [mineTasks, now]);

  const stats = useMemo(() => {
    const assigned = tasks.filter(t => (t.assigneeEmails || []).includes(myEmail));
    const open = assigned.filter(t => t.status !== 'done');
    const weekAgo = now - 7 * 86400000;
    return [
      { label: 'Open for me', value: open.length, icon: <Circle size={14} aria-hidden="true" /> },
      { label: 'Overdue', value: open.filter(t => dueState(t, now) === 'overdue').length, icon: <AlertTriangle size={14} aria-hidden="true" />, tone: 'overdue' },
      { label: 'Due today', value: open.filter(t => dueState(t, now) === 'today').length, icon: <Clock size={14} aria-hidden="true" />, tone: 'today' },
      { label: 'Done this week', value: assigned.filter(t => t.status === 'done' && (toDate(t.completedAt)?.getTime() || 0) >= weekAgo).length, icon: <CheckCircle2 size={14} aria-hidden="true" />, tone: 'done' },
    ];
  }, [tasks, myEmail, now]);

  const boardPeople = useMemo(() => {
    const people = new Map();
    tasks.forEach(t => (t.assignees || []).forEach(a => people.set(a.email, a.name)));
    return [...people].map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  // Filtered dataset for "Team Board"
  const boardTasks = useMemo(() => filterTasks(tasks, {
    search,
    category: category || categoryFilter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    hideDone,
    quickFilter,
    myEmail,
    now,
  }), [tasks, search, category, categoryFilter, priorityFilter, assigneeFilter, hideDone, quickFilter, myEmail, now]);

  const totalDoneCount = useMemo(() => {
    const list = section === 'mine' ? mineRaw : tasks;
    return list.filter(t => t.status === 'done').length;
  }, [section, mineRaw, tasks]);

  const activeTask = dialog?.taskId ? tasks.find(t => t.id === dialog.taskId) : null;
  const closeDialog = () => { setDialog(null); setError(''); };
  const openTask = taskId => { setError(''); setDialog({ type: 'detail', taskId }); };

  const run = async (work) => {
    setBusy(true); setError('');
    try { await work(); return true; }
    catch (err) { console.error('Task update failed:', err); setError(errorText(err)); return false; }
    finally { setBusy(false); }
  };

  const submitForm = form => {
    if (!form.title.trim()) return setError('Give the task a title.');
    if (!form.dueDate) return setError('Set a deadline date.');
    return run(async () => {
      if (dialog.taskId) {
        await editTask(firebaseUser, dialog.taskId, form);
        setDialog({ type: 'detail', taskId: dialog.taskId });
      } else {
        await createTask(firebaseUser, form, { category });
        closeDialog();
        modal.success({ title: 'Task posted', message: form.assignees.length ? `Assigned to ${form.assignees.map(a => a.name).join(', ')}.` : 'The task is on the team board.' });
      }
    });
  };

  const removeTask = async () => {
    if (await run(() => deleteTask(activeTask.id))) closeDialog();
  };

  const renderGroup = (key, label, list) => list.length > 0 && (
    <section key={key} className="task-group" aria-labelledby={`task-group-${key}`}>
      <h3 id={`task-group-${key}`} className={`task-group-title task-group-${key}`}>{label} <span className="task-count">{list.length}</span></h3>
      <div className="task-grid">{list.map(task => <TaskCard key={task.id} task={task} now={now} onOpen={openTask} />)}</div>
    </section>
  );

  return (
    <div className="task-module">
      <header className="task-heading">
        <div>
          {heading ? <p className="task-muted">{heading}</p> : (
            <>
              <p className="task-eyebrow">Team workspace</p>
              <h2>Task Board</h2>
              <p>Post tasks with deadlines, assign them to staff, and track what&apos;s done.</p>
            </>
          )}
        </div>
        {canCreate && (
          <button type="button" className="task-primary task-heading-action" onClick={() => { setError(''); setDialog({ type: 'form' }); }}>
            <Plus size={16} /> New task
          </button>
        )}
      </header>

      <nav className="task-tabs" aria-label="Task views">
        {SECTIONS.map(s => (
          <button type="button" key={s.id} aria-current={section === s.id ? 'page' : undefined} onClick={() => selectSection(s.id)}>{s.label}</button>
        ))}
      </nav>

      {loadError && <p className="task-error" role="alert">{loadError}</p>}

      {/* Main Toolbar */}
      <div className="task-toolbar">
        {/* Search */}
        <label className="task-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks or people…" aria-label="Search tasks" />
        </label>

        {/* View Switcher Toggle: Kanban vs List */}
        <div className="task-view-switcher" role="group" aria-label="View format">
          <button
            type="button"
            className={`task-view-btn ${viewMode === 'kanban' ? 'is-active' : ''}`}
            onClick={() => handleViewModeChange('kanban')}
            title="Kanban Board view"
            aria-pressed={viewMode === 'kanban'}
          >
            <LayoutGrid size={15} />
            <span>Board</span>
          </button>
          <button
            type="button"
            className={`task-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => handleViewModeChange('list')}
            title="High-density List/Table view"
            aria-pressed={viewMode === 'list'}
          >
            <List size={15} />
            <span>List</span>
          </button>
        </div>

        {/* "Hide Done" Toggle */}
        <button
          type="button"
          className={`task-hide-done-toggle ${hideDone ? 'is-active' : ''}`}
          onClick={handleHideDoneToggle}
          title={hideDone ? 'Showing active tasks only (Completed hidden)' : 'Showing all tasks including completed'}
          aria-pressed={hideDone}
        >
          {hideDone ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>Hide done</span>
          {totalDoneCount > 0 && <span className="task-count">{totalDoneCount}</span>}
        </button>

        {/* Quick Filter Chips */}
        <div className="task-quick-chips" role="group" aria-label="Quick filters">
          <button
            type="button"
            className={`task-chip ${quickFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setQuickFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`task-chip task-chip-overdue ${quickFilter === 'overdue' ? 'is-active' : ''}`}
            onClick={() => setQuickFilter(f => f === 'overdue' ? 'all' : 'overdue')}
          >
            Overdue
          </button>
          <button
            type="button"
            className={`task-chip task-chip-today ${quickFilter === 'today' ? 'is-active' : ''}`}
            onClick={() => setQuickFilter(f => f === 'today' ? 'all' : 'today')}
          >
            Due today
          </button>
          {section === 'board' && (
            <button
              type="button"
              className={`task-chip ${quickFilter === 'mine' ? 'is-active' : ''}`}
              onClick={() => setQuickFilter(f => f === 'mine' ? 'all' : 'mine')}
            >
              My tasks
            </button>
          )}
        </div>

        {/* Section-specific Filters */}
        {section === 'mine' ? (
          <div className="task-segmented" role="group" aria-label="Which tasks">
            <button type="button" aria-pressed={mineScope === 'assigned'} onClick={() => setMineScope('assigned')}>Assigned to me</button>
            <button type="button" aria-pressed={mineScope === 'created'} onClick={() => setMineScope('created')}>Posted by me</button>
          </div>
        ) : (
          <div className="task-dropdown-filters">
            <label className="task-filter">
              <span>Assignee</span>
              <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}>
                <option value="all">Everyone</option>
                <option value={myEmail}>Me</option>
                <option value="none">Unassigned</option>
                {boardPeople.filter(p => p.email !== myEmail).map(p => <option key={p.email} value={p.email}>{p.name}</option>)}
              </select>
            </label>
            <label className="task-filter">
              <span>Priority</span>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                <option value="all">All</option>
                {TASK_PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            {!category && (
              <label className="task-filter">
                <span>Category</span>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                  <option value="all">All tasks</option>
                  <option value="general">General</option>
                  <option value="sales">Sales</option>
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="task-skeleton" role="status" aria-label="Loading tasks" />
      ) : section === 'mine' ? (
        <>
          {mineScope === 'assigned' && (
            <div className="task-stats">
              {stats.map(({ label, value, icon, tone }) => (
                <div key={label} className={`task-stat ${tone ? `task-stat-${tone}` : ''}`}>
                  <span>{icon} {label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'list' ? (
            <TaskListView
              tasks={mineTasks}
              now={now}
              groupBy="deadline"
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              onStatusChange={(taskId, newStatus) => run(() => changeTaskStatus(firebaseUser, taskId, newStatus))}
              onOpenTask={openTask}
              onEditTask={taskId => { setError(''); setDialog({ type: 'form', taskId }); }}
              canUpdateTask={canUpdateTask}
              canEditTask={canEditTask}
              onClearFilters={handleClearFilters}
            />
          ) : (
            mineTasks.length === 0 ? (
              <div className="task-empty">
                <ListChecks size={32} aria-hidden="true" />
                <h3>{mineScope === 'assigned' ? 'Nothing assigned to you' : "You haven't posted any tasks"}</h3>
                <p>{mineScope === 'assigned' ? 'Tasks that teammates assign to you will show up here with their deadlines.' : canCreate ? 'Use “New task” to post work for the team.' : 'Ask an administrator for task posting access.'}</p>
                {(search || quickFilter !== 'all' || hideDone) && (
                  <button type="button" className="task-primary" style={{ marginTop: '10px' }} onClick={handleClearFilters}>
                    Clear active filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {renderGroup('overdue', 'Overdue', mineGroups.overdue)}
                {renderGroup('today', 'Due today', mineGroups.today)}
                {renderGroup('upcoming', 'Upcoming', mineGroups.upcoming)}
                {!hideDone && mineGroups.done.length > 0 && (
                  <section className="task-group">
                    <button type="button" className="task-done-toggle" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
                      {showDone ? 'Hide' : 'Show'} completed <span className="task-count">{mineGroups.done.length}</span>
                    </button>
                    {showDone && <div className="task-grid">{mineGroups.done.map(task => <TaskCard key={task.id} task={task} now={now} onOpen={openTask} />)}</div>}
                  </section>
                )}
              </>
            )
          )}
        </>
      ) : (
        viewMode === 'list' ? (
          <TaskListView
            tasks={boardTasks}
            now={now}
            groupBy="status"
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onStatusChange={(taskId, newStatus) => run(() => changeTaskStatus(firebaseUser, taskId, newStatus))}
            onOpenTask={openTask}
            onEditTask={taskId => { setError(''); setDialog({ type: 'form', taskId }); }}
            canUpdateTask={canUpdateTask}
            canEditTask={canEditTask}
            onClearFilters={handleClearFilters}
          />
        ) : (
          <TaskBoardView
            tasks={boardTasks}
            now={now}
            onOpenTask={openTask}
          />
        )
      )}

      {dialog?.type === 'form' && (
        <TaskDialog title={dialog.taskId ? 'Edit task' : 'New task'} busy={busy} onClose={closeDialog}>
          <TaskForm task={activeTask} staff={staff} busy={busy} error={error} onSubmit={submitForm}
            onCancel={() => dialog.taskId ? setDialog({ type: 'detail', taskId: dialog.taskId }) : closeDialog()} />
        </TaskDialog>
      )}

      {dialog?.type === 'detail' && activeTask && (
        <TaskDialog title={activeTask.title} busy={busy} onClose={closeDialog}>
          <TaskDetail
            task={activeTask} now={now} busy={busy} error={error}
            canEdit={canEditTask(activeTask)} canUpdate={canUpdateTask(activeTask)}
            onEdit={() => { setError(''); setDialog({ type: 'form', taskId: activeTask.id }); }}
            onDelete={removeTask}
            onStatus={status => run(() => changeTaskStatus(firebaseUser, activeTask.id, status))}
            onNote={note => note.trim() ? run(() => addTaskNote(firebaseUser, activeTask.id, note)) : false}
            onToggleItem={itemId => run(() => toggleChecklistItem(activeTask.id, itemId))}
          />
        </TaskDialog>
      )}
    </div>
  );
}
