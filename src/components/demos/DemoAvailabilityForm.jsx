import { useState } from 'react';
import { Plus, X, CalendarX } from '@phosphor-icons/react';
import { DemoField } from './DemoBookingForm';
import { DEMO_DAYS, defaultDemoWeekly, demoToday, formatDemoDate } from '../../utils/demoScheduling';
import LoadingButton from '../ui/LoadingButton';

function AvailabilityWindows({ ranges, onChange, disabled, label }) {
  const update = (index, key, value) => onChange(ranges.map((range, i) => i === index ? { ...range, [key]: value } : range));
  return <div className="demo-windows">
    {ranges.length === 0 && <span className="demo-helper">Unavailable</span>}
    {ranges.map((range, index) => <div className="demo-window" key={index}>
      <input aria-label={`${label} window ${index + 1} start`} type="time" step="900" value={range.start} onChange={e => update(index, 'start', e.target.value)} disabled={disabled} required />
      <span>to</span><input aria-label={`${label} window ${index + 1} end`} type="time" step="900" value={range.end} onChange={e => update(index, 'end', e.target.value)} disabled={disabled} required />
      <button aria-label={`Remove ${label} window ${index + 1}`} type="button" disabled={disabled} onClick={() => onChange(ranges.filter((_, i) => i !== index))}><X size={15} /></button>
    </div>)}
    {ranges.length < 4 && <button type="button" disabled={disabled} onClick={() => onChange([...ranges, { start: ranges.length ? ranges.at(-1).end : '09:00', end: ranges.length ? '17:00' : '12:00' }])}><Plus size={14} /> Add window</button>}
  </div>;
}

export default function DemoAvailabilityForm({ uid, availability, busy, onSave }) {
  const published = Object.keys(availability?.weekly || {}).length > 0;
  const [weekly, setWeekly] = useState(() => published ? availability.weekly : defaultDemoWeekly());
  const [overrides, setOverrides] = useState(() => availability?.overrides || {});
  const [date, setDate] = useState(demoToday());
  const [mode, setMode] = useState('closed');
  const [ranges, setRanges] = useState([{ start: '09:00', end: '12:00' }]);
  const [notice, setNotice] = useState('');
  const addOverride = () => {
    if (!date) return;
    setOverrides(values => ({ ...values, [date]: mode === 'closed' ? [] : ranges }));
    setNotice(`${formatDemoDate(date)} added to your draft. Publish availability to apply it.`);
  };
  return <form onSubmit={e => { e.preventDefault(); onSave('saveAvailability', { presenterUid: uid, availability: { weekly, overrides } }); }}>
    <div className="demo-availability-layout">
      <div>
        <h3>Weekly availability</h3><p className="demo-helper">Publish the hours sales may book. All times are Philippine time (UTC+8).</p>
        {!published && <p className="demo-notice">These suggested hours are unpublished. Review and save them to start receiving bookings.</p>}
        {DEMO_DAYS.map((day, index) => <div className="demo-weekly-row" key={day}><strong>{day}</strong><AvailabilityWindows label={day} ranges={weekly[index] || []} disabled={busy} onChange={value => setWeekly(w => ({ ...w, [index]: value }))} /></div>)}
      </div>
      <div className="demo-date-overrides">
        <h3>Changes for a specific date</h3><p className="demo-helper">Close a day or replace its usual hours. To block part of a day, enter only the windows when you are available.</p>
        <DemoField label="Date"><input type="date" min={demoToday()} value={date} onChange={e => setDate(e.target.value)} disabled={busy} /></DemoField>
        <DemoField label="Availability for this date"><select value={mode} onChange={e => setMode(e.target.value)} disabled={busy}><option value="closed">Close the entire day</option><option value="custom">Set available hours</option></select></DemoField>
        {mode === 'custom' && <AvailabilityWindows label="Date override" ranges={ranges} disabled={busy} onChange={setRanges} />}
        <button type="button" onClick={addOverride} disabled={busy || !date || mode === 'custom' && ranges.length === 0}><CalendarX size={16} /> Add date change</button>
        {notice && <p className="demo-helper" role="status">{notice}</p>}
        <div className="demo-overrides-list">{Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)).map(([key, windows]) => <div className="demo-override" key={key}><div><strong>{formatDemoDate(key, { year: 'numeric' })}</strong><small>{windows.length ? windows.map(r => `${r.start}–${r.end}`).join(', ') : 'Closed all day'}</small></div><button type="button" aria-label={`Remove override for ${key}`} disabled={busy} onClick={() => setOverrides(values => Object.fromEntries(Object.entries(values).filter(([d]) => d !== key)))}><X size={15} /></button></div>)}</div>
      </div>
    </div>
    <div className="demo-form-footer"><p className="demo-helper">Existing meetings are protected. Reassign or reschedule conflicts before closing their time.</p><LoadingButton type="submit" className="demo-primary" loading={busy} loadingLabel="Publishing…">Publish availability</LoadingButton></div>
  </form>;
}
