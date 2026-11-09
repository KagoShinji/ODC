import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Link2, Check, Printer, ImageDown,
  Pencil, Send, Ban, Trash2, ArrowLeft, PenLine, FileText,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import AcceptanceFrame from '../components/acceptance/AcceptanceFrame';
import AcceptanceEditor from '../components/acceptance/AcceptanceEditor';
import {
  emptyAcceptanceSigners, acceptanceLink, SIGNER_KINDS, certificateNumberFor,
} from '../utils/acceptanceDocument';
import { BRAND_CO, longDate } from '../utils/brandDocument';
import {
  subscribeCertificates, subscribeCertificate, subscribeCertificateSignatures,
  createCertificate, updateCertificate, issueCertificate, revokeCertificate, deleteCertificateDraft, signCertificate,
} from '../services/acceptanceService';
import './AdminTasks.css';
import './AdminAuditReports.css';

const STATUS_LABEL = {
  draft: 'Draft',
  issued: 'Issued / In Review',
  accepted: 'Accepted & Conforme',
  revoked: 'Revoked',
};

const errorText = err => (err?.code === 'permission-denied'
  ? 'You do not have permission for this action, or the document was updated elsewhere.'
  : err?.message || 'Something went wrong. Please try again.');

function mergeAcceptanceParsed(f, parsed) {
  const next = { ...f };
  for (const key of ['projectName', 'clientName', 'clientBusiness', 'clientAddress', 'turnoverDate', 'providerName', 'providerBusiness']) {
    if (parsed.fields && parsed.fields[key] !== undefined) next[key] = parsed.fields[key];
  }
  if (parsed.signers && Object.keys(parsed.signers).length) {
    next.signers = Object.entries(parsed.signers).map(([id, s]) => ({ id, ...s }));
  }
  return next;
}

function formFrom(coa) {
  const signers = Object.entries(coa?.signers || emptyAcceptanceSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    projectName: coa?.projectName || 'Digital Engineering Project',
    clientName: coa?.clientName || '',
    clientBusiness: coa?.clientBusiness || '',
    clientAddress: coa?.clientAddress || '',
    providerName: coa?.providerName || coa?.providerRep || BRAND_CO.approvedBy,
    providerBusiness: coa?.providerBusiness || BRAND_CO.name,
    turnoverDate: coa?.turnoverDate || new Date().toISOString().split('T')[0],
    customText: coa?.customText || '',
    bodyJson: coa?.bodyJson || '',
    bodyText: coa?.body || '',
    scope: Array.isArray(coa?.scope) ? coa.scope : [],
    signers,
  };
}

