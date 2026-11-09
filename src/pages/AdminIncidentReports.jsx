import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, ShieldAlert, Link2, Check, Printer, ImageDown,
  Pencil, Send, Ban, Trash2, ArrowLeft, CheckCircle2, PenLine, AlertTriangle,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import IncidentReportFrame from '../components/incidentReports/IncidentReportFrame';
import IncidentReportEditor from '../components/incidentReports/IncidentReportEditor';
import {
  emptyIncidentSigners, incidentReportLink, CATEGORIES, SEVERITIES, SIGNER_KINDS,
} from '../utils/incidentReportDocument';
import { BRAND_CO, longDate } from '../utils/brandDocument';
import {
  subscribeIncidentReports, subscribeIncidentReport, subscribeIncidentSignatures,
  createIncidentReport, updateIncidentReport, issueIncidentReport,
  closeIncidentReport, revokeIncidentReport, deleteIncidentReportDraft, signIncidentReport,
} from '../services/incidentReportService';
import './AdminTasks.css';
import './AdminIncidentReports.css';

const STATUS_LABEL = { draft: 'Draft', issued: 'Issued / In Progress', closed: 'Closed / Resolved', revoked: 'Revoked' };
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const errorText = err => (err?.code === 'permission-denied'
  ? 'You do not have permission for this action, or the report was updated elsewhere. Refresh and try again.'
  : err?.message || 'Something went wrong. Please try again.');

function mergeIncidentParsed(f, parsed) {
  const next = { ...f };
  for (const key of ['title', 'incidentDate', 'incidentTime', 'dateReported', 'location', 'category', 'severity', 'reportedByName', 'reportedByTitle', 'personsInvolved']) {
    if (parsed[key]) next[key] = parsed[key];
  }

  const hasSigners = Boolean(
    (parsed.reporters && parsed.reporters.length) ||
    (parsed.investigators && parsed.investigators.length) ||
    (parsed.approvers && parsed.approvers.length) ||
    (parsed.acknowledgers && parsed.acknowledgers.length)
  );

  if (!hasSigners) {
    if (parsed.reportedByName) {
      next.signers = (f.signers || []).map(s => (s.kind === 'reporter' && !s.name
        ? { ...s, name: parsed.reportedByName, title: parsed.reportedByTitle || s.title }
        : s));
    }
    return next;
  }

  const signers = [];
  let order = 1;
  const slot = () => `s${order}`;

  const reporters = (parsed.reporters && parsed.reporters.length)
    ? parsed.reporters
    : (parsed.reportedByName ? [{ name: parsed.reportedByName, title: parsed.reportedByTitle || '' }] : []);

  for (const r of reporters) {
    signers.push({ id: slot(), kind: 'reporter', name: r.name || '', title: r.title || '', order: order++ });
  }
  if (!signers.some(s => s.kind === 'reporter')) {
    const existing = f.signers?.find(s => s.kind === 'reporter');
    signers.push({ id: slot(), kind: 'reporter', name: existing?.name || '', title: existing?.title || '', order: order++ });
  }

  for (const inv of (parsed.investigators || [])) {
    signers.push({ id: slot(), kind: 'investigator', name: inv.name || '', title: inv.title || '', order: order++ });
  }

  const approvers = (parsed.approvers && parsed.approvers.length)
    ? parsed.approvers
    : [{ name: BRAND_CO.approvedBy, title: 'Founder' }];

  for (const app of approvers) {
    signers.push({ id: slot(), kind: 'approver', name: app.name || BRAND_CO.approvedBy, title: app.title || 'Founder', order: order++ });
  }

  for (const ack of (parsed.acknowledgers || [])) {
    signers.push({ id: slot(), kind: 'acknowledger', name: ack.name || '', title: ack.title || '', order: order++ });
  }

  next.signers = signers;
  return next;
}

