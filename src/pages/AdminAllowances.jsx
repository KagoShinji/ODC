import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { ArrowClockwise, BookOpen, Plus, Printer, DownloadSimple, Wallet, X } from '@phosphor-icons/react';
import { db } from '../lib/firebase';
import { useAllowances } from '../hooks/useAllowances';
import { newAllowanceId, runAllowanceCommand, allowanceError, openAllowanceEvidence } from '../services/allowanceService';
import { estimatedCash, manilaDate } from '../../functions/src/domain.js';
import { peso, timestampLabel, exportAllowanceCsv, printAllowanceSlip } from '../utils/allowanceDocuments';
import { AccountForm, CorrectionForm, LiquidationForm, MeetingForm, PolicyForm, ReleaseForm, RequisitionForm, ReviewForm } from '../components/allowances/AllowanceForms';
import AllowanceSlipDetail from '../components/allowances/AllowanceSlipDetail';
import AllowanceWorkflowGuide from '../components/allowances/AllowanceWorkflowGuide';
import AllowanceStatusBadge from '../components/allowances/AllowanceStatusBadge';
import LoadingButton from '../components/ui/LoadingButton';
import './AdminAllowances.css';

const TITLES = { guide: 'Guided allowance & requisition workflow', meeting: 'Record client meeting', liquidation: 'Liquidation slip', requisition: 'Replenishment requisition', review: 'Operations review', approve: 'Requisition approval', release: 'Record actual release', policy: 'Allowance policy', account: 'Allowance account', reconcile: 'Verify cash on hand', return: 'Record cash return', correct: 'Correct approved expense', detail: 'Slip and supporting evidence' };
const statusLabel = value => String(value || '').replaceAll('_', ' ');

