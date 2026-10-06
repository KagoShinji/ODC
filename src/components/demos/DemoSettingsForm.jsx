import { useState } from 'react';
import { DemoField } from './DemoBookingForm';
import LoadingButton from '../ui/LoadingButton';

function DemoPolicyForm({ context, busy, onSave }) {
  const [policy, setPolicy] = useState(context.policy);
  const [enabled, setEnabled] = useState(context.enabled);
  const set = (key, value) => setPolicy(p => ({ ...p, [key]: Number(value) }));
  return <form onSubmit={e => { e.preventDefault(); onSave('saveSettings', { enabled, policy }); }}>
    <h3>Booking rules</h3><label className="demo-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} disabled={busy} /> Allow new bookings and rescheduling</label>
    <div className="demo-form-grid">
      <DemoField label="Buffer after a demonstration"><select value={policy.bufferMinutes} onChange={e => set('bufferMinutes', e.target.value)} disabled={busy}>{[0, 15, 30, 45, 60].map(value => <option value={value} key={value}>{value} minutes</option>)}</select></DemoField>
      <DemoField label="Minimum advance notice (minutes)"><input type="number" min="0" max="10080" value={policy.minimumNoticeMinutes} onChange={e => set('minimumNoticeMinutes', e.target.value)} disabled={busy} required /></DemoField>
      <DemoField label="Booking window (days)"><input type="number" min="1" max="90" value={policy.bookingWindowDays} onChange={e => set('bookingWindowDays', e.target.value)} disabled={busy} required /></DemoField>
    </div>
    <p className="demo-helper">Allowed durations</p><div className="demo-inline-checks">{[30, 45, 60, 90, 120].map(value => <label className="demo-check" key={value}><input type="checkbox" disabled={busy} checked={policy.durations.includes(value)} onChange={e => setPolicy(p => ({ ...p, durations: e.target.checked ? [...p.durations, value].sort((a, b) => a - b) : p.durations.filter(v => v !== value) }))} />{value} min</label>)}</div>
    <LoadingButton type="submit" className="demo-primary" loading={busy} loadingLabel="Saving…" disabled={policy.durations.length === 0}>Save booking rules</LoadingButton>
  </form>;
}

export default function DemoSettingsForm({ context, busy, onSave, onOpenStaff }) {
  return <div className="demo-settings-layout">
    <div><DemoPolicyForm context={context} busy={busy} onSave={onSave} />
      <article className="demo-self-presenter"><h3>Your presenter profile</h3><p className="demo-helper">Administrators can also conduct demonstrations. Enable your profile, then publish your hours in My availability.</p><LoadingButton loading={busy} loadingLabel="Updating…" onClick={() => onSave('setMyPresenter', { presenterEnabled: !context.access.presenterEnabled })}>{context.access.presenterEnabled ? 'Disable my presenter profile' : 'Enable my presenter profile'}</LoadingButton></article>
    </div>
    <article><h3>Staff permissions</h3><p className="demo-helper">Manage sales booking, presenter access, and available presenters in Staff Management → Create/Edit Staff → Page &amp; Action Permissions → Demo Scheduling.</p>{onOpenStaff ? <button type="button" disabled={busy} onClick={onOpenStaff}>Open Staff Management</button> : <p className="demo-helper">Ask an administrator with Staff Management access to update staff permissions.</p>}</article>
  </div>;
}