function formFrom(report) {
  const signers = Object.entries(report?.signers || emptyIncidentSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    title: report?.title || '',
    incidentDate: report?.incidentDate || todayIso(),
    incidentTime: report?.incidentTime || '09:00 AM',
    dateReported: report?.dateReported || todayIso(),
    location: report?.location || 'Office / Talisay City',
    category: report?.category || 'operational',
    severity: report?.severity || 'medium',
    reportedByName: report?.reportedByName || '',
    reportedByTitle: report?.reportedByTitle || '',
    personsInvolved: report?.personsInvolved || '',
    bodyJson: report?.bodyJson || '',
    bodyText: report?.body || '',
    signers,
  };
}

function Editor({ user, report, onClose, onSaved }) {
  const [form, setForm] = useState(() => formFrom(report));
  const [initialContent] = useState(() => {
    if (report?.bodyJson) {
      try { return JSON.parse(report.bodyJson); } catch { /* fallback */ }
    }
    return report?.body || '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const onDoc = useCallback((json, text) => setForm(f => ({ ...f, bodyJson: JSON.stringify(json), bodyText: text })), []);
  const onParsed = useCallback(parsed => {
    setForm(f => mergeIncidentParsed(f, parsed));
    setNotice('Draft parsed and formatted into the report. Check the details and signers, then save.');
  }, []);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const id = report ? (await updateIncidentReport(user, report.id, form), report.id) : await createIncidentReport(user, form);
      onSaved(id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ir-doc-editor">
      <div className="ir-doc-head">
        <button type="button" className="ir-back" onClick={onClose}><ArrowLeft size={14} /> Back to incident reports</button>
        <h3>{report ? `Editing ${report.controlNumber}` : 'New Incident Report'}</h3>
        <span className="task-muted">{report ? 'Draft — visible only to managers and authorized staff.' : 'The tracking number is assigned on first save.'}</span>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="ir-notice" role="status">{notice}</p>}
      <div className="ir-doc-layout">
        <IncidentReportEditor
          form={form}
          controlNumber={report?.controlNumber}
          initialContent={initialContent}
          onField={set}
          onDoc={onDoc}
          onParsed={onParsed}
        />
        <aside className="ir-doc-side" aria-label="Saving and details">
          <h4>Save &amp; Issue</h4>
          <p className="task-muted ir-small">Make sure to document all timeline facts and root causes thoroughly before issuing.</p>
          <div className="ir-doc-save">
            <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Saving…" onClick={save}>
              {report ? 'Save changes' : 'Save draft'}
            </LoadingButton>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
          <p className="task-muted ir-small">After saving, you can review the document preview, issue it to generate its permanent verification link, and request sign-offs.</p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ user, id, onBack, onEdit }) {
  const modal = useSystemModal();
  const frame = useRef(null);
  const [report, setReport] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');
  const [signName, setSignName] = useState('');

  useEffect(() => subscribeIncidentReport(id, setReport, err => setError(errorText(err))), [id]);
  useEffect(() => subscribeIncidentSignatures(id, setSignatures, () => setSignatures({})), [id]);

  if (report === undefined) return <div className="task-skeleton" role="status" aria-label="Loading incident report" />;
  if (report === null) return <p className="task-error" role="alert">This incident report no longer exists.</p>;

  const link = incidentReportLink(report.id);
  const signers = Object.entries(report.signers || {})
    .map(([slot, s]) => ({ slot, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const approverSlot = signers.find(s => s.kind === 'approver' && !signatures[s.slot]);

  const run = async (key, work) => {
    setBusy(key); setError('');
    try { await work(); } catch (err) { setError(errorText(err)); } finally { setBusy(''); }
  };

  const copy = (text, key) => navigator.clipboard.writeText(text).then(() => {
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  });

  const issue = async () => {
    if (!await modal.confirm({
      title: `Issue Incident Report ${report.controlNumber}?`,
      message: 'Issuing locks the narrative and makes the report officially viewable and signable through its link. Any changes afterwards require revoking.',
      confirmLabel: 'Issue report',
    })) return;
    run('issue', () => issueIncidentReport(user, report.id));
  };

  const remove = async () => {
    if (!await modal.confirm({
      title: `Delete draft ${report.controlNumber}?`,
      message: 'This draft will be permanently removed. The tracking number will not be reused.',
      confirmLabel: 'Delete draft',
    })) return;
    run('delete', async () => { await deleteIncidentReportDraft(report.id); onBack(); });
  };

  const file = report.controlNumber;

  return (
    <div className="ir-detail">
      <div className="ir-detail-side">
        <button type="button" className="ir-back" onClick={onBack}><ArrowLeft size={14} /> Back to incident reports</button>
        <p className="task-eyebrow">Control / tracking no.</p>
        <h3 className="ir-number">{report.controlNumber}</h3>
        <p className="ir-title">{report.title}</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className={`task-pill ir-status-${report.status}`}>{STATUS_LABEL[report.status]}</span>
          <span className={`ir-sev-badge sev-${report.severity}`}><i></i>{report.severity.toUpperCase()}</span>
        </div>
        {error && <p className="task-error" role="alert">{error}</p>}

        <div className="ir-actions">
          {report.status === 'draft' && <button type="button" onClick={() => onEdit(report)}><Pencil size={14} /> Edit</button>}
          {report.status === 'draft' && (
            <LoadingButton type="button" className="task-primary" loading={busy === 'issue'} loadingLabel="Issuing…" onClick={issue}>
              <Send size={14} /> Issue
            </LoadingButton>
          )}
          {report.status !== 'draft' && (
            <button type="button" className={copied === 'link' ? 'ar-btn-copied' : ''} onClick={() => copy(link, 'link')}>
              {copied === 'link' ? <Check size={14} /> : <Link2 size={14} />} {copied === 'link' ? 'Link copied' : 'Copy link'}
            </button>
          )}
          <button type="button" onClick={() => frame.current?.print()}><Printer size={14} /> Save as PDF</button>
          <LoadingButton type="button" loading={busy === 'png'} loadingLabel="Rendering…" onClick={() => run('png', () => frame.current.savePng(`${file}.png`))}>
            <ImageDown size={14} /> Save as PNG
          </LoadingButton>
          {report.status === 'issued' && (
            <button type="button" className="btn btn-secondary" onClick={() => setClosing(v => !v)}>
              <CheckCircle2 size={14} /> Close / Resolve
            </button>
          )}
          {report.status === 'issued' && (
            <button type="button" className="task-danger" onClick={() => setRevoking(v => !v)}>
              <Ban size={14} /> Revoke
            </button>
          )}
          {report.status === 'draft' && (
            <LoadingButton type="button" className="task-danger" loading={busy === 'delete'} loadingLabel="Deleting…" onClick={remove}>
              <Trash2 size={14} /> Delete draft
            </LoadingButton>
          )}
        </div>

        {report.status !== 'draft' && (
          <div className="ir-link-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="task-muted ir-small">Incident Verification URL:</span>
              <button
                type="button"
                className={`ir-mini-copy ${copied === 'link' ? 'ar-copied' : ''}`}
                title="Copy incident verification link"
                onClick={() => copy(link, 'link')}
              >
                {copied === 'link' ? <Check size={11} /> : <Link2 size={11} />}
                <span>{copied === 'link' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <code>{link}</code>
          </div>
        )}

        {closing && (
          <form className="ir-inline" onSubmit={e => { e.preventDefault(); run('close', async () => { await closeIncidentReport(user, report.id, reason); setClosing(false); setReason(''); }); }}>
            <label className="task-field">
              <span>Resolution notes (optional)</span>
              <textarea maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Summary of preventive actions implemented…" />
            </label>
            <LoadingButton type="submit" className="task-primary" loading={busy === 'close'} loadingLabel="Closing…">
              Confirm Resolution &amp; Close
            </LoadingButton>
          </form>
        )}

        {revoking && (
          <form className="ir-inline" onSubmit={e => { e.preventDefault(); run('revoke', async () => { await revokeIncidentReport(user, report.id, reason); setRevoking(false); setReason(''); }); }}>
            <label className="task-field">
              <span>Reason for revoking</span>
              <textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this report is void or revoked…" />
            </label>
            <LoadingButton type="submit" className="task-danger" loading={busy === 'revoke'} loadingLabel="Revoking…">
              Revoke incident report
            </LoadingButton>
          </form>
        )}

        <h4>Signatures <small>{signers.filter(s => signatures[s.slot]).length}/{signers.length}</small></h4>
        <ul className="ir-sign-list">
          {signers.map(s => {
            const sig = signatures[s.slot];
            return (
              <li key={s.slot}>
                <span className={`ir-dot${sig ? ' is-signed' : ''}`} aria-hidden="true" />
                <span>
                  <b>{sig?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind]}{s.title && (sig?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{sig ? `Signed ${new Date(sig.signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending signature'}</small>
                </span>
                {!sig && report.status === 'issued' && (
                  <button
                    type="button"
                    className={`ir-slot-copy ${copied === s.slot ? 'ar-copied' : ''}`}
                    onClick={() => copy(`${link}?sign=${s.slot}`, s.slot)}
                    title={`Copy signature link for ${s.name || s.title}`}
                    aria-label={`Copy signature link for ${s.name || s.title}`}
                  >
                    {copied === s.slot ? <Check size={13} /> : <Link2 size={13} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {approverSlot && report.status === 'issued' && (
          <form className="ir-inline" onSubmit={e => { e.preventDefault(); run('sign', () => signIncidentReport(report.id, approverSlot.slot, signName || approverSlot.name, user)); }}>
            <label className="task-field">
              <span>Sign as Approver — type “{approverSlot.name}”</span>
              <input value={signName} onChange={e => setSignName(e.target.value)} placeholder={approverSlot.name} />
            </label>
            <LoadingButton type="submit" className="task-primary" loading={busy === 'sign'} loadingLabel="Signing…">
              <PenLine size={14} /> Sign Incident Report
            </LoadingButton>
          </form>
        )}
      </div>

      <div className="ir-detail-doc">
        <IncidentReportFrame ref={frame} report={report} signatures={signatures} title={`Incident Report ${report.controlNumber}`} />
      </div>
    </div>
  );
}

export default function AdminIncidentReports({ firebaseUser, can }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [view, setView] = useState({ mode: 'list' });
  const user = firebaseUser;

  useEffect(() => subscribeIncidentReports(list => {
    setReports(list);
    setLoading(false);
    setError('');
  }, err => {
    setError(errorText(err));
    setLoading(false);
  }), []);

  if (!can('incidentreports:manage')) {
    return (
      <div className="task-module">
        <p className="task-error" role="alert">You need the “Manage Incident Reports” permission to access this module.</p>
      </div>
    );
  }

  const visible = reports.filter(r => {
    const matchStatus = status === 'all' || r.status === status;
    const matchSev = severity === 'all' || r.severity === severity;
    const matchSearch = !search || `${r.controlNumber} ${r.title} ${r.location} ${r.reportedByName}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSev && matchSearch;
  });

  const totalCount = reports.length;
  const draftCount = reports.filter(r => r.status === 'draft').length;
  const issuedCount = reports.filter(r => r.status === 'issued').length;
  const criticalCount = reports.filter(r => r.severity === 'critical' || r.severity === 'high').length;

  return (
    <div className="task-module ir-module">
      {view.mode === 'list' && (
        <>
          <header className="task-heading">
            <div>
              <p className="task-eyebrow">Operational Governance &amp; Compliance</p>
              <h2>Incident Reports</h2>
              <p>Log operational, security, and safety incidents with Brand Bible formatting, CAPA actions, and multi-slot e-signatures.</p>
            </div>
            <button type="button" className="task-primary task-heading-action" onClick={() => setView({ mode: 'edit' })}>
              <Plus size={16} /> New Incident Report
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Total Filed</span>
              <strong style={{ display: 'block', fontSize: 22, marginTop: 4 }}>{totalCount}</strong>
            </div>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Drafts</span>
              <strong style={{ display: 'block', fontSize: 22, marginTop: 4 }}>{draftCount}</strong>
            </div>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Issued / Open</span>
              <strong style={{ display: 'block', fontSize: 22, color: '#60a5fa', marginTop: 4 }}>{issuedCount}</strong>
            </div>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>High / Critical</span>
              <strong style={{ display: 'block', fontSize: 22, color: criticalCount > 0 ? '#ef4444' : 'var(--task-muted)', marginTop: 4 }}>{criticalCount}</strong>
            </div>
          </div>

          <div className="task-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
            <label className="task-search" style={{ minWidth: 260 }}>
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search control no., title, or location…"
                aria-label="Search incident reports"
              />
            </label>

            <div className="task-segmented" role="group" aria-label="Status filter">
              {['all', 'draft', 'issued', 'closed', 'revoked'].map(s => (
                <button type="button" key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>
                  {s === 'all' ? 'All Status' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <div className="task-segmented" role="group" aria-label="Severity filter">
              {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
                <button type="button" key={sev} aria-pressed={severity === sev} onClick={() => setSeverity(sev)}>
                  {sev === 'all' ? 'All Severity' : SEVERITIES[sev]?.label || sev}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="task-error" role="alert">{error}</p>}

          {loading ? (
            <div className="task-skeleton" role="status" aria-label="Loading incident reports" />
          ) : visible.length === 0 ? (
            <div className="task-empty">
              <ShieldAlert size={32} aria-hidden="true" />
              <h3>{reports.length ? 'No incident reports match your filter' : 'No incident reports logged yet'}</h3>
              <p>{reports.length ? 'Try clearing the search or severity filter.' : 'Click "New Incident Report" to create a branded incident document or paste an AI draft.'}</p>
            </div>
          ) : (
            <div className="ir-table-wrap">
              <table className="ir-table">
                <thead>
                  <tr>
                    <th scope="col">Control / Tracking No.</th>
                    <th scope="col">Incident Title</th>
                    <th scope="col">Category</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Incident Date</th>
                    <th scope="col">Signatures</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id}>
                      <th scope="row">
                        <button type="button" className="ir-link" onClick={() => setView({ mode: 'detail', id: r.id })}>
                          {r.controlNumber}
                        </button>
                      </th>
                      <td style={{ fontWeight: 600 }}>{r.title}</td>
                      <td>{CATEGORIES[r.category] || r.category || 'Operational'}</td>
                      <td>
                        <span className={`ir-sev-badge sev-${r.severity}`}><i></i>{r.severity.toUpperCase()}</span>
                      </td>
                      <td>{r.incidentDate ? longDate(r.incidentDate) : '—'}</td>
                      <td>{Object.keys(r.signers || {}).length} signer{Object.keys(r.signers || {}).length === 1 ? '' : 's'}</td>
                      <td>
                        <span className={`task-pill ir-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view.mode === 'edit' && (
        <Editor
          user={user}
          report={view.report}
          onClose={() => setView(view.report ? { mode: 'detail', id: view.report.id } : { mode: 'list' })}
          onSaved={id => setView({ mode: 'detail', id })}
        />
      )}

      {view.mode === 'detail' && (
        <Detail
          user={user}
          id={view.id}
          onBack={() => setView({ mode: 'list' })}
          onEdit={report => setView({ mode: 'edit', report })}
        />
      )}
    </div>
  );
}

