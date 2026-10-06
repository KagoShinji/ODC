import { useState } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { formatDemoDate, formatDemoTime } from '../../utils/demoScheduling';
import { DemoField } from './DemoBookingForm';
import LoadingButton from '../ui/LoadingButton';

export default function DemoBookingDetail({ booking, events, access, uid, onAction }) {
  const manager = access.actions.includes('demos:manage');
  const canChange = manager || booking.bookedByUid === uid && access.actions.includes('demos:book') || booking.presenterUid === uid && access.actions.includes('demos:present');
  const confirmed = booking.status === 'confirmed';
  const canOutcome = (manager || booking.presenterUid === uid && access.actions.includes('demos:present')) && booking.endAt <= new Date().toISOString();
  return <>
    <p className="demo-eyebrow">{booking.status.replaceAll('_', ' ')} · {booking.mode === 'online' ? 'Online meeting' : 'On-site meeting'}</p><h3>{booking.clientName}</h3><p className="demo-detail-time">{formatDemoDate(booking.date, { weekday: 'long', year: 'numeric' })}<br />{formatDemoTime(booking.startAt)}–{formatDemoTime(booking.endAt)} PHT</p>
    <dl className="demo-detail-grid"><dt>Demonstration</dt><dd>{booking.topic}</dd><dt>Presenter</dt><dd>{booking.presenterName}</dd><dt>Booked by</dt><dd>{booking.bookedByName}</dd><dt>Contact</dt><dd>{booking.contactName}{booking.contactEmail && <span>{booking.contactEmail}</span>}{booking.contactPhone && <span>{booking.contactPhone}</span>}</dd><dt>{booking.mode === 'online' ? 'Meeting link' : 'Location'}</dt><dd>{booking.mode === 'online' && /^https:\/\//i.test(booking.location) ? <a href={booking.location} target="_blank" rel="noopener noreferrer">Open meeting <ArrowSquareOut size={15} /></a> : booking.location}</dd><dt>Preparation</dt><dd className="demo-preserve-lines">{booking.notes || 'No preparation notes.'}</dd>{booking.outcomeNotes && <><dt>Outcome notes</dt><dd className="demo-preserve-lines">{booking.outcomeNotes}</dd></>}</dl>
    {confirmed && canChange && <div className="demo-inline-actions demo-detail-actions">{booking.startAt > new Date().toISOString() && <button onClick={() => onAction('reschedule', booking)}>Reschedule / reassign</button>}<button onClick={() => onAction('cancel', booking)}>Cancel demonstration</button>{canOutcome && <><button onClick={() => onAction('complete', booking)}>Mark completed</button><button onClick={() => onAction('noShow', booking)}>Mark no-show</button></>}</div>}
    <h4 className="demo-form-divider">Change history</h4>{events.length === 0 && <p className="demo-helper">No recorded changes.</p>}{events.map(event => <div className="demo-history-event" key={event.id}><strong>{event.command === 'book' ? 'Booked' : event.command === 'noShow' ? 'Marked no-show' : event.command === 'complete' ? 'Completed' : event.command === 'cancel' ? 'Cancelled' : 'Rescheduled'}</strong><small>{event.actorName} · {new Date(event.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</small>{event.before && event.after && event.command === 'reschedule' && <p>{event.before.date} {event.before.time} · {event.before.presenterName}<br />→ {event.after.date} {event.after.time} · {event.after.presenterName}</p>}</div>)}
  </>;
}

export function DemoOutcomeForm({ booking, command, busy, onSave }) {
  const [notes, setNotes] = useState('');
  const label = command === 'cancel' ? 'Cancel demonstration' : command === 'complete' ? 'Mark completed' : 'Mark no-show';
  return <form onSubmit={e => { e.preventDefault(); onSave(command, { id: booking.id, version: booking.version, notes }); }}><p>{booking.clientName} · {formatDemoDate(booking.date)} · {formatDemoTime(booking.startAt)} PHT</p><p className="demo-helper">{command === 'cancel' ? 'The reserved time will become available again. The presenter and salesperson will be notified.' : 'Record the meeting outcome and any follow-up for the sales team.'}</p><DemoField label={command === 'cancel' ? 'Cancellation reason (optional)' : 'Outcome and follow-up notes'}><textarea value={notes} maxLength={2000} disabled={busy} onChange={e => setNotes(e.target.value)} /></DemoField><LoadingButton className="demo-primary" type="submit" loading={busy} loadingLabel="Saving…">{label}</LoadingButton></form>;
}
