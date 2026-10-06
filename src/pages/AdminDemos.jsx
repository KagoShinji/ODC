import { useState, useEffect, useRef, useCallback } from 'react';
import { CalendarBlank, Plus, Bell, ArrowClockwise, X } from '@phosphor-icons/react';
import { getDemoDashboard, getDemoHistory, runDemoCommand, newDemoId, demoError } from '../services/demoService';
import { demoToday, demoWeekStart, shiftDemoDate } from '../utils/demoScheduling';
import DemoBookingForm from '../components/demos/DemoBookingForm';
import DemoAvailabilityForm from '../components/demos/DemoAvailabilityForm';
import DemoSettingsForm from '../components/demos/DemoSettingsForm';
import DemoCalendar from '../components/demos/DemoCalendar';
import DemoBookingDetail, { DemoOutcomeForm } from '../components/demos/DemoBookingDetail';
import './AdminDemos.css';

function DemoDialog({ title, busy, error, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="demo-dialog" aria-labelledby="demo-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><header><h3 id="demo-dialog-title">{title}</h3><button aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button></header>{error && <p className="demo-error" role="alert">{error}</p>}{children}</dialog>;
}

export default function AdminDemos({ firebaseUser, demoState, initialSection, onSectionChange, onOpenStaff }) {
  const { context, loading: contextLoading, error: contextError } = demoState;
  const [date, setDate] = useState(demoToday);
  const [view, setView] = useState('week');
  const [localSection, setLocalSection] = useState('calendar');
  const [data, setData] = useState({ key: '', bookings: [], presenters: [], clients: [], availability: null, grants: [], staff: [], truncated: false, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const retry = useRef(null);
  const mounted = useRef(true);
  const detailRequest = useRef(0);
  const access = context?.access;
  const manager = access?.actions.includes('demos:manage');
  const presenter = access?.presenterEnabled && access.actions.includes('demos:present');
  const canBook = manager || access?.actions.includes('demos:book');
  const sections = ['calendar', ...(presenter ? ['availability'] : []), 'notifications', ...(manager ? ['settings'] : [])];
  const requestedSection = initialSection || localSection;
  const section = sections.includes(requestedSection) ? requestedSection : 'calendar';
  const start = view === 'week' ? demoWeekStart(date) : date;
  const end = view === 'week' ? shiftDemoDate(start, 6) : start;
  const active = access?.active === true;
  const loadKey = JSON.stringify({ start, end, version, actions: access?.actions });
  const loading = data.key !== loadKey || data.loading;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!active) return;
    let disposed = false; let running = false;
    const load = async () => {
      if (running) return; running = true;
      try { const result = await getDemoDashboard(start, end); if (!disposed) setData({ ...result, key: loadKey, loading: false, error: '' }); }
      catch (err) { if (!disposed) setData(current => ({ ...current, key: loadKey, loading: false, error: demoError(err) })); }
      finally { running = false; }
    };
    load(); const timer = setInterval(load, 30000);
    return () => { disposed = true; clearInterval(timer); };
  }, [active, start, end, loadKey]);
  const close = useCallback(() => { detailRequest.current++; setModal(null); setError(''); }, []);
  const save = async (command, payload) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    const signature = JSON.stringify({ command, payload });
    if (retry.current?.signature !== signature) retry.current = { signature, id: newDemoId() };
    try {
      await runDemoCommand(command, payload, retry.current.id);
      retry.current = null;
      if (!mounted.current) return;
      setModal(null); setNotice(command === 'saveAvailability' ? 'Availability published. Sales will see your updated hours.' : command === 'book' ? 'Demonstration confirmed. Notifications have been sent to the presenter and salesperson.' : 'Changes saved.');
      setVersion(v => v + 1);
      if (['saveSettings', 'setMyPresenter'].includes(command)) demoState.refresh();
    } catch (err) { if (mounted.current) setError(demoError(err)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const openDetail = async id => {
    const requestId = ++detailRequest.current;
    setError(''); setModal({ kind: 'detail', loading: true });
    try { const result = await getDemoHistory(id); if (mounted.current && requestId === detailRequest.current) setModal({ kind: 'detail', ...result, loading: false }); }
    catch (err) { if (mounted.current && requestId === detailRequest.current) { setModal({ kind: 'detail', loading: false }); setError(demoError(err)); } }
  };
  const notificationClick = async notification => {
    try { if (!notification.read) await runDemoCommand('markRead', { id: notification.id }, newDemoId()); await openDetail(notification.bookingId); }
    catch (err) { if (mounted.current) setError(demoError(err)); }
  };
  const select = value => { setLocalSection(value); onSectionChange?.(value); setError(''); setNotice(''); };
  const onAction = (command, booking) => { setError(''); setModal({ kind: command === 'reschedule' ? 'booking' : 'outcome', command, booking }); };
  const filtered = data.bookings.filter(b => (filter === 'all' || b.presenterUid === filter) && (statusFilter === 'all' || b.status === statusFilter));
  return <div className="demo-module">
    <header className="demo-heading"><div><p className="demo-eyebrow">SALES & DEMONSTRATION TEAM</p><h2>Demo scheduling</h2><p>Book the right time. Give your team room to prepare.</p></div>{canBook && <button className="demo-primary" disabled={busy || !context?.enabled || loading || !!data.error} onClick={() => { setError(''); setModal({ kind: 'booking' }); }}><Plus size={18} /> Book a demonstration</button>}</header>
    {contextLoading && !context ? <div className="demo-skeleton" role="status" aria-label="Checking scheduling access" /> : contextError ? <div className="demo-error" role="alert"><strong>Scheduling service unavailable</strong><p>{contextError}</p><button onClick={demoState.refresh}>Retry connection</button></div> : !access ? <div className="demo-empty"><CalendarBlank size={32} /><h3>Scheduling access needs to be configured</h3><p>Ask an administrator to enable Demo Scheduling and assign your actions in Staff Management.</p><button onClick={demoState.refresh}>Check access again</button></div> : <>
      <nav className="demo-tabs" aria-label="Demo scheduling sections">{sections.map(id => <button key={id} aria-current={section === id ? 'page' : undefined} onClick={() => select(id)}>{id === 'calendar' ? 'Demonstrations' : id === 'availability' ? 'My availability' : id === 'notifications' ? <>Notifications {demoState.unread > 0 && <span className="demo-count">{demoState.unread}</span>}</> : 'Settings'}</button>)}</nav>
      {!context.enabled && <p className="demo-notice">New bookings are paused.{manager ? ' Assign presenters in Staff Management and enable bookings in Settings.' : ' Contact your scheduling administrator.'} Existing meetings and availability remain accessible.</p>}
      {(error && !modal || data.error) && <p className="demo-error" role="alert">{error && !modal ? error : data.error}</p>}
      {notice && <p className="demo-notice" role="status">{notice}</p>}
      {section === 'calendar' && <><div className="demo-calendar-filters"><label>Presenter<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All presenters</option>{[...new Map([...data.presenters, ...data.bookings.map(b => ({ uid: b.presenterUid, name: b.presenterName }))].map(p => [p.uid, p])).values()].map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}</select></label><label>Status<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">All statuses</option>{['confirmed', 'completed', 'cancelled', 'no_show'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><button onClick={() => setVersion(v => v + 1)} disabled={busy}><ArrowClockwise size={16} />Refresh</button><span className="demo-helper">PHT · UTC+8 · {manager || access.actions.includes('demos:view_all') ? 'Team calendar' : 'Your bookings and assigned meetings'}</span></div><DemoCalendar start={start} date={date} view={view} onDateChange={setDate} onViewChange={setView} bookings={filtered} loading={loading} truncated={data.truncated} onOpen={openDetail} /></>}
      {section === 'availability' && (loading ? <div className="demo-skeleton" /> : !data.error && <DemoAvailabilityForm key={data.availability?.updatedAt || 'initial'} uid={firebaseUser.uid} availability={data.availability} busy={busy} onSave={save} />)}
      {section === 'settings' && (loading ? <div className="demo-skeleton" /> : !data.error && <DemoSettingsForm key={JSON.stringify({ policy: context.policy, enabled: context.enabled, presenter: access.presenterEnabled })} context={context} busy={busy} onSave={save} onOpenStaff={onOpenStaff} />)}
      {section === 'notifications' && <>{demoState.notificationError && <div className="demo-error" role="alert"><p>{demoState.notificationError}</p><button onClick={demoState.refresh}>Retry notifications</button></div>}<p className="demo-helper">Your latest 50 updates. Notifications appear here while you are signed in; email delivery is not configured.</p>{demoState.notifications.length === 0 ? (!demoState.notificationError && <div className="demo-empty"><Bell size={32} /><h3>No notifications yet</h3><p>New bookings and schedule changes will appear here.</p></div>) : <div className="demo-notifications">{demoState.notifications.map(notification => <button key={notification.id} className={notification.read ? '' : 'demo-unread'} onClick={() => notificationClick(notification)}><span className="demo-notification-dot" /><div><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</small></div><span>{notification.read ? 'Read' : 'Unread'}</span></button>)}</div>}</>}
    </>}
    {modal && access && <DemoDialog title={modal.kind === 'booking' ? modal.booking ? 'Reschedule demonstration' : 'Book a demonstration' : modal.kind === 'detail' ? 'Demonstration details' : 'Update demonstration'} busy={busy} error={error} onClose={close}>
      {modal.kind === 'booking' && <DemoBookingForm policy={context.policy} presenters={data.presenters} clients={data.clients} booking={modal.booking} busy={busy} onSave={save} />}
      {modal.kind === 'detail' && (modal.loading ? <div className="demo-skeleton" role="status" aria-label="Loading meeting details" /> : modal.booking && <DemoBookingDetail booking={modal.booking} events={modal.events} access={access} uid={firebaseUser.uid} onAction={onAction} />)}
      {modal.kind === 'outcome' && <DemoOutcomeForm booking={modal.booking} command={modal.command} busy={busy} onSave={save} />}
    </DemoDialog>}
  </div>;
}
