import { useEffect, useState } from 'react';
import { Pencil, Phone, Mail, Globe, MapPin, User, Link2, ListPlus } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';
import { StagePill } from './SalesUi';
import LeadForm from './LeadForm';
import {
  SALES_STAGES, OPEN_STAGES, LOST_REASONS, ACTIVITY_TYPES, activityLabel, lostReasonLabel, stageLabel, formatPeso, localDateKey, zonedTime,
} from '../../../functions/src/salesDomain.js';
import {
  subscribeLead, subscribeLeadActivities, getDeal, moveLeadStage, logActivity, assignLead, reviewDuplicate, setQualification,
  requestConversion, applyAutomation, ensureLeadTask, endorseToDeveloper, suggestedTask,
} from '../../services/salesService';
import { errorText, formatWhen, formatDay } from '../../utils/salesFormat';

const CONVERSION_LABELS = { pending: 'Conversion awaiting confirmation', confirmed: 'Payment confirmed', rejected: 'Conversion returned' };

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={`lead-${id}`} className="sales-section">
      <h4 id={`lead-${id}`}>{title}</h4>
      {children}
    </section>
  );
}

function StageMover({ lead, busy, onMove }) {
  const options = SALES_STAGES.filter(s => s.id !== lead.stage && s.id !== 'converted');
  const [to, setTo] = useState(options[0]?.id || '');
  const [lostReason, setLostReason] = useState('');
  const [lostNotes, setLostNotes] = useState('');
  return (
    <form className="sales-inline-form" onSubmit={e => { e.preventDefault(); onMove(to, { lostReason, lostNotes }); }}>
      <label className="task-field">
        <span>Move to</span>
        <select value={to} onChange={e => setTo(e.target.value)}>{options.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </label>
      {to === 'lost' && (
        <>
          <label className="task-field">
            <span>Reason lost</span>
            <select required value={lostReason} onChange={e => setLostReason(e.target.value)}>
              <option value="">Choose…</option>
              {LOST_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <label className="task-field sales-span">
            <span>Notes {lostReason === 'other' ? '' : <small>(optional)</small>}</span>
            <textarea maxLength={1000} value={lostNotes} onChange={e => setLostNotes(e.target.value)} />
          </label>
        </>
      )}
      <p className="task-muted sales-span">Converted is set automatically once management confirms the client's down payment.</p>
      <LoadingButton type="submit" loading={busy} loadingLabel="Saving…" className={to === 'lost' ? 'task-danger' : 'task-primary'}>
        {to === 'lost' ? 'Mark as lost' : `Move to ${stageLabel(to)}`}
      </LoadingButton>
    </form>
  );
}

function ActivityForm({ lead, settings, busy, onLog }) {
  const [type, setType] = useState(lead.stage === 'new' ? 'initial_contact' : 'follow_up');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [followUp, setFollowUp] = useState('');
  const outreach = ACTIVITY_TYPES.find(a => a.id === type)?.outreach;
  const [advance, setAdvance] = useState(true);
  const advanceTo = lead.stage === 'new' && outreach ? 'contacted'
    : lead.stage === 'interested' && type === 'consultation_scheduled' ? 'consultation'
      : ['consultation', 'interested'].includes(lead.stage) && type === 'quotation_sent' ? 'quotation' : '';
  const submit = async e => {
    e.preventDefault();
    const scheduled = scheduledAt ? zonedTime(scheduledAt.slice(0, 10), settings.timezone, Number(scheduledAt.slice(11, 13)), Number(scheduledAt.slice(14, 16))) : null;
    if (await onLog({ type, notes, scheduledAt: scheduled, nextFollowUpAt: followUp || undefined, advanceTo: advance ? advanceTo : '' })) { setNotes(''); setScheduledAt(''); setFollowUp(''); }
  };
  return (
    <form className="sales-inline-form" onSubmit={submit}>
      <label className="task-field">
        <span>What happened</span>
        <select value={type} onChange={e => setType(e.target.value)}>{ACTIVITY_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      </label>
      <label className="task-field">
        <span>Next follow-up <small>(optional)</small></span>
        <input type="date" value={followUp} min={localDateKey(new Date(), settings.timezone)} onChange={e => setFollowUp(e.target.value)} />
      </label>
      {type === 'consultation_scheduled' && (
        <label className="task-field">
          <span>Consultation date & time ({settings.timezone})</span>
          <input type="datetime-local" required value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </label>
      )}
      <label className="task-field sales-span">
        <span>Notes {type === 'note' ? '' : <small>(recommended)</small>}</span>
        <textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What was said, objections, agreed next step…" />
      </label>
      {advanceTo && (
        <label className="task-assignee-option sales-span">
          <input type="checkbox" checked={advance} onChange={e => setAdvance(e.target.checked)} />
          <span>Also move the lead to {stageLabel(advanceTo)}</span>
        </label>
      )}
      <p className="task-muted sales-span">Log only what you actually did — this records the interaction, it does not send any message.</p>
      <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Saving…">Record activity</LoadingButton>
    </form>
  );
}

function ConversionForm({ busy, deal, onSubmit }) {
  const peso = c => (c ? String(c / 100) : '');
  const [form, setForm] = useState({
    service: deal?.service || '', quoted: peso(deal?.quotedCentavos), final: peso(deal?.finalCentavos), downPayment: peso(deal?.downPaymentCentavos),
    paymentDate: deal?.paymentDate || '', paymentReference: deal?.paymentReference || '', notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <form className="sales-inline-form" onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <label className="task-field sales-span"><span>Service purchased</span><input required maxLength={200} value={form.service} onChange={e => set('service', e.target.value)} placeholder="e.g. Court booking system + website" /></label>
      <label className="task-field"><span>Quoted project value (₱)</span><input required inputMode="decimal" value={form.quoted} onChange={e => set('quoted', e.target.value)} /></label>
      <label className="task-field"><span>Final agreed amount (₱) <small>(optional)</small></span><input inputMode="decimal" value={form.final} onChange={e => set('final', e.target.value)} /></label>
      <label className="task-field"><span>Down payment received (₱) <small>(if known)</small></span><input inputMode="decimal" value={form.downPayment} onChange={e => set('downPayment', e.target.value)} /></label>
      <label className="task-field"><span>Payment date <small>(if known)</small></span><input type="date" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} /></label>
      <label className="task-field"><span>Payment reference <small>(optional)</small></span><input maxLength={120} value={form.paymentReference} onChange={e => set('paymentReference', e.target.value)} /></label>
      <label className="task-field sales-span"><span>Notes for management <small>(optional)</small></span><textarea maxLength={1000} value={form.notes} onChange={e => set('notes', e.target.value)} /></label>
      <p className="task-muted sales-span">The lead counts as converted only after management verifies the down payment.</p>
      <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Submitting…">Submit for confirmation</LoadingButton>
    </form>
  );
}

function EndorseForm({ staff, settings, busy, onSubmit }) {
  const [email, setEmail] = useState('');
  const [dueDate, setDueDate] = useState(() => localDateKey(Date.now() + 2 * 86400000, settings.timezone));
  const [notes, setNotes] = useState('');
  return (
    <form className="sales-inline-form" onSubmit={e => { e.preventDefault(); onSubmit(staff.all.find(s => s.email === email), { notes, dueDate }); }}>
      <label className="task-field">
        <span>Developer / presenter</span>
        <select required value={email} onChange={e => setEmail(e.target.value)}>
          <option value="">Choose…</option>
          {staff.all.map(s => <option key={s.email} value={s.email}>{s.name}{s.role ? ` — ${s.role}` : ''}</option>)}
        </select>
      </label>
      <label className="task-field"><span>Ready by</span><input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
      <label className="task-field sales-span"><span>What the prospect wants to see</span><textarea maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <p className="task-muted sales-span">Creates a Sales task on the developer's task board. Book the meeting itself in Demo Scheduling.</p>
      <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Endorsing…">Endorse to developer</LoadingButton>
    </form>
  );
}

function Timeline({ items, timeZone }) {
  if (!items.length) return <p className="task-muted">No activity recorded yet.</p>;
  return (
    <ol className="task-activity sales-timeline">
      {items.map(item => (
        <li key={item.id} className={`sales-timeline-${item.type}`}>
          <p><strong>{item.byName}</strong> — {activityLabel(item.type)}{item.detail ? `: ${item.detail}` : ''}</p>
          {item.scheduledAt && <p className="task-muted">Scheduled for {formatWhen(item.scheduledAt, timeZone)}</p>}
          {item.notes && <p className="task-activity-note">{item.notes}</p>}
          <small>{formatWhen(item.at, timeZone)}</small>
        </li>
      ))}
    </ol>
  );
}

/** Full lead record: details, workflow actions and the activity timeline. */
export default function LeadDetail({ ctx, leadId, initialNotice = '', onChanged }) {
  const { user, role, settings, staff } = ctx;
  const [lead, setLead] = useState(undefined);
  const [items, setItems] = useState([]);
  const [deal, setDeal] = useState(null);
  const [panel, setPanel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice);
  const [suggestion, setSuggestion] = useState(null);
  const [assignTo, setAssignTo] = useState('');
  const [reason, setReason] = useState('');
  const [dealVersion, setDealVersion] = useState(0);

  useEffect(() => subscribeLead(leadId, setLead, err => setError(errorText(err))), [leadId]);
  useEffect(() => subscribeLeadActivities(leadId, setItems, err => setError(errorText(err))), [leadId]);
  useEffect(() => { getDeal(leadId).then(setDeal).catch(() => setDeal(null)); }, [leadId, dealVersion, lead?.conversionStatus]);

  if (lead === undefined) return <div className="task-skeleton" role="status" aria-label="Loading lead" />;
  if (lead === null) return <p className="task-error" role="alert">{error || 'This lead is not available to you.'}</p>;

  const tz = settings.timezone;
  const mine = lead.ownerEmail === ctx.myEmail;
  const canWork = role.isManager || mine;
  const open = OPEN_STAGES.includes(lead.stage);
  const canRequest = canWork && ['quotation', 'negotiation'].includes(lead.stage) && ['none', 'rejected'].includes(lead.conversionStatus);

  const run = async (work, success) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await work();
      if (success) setNotice(typeof success === 'function' ? success(result) : success);
      onChanged?.();
      return result ?? true;
    } catch (err) { setError(errorText(err)); return false; } finally { setBusy(false); }
  };
  const afterStage = async (updated, stage) => {
    const automation = await applyAutomation(user, updated, stage, settings);
    if (automation.status === 'created') return `Moved to ${stageLabel(stage)}. Task “${automation.task.title}” was added to the task board.`;
    if (automation.status === 'suggested') setSuggestion(automation.task);
    else setSuggestion(null);
    return `Moved to ${stageLabel(stage)}.`;
  };

  const move = (to, options) => run(async () => {
    const updated = await moveLeadStage(user, lead.id, to, options);
    setPanel('');
    return afterStage(updated, to);
  }, msg => msg);
  const log = values => run(async () => {
    const updated = await logActivity(user, lead.id, values, settings, staff);
    if (values.advanceTo && values.advanceTo !== lead.stage) return afterStage(updated, values.advanceTo);
    return 'Activity recorded.';
  }, msg => msg);

  if (panel === 'edit') {
    return <LeadForm ctx={ctx} lead={lead} onCancel={() => setPanel('')} onSaved={({ message }) => { setPanel(''); setNotice(message); onChanged?.(); }} />;
  }

  const channel = (Icon, value, href) => value ? <li><Icon size={14} aria-hidden="true" />{href ? <a href={href} target="_blank" rel="noreferrer noopener">{value}</a> : value}</li> : null;
  const tabs = [
    open && canWork && ['activity', 'Log activity'],
    canWork && lead.stage !== 'converted' && lead.conversionStatus !== 'pending' && ['stage', 'Change stage'],
    canRequest && ['conversion', lead.conversionStatus === 'rejected' ? 'Resubmit conversion' : 'Request conversion'],
    open && canWork && ['endorse', 'Endorse to developer'],
    role.isManager && open && ['assign', 'Reassign'],
    role.isManager && ['qualify', lead.qualified === false ? 'Mark qualified' : 'Disqualify'],
  ].filter(Boolean);

  return (
    <div className="task-detail sales-lead-detail">
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="sales-notice" role="status">{notice}</p>}
      <div className="task-detail-pills">
        <StagePill stage={lead.stage} />
        {lead.conversionStatus !== 'none' && <span className={`task-pill sales-conv-${lead.conversionStatus}`}>{CONVERSION_LABELS[lead.conversionStatus]}</span>}
        {lead.duplicateStatus === 'pending_review' && <span className="task-pill sales-flag">Possible duplicate</span>}
        {lead.duplicateStatus === 'duplicate' && <span className="task-pill sales-flag">Duplicate — excluded</span>}
        {lead.qualified === false && <span className="task-pill sales-flag">Not qualified — excluded</span>}
        {canWork && <button type="button" className="sales-push" onClick={() => setPanel('edit')}><Pencil size={13} /> Edit details</button>}
      </div>

      {suggestion && canWork && (
        <div className="sales-suggestion" role="status">
          <span><ListPlus size={15} aria-hidden="true" /> Suggested next task: <strong>{suggestion.title}</strong> (due {formatDay(suggestion.dueAt, tz)})</span>
          <span className="task-inline">
            <button type="button" onClick={() => setSuggestion(null)} disabled={busy}>Dismiss</button>
            <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Adding…" onClick={() => run(async () => {
              const status = await ensureLeadTask(user, lead, suggestion);
              setSuggestion(null);
              return status === 'exists' ? 'An open task for this step already exists on the task board.' : 'Task added to the task board.';
            }, m => m)}>Add to task board</LoadingButton>
          </span>
        </div>
      )}

      <dl className="task-detail-grid">
        <dt>Industry</dt><dd>{lead.industry}</dd>
        <dt>Assigned to</dt><dd>{lead.ownerName || lead.ownerEmail}{lead.attributedEmail !== lead.ownerEmail && <span>KPI credit: {lead.attributedName || lead.attributedEmail}</span>}</dd>
        <dt>Source</dt><dd>{lead.source}</dd>
        <dt>Added</dt><dd>{formatWhen(lead.createdAt, tz)}<span>by {lead.createdByName}</span></dd>
        <dt>Next follow-up</dt><dd>{lead.nextFollowUpAt ? formatDay(lead.nextFollowUpAt, tz) : '—'}</dd>
        {lead.stage === 'lost' && <><dt>Lost reason</dt><dd>{lostReasonLabel(lead.lostReason)}{lead.lostNotes && <span>{lead.lostNotes}</span>}</dd></>}
        {lead.qualified === false && <><dt>Not qualified</dt><dd>{lead.disqualifyReason}</dd></>}
      </dl>
      <ul className="sales-channels">
        {channel(User, lead.contactName)}
        {channel(Phone, lead.contactNumber, `tel:${lead.contactNumber}`)}
        {channel(Mail, lead.email, `mailto:${lead.email}`)}
        {channel(Link2, lead.facebookUrl, lead.facebookUrl)}
        {channel(Globe, lead.websiteUrl, lead.websiteUrl)}
        {channel(MapPin, lead.location)}
      </ul>
      {lead.notes && <p className="task-description">{lead.notes}</p>}

      {role.isManager && lead.duplicateStatus === 'pending_review' && (
        <Section id="dup" title="Duplicate review">
          <p className="task-muted">Saved while matching {lead.possibleDuplicateOf.length} existing lead(s) by name, phone, website, Facebook page or email. Confirmed duplicates are kept for history but excluded from targets.</p>
          <div className="task-inline">
            <LoadingButton type="button" loading={busy} onClick={() => run(() => reviewDuplicate(user, lead.id, 'not_duplicate'), 'Marked as not a duplicate.')}>Not a duplicate</LoadingButton>
            <LoadingButton type="button" className="task-danger" loading={busy} onClick={() => run(() => reviewDuplicate(user, lead.id, 'duplicate'), 'Confirmed as duplicate and excluded from KPIs.')}>Confirm duplicate</LoadingButton>
          </div>
        </Section>
      )}

      {deal && (
        <Section id="deal" title="Deal">
          <dl className="task-detail-grid">
            <dt>Service</dt><dd>{deal.service}</dd>
            <dt>Quoted</dt><dd>{formatPeso(deal.quotedCentavos)}</dd>
            {deal.finalCentavos > 0 && <><dt>Final amount</dt><dd>{formatPeso(deal.finalCentavos)}</dd></>}
            {deal.downPaymentCentavos > 0 && <><dt>Down payment</dt><dd>{formatPeso(deal.downPaymentCentavos)}<span>{deal.paymentDate}{deal.paymentReference ? ` · ref ${deal.paymentReference}` : ''}</span></dd></>}
            <dt>Status</dt><dd>{deal.status === 'confirmed' ? `Confirmed by ${deal.reviewedByName}` : deal.status === 'rejected' ? `Returned by ${deal.reviewedByName}` : `Awaiting confirmation (submitted by ${deal.submittedByName})`}{deal.reviewNotes && <span>{deal.reviewNotes}</span>}</dd>
          </dl>
        </Section>
      )}

      {tabs.length > 0 && (
        <Section id="actions" title="Actions">
          <div className="task-status-picker" role="group" aria-label="Lead actions">
            {tabs.map(([id, label]) => <button type="button" key={id} aria-pressed={panel === id} onClick={() => { setPanel(panel === id ? '' : id); setError(''); }}>{label}</button>)}
          </div>
          {panel === 'activity' && <ActivityForm lead={lead} settings={settings} busy={busy} onLog={log} />}
          {panel === 'stage' && <StageMover lead={lead} busy={busy} onMove={move} />}
          {panel === 'conversion' && (
            <ConversionForm busy={busy} deal={deal} onSubmit={form => run(async () => {
              await requestConversion(user, lead.id, form, staff);
              setPanel(''); setDealVersion(v => v + 1);
            }, 'Conversion submitted. Management will verify the down payment before it counts.')} />
          )}
          {panel === 'endorse' && (
            <EndorseForm staff={staff} settings={settings} busy={busy} onSubmit={(developer, values) => run(async () => {
              const status = await endorseToDeveloper(user, lead, developer, values, settings);
              setPanel('');
              return status === 'exists' ? 'This lead already has an open developer endorsement on the task board.' : `Endorsed to ${developer.name}. The task is on their board.`;
            }, m => m)} />
          )}
          {panel === 'assign' && (
            <form className="sales-inline-form" onSubmit={e => { e.preventDefault(); run(async () => { await assignLead(user, lead.id, staff.sales.find(s => s.email === assignTo)); setPanel(''); }, 'Lead reassigned. Open sales tasks moved to the new owner.'); }}>
              <label className="task-field">
                <span>New owner</span>
                <select required value={assignTo} onChange={e => setAssignTo(e.target.value)}>
                  <option value="">Choose…</option>
                  {staff.sales.filter(s => s.email !== lead.ownerEmail).map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
                </select>
              </label>
              <p className="task-muted sales-span">KPI credit stays with {lead.attributedName || lead.attributedEmail}, who generated the lead.</p>
              <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Reassigning…">Reassign lead</LoadingButton>
            </form>
          )}
          {panel === 'qualify' && (
            <form className="sales-inline-form" onSubmit={e => { e.preventDefault(); run(async () => { await setQualification(user, lead.id, lead.qualified === false, reason); setPanel(''); setReason(''); }, lead.qualified === false ? 'Lead marked qualified.' : 'Lead marked not qualified and excluded from KPIs.'); }}>
              {lead.qualified !== false && (
                <label className="task-field sales-span"><span>Why is this lead not relevant to ODC?</span><textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
              )}
              <LoadingButton type="submit" className={lead.qualified === false ? 'task-primary' : 'task-danger'} loading={busy} loadingLabel="Saving…">{lead.qualified === false ? 'Mark qualified' : 'Disqualify lead'}</LoadingButton>
            </form>
          )}
        </Section>
      )}

      {open && canWork && !suggestion && suggestedTask(lead, lead.stage, settings) && (
        <p className="task-muted">
          <button type="button" className="sales-link" disabled={busy} onClick={() => setSuggestion(suggestedTask(lead, lead.stage, settings))}>Create the next task for this stage</button>
        </p>
      )}

      <Section id="timeline" title={`Activity history (${items.length})`}>
        <Timeline items={items} timeZone={tz} />
      </Section>
    </div>
  );
}
