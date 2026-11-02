import { useEffect, useMemo, useState } from 'react';
import { Columns3, List, KanbanSquare, ListPlus } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';
import { SalesDialog, StagePill, Empty } from './SalesUi';
import { SALES_STAGES, OPEN_STAGES, LOST_REASONS, stageLabel } from '../../../functions/src/salesDomain.js';
import { loadLeads, moveLeadStage, applyAutomation, ensureLeadTask } from '../../services/salesService';
import { errorText, formatDay, toMillis } from '../../utils/salesFormat';

const CLOSED_WINDOW_DAYS = 30;

function LostDialog({ lead, busy, error, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <SalesDialog title={`Mark ${lead.businessName} as lost`} busy={busy} onClose={onCancel}>
      <form onSubmit={e => { e.preventDefault(); onConfirm({ lostReason: reason, lostNotes: notes }); }}>
        {error && <p className="task-error" role="alert">{error}</p>}
        <label className="task-field"><span>Reason lost</span>
          <select required data-autofocus="true" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Choose…</option>
            {LOST_REASONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        <label className="task-field"><span>Notes {reason === 'other' ? '' : <small>(optional)</small>}</span><textarea maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
        <footer className="task-form-footer">
          <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <LoadingButton type="submit" className="task-danger" loading={busy} loadingLabel="Saving…">Mark as lost</LoadingButton>
        </footer>
      </form>
    </SalesDialog>
  );
}

function LeadCard({ lead, ctx, now, onOpen, onMove, busy }) {
  const due = toMillis(lead.nextFollowUpAt);
  const overdue = due != null && due < now && OPEN_STAGES.includes(lead.stage);
  const canMove = (ctx.role.isManager || lead.ownerEmail === ctx.myEmail) && lead.stage !== 'converted' && lead.conversionStatus !== 'pending';
  return (
    <article className={`task-card sales-card${overdue ? ' task-card-overdue' : ''}`} draggable={canMove}
      onDragStart={e => { e.dataTransfer.setData('text/plain', lead.id); e.dataTransfer.effectAllowed = 'move'; }}>
      <button type="button" className="sales-card-open" onClick={() => onOpen(lead.id)}>
        <strong className="task-card-title">{lead.businessName}</strong>
        <span className="task-muted">{lead.industry}{ctx.role.viewAll ? ` · ${lead.ownerName}` : ''}</span>
        {lead.conversionStatus === 'pending' && <span className="task-pill sales-conv-pending">Awaiting payment confirmation</span>}
        {due && <span className={`task-due ${overdue ? 'task-due-overdue' : ''}`}>Follow-up {formatDay(due, ctx.settings.timezone)}</span>}
      </button>
      {canMove && (
        <label className="sales-card-move">
          <span className="task-visually-hidden">Move {lead.businessName} to</span>
          <select value="" disabled={busy} onChange={e => e.target.value && onMove(lead, e.target.value)}>
            <option value="">Move to…</option>
            {SALES_STAGES.filter(s => s.id !== lead.stage && s.id !== 'converted').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      )}
    </article>
  );
}

export default function SalesPipeline({ ctx, refreshKey, onOpenLead, onChanged }) {
  const { role, settings, user } = ctx;
  const [leads, setLeads] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [loadedKey, setLoadedKey] = useState(null);
  const loading = loadedKey !== refreshKey;
  const [error, setError] = useState('');
  const [view, setView] = useState('board');
  const [owner, setOwner] = useState('all');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [lostLead, setLostLead] = useState(null);
  const [lostError, setLostError] = useState('');
  const [dropTarget, setDropTarget] = useState('');

  useEffect(() => {
    let live = true;
    loadLeads({ owner: role.viewAll ? null : ctx.myEmail })
      .then(list => { if (live) { setLeads(list); setNow(Date.now()); setError(''); } })
      .catch(err => { if (live) setError(errorText(err)); })
      .finally(() => { if (live) setLoadedKey(refreshKey); });
    return () => { live = false; };
  }, [role.viewAll, ctx.myEmail, refreshKey]);

  const cutoff = now - CLOSED_WINDOW_DAYS * 86400000;
  const pipeline = useMemo(() => leads.filter(l => (OPEN_STAGES.includes(l.stage) || (toMillis(l.stageChangedAt) || 0) >= cutoff)
    && (owner === 'all' || l.ownerEmail === owner)), [leads, owner, cutoff]);
  const owners = [...new Map(leads.map(l => [l.ownerEmail, l.ownerName || l.ownerEmail]))].sort((a, b) => a[1].localeCompare(b[1]));

  const move = async (lead, to, options = {}) => {
    if (to === 'converted') { setNotice({ text: 'A lead becomes Converted only when management confirms the down payment. Open the lead and submit a conversion request.' }); return; }
    if (to === 'lost' && !options.lostReason) { setLostError(''); setLostLead(lead); return; }
    setBusy(true); setError(''); setNotice(null);
    try {
      const updated = await moveLeadStage(user, lead.id, to, options);
      setLeads(list => list.map(l => (l.id === lead.id ? { ...l, ...updated, stageChangedAt: new Date() } : l)));
      setLostLead(null);
      const automation = await applyAutomation(user, updated, to, settings);
      setNotice(automation.status === 'suggested'
        ? { text: `${lead.businessName} moved to ${stageLabel(to)}.`, lead: updated, task: automation.task }
        : { text: `${lead.businessName} moved to ${stageLabel(to)}.${automation.status === 'created' ? ` Task “${automation.task.title}” added to the task board.` : ''}` });
      onChanged?.();
    } catch (err) {
      if (lostLead) setLostError(errorText(err)); else setError(errorText(err));
    } finally { setBusy(false); }
  };

  const acceptSuggestion = async () => {
    setBusy(true);
    try {
      const status = await ensureLeadTask(user, notice.lead, notice.task);
      setNotice({ text: status === 'exists' ? 'An open task for this step already exists.' : `Task “${notice.task.title}” added to the task board.` });
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  const columns = SALES_STAGES.map(stage => ({ ...stage, leads: pipeline.filter(l => l.stage === stage.id).sort((a, b) => (toMillis(a.nextFollowUpAt) ?? Infinity) - (toMillis(b.nextFollowUpAt) ?? Infinity)) }));

  return (
    <div>
      <div className="task-toolbar">
        <div className="task-segmented" role="group" aria-label="Pipeline view">
          <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}><KanbanSquare size={14} /> Board</button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={14} /> List</button>
        </div>
        {role.viewAll && (
          <label className="task-filter"><span>Associate</span>
            <select value={owner} onChange={e => setOwner(e.target.value)}>
              <option value="all">Everyone</option>
              {owners.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
            </select>
          </label>
        )}
        <p className="task-muted sales-push">Open leads plus leads converted or lost in the last {CLOSED_WINDOW_DAYS} days. Drag a card or use “Move to”.</p>
      </div>
      <div className="sales-stage-counts" aria-label="Leads per stage">
        {columns.map(c => <span key={c.id}><StagePill stage={c.id} /> <strong>{c.leads.length}</strong></span>)}
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && (
        <div className="sales-suggestion" role="status">
          <span>{notice.text}{notice.task && <> Suggested next task: <strong>{notice.task.title}</strong></>}</span>
          <span className="task-inline">
            <button type="button" onClick={() => setNotice(null)} disabled={busy}>{notice.task ? 'Dismiss' : 'Close'}</button>
            {notice.task && <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Adding…" onClick={acceptSuggestion}><ListPlus size={14} /> Add to task board</LoadingButton>}
          </span>
        </div>
      )}
      {loading ? <div className="task-skeleton" role="status" aria-label="Loading pipeline" /> : pipeline.length === 0 ? (
        <Empty icon={Columns3} title="The pipeline is empty">Leads appear here as soon as they are added.</Empty>
      ) : view === 'board' ? (
        <div className="sales-board">
          {columns.map(column => (
            <section key={column.id} className={`task-column sales-column${dropTarget === column.id ? ' is-drop' : ''}`} aria-labelledby={`stage-${column.id}`}
              onDragOver={e => { e.preventDefault(); setDropTarget(column.id); }} onDragLeave={() => setDropTarget('')}
              onDrop={e => { e.preventDefault(); setDropTarget(''); const lead = pipeline.find(l => l.id === e.dataTransfer.getData('text/plain')); if (lead && lead.stage !== column.id) move(lead, column.id); }}>
              <h3 id={`stage-${column.id}`}>{column.label} <span className="task-count">{column.leads.length}</span></h3>
              {column.leads.length === 0 ? <p className="task-column-empty">No leads</p> : column.leads.map(lead => <LeadCard key={lead.id} lead={lead} ctx={ctx} now={now} busy={busy} onOpen={onOpenLead} onMove={move} />)}
            </section>
          ))}
        </div>
      ) : (
        <div className="sales-table-wrap">
          <table className="sales-table">
            <thead><tr><th scope="col">Business</th><th scope="col">Stage</th><th scope="col">In stage since</th>{role.viewAll && <th scope="col">Assigned to</th>}<th scope="col">Next follow-up</th></tr></thead>
            <tbody>
              {columns.flatMap(c => c.leads).map(l => (
                <tr key={l.id}>
                  <th scope="row"><button type="button" className="sales-link" onClick={() => onOpenLead(l.id)}>{l.businessName}</button><small>{l.industry}</small></th>
                  <td><StagePill stage={l.stage} /></td>
                  <td>{formatDay(l.stageChangedAt, settings.timezone)}</td>
                  {role.viewAll && <td>{l.ownerName}</td>}
                  <td>{l.nextFollowUpAt ? formatDay(l.nextFollowUpAt, settings.timezone) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lostLead && <LostDialog lead={lostLead} busy={busy} error={lostError} onCancel={() => setLostLead(null)} onConfirm={options => move(lostLead, 'lost', options)} />}
    </div>
  );
}
