import { db } from '../lib/firebase';
import { collection, doc, addDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, limit, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { formatDisplayIdentifier } from '../utils/authHelpers';
import { TASK_LIMITS } from '../utils/taskTracker';

const tasksRef = collection(db, 'tasks');

const actorOf = user => ({
  byEmail: (user.email || '').toLowerCase(),
  byName: user.displayName || formatDisplayIdentifier(user.email),
});
const entry = (user, type, extra = {}) => ({ type, at: Timestamp.now(), ...actorOf(user), ...extra });
const withEntry = (activity, item) => [...(activity || []), item].slice(-TASK_LIMITS.activity);

function taskFields(form) {
  const assignees = form.assignees.slice(0, TASK_LIMITS.assignees).map(a => ({ email: a.email.toLowerCase(), name: a.name }));
  return {
    title: form.title.trim().slice(0, TASK_LIMITS.title),
    description: form.description.trim().slice(0, TASK_LIMITS.description),
    priority: form.priority,
    dueAt: Timestamp.fromDate(new Date(`${form.dueDate}T${form.dueTime || '17:00'}`)),
    assignees,
    assigneeEmails: assignees.map(a => a.email),
    checklist: form.checklist
      .map(item => ({ id: item.id, text: item.text.trim().slice(0, TASK_LIMITS.checklistText), done: item.done === true }))
      .filter(item => item.text)
      .slice(0, TASK_LIMITS.checklist),
  };
}

/** Reads the latest copy of a task, applies `change`, and writes it back atomically. */
function mutateTask(taskId, change) {
  const ref = doc(db, 'tasks', taskId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('This task was deleted.');
    tx.update(ref, { ...change(snap.data()), updatedAt: serverTimestamp() });
  });
}

export function subscribeTasks(onData, onError) {
  return onSnapshot(
    query(tasksRef, orderBy('dueAt', 'asc'), limit(500)),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    onError,
  );
}

export async function listAssignableStaff() {
  const snap = await getDocs(collection(db, 'staff'));
  return snap.docs
    .map(d => d.data())
    .filter(s => s.status === 'active' && s.email)
    .map(s => ({ email: s.email.toLowerCase(), name: s.name || formatDisplayIdentifier(s.email), role: s.role || '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createTask(user, form) {
  return addDoc(tasksRef, {
    ...taskFields(form),
    status: 'todo',
    activity: [entry(user, 'created')],
    createdByUid: user.uid,
    createdByEmail: (user.email || '').toLowerCase(),
    createdByName: actorOf(user).byName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  });
}

export function editTask(user, taskId, form) {
  return mutateTask(taskId, current => ({ ...taskFields(form), activity: withEntry(current.activity, entry(user, 'edited')) }));
}

export function changeTaskStatus(user, taskId, status) {
  return mutateTask(taskId, current => {
    if (current.status === status) return {};
    return {
      status,
      completedAt: status === 'done' ? Timestamp.now() : null,
      activity: withEntry(current.activity, entry(user, 'status', { from: current.status, to: status })),
    };
  });
}

export function addTaskNote(user, taskId, note) {
  const text = note.trim().slice(0, TASK_LIMITS.note);
  return mutateTask(taskId, current => ({ activity: withEntry(current.activity, entry(user, 'note', { note: text })) }));
}

export function toggleChecklistItem(taskId, itemId) {
  return mutateTask(taskId, current => ({
    checklist: (current.checklist || []).map(item => item.id === itemId ? { ...item, done: !item.done } : item),
  }));
}

export const deleteTask = taskId => deleteDoc(doc(db, 'tasks', taskId));
