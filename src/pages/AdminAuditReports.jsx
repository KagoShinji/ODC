import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, ClipboardCheck, Link2, Check, Printer, ImageDown,
  Pencil, Send, Ban, Trash2, ArrowLeft, CheckCircle2, PenLine,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import AuditReportFrame from '../components/auditReports/AuditReportFrame';
import AuditReportEditor from '../components/auditReports/AuditReportEditor';
import {
  emptyAuditSigners, auditReportLink, AUDIT_CATEGORIES, AUDIT_RATINGS, SIGNER_KINDS,
} from '../utils/auditReportDocument';
import { BRAND_CO, longDate } from '../utils/brandDocument';
import {
  subscribeAuditReports, subscribeAuditReport, subscribeAuditSignatures,
  createAuditReport, updateAuditReport, issueAuditReport,
  closeAuditReport, revokeAuditReport, deleteAuditReportDraft, signAuditReport,
} from '../services/auditReportService';
import './AdminTasks.css';
import './AdminAuditReports.css';

const STATUS_LABEL = { draft: 'Draft', issued: 'Issued / In Progress', closed: 'Closed / Remediated', revoked: 'Revoked' };
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const errorText = err => (err?.code === 'permission-denied'
  ? 'You do not have permission for this action, or the report was updated elsewhere. Refresh and try again.'
  : err?.message || 'Something went wrong. Please try again.');

function mergeAuditParsed(f, parsed) {
  const next = { ...f };
  for (const key of ['title', 'category', 'rating', 'auditPeriodStart', 'auditPeriodEnd', 'auditDate', 'dateIssued', 'leadAuditorName', 'leadAuditorTitle', 'auditeeEntity', 'auditeeContact', 'auditTeam', 'referenceNo', 'classification', 'venueDomain']) {
    if (parsed.fields && parsed.fields[key]) next[key] = parsed.fields[key];
  }

  if (parsed.signers && Object.keys(parsed.signers).length) {
    next.signers = Object.entries(parsed.signers).map(([id, s]) => ({ id, ...s }));
  }

  return next;
}

