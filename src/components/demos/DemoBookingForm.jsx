import { useEffect, useState, useId, cloneElement } from 'react';
import { CalendarBlank, ArrowRight, Clock } from '@phosphor-icons/react';
import { getDemoSlots, demoError } from '../../services/demoService';
import { demoToday, shiftDemoDate, formatDemoTime } from '../../utils/demoScheduling';

export function DemoField({ label, helper, children }) {
  const id = useId();
  return <div className="demo-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-describedby': helper ? `${id}-helper` : undefined })}{helper && <small id={`${id}-helper`}>{helper}</small>}</div>;
}

export default function DemoBookingForm({ policy, presenters, clients, booking, busy, onSave }) {
  const [date, setDate] = useState(booking?.date || demoToday());
  const [duration, setDuration] = useState(policy.durations.includes(booking?.duration) ? booking.duration : policy.durations.includes(60) ? 60 : policy.durations[0]);
  const [presenterUid, setPresenterUid] = useState(booking?.presenterUid || '');
  const [chosen, setChosen] = useState(null);
  const [slots, setSlots] = useState({ key: '', loading: true, rows: [], error: '' });
  const [refresh, setRefresh] = useState(0);
  const [client, setClient] = useState({ clientId: '', clientName: '', contactName: '', contactEmail: '', contactPhone: '', topic: '', mode: 'online', location: '', notes: '' });
  const [validation, setValidation] = useState('');
  const slotKey = JSON.stringify({ date, duration, presenterUid, refresh });
  const selection = chosen?.key === slotKey ? chosen : null;
  useEffect(() => {
    let disposed = false;
    getDemoSlots({ date, duration, ...(presenterUid ? { presenterUid } : {}), ...(booking ? { bookingId: booking.id } : {}) }).then(data => {
      const times = new Map();
      for (const person of data.presenters) for (const slot of person.slots) {
        // Backend orders presenters by their load, so Any presenter picks the first eligible one.
        if (!times.has(slot.time)) times.set(slot.time, { ...slot, presenterUid: person.uid, presenterName: person.name });
      }
      if (!disposed) setSlots({ key: slotKey, loading: false, rows: [...times.values()].sort((a, b) => a.time.localeCompare(b.time)), error: '' });
    }).catch(error => { if (!disposed) setSlots({ key: slotKey, loading: false, rows: [], error: demoError(error) }); });
    return () => { disposed = true; };
  }, [date, duration, presenterUid, booking, slotKey]);
  const loadingSlots = slots.key !== slotKey || slots.loading;
  const set = (key, value) => setClient(c => ({ ...c, [key]: value }));
  const chooseClient = id => {
    const selected = clients.find(c => c.id === id);
    setClient(c => ({ ...c, clientId: id, clientName: selected?.name || '', contactName: selected?.contactName || '', contactEmail: selected?.email || '', contactPhone: selected?.phone || '' }));
  };
  const submit = event => {
    event.preventDefault(); setValidation('');
    if (!selection) { setValidation('Select an available time before confirming.'); return; }
    if (!booking && !client.contactEmail && !client.contactPhone) { setValidation('Provide a client contact email or phone.'); return; }
    onSave(booking ? 'reschedule' : 'book', { ...(booking ? { id: booking.id, version: booking.version } : client), date, duration, time: selection.time, presenterUid: selection.presenterUid });
  };
  return <form onSubmit={submit}>
    <fieldset disabled={busy}>
      {booking && <p className="demo-helper">Rescheduling {booking.clientName}. The original booking stays reserved until a replacement is confirmed.</p>}
      <div className="demo-form-grid">
        <DemoField label="Date · Philippine time"><input type="date" value={date} min={demoToday()} max={shiftDemoDate(demoToday(), policy.bookingWindowDays)} onChange={e => setDate(e.target.value)} required /></DemoField>
        <DemoField label="Duration"><select value={duration} onChange={e => setDuration(Number(e.target.value))}>{policy.durations.map(value => <option key={value} value={value}>{value} minutes</option>)}</select></DemoField>
      </div>
      <DemoField label="Presenter"><select value={presenterUid} onChange={e => setPresenterUid(e.target.value)}><option value="">Any available presenter</option>{presenters.map(p => <option key={p.uid} value={p.uid}>{p.name}</option>)}</select></DemoField>
      <div className="demo-slot-heading"><h4><Clock size={17} /> Available times</h4><button type="button" onClick={() => setRefresh(v => v + 1)}>Refresh times</button></div>
      <p className="demo-helper">Includes {policy.bufferMinutes} minutes after the meeting for preparation. Times shown in PHT (UTC+8).</p>
      {loadingSlots ? <div className="demo-skeleton" role="status" aria-label="Finding available times" /> : slots.error ? <p className="demo-error" role="alert">{slots.error}</p> : slots.rows.length === 0 ? <div className="demo-empty demo-empty-small"><CalendarBlank size={26} /><p>No available times. Choose another date or presenter.</p></div> : <div className="demo-slot-grid">{slots.rows.map(slot => <button type="button" key={slot.time} aria-pressed={selection?.time === slot.time} onClick={() => setChosen({ ...slot, key: slotKey })}>{formatDemoTime(slot.startAt)}</button>)}</div>}
      {selection && <p className="demo-selection" role="status">{formatDemoTime(selection.startAt)}–{formatDemoTime(selection.endAt)} · {selection.presenterName}</p>}
      {!booking && <>
        <h4 className="demo-form-divider">Client and meeting details</h4>
        <DemoField label="Existing client (optional)" helper="Choose from the first 100 client records, or enter a new prospect below."><select value={client.clientId} onChange={e => chooseClient(e.target.value)}><option value="">Enter a client or prospect</option>{clients.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></DemoField>
        <div className="demo-form-grid">
          <DemoField label="Client / company"><input value={client.clientName} onChange={e => set('clientName', e.target.value)} required maxLength={200} /></DemoField>
          <DemoField label="Contact person"><input value={client.contactName} onChange={e => set('contactName', e.target.value)} required maxLength={200} /></DemoField>
          <DemoField label="Contact email"><input type="email" value={client.contactEmail} onChange={e => set('contactEmail', e.target.value)} maxLength={254} /></DemoField>
          <DemoField label="Contact phone"><input type="tel" value={client.contactPhone} onChange={e => set('contactPhone', e.target.value)} maxLength={60} /></DemoField>
        </div>
        <DemoField label="System / demonstration topic"><input value={client.topic} onChange={e => set('topic', e.target.value)} required maxLength={300} /></DemoField>
        <DemoField label="Meeting type"><select value={client.mode} onChange={e => setClient(c => ({ ...c, mode: e.target.value, location: '' }))}><option value="online">Online</option><option value="onsite">On-site</option></select></DemoField>
        <DemoField label={client.mode === 'online' ? 'Meeting link (HTTPS)' : 'Meeting address'}><input type={client.mode === 'online' ? 'url' : 'text'} value={client.location} onChange={e => set('location', e.target.value)} required maxLength={1000} /></DemoField>
        <DemoField label="Preparation notes"><textarea value={client.notes} onChange={e => set('notes', e.target.value)} maxLength={3000} placeholder="Client needs, features to demonstrate, and anything the presenter should prepare." /></DemoField>
      </>}
    </fieldset>
    {validation && <p className="demo-error" role="alert">{validation}</p>}
    <div className="demo-form-footer"><span className="demo-helper">{booking ? 'Both teams will receive the update.' : 'The presenter and salesperson will be notified.'}</span><button className="demo-primary" disabled={busy || !selection || loadingSlots} type="submit">{busy ? 'Saving…' : booking ? 'Confirm new schedule' : 'Confirm demonstration'}<ArrowRight size={16} /></button></div>
  </form>;
}