export default function AdminAllowances({ firebaseUser, allowanceState, isSuperAdmin = false, initialSection = 'overview', onSectionChange, onOpenStaff }) {
  const context = allowanceState.context;
  const actions = context?.access?.actions || [];
  const can = action => actions.includes(`allowances:${action}`);
  const data = useAllowances(firebaseUser.uid, context?.access, context?.enabled);
  const accounts = data.rows.allowanceAccounts || [];
  const meetings = data.rows.allowanceMeetings || [];
  const liquidations = data.rows.allowanceLiquidations || [];
  const requests = data.rows.allowanceRequisitions || [];
  const ledger = data.rows.allowanceLedger || [];
  const audits = data.rows.allowanceAuditEvents || [];
  const [section, setSection] = useState(initialSection);
  const [accountId, setAccountId] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aux, setAux] = useState({ clients: [], staff: [], grants: [] });
  const [filter, setFilter] = useState('all');
  const commandRetry = useRef(null);
  const mounted = useRef(true);
  const modalRef = useRef(null);
  const previousFocus = useRef(null);
  const ownAccount = accounts.find(a => a.ownerUid === firebaseUser.uid);
  const account = accounts.find(a => a.id === accountId) || ownAccount || accounts[0];
  const own = account?.ownerUid === firebaseUser.uid;
  const loading = busy || data.loading || allowanceState.loading;
  const manager = actions.includes('allowances:manage');

  useEffect(() => {
    const availableSections = ['overview', 'meetings', 'liquidations', 'requisitions', 'history', ...(manager ? ['settings'] : [])];
    if (availableSections.includes(initialSection)) setSection(initialSection);
  }, [initialSection, manager]);

  const selectSection = (nextSection) => {
    setSection(nextSection);
    setFilter('all');
    onSectionChange?.(nextSection);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!context?.access) return;
    let cancelled = false;
    const work = [getDocs(query(collection(db, 'clients'), limit(100)))];
    if (manager) work.push(getDocs(query(collection(db, 'staff'), orderBy('name'), limit(200))), getDocs(collection(db, 'allowanceAccess')));
    Promise.all(work).then(pages => {
      if (!cancelled) setAux({ clients: pages[0].docs.map(d => ({ ...d.data(), id: d.id })), staff: pages[1]?.docs.map(d => ({ id: d.id, name: d.data().name, email: d.data().email })) || [], grants: pages[2]?.docs.map(d => ({ ...d.data(), id: d.id })) || [] });
    }).catch(err => { if (!cancelled) setError(allowanceError(err)); });
    return () => { cancelled = true; };
  }, [context, manager]);
  useEffect(() => {
    if (!modal) return;
    previousFocus.current = document.activeElement;
    const dialog = modalRef.current;
    dialog?.focus();
    const keydown = event => {
      if (event.key === 'Escape' && !busy) setModal(null);
      if (event.key === 'Tab' && dialog) {
        const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
        const first = focusable[0]; const last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previousFocus.current?.focus(); };
  }, [modal, busy]);

  const command = async (name, payload) => {
    // Drop undefined optional values before crossing the callable JSON boundary.
    const clean = JSON.parse(JSON.stringify(payload));
    const signature = JSON.stringify({ name, payload: clean });
    if (commandRetry.current?.signature !== signature) commandRetry.current = { signature, id: newAllowanceId() };
    const result = await runAllowanceCommand(name, clean, commandRetry.current.id);
    commandRetry.current = null;
    return result;
  };
  const save = async (name, payload) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await command(name, payload);
      if (!mounted.current) return;
      setModal(null); setNotice('Saved successfully.');
      if (name === 'savePolicy') allowanceState.refresh();
      await data.refresh();
    } catch (err) { if (mounted.current) setError(allowanceError(err)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const evidenceFor = async slip => {
    const pages = await Promise.all([
      getDocs(query(collection(db, 'allowanceAttachments'), where('ownerUid', '==', slip.ownerUid), where('liquidationId', '==', slip.id), orderBy('createdAt', 'desc'), limit(200))),
      getDocs(query(collection(db, 'allowanceAttachments'), where('ownerUid', '==', slip.ownerUid), where('accountId', '==', slip.accountId), where('date', '==', slip.date), where('purchaseCentavos', '>', 0), limit(100))),
    ]);
    return [...new Map(pages.flatMap(page => page.docs.map(d => ({ ...d.data(), id: d.id }))).map(file => [file.id, file])).values()].filter(file => !file.deleting);
  };
  const open = async (kind, value = {}) => {
    setError('');
    if (['liquidation', 'review', 'detail', 'correct'].includes(kind)) {
      setBusy(true);
      try {
        const slip = value.slip || { id: value.meeting.id, ownerUid: firebaseUser.uid, accountId: account.id, date: value.meeting.date };
        const evidence = await evidenceFor(slip);
        if (mounted.current) setModal({ kind, ...value, evidence });
      } catch (err) { if (mounted.current) setError(allowanceError(err)); }
      finally { if (mounted.current) setBusy(false); }
    } else setModal({ kind, ...value });
  };
  const print = async (slip, type) => {
    try { printAllowanceSlip(slip, type, type === 'liquidation' ? await evidenceFor(slip) : [], audits.filter(x => x.entityId === slip.id)); }
    catch (err) { setError(allowanceError(err)); }
  };
  const more = name => data.more[name] && <LoadingButton loading={loading} loadingLabel="Loading…" onClick={() => data.loadMore(name)}>Load more</LoadingButton>;
  const tabs = ['overview', 'meetings', 'liquidations', 'requisitions', 'history', ...(manager ? ['settings'] : [])];
  const list = (items, row, empty = 'No records yet.') => <div className="allowance-records">{items.length ? items.map(row) : <div className="allowance-empty"><Wallet size={28} /><p>{empty}</p></div>}</div>;
  const matches = record => (!account || record.accountId === account.id) && (filter === 'all' || record.status === filter);
  const targetAccount = modal?.slip ? accounts.find(a => a.id === modal.slip.accountId) || account : modal?.account || account;
  const guideCapabilities = {
    policy: manager,
    createAccount: manager && context?.enabled === true,
    manageAccount: manager && Boolean(account),
    initialRelease: can('release') && account?.status === 'pending_setup',
    newMeeting: own && can('meeting') && account?.status === 'active',
    newRequisition: own && can('request') && account?.status === 'active',
    reconcile: manager && account?.reconciliationHold === true,
    cashReturn: can('release') && account?.funded === true,
  };
  const followGuide = destination => {
    if (destination.section) selectSection(destination.section);
    if (destination.filter) setFilter(destination.filter);
    if (destination.modal) {
      open(destination.modal, destination.withAccount && account ? { account } : {});
    } else {
      setModal(null);
    }
  };

  return <section className="allowance-module">
    <header className="allowance-heading"><div><p className="allowance-eyebrow">STAFF OPERATIONS</p><h2>Allowances & Requisitions</h2><p>Track meeting spending, check evidence, and replenish the staff float.</p></div><div className="allowance-heading-actions"><button type="button" aria-haspopup="dialog" onClick={() => { setError(''); setModal({ kind: 'guide' }); }}><BookOpen size={18} aria-hidden="true" /> Workflow guide</button><LoadingButton loading={loading} loadingLabel="Refreshing…" onClick={() => { allowanceState.refresh(); data.refresh(); }}><ArrowClockwise size={18} /> Refresh</LoadingButton></div></header>
    {(error || data.error || allowanceState.error) && <div className="allowance-error" role="alert">{error || data.error || allowanceState.error}</div>}
    {notice && <p className="allowance-notice" role="status">{notice}</p>}
    {allowanceState.loading && <div className="allowance-skeleton" aria-label="Loading allowance access" />}
    {!context?.access && !allowanceState.loading && (allowanceState.error
      ? <div className="allowance-empty"><Wallet size={36} /><h3>Allowance service is unavailable</h3><p>Your allowance permissions could not be verified. Use Refresh to try again. Your other modules remain available.</p>{isSuperAdmin && <p>Your superadmin account can open this module. Ask the project administrator to deploy the updated Firestore rules and refresh this page.</p>}</div>
      : <div className="allowance-empty"><Wallet size={36} /><h3>Allowance access is awaiting setup</h3><p>{isSuperAdmin ? 'Your superadmin account is recognized. Complete the allowance administrator setup for this login to manage the feature.' : 'An authorized administrator must configure the feature and assign your allowance permissions.'}</p></div>)}
    {context?.access && <>
      {!context.enabled && <p className="allowance-notice">Allowances are inactive. {manager ? 'Confirm the policy in Settings to enable the workflow.' : 'An administrator must activate the feature first.'}</p>}
      <nav className="allowance-tabs" aria-label="Allowance sections">{tabs.map(tab => <button key={tab} aria-current={section === tab ? 'page' : undefined} onClick={() => selectSection(tab)}>{statusLabel(tab)}</button>)}</nav>
      {section !== 'settings' && <div className="allowance-toolbar">
        <label>Allowance account<select value={account?.id || ''} onChange={e => setAccountId(e.target.value)}><option value="" disabled>Select an account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.staffName} · {statusLabel(a.status)}</option>)}</select></label>
        {account && <AllowanceStatusBadge status={account.status} className="mb-2.5" />}
        {more('allowanceAccounts')}
        {['liquidations', 'requisitions'].includes(section) && <>
          <label>Status<select value={filter} onChange={e => setFilter(e.target.value)}>{['all', 'draft', 'submitted', 'returned', 'approved', ...(section === 'requisitions' ? ['released', 'rejected', 'cancelled'] : ['voided'])].map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
          {filter !== 'all' && <AllowanceStatusBadge status={filter} className="mb-2.5" />}
        </>}
      </div>}
      {data.loading && <div className="allowance-skeleton" aria-label="Loading allowance records" />}
      {section === 'overview' && (account ? <>
        <div className="allowance-metrics"><div><span>Allowance float</span><strong>{peso(account.policy.targetCentavos)}</strong></div><div><span>Reviewed balance</span><strong>{peso(account.reviewedBalanceCentavos)}</strong></div><div><span>Estimated cash on hand</span><strong>{peso(estimatedCash(account))}</strong></div><div><span>Awaiting review</span><strong>{peso(account.unreviewedCentavos)}</strong></div></div>
        <div className="allowance-balance-detail"><div><strong>{Math.max(0, Math.round((account.policy.targetCentavos - account.reviewedBalanceCentavos) / account.policy.targetCentavos * 100))}% depleted</strong><progress max={account.policy.targetCentavos} value={Math.max(0, account.policy.targetCentavos - account.reviewedBalanceCentavos)} /></div><p>Scheduled replenishment: <strong>{account.nextScheduledDate}</strong><br />Per meeting: {peso(account.policy.meetingCapCentavos)} · Fuel: {peso(account.policy.singleFuelCentavos)} standalone / {peso(account.policy.dailyFuelCentavos)} daily across multiple meetings.</p></div>
        {account.reconciliationHold && <p className="allowance-error">Cash discrepancy requires reconciliation before replenishment.</p>}
        <div className="allowance-controls">{own && can('meeting') && account.status === 'active' && <button className="allowance-primary" disabled={loading} onClick={() => open('meeting')}><Plus size={16} /> Record meeting</button>}{own && can('request') && account.status === 'active' && <button disabled={loading} onClick={() => open('requisition')}>Request replenishment</button>}{can('release') && account.status === 'pending_setup' && <button disabled={loading} onClick={() => open('release')}>Record initial release</button>}{manager && <button disabled={loading} onClick={() => open('account', { account })}>Manage account</button>}{manager && account.reconciliationHold && <button disabled={loading} onClick={() => open('reconcile', { account })}>Verify cash</button>}{can('release') && account.funded && <button disabled={loading} onClick={() => open('return', { account })}>Record cash return</button>}</div>
        <h3>Next actions</h3>{list(meetings.filter(m => m.accountId === account.id && (m.status === 'planned' || m.status === 'held' && !liquidations.some(s => s.meetingId === m.id && ['submitted', 'approved', 'voided'].includes(s.status)))), m => <article key={m.id} className="allowance-row"><div><strong className="flex flex-wrap items-center gap-2">{m.clientName}<AllowanceStatusBadge status={m.status} />{m.status === 'held' && m.date < manilaDate() && <AllowanceStatusBadge status="overdue" />}</strong><small>{m.date}</small></div>{own && can('liquidate') && m.status === 'held' && <button disabled={loading} onClick={() => open('liquidation', { meeting: m, slip: liquidations.find(s => s.meetingId === m.id) })}>Submit liquidation</button>}</article>, 'Record a meeting to start tracking its liquidation.')}
      </> : <div className="allowance-empty"><Wallet size={32} /><h3>No allowance account yet</h3><p>{manager ? 'Assign permissions in Staff Management, then create an allowance account in Settings.' : 'Ask the allowance administrator to establish your float.'}</p></div>)}
      {section === 'meetings' && <><div className="allowance-controls">{own && can('meeting') && <button disabled={loading} onClick={() => open('meeting')}><Plus size={16} /> New meeting</button>}</div>{list(meetings.filter(m => m.accountId === account?.id), m => <article className="allowance-row" key={m.id}><div><strong className="flex flex-wrap items-center gap-2">{m.clientName}<AllowanceStatusBadge status={m.status} /></strong><small>{m.date}</small><p>{m.purpose}</p></div><div className="allowance-row-actions">{own && can('meeting') && !m.liquidationId && <button disabled={loading} onClick={() => open('meeting', { meeting: m })}>Edit meeting</button>}{own && can('liquidate') && m.status === 'held' && (!m.liquidationId || ['draft', 'returned'].includes(liquidations.find(s => s.id === m.liquidationId)?.status)) && <button disabled={loading} onClick={() => open('liquidation', { meeting: m, slip: liquidations.find(s => s.id === m.liquidationId) })}>Liquidate</button>}</div></article>)}{more('allowanceMeetings')}</>}
      {section === 'liquidations' && <>{list(liquidations.filter(matches), slip => <article className="allowance-row" key={slip.id}><div><strong className="flex flex-wrap items-center gap-2">{slip.clientName}<AllowanceStatusBadge status={slip.status} />{slip.late && <AllowanceStatusBadge status="overdue" />}</strong><small>{slip.slipNumber} · {slip.staffName} · {slip.date}</small><p>{peso(slip.correctedTotalCentavos ?? slip.totalCentavos)}{slip.reviewNote && ` · ${slip.reviewNote}`}</p></div><div className="allowance-row-actions"><button disabled={loading} onClick={() => open('detail', { slip, type: 'liquidation' })}>View evidence</button>{slip.ownerUid === firebaseUser.uid && can('liquidate') && ['draft', 'returned'].includes(slip.status) && <button disabled={loading} onClick={() => open('liquidation', { slip, meeting: meetings.find(m => m.id === slip.meetingId) || { id: slip.meetingId, clientName: slip.clientName, date: slip.date } })}>Revise</button>}{can('review') && slip.ownerUid !== firebaseUser.uid && slip.status === 'submitted' && <button disabled={loading} onClick={() => open('review', { slip })}>Review</button>}{can('reverse') && slip.ownerUid !== firebaseUser.uid && slip.status === 'approved' && slip.totalCentavos > 0 && <button disabled={loading} onClick={() => open('correct', { slip })}>Correct</button>}<button disabled={loading} aria-label={`Print ${slip.slipNumber}`} onClick={() => print(slip, 'liquidation')}><Printer size={16} /></button></div></article>)}{more('allowanceLiquidations')}</>}
      {section === 'requisitions' && <><div className="allowance-controls">{own && can('request') && <button disabled={loading} onClick={() => open('requisition')}><Plus size={16} /> New requisition</button>}</div>{list(requests.filter(matches), req => <article className="allowance-row" key={req.id}><div><strong className="flex flex-wrap items-center gap-2">{req.reason}<AllowanceStatusBadge status={req.status} /></strong><small>{req.slipNumber} · {req.staffName} · {req.date}</small><p>{peso(req.amountCentavos)} · Cash on hand {peso(req.declaredCashCentavos)}</p>{req.reviewNote && <p>{req.reviewNote}</p>}</div><div className="allowance-row-actions">{req.ownerUid === firebaseUser.uid && can('request') && ['draft', 'returned'].includes(req.status) && <button disabled={loading} onClick={() => open('requisition', { request: req })}>Revise</button>}{can('approve') && req.ownerUid !== firebaseUser.uid && ['submitted', 'approved'].includes(req.status) && <button disabled={loading} onClick={() => open('approve', { slip: req })}>Review</button>}{can('release') && req.status === 'approved' && <button disabled={loading} onClick={() => open('release', { request: req })}>Record release</button>}{req.ownerUid === firebaseUser.uid && can('request') && ['draft', 'submitted', 'returned'].includes(req.status) && <button disabled={loading} onClick={() => open('cancel', { request: req })}>Cancel</button>}<button disabled={loading} aria-label={`Print ${req.slipNumber}`} onClick={() => print(req, 'requisition')}><Printer size={16} /></button></div></article>)}{more('allowanceRequisitions')}</>}
      {section === 'history' && <><div className="allowance-controls">{can('reports') && <button disabled={loading} onClick={() => exportAllowanceCsv(ledger.filter(x => x.accountId === account?.id))}><DownloadSimple size={16} /> Export loaded ledger</button>}</div>{list(ledger.filter(x => x.accountId === account?.id), row => <article className="allowance-row" key={row.id}><div><strong>{statusLabel(row.kind)}</strong><small>{row.date} · {row.staffName} · {row.sourceId}</small></div><strong>{peso(row.amountCentavos)}</strong></article>)}{more('allowanceLedger')}<h3>Action history</h3>{list(audits.filter(x => x.accountId === account?.id), event => <article className="allowance-row" key={event.id}><div><strong>{statusLabel(event.command)}</strong><small>{timestampLabel(event.createdAt)} · {event.actorUid}</small>{(event.before || event.after) && <div className="mt-2 flex flex-wrap items-center gap-2"><AllowanceStatusBadge status={event.before || 'created'} /><span className="text-white/35" aria-hidden="true">→</span><AllowanceStatusBadge status={event.after} />{event.reason && <span className="text-xs text-[#aaa]">{event.reason}</span>}</div>}</div></article>)}{more('allowanceAuditEvents')}</>}
      {section === 'settings' && manager && <div className="allowance-settings"><article><h3>Policy and activation</h3><p>Confirm the float, caps, replenishment threshold and meeting window.</p><button disabled={loading} onClick={() => open('policy')}>Configure policy</button></article><article><h3>Staff permissions</h3><p>Manage participant, Operations and Finance access in Staff Management → Create/Edit Staff → Page &amp; Action Permissions → Allowances &amp; Requisitions.</p>{onOpenStaff ? <button disabled={loading} onClick={onOpenStaff}>Open Staff Management</button> : <p>Ask an administrator with Staff Management access to update staff permissions.</p>}</article><article><h3>Allowance accounts</h3><p>Create an account with its scheduled replenishment date, then record funding.</p><button disabled={loading || !context.enabled} onClick={() => open('account')}>Create allowance account</button></article></div>}
    </>}
    {modal && <div className="allowance-overlay"><div className={`allowance-dialog${modal.kind === 'detail' ? ' allowance-detail-dialog' : ''}${modal.kind === 'guide' ? ' !w-[min(900px,100%)]' : ''}`} role="dialog" aria-modal="true" aria-labelledby="allowance-dialog-title" tabIndex={-1} ref={modalRef}><header><h3 id="allowance-dialog-title">{TITLES[modal.kind] || 'Cancel requisition'}</h3><button aria-label="Close dialog" disabled={busy} onClick={() => setModal(null)}><X size={20} /></button></header>
      {error && <p className="allowance-error" role="alert">{error}</p>}
      {modal.kind === 'guide' && <AllowanceWorkflowGuide access={context?.access} enabled={context?.enabled} policy={context?.policy} capabilities={guideCapabilities} onNavigate={followGuide} onOpenStaff={onOpenStaff ? () => { setModal(null); onOpenStaff(); } : undefined} onClose={() => setModal(null)} />}
      {modal.kind === 'meeting' && <MeetingForm account={targetAccount} meeting={modal.meeting} clients={aux.clients} busy={busy} onSave={save} />}
      {modal.kind === 'liquidation' && <LiquidationForm account={targetAccount} meeting={modal.meeting} slip={modal.slip} evidence={modal.evidence} busy={busy} onSave={save} onCommand={command} />}
      {modal.kind === 'requisition' && <RequisitionForm account={targetAccount} request={modal.request} meetings={meetings} busy={busy} onSave={save} />}
      {['review', 'approve'].includes(modal.kind) && <ReviewForm slip={modal.slip} type={modal.kind === 'review' ? 'liquidation' : 'requisition'} evidence={modal.evidence || []} busy={busy} onSave={save} />}
      {modal.kind === 'release' && <ReleaseForm account={targetAccount} request={modal.request} busy={busy} onSave={save} />}
      {modal.kind === 'policy' && <PolicyForm policy={context.policy} enabled={context.enabled} busy={busy} onSave={save} />}
      {modal.kind === 'account' && <AccountForm staff={aux.staff} grants={aux.grants} account={modal.account} busy={busy} onSave={save} />}
      {['reconcile', 'return', 'correct'].includes(modal.kind) && <CorrectionForm mode={modal.kind} account={targetAccount} slip={modal.slip} busy={busy} onSave={save} />}
      {modal.kind === 'cancel' && <form onSubmit={e => { e.preventDefault(); save('cancelRequisition', { accountId: modal.request.accountId, id: modal.request.id, reason: new FormData(e.currentTarget).get('reason') }); }}><label className="allowance-field"><span>Reason for cancellation</span><textarea name="reason" required maxLength={1000} /></label><LoadingButton className="allowance-primary" loading={busy} loadingLabel="Cancelling…">Confirm cancellation</LoadingButton></form>}
      {modal.kind === 'detail' && <AllowanceSlipDetail slip={modal.slip} evidence={modal.evidence} history={audits.filter(event => event.entityId === modal.slip.id)} busy={busy} onOpenEvidence={file => openAllowanceEvidence(file).catch(err => setError(allowanceError(err)))} onPrint={() => print(modal.slip, 'liquidation')} />}
    </div></div>}
  </section>;
}