function Editor({ user, coa, onClose, onSaved }) {
  const [form, setForm] = useState(() => formFrom(coa));
  const [initialContent] = useState(() => {
    if (coa?.bodyJson) {
      try { return JSON.parse(coa.bodyJson); } catch { /* fallback */ }
    }
    return coa?.body || coa?.customText || '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const onDoc = useCallback((json, text) => setForm(f => ({ ...f, bodyJson: JSON.stringify(json), bodyText: text })), []);
  const onParsed = useCallback(parsed => {
    setForm(f => mergeAcceptanceParsed(f, parsed));
    setNotice('Certificate draft parsed into fields. Review deliverables and signers, then save.');
  }, []);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const id = coa ? (await updateCertificate(user, coa.id, form), coa.id) : await createCertificate(user, form);
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
        <button type="button" className="ar-back" onClick={onClose}><ArrowLeft size={14} /> Back to certificates</button>
        <h3>{coa ? `Editing ${certificateNumberFor(coa)}` : 'New Certificate of Acceptance'}</h3>
        <span className="task-muted">{coa ? 'Draft — review handover deliverables and signers before issuing.' : 'Certificate number is generated on first save.'}</span>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="ar-notice" role="status">{notice}</p>}
      <div className="ar-doc-layout">
        <AcceptanceEditor
          form={form}
          controlNumber={certificateNumberFor(coa)}
          initialContent={initialContent}
          onField={set}
          onDoc={onDoc}
          onParsed={onParsed}
        />
        <aside className="ar-doc-side" aria-label="Saving and details">
          <h4>Save &amp; Issue</h4>
          <p className="task-muted ar-small">Verify completed software deliverables, deployment environments, and designated client signatories before issuing.</p>
          <div className="ar-doc-save">
            <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Saving…" onClick={save}>
              {coa ? 'Save changes' : 'Save draft'}
            </LoadingButton>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
          <p className="task-muted ar-small">After saving, you can review the document frame, issue the certificate for client acceptance, or sign directly as Service Provider lead.</p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ user, id, onBack, onEdit, canEdit, canDelete }) {
  const modal = useSystemModal();
  const frame = useRef(null);
  const [coa, setCoa] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [signName, setSignName] = useState('');

  useEffect(() => subscribeCertificate(id, setCoa, err => setError(errorText(err))), [id]);
  useEffect(() => subscribeCertificateSignatures(id, setSignatures, () => setSignatures({})), [id]);

  if (coa === undefined) return <div className="task-skeleton" role="status" aria-label="Loading certificate" />;
  if (coa === null) return <p className="task-error" role="alert">This certificate no longer exists.</p>;

  const number = certificateNumberFor(coa);
  const link = acceptanceLink(coa.id);
  const status = (coa.status || 'draft').toLowerCase();

  const signers = Object.entries(coa.signers || emptyAcceptanceSigners())
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
      title: `Issue Certificate ${number}?`,
      message: `Issuing ${number} locks the handover terms and enables client electronic acceptance via the verification link. Continue?`,
      confirmLabel: 'Issue Certificate',
    })) return;
    run('issue', () => issueCertificate(user, coa.id));
  };

  const remove = async () => {
    if (!await modal.confirm({
      title: `Delete draft ${number}?`,
      message: `Permanently delete draft ${number}? This action cannot be undone.`,
      confirmLabel: 'Delete draft',
    })) return;
    run('delete', async () => { await deleteCertificateDraft(coa.id); onBack(); });
  };

  // Provider / Turnover signer slot
  const turnoverSlot = signers.find(s => s.kind === 'turnover') || signers[0];
  const turnoverAlreadySigned = turnoverSlot && Boolean(signatures[turnoverSlot.slot] || signatures.issuer || coa.providerSigned);

  return (
    <div className="ar-detail">
      <aside className="ar-detail-side" aria-label="Certificate actions">
        <button type="button" className="ar-back" onClick={onBack}><ArrowLeft size={14} /> Back to certificates</button>
        <span className={`task-pill ar-status-${status}`}>{STATUS_LABEL[status] || status.toUpperCase()}</span>
        <h3 className="ar-number">{number}</h3>
        <p className="ar-title">{coa.projectName || 'Certificate of Acceptance'}</p>

        <div style={{ fontSize: 12, color: 'var(--task-muted)', marginBottom: 8 }}>
          <div>Client: <strong style={{ color: '#fff' }}>{coa.clientBusiness || coa.clientName || '—'}</strong></div>
          <div>Turnover Date: <strong style={{ color: '#ff6a13' }}>{longDate(coa.turnoverDate) || coa.turnoverDate || '—'}</strong></div>
        </div>

        {error && <p className="task-error" role="alert">{error}</p>}

        <div className="ar-actions">
          {status === 'draft' && (
            <>
              {canEdit && (
                <button type="button" className="task-primary" onClick={() => onEdit(coa)}><Pencil size={14} /> Edit draft</button>
              )}
              <LoadingButton type="button" loading={busy === 'issue'} loadingLabel="Issuing…" onClick={issue}><Send size={14} /> Issue certificate</LoadingButton>
              {canDelete && (
                <LoadingButton type="button" loading={busy === 'delete'} loadingLabel="Deleting…" onClick={remove}><Trash2 size={14} /> Delete draft</LoadingButton>
              )}
            </>
          )}

          {status !== 'draft' && (
            <>
              <button type="button" onClick={() => frame.current?.print()}><Printer size={14} /> Save as PDF</button>
              <LoadingButton type="button" loading={busy === 'png'} loadingLabel="Rendering…" onClick={() => run('png', () => frame.current.savePng(`${number}.png`))}>
                <ImageDown size={14} /> Save as PNG
              </LoadingButton>
              <button type="button" onClick={() => copy('link', link)}>
                {copied === 'link' ? <Check size={14} /> : <Link2 size={14} />} {copied === 'link' ? 'Copied' : 'Copy signing link'}
              </button>
            </>
          )}

          {status === 'issued' && (
            <button type="button" onClick={() => setRevoking(v => !v)}>
              <Ban size={14} /> Revoke certificate
            </button>
          )}
        </div>

        {revoking && status === 'issued' && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('revoke', async () => { await revokeCertificate(user, coa.id, reason); setRevoking(false); setReason(''); }); }}>
            <label htmlFor="coa-revoke-reason" className="ar-small task-muted">Reason for revoking:</label>
            <textarea id="coa-revoke-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Explain why this certificate is revoked…" required />
            <LoadingButton type="submit" loading={busy === 'revoke'} loadingLabel="Revoking…">Revoke Certificate</LoadingButton>
          </form>
        )}

        {status !== 'draft' && (
          <div className="ar-link-box">
            <span className="task-muted ar-small">Client Acceptance Link:</span>
            <code>{link}</code>
          </div>
        )}

        <h4>Signers &amp; Handover Governance <small>({signers.filter(s => signatures[s.slot] || (s.kind === 'turnover' && (signatures.issuer || coa.providerSigned)) || (s.kind === 'acceptor' && (signatures.acceptor || coa.signeeName))).length}/{signers.length})</small></h4>
        <ul className="ar-sign-list">
          {signers.map(s => {
            const sig = signatures[s.slot] ||
              (s.kind === 'turnover' && (signatures.issuer || (coa.providerSigned ? { name: coa.providerSigneeName || coa.providerName, signedAt: coa.providerSignedAt } : null))) ||
              (s.kind === 'acceptor' && (signatures.acceptor || (coa.signeeName ? { name: coa.signeeName, signedAt: coa.acceptedAt } : null)));
            return (
              <li key={s.slot}>
                <span className={`ar-dot ${sig ? 'is-signed' : ''}`} />
                <span>
                  <b>{sig?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind] || 'Signer'}{s.title && (sig?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{sig ? `Signed ${new Date(sig.signedAt?.toDate?.() || sig.signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending signature'}</small>
                </span>
                {status !== 'draft' && !sig && (
                  <button type="button" onClick={() => copy(`slot-${s.slot}`, `${link}?sign=${s.slot}`)}>
                    {copied === `slot-${s.slot}` ? <Check size={12} /> : <Link2 size={12} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {status === 'issued' && turnoverSlot && !turnoverAlreadySigned && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('sign', () => signCertificate(coa.id, turnoverSlot.slot, signName || turnoverSlot.name || BRAND_CO.approvedBy, user)); }}>
            <span className="ar-small task-muted">Sign as Service Provider Lead:</span>
            <input
              value={signName}
              placeholder={turnoverSlot.name || BRAND_CO.approvedBy}
              onChange={e => setSignName(e.target.value)}
            />
            <LoadingButton type="submit" loading={busy === 'sign'} loadingLabel="Signing…">
              <PenLine size={13} /> Affix E-Signature
            </LoadingButton>
          </form>
        )}
      </aside>

      <div className="ar-detail-doc">
        <AcceptanceFrame ref={frame} certificate={coa} signatures={signatures} title={`Certificate ${number}`} />
      </div>
    </div>
  );
}

export default function AdminAcceptance({ firebaseUser, isSuperAdmin, can }) {
  const canCreateCert = can ? can('acceptance:create') : isSuperAdmin;
  const canEditCert = can ? can('acceptance:edit') : isSuperAdmin;
  const canDeleteCert = can ? can('acceptance:delete') : isSuperAdmin;

  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState({ mode: 'list' });
  const user = firebaseUser;

  useEffect(() => subscribeCertificates(list => {
    setCoas(list);
    setLoading(false);
    setError('');
  }, err => {
    setError(errorText(err));
    setLoading(false);
  }), []);

  const visible = coas.filter(c => {
    if (status !== 'all' && (c.status || 'draft').toLowerCase() !== status) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const num = certificateNumberFor(c).toLowerCase();
    const project = (c.projectName || '').toLowerCase();
    const client = (c.clientName || '').toLowerCase();
    const business = (c.clientBusiness || '').toLowerCase();
    return num.includes(q) || project.includes(q) || client.includes(q) || business.includes(q);
  });

  if (view.mode === 'edit') {
    return <Editor user={user} coa={view.coa} onClose={() => setView({ mode: 'list' })} onSaved={id => setView({ mode: 'detail', id })} />;
  }

  if (view.mode === 'detail') {
    return (
      <Detail
        user={user}
        id={view.id}
        onBack={() => setView({ mode: 'list' })}
        onEdit={c => setView({ mode: 'edit', coa: c })}
        canEdit={canEditCert}
        canDelete={canDeleteCert}
      />
    );
  }

  return (
    <div className="task-module">
      <div className="task-heading">
        <div>
          <h2>Certificates of Acceptance</h2>
          <span className="task-muted">Draft, issue, and manage client project handover and acceptance certificates.</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canCreateCert && (
            <button type="button" className="task-primary task-heading-action" onClick={() => setView({ mode: 'edit' })}>
              <Plus size={16} /> New Certificate
            </button>
          )}
        </div>
      </div>

      <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Total Certificates', v: coas.length, c: '#fff' },
          { l: 'Issued / In Review', v: coas.filter(c => (c.status || '').toLowerCase() === 'issued' || (c.status || '').toLowerCase() === 'pending').length, c: '#ff6a13' },
          { l: 'Accepted', v: coas.filter(c => (c.status || '').toLowerCase() === 'accepted' || c.signeeName).length, c: '#10b981' },
        ].map(({ l, v, c }) => (
          <div key={l} className="task-card" style={{ padding: '16px 20px' }}>
            <div style={{ color: 'var(--task-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{l}</div>
            <div style={{ color: c, fontSize: 22, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="task-filters">
        <label className="task-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search certificate no., project, or client…"
            aria-label="Search certificates"
          />
        </label>
        <div className="task-pills" role="radiogroup" aria-label="Filter by status">
          {['all', 'draft', 'issued', 'accepted', 'revoked'].map(s => (
            <button
              key={s}
              type="button"
              className={`task-pill-btn ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s] || s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="task-error" role="alert">{error}</p>}

      {loading ? (
        <div className="task-skeleton" role="status" aria-label="Loading certificates" />
      ) : visible.length === 0 ? (
        <div className="task-empty">
          <FileText size={32} />
          <h3>{coas.length ? 'No certificates match your search' : 'No certificates generated yet'}</h3>
          <p>{coas.length ? 'Try a different filter or search term.' : 'Create a handover certificate with the visual editor or paste an AI draft.'}</p>
        </div>
      ) : (
        <div className="task-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="task-table">
            <thead>
              <tr>
                <th>Certificate No.</th>
                <th>Project Name</th>
                <th>Client Partner</th>
                <th>Turnover Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(c => {
                const num = certificateNumberFor(c);
                const st = (c.status || 'draft').toLowerCase();
                return (
                  <tr key={c.id} onClick={() => setView({ mode: 'detail', id: c.id })} style={{ cursor: 'pointer' }}>
                    <td><strong style={{ color: '#fff' }}>{num}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{c.projectName || '—'}</div>
                    </td>
                    <td>
                      <div style={{ color: '#fff' }}>{c.clientBusiness || c.clientName || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--task-muted)' }}>{c.clientName || 'Representative'}</div>
                    </td>
                    <td><span style={{ color: 'var(--task-muted)' }}>{longDate(c.turnoverDate) || c.turnoverDate || '—'}</span></td>
                    <td><span className={`task-pill ar-status-${st}`}>{STATUS_LABEL[st] || st.toUpperCase()}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setView({ mode: 'detail', id: c.id }); }}
                        className="btn btn-secondary btn-sm"
                      >
                        View &amp; Sign
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