function formFrom(report) {
  const signers = Object.entries(report?.signers || emptyAuditSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    title: report?.title || '',
    category: report?.category || 'it_security',
    rating: report?.rating || 'satisfactory',
    auditPeriodStart: report?.auditPeriodStart || todayIso(),
    auditPeriodEnd: report?.auditPeriodEnd || todayIso(),
    auditDate: report?.auditDate || todayIso(),
    dateIssued: report?.dateIssued || todayIso(),
    leadAuditorName: report?.leadAuditorName || '',
    leadAuditorTitle: report?.leadAuditorTitle || 'Lead Auditor',
    auditeeEntity: report?.auditeeEntity || 'Engineering & Operations',
    auditeeContact: report?.auditeeContact || '',
    auditTeam: report?.auditTeam || '',
    referenceNo: report?.referenceNo || '',
    classification: report?.classification || '',
    venueDomain: report?.venueDomain || '',
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
    setForm(f => mergeAuditParsed(f, parsed));
    setNotice('Audit draft parsed and formatted into the report. Check the details and signers, then save.');
  }, []);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const id = report ? (await updateAuditReport(user, report.id, form), report.id) : await createAuditReport(user, form);
      onSaved(id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ar-doc-editor">
      <div className="ar-doc-head">
        <button type="button" className="ar-back" onClick={onClose}><ArrowLeft size={14} /> Back to audit reports</button>
        <h3>{report ? `Editing ${report.controlNumber}` : 'New Audit Report'}</h3>
        <span className="task-muted">{report ? 'Draft — visible only to managers and authorized auditors.' : 'The tracking number is assigned on first save.'}</span>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="ar-notice" role="status">{notice}</p>}
      <div className="ar-doc-layout">
        <AuditReportEditor
          form={form}
          controlNumber={report?.controlNumber}
          initialContent={initialContent}
          onField={set}
          onDoc={onDoc}
          onParsed={onParsed}
        />
        <aside className="ar-doc-side" aria-label="Saving and details">
          <h4>Save &amp; Issue</h4>
          <p className="task-muted ar-small">Document audit objectives, scope, observations, criteria, and corrective actions thoroughly before issuing.</p>
          <div className="ar-doc-save">
            <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Saving…" onClick={save}>
              {report ? 'Save changes' : 'Save draft'}
            </LoadingButton>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
          <p className="task-muted ar-small">After saving, you can review the live frame preview, issue the audit report to generate its permanent verification link, and collect governance sign-offs.</p>
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

  useEffect(() => subscribeAuditReport(id, setReport, err => setError(errorText(err))), [id]);
  useEffect(() => subscribeAuditSignatures(id, setSignatures, () => setSignatures({})), [id]);

  if (report === undefined) return <div className="task-skeleton" role="status" aria-label="Loading audit report" />;
  if (report === null) return <p className="task-error" role="alert">This audit report no longer exists.</p>;

  const link = auditReportLink(report.id);
  const signers = Object.entries(report.signers || {})
    .map(([slot, s]) => ({ slot, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const run = async (key, work) => {
    setBusy(key); setError('');
    try { await work(); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(''); }
  };

  const copy = (key, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const issue = async () => {
    if (!await modal.confirm({
      title: `Issue Audit Report ${report.controlNumber}?`,
      message: `Issuing ${report.controlNumber} locks its contents and publishes it for official review. Designated signers will be able to sign via the verification link. Continue?`,
      confirmLabel: 'Issue Audit Report',
    })) return;
    run('issue', () => issueAuditReport(user, report.id));
  };

  const remove = async () => {
    if (!await modal.confirm({
      title: `Delete draft ${report.controlNumber}?`,
      message: `Permanently delete draft ${report.controlNumber}? The control number cannot be reused.`,
      confirmLabel: 'Delete draft',
    })) return;
    run('delete', async () => { await deleteAuditReportDraft(report.id); onBack(); });
  };

  const approverSlot = signers.find(s => s.kind === 'approver');
  const alreadySigned = approverSlot && Boolean(signatures[approverSlot.slot]);

  return (
    <div className="ar-detail">
      <aside className="ar-detail-side" aria-label="Audit report actions">
        <button type="button" className="ar-back" onClick={onBack}><ArrowLeft size={14} /> Back to audit reports</button>
        <span className={`task-pill ar-status-${report.status}`}>{STATUS_LABEL[report.status]}</span>
        <h3 className="ar-number">{report.controlNumber}</h3>
        {report.referenceNo && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--task-muted)', letterSpacing: '0.5px', marginTop: -4, marginBottom: 4 }}>
            REF: <code>{report.referenceNo}</code> {report.classification ? `· ${report.classification}` : ''}
          </div>
        )}
        <p className="ar-title">{report.title}</p>
        {report.venueDomain && (
          <div style={{ fontSize: 11, color: 'var(--task-muted)', marginBottom: 6 }}>
            Domain: <a href={`https://${report.venueDomain.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" style={{ color: '#ff6a13' }}>{report.venueDomain}</a>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`ar-rating-badge rating-${report.rating}`}>
            <i></i>{(AUDIT_RATINGS[report.rating]?.label || report.rating).toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--task-muted)' }}>· {AUDIT_CATEGORIES[report.category] || report.category}</span>
        </div>

        {error && <p className="task-error" role="alert">{error}</p>}

        <div className="ar-actions">
          {report.status === 'draft' && (
            <>
              <button type="button" className="task-primary" onClick={() => onEdit(report)}><Pencil size={14} /> Edit draft</button>
              <LoadingButton type="button" loading={busy === 'issue'} loadingLabel="Issuing…" onClick={issue}><Send size={14} /> Issue report</LoadingButton>
              <LoadingButton type="button" loading={busy === 'delete'} loadingLabel="Deleting…" onClick={remove}><Trash2 size={14} /> Delete draft</LoadingButton>
            </>
          )}

          {report.status !== 'draft' && (
            <>
              <button type="button" onClick={() => frame.current?.print()}><Printer size={14} /> Save as PDF</button>
              <LoadingButton type="button" loading={busy === 'png'} loadingLabel="Rendering…" onClick={() => run('png', () => frame.current.savePng(`${report.controlNumber}.png`))}>
                <ImageDown size={14} /> Save as PNG
              </LoadingButton>
              <button type="button" onClick={() => copy('link', link)}>
                {copied === 'link' ? <Check size={14} /> : <Link2 size={14} />} {copied === 'link' ? 'Copied' : 'Copy signing link'}
              </button>
            </>
          )}

          {report.status === 'issued' && (
            <>
              <button type="button" onClick={() => { setClosing(v => !v); setRevoking(false); }}>
                <CheckCircle2 size={14} /> Close / Remediate
              </button>
              <button type="button" onClick={() => { setRevoking(v => !v); setClosing(false); }}>
                <Ban size={14} /> Revoke report
              </button>
            </>
          )}
        </div>

        {closing && report.status === 'issued' && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('close', async () => { await closeAuditReport(user, report.id, reason); setClosing(false); setReason(''); }); }}>
            <label htmlFor="ar-close-reason" className="ar-small task-muted">Remediation / Resolution notes:</label>
            <textarea id="ar-close-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Explain how findings were verified and remediated…" />
            <LoadingButton type="submit" loading={busy === 'close'} loadingLabel="Closing…">Mark Audit Closed</LoadingButton>
          </form>
        )}

        {revoking && report.status === 'issued' && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('revoke', async () => { await revokeAuditReport(user, report.id, reason); setRevoking(false); setReason(''); }); }}>
            <label htmlFor="ar-revoke-reason" className="ar-small task-muted">Reason for revoking (required):</label>
            <textarea id="ar-revoke-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Explain why this audit report is being revoked…" required />
            <LoadingButton type="submit" loading={busy === 'revoke'} loadingLabel="Revoking…">Revoke Report</LoadingButton>
          </form>
        )}

        {report.status !== 'draft' && (
          <div className="ar-link-box">
            <span className="task-muted ar-small">Verification &amp; Signing URL:</span>
            <code>{link}</code>
          </div>
        )}

        <h4>Signers &amp; Audit Governance <small>({signers.filter(s => signatures[s.slot]).length}/{signers.length})</small></h4>
        <ul className="ar-sign-list">
          {signers.map(s => {
            const sig = signatures[s.slot];
            return (
              <li key={s.slot}>
                <span className={`ar-dot ${sig ? 'is-signed' : ''}`} />
                <span>
                  <b>{sig?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind] || 'Signer'}{s.title && (sig?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{sig ? `Signed ${new Date(sig.signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending signature'}</small>
                </span>
                {report.status !== 'draft' && !sig && (
                  <button type="button" onClick={() => copy(`slot-${s.slot}`, `${link}?sign=${s.slot}`)}>
                    {copied === `slot-${s.slot}` ? <Check size={12} /> : <Link2 size={12} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {report.status === 'issued' && approverSlot && !alreadySigned && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('sign', () => signAuditReport(report.id, approverSlot.slot, signName || approverSlot.name, user)); }}>
            <span className="ar-small task-muted">Sign as Management Approver:</span>
            <input
              value={signName}
              placeholder={approverSlot.name || BRAND_CO.approvedBy}
              onChange={e => setSignName(e.target.value)}
            />
            <LoadingButton type="submit" loading={busy === 'sign'} loadingLabel="Signing…">
              <PenLine size={13} /> Affix E-Signature
            </LoadingButton>
          </form>
        )}
      </aside>

      <div className="ar-detail-doc">
        <AuditReportFrame ref={frame} report={report} signatures={signatures} title={`Audit Report ${report.controlNumber}`} />
      </div>
    </div>
  );
}

export default function AdminAuditReports({ firebaseUser, can }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [rating, setRating] = useState('all');
  const [view, setView] = useState({ mode: 'list' });
  const user = firebaseUser;

  useEffect(() => subscribeAuditReports(list => {
    setReports(list);
    setLoading(false);
    setError('');
  }, err => {
    setError(errorText(err));
    setLoading(false);
  }), []);

  if (!can('auditreports:manage')) {
    return (
      <div className="task-module">
        <p className="task-error" role="alert">You need the “Manage Audit Reports” permission to access this module.</p>
      </div>
    );
  }

  const visible = reports.filter(r => {
    const matchStatus = status === 'all' || r.status === status;
    const matchRating = rating === 'all' || r.rating === rating;
    const matchSearch = !search || `${r.controlNumber} ${r.referenceNo || ''} ${r.classification || ''} ${r.venueDomain || ''} ${r.title} ${r.auditeeEntity} ${r.leadAuditorName}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchRating && matchSearch;
  });

  const totalCount = reports.length;
  const draftCount = reports.filter(r => r.status === 'draft').length;
  const issuedCount = reports.filter(r => r.status === 'issued').length;
  const unsatisfactoryCount = reports.filter(r => r.rating === 'unsatisfactory').length;

  return (
    <div className="task-module ar-module">
      {view.mode === 'list' && (
        <>
          <header className="task-heading">
            <div>
              <p className="task-eyebrow">Audit &amp; Quality Governance</p>
              <h2>Audit Reports</h2>
              <p>Execute and track IT, operational, financial, and compliance audits with Brand Bible formatting, CAPA actions, and 4-tier e-signatures.</p>
            </div>
            <button type="button" className="task-primary task-heading-action" onClick={() => setView({ mode: 'edit' })}>
              <Plus size={16} /> New Audit Report
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Total Audits</span>
              <strong style={{ display: 'block', fontSize: 22, marginTop: 4 }}>{totalCount}</strong>
            </div>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Drafts</span>
              <strong style={{ display: 'block', fontSize: 22, marginTop: 4 }}>{draftCount}</strong>
            </div>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Issued / Active</span>
              <strong style={{ display: 'block', fontSize: 22, color: '#60a5fa', marginTop: 4 }}>{issuedCount}</strong>
            </div>
            <div className="task-metric-card" style={{ padding: '12px 16px', background: '#ffffff05', border: '1px solid var(--task-line)', borderRadius: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--task-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700 }}>Unsatisfactory / Risk</span>
              <strong style={{ display: 'block', fontSize: 22, color: unsatisfactoryCount > 0 ? '#ef4444' : 'var(--task-muted)', marginTop: 4 }}>{unsatisfactoryCount}</strong>
            </div>
          </div>

          <div className="task-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
            <label className="task-search" style={{ minWidth: 260 }}>
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search control no., title, auditee, or auditor…"
                aria-label="Search audit reports"
              />
            </label>

            <div className="task-segmented" role="group" aria-label="Status filter">
              {['all', 'draft', 'issued', 'closed', 'revoked'].map(s => (
                <button type="button" key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>
                  {s === 'all' ? 'All Status' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <div className="task-segmented" role="group" aria-label="Rating filter">
              {['all', 'satisfactory', 'needs_improvement', 'unsatisfactory'].map(r => (
                <button type="button" key={r} aria-pressed={rating === r} onClick={() => setRating(r)}>
                  {r === 'all' ? 'All Ratings' : AUDIT_RATINGS[r]?.label || r}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="task-error" role="alert">{error}</p>}

          {loading ? (
            <div className="task-skeleton" role="status" aria-label="Loading audit reports" />
          ) : visible.length === 0 ? (
            <div className="task-empty">
              <ClipboardCheck size={32} aria-hidden="true" />
              <h3>{reports.length ? 'No audit reports match your filter' : 'No audit reports created yet'}</h3>
              <p>{reports.length ? 'Try clearing the search or rating filter.' : 'Click "New Audit Report" to draft an engagement or paste an AI report.'}</p>
            </div>
          ) : (
            <div className="ar-table-wrap">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th scope="col">Control / Tracking No.</th>
                    <th scope="col">Engagement Title</th>
                    <th scope="col">Scope Area</th>
                    <th scope="col">Overall Rating</th>
                    <th scope="col">Period Covered</th>
                    <th scope="col">Lead Auditor</th>
                    <th scope="col">Signatures</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.id}>
                      <th scope="row">
                        <button type="button" className="ar-link" onClick={() => setView({ mode: 'detail', id: r.id })}>
                          {r.controlNumber}
                        </button>
                      </th>
                      <td style={{ fontWeight: 600 }}>
                        <div>{r.title}</div>
                        {r.referenceNo && <small style={{ color: 'var(--task-muted)', fontSize: 11, fontWeight: 500, display: 'block' }}>Ref: {r.referenceNo}</small>}
                      </td>
                      <td>{AUDIT_CATEGORIES[r.category] || r.category || 'General Audit'}</td>
                      <td>
                        <span className={`ar-rating-badge rating-${r.rating || 'satisfactory'}`}>
                          <i></i>{(AUDIT_RATINGS[r.rating]?.label || r.rating || 'SATISFACTORY').toUpperCase()}
                        </span>
                      </td>
                      <td>{r.auditPeriodStart ? longDate(r.auditPeriodStart) : '—'}</td>
                      <td>{r.leadAuditorName || '—'}</td>
                      <td>{Object.keys(r.signers || {}).length} signer{Object.keys(r.signers || {}).length === 1 ? '' : 's'}</td>
                      <td>
                        <span className={`task-pill ar-status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
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

