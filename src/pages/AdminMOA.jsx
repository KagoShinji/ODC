import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Link2, Check, Printer, ImageDown,
  Pencil, Send, Ban, Trash2, ArrowLeft, PenLine, FileText,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import MoaFrame from '../components/moa/MoaFrame';
import MoaEditor from '../components/moa/MoaEditor';
import {
  emptyMoaSigners, moaLink, SIGNER_KINDS, moaNumberFor,
} from '../utils/moaDocument';
import { BRAND_CO, money, longDate } from '../utils/brandDocument';
import {
  subscribeMoas, subscribeMoa, subscribeMoaSignatures,
  createMoa, updateMoa, issueMoa, revokeMoa, deleteMoaDraft, signMoa,
} from '../services/moaService';
import './AdminTasks.css';
import './AdminAuditReports.css';

const STATUS_LABEL = {
  draft: 'Draft',
  issued: 'Issued / In Review',
  executed: 'Executed / Signed',
  revoked: 'Revoked',
  void: 'Void',
  cancelled: 'Cancelled',
};

const errorText = err => (err?.code === 'permission-denied'
  ? 'You do not have permission for this action, or the document was updated elsewhere.'
  : err?.message || 'Something went wrong. Please try again.');

function mergeMoaParsed(f, parsed) {
  const next = { ...f };
  for (const key of ['title', 'clientName', 'clientBusiness', 'clientAddress', 'projectCost', 'timeline', 'providerName', 'providerBusiness']) {
    if (parsed.fields && parsed.fields[key] !== undefined) next[key] = parsed.fields[key];
  }
  if (parsed.signers && Object.keys(parsed.signers).length) {
    next.signers = Object.entries(parsed.signers).map(([id, s]) => ({ id, ...s }));
  }
  return next;
}

function formFrom(moa) {
  const signers = Object.entries(moa?.signers || emptyMoaSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    title: moa?.title || moa?.purpose || 'System Enhancement & Technical Services Agreement',
    clientName: moa?.clientName || '',
    clientBusiness: moa?.clientBusiness || '',
    clientAddress: moa?.clientAddress || '',
    providerName: moa?.providerName || BRAND_CO.approvedBy,
    providerBusiness: moa?.providerBusiness || BRAND_CO.name,
    projectCost: moa?.projectCost || 0,
    timeline: moa?.timeline || 'Agreed project schedule',
    bodyJson: moa?.bodyJson || '',
    bodyText: moa?.body || moa?.freeformContent || '',
    signers,
  };
}

function Editor({ user, moa, onClose, onSaved }) {
  const [form, setForm] = useState(() => formFrom(moa));
  const [initialContent] = useState(() => {
    if (moa?.bodyJson) {
      try { return JSON.parse(moa.bodyJson); } catch { /* fallback */ }
    }
    return moa?.body || moa?.freeformContent || '';
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const onDoc = useCallback((json, text) => setForm(f => ({ ...f, bodyJson: JSON.stringify(json), bodyText: text })), []);
  const onParsed = useCallback(parsed => {
    setForm(f => mergeMoaParsed(f, parsed));
    setNotice('Agreement draft parsed into contract fields. Review signers and clauses, then save.');
  }, []);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const id = moa ? (await updateMoa(user, moa.id, form), moa.id) : await createMoa(user, form);
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
        <button type="button" className="ar-back" onClick={onClose}><ArrowLeft size={14} /> Back to agreements</button>
        <h3>{moa ? `Editing ${moaNumberFor(moa)}` : 'New Memorandum of Agreement'}</h3>
        <span className="task-muted">{moa ? 'Draft — review terms and signers before issuing.' : 'Control number is generated on first save.'}</span>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="ar-notice" role="status">{notice}</p>}
      <div className="ar-doc-layout">
        <MoaEditor
          form={form}
          controlNumber={moaNumberFor(moa)}
          initialContent={initialContent}
          onField={set}
          onDoc={onDoc}
          onParsed={onParsed}
        />
        <aside className="ar-doc-side" aria-label="Saving and details">
          <h4>Save &amp; Issue</h4>
          <p className="task-muted ar-small">Ensure deliverables, milestone payments, intellectual property clauses, and designated signatories are complete before issuing.</p>
          <div className="ar-doc-save">
            <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Saving…" onClick={save}>
              {moa ? 'Save changes' : 'Save draft'}
            </LoadingButton>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
          <p className="task-muted ar-small">After saving, you can review the document frame, issue the contract for client sign-off, or sign directly as Service Provider.</p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ user, id, onBack, onEdit, canEdit, canSign, canDelete }) {
  const modal = useSystemModal();
  const frame = useRef(null);
  const [moa, setMoa] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [signName, setSignName] = useState('');

  useEffect(() => subscribeMoa(id, setMoa, err => setError(errorText(err))), [id]);
  useEffect(() => subscribeMoaSignatures(id, setSignatures, () => setSignatures({})), [id]);

  if (moa === undefined) return <div className="task-skeleton" role="status" aria-label="Loading agreement" />;
  if (moa === null) return <p className="task-error" role="alert">This agreement no longer exists.</p>;

  const number = moaNumberFor(moa);
  const link = moaLink(moa.id);
  const status = (moa.status || 'draft').toLowerCase();

  const signers = Object.entries(moa.signers || emptyMoaSigners())
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
      title: `Issue Agreement ${number}?`,
      message: `Issuing ${number} locks the contract terms and enables electronic signing via the client verification link. Continue?`,
      confirmLabel: 'Issue Agreement',
    })) return;
    run('issue', () => issueMoa(user, moa.id));
  };

  const remove = async () => {
    if (!await modal.confirm({
      title: `Delete draft ${number}?`,
      message: `Permanently delete draft ${number}? This action cannot be undone.`,
      confirmLabel: 'Delete draft',
    })) return;
    run('delete', async () => { await deleteMoaDraft(moa.id); onBack(); });
  };

  // Provider / Management signer slot
  const providerSlot = signers.find(s => s.kind === 'provider') || signers[0];
  const providerAlreadySigned = providerSlot && Boolean(signatures[providerSlot.slot] || signatures.provider || moa.providerSigned);

  return (
    <div className="ar-detail">
      <aside className="ar-detail-side" aria-label="MOA actions">
        <button type="button" className="ar-back" onClick={onBack}><ArrowLeft size={14} /> Back to agreements</button>
        <span className={`task-pill ar-status-${status}`}>{STATUS_LABEL[status] || status.toUpperCase()}</span>
        <h3 className="ar-number">{number}</h3>
        <p className="ar-title">{moa.title || moa.purpose || 'Memorandum of Agreement'}</p>

        <div style={{ fontSize: 12, color: 'var(--task-muted)', marginBottom: 8 }}>
          <div>Client: <strong style={{ color: '#fff' }}>{moa.clientName || '—'}</strong> ({moa.clientBusiness || 'Enterprise'})</div>
          <div>Project Cost: <strong style={{ color: '#ff6a13' }}>₱{money(moa.projectCost)}</strong></div>
        </div>

        {error && <p className="task-error" role="alert">{error}</p>}

        <div className="ar-actions">
          {status === 'draft' && (
            <>
              {canEdit && (
                <button type="button" className="task-primary" onClick={() => onEdit(moa)}><Pencil size={14} /> Edit draft</button>
              )}
              <LoadingButton type="button" loading={busy === 'issue'} loadingLabel="Issuing…" onClick={issue}><Send size={14} /> Issue agreement</LoadingButton>
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
              <Ban size={14} /> Revoke agreement
            </button>
          )}
        </div>

        {revoking && status === 'issued' && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('revoke', async () => { await revokeMoa(user, moa.id, reason); setRevoking(false); setReason(''); }); }}>
            <label htmlFor="moa-revoke-reason" className="ar-small task-muted">Reason for revoking:</label>
            <textarea id="moa-revoke-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Explain why this agreement is revoked…" required />
            <LoadingButton type="submit" loading={busy === 'revoke'} loadingLabel="Revoking…">Revoke Agreement</LoadingButton>
          </form>
        )}

        {status !== 'draft' && (
          <div className="ar-link-box">
            <span className="task-muted ar-small">Client Verification Link:</span>
            <code>{link}</code>
          </div>
        )}

        <h4>Signers &amp; Sign-off Status <small>({signers.filter(s => signatures[s.slot] || (s.kind === 'provider' && (signatures.provider || moa.providerSigned)) || (s.kind === 'client' && (signatures.client || moa.clientSigned))).length}/{signers.length})</small></h4>
        <ul className="ar-sign-list">
          {signers.map(s => {
            const sig = signatures[s.slot] ||
              (s.kind === 'provider' && (signatures.provider || (moa.providerSigned ? { name: moa.providerSigneeName || moa.providerName, signedAt: moa.providerSignedAt } : null))) ||
              (s.kind === 'client' && (signatures.client || (moa.clientSigned ? { name: moa.clientSigneeName || moa.clientName, signedAt: moa.clientSignedAt } : null)));
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

        {status === 'issued' && providerSlot && !providerAlreadySigned && canSign && (
          <form className="ar-inline" onSubmit={e => { e.preventDefault(); run('sign', () => signMoa(moa.id, providerSlot.slot, signName || providerSlot.name || BRAND_CO.approvedBy, user)); }}>
            <span className="ar-small task-muted">Sign as Service Provider Lead:</span>
            <input
              value={signName}
              placeholder={providerSlot.name || BRAND_CO.approvedBy}
              onChange={e => setSignName(e.target.value)}
            />
            <LoadingButton type="submit" loading={busy === 'sign'} loadingLabel="Signing…">
              <PenLine size={13} /> Affix E-Signature
            </LoadingButton>
          </form>
        )}
      </aside>

      <div className="ar-detail-doc">
        <MoaFrame ref={frame} moa={moa} signatures={signatures} title={`Agreement ${number}`} />
      </div>
    </div>
  );
}

export default function AdminMOA({ firebaseUser, isSuperAdmin, can }) {
  const canCreateMOA = can ? can('moa:create') : isSuperAdmin;
  const canEditMOA = can ? can('moa:edit') : isSuperAdmin;
  const canSignMOA = can ? can('moa:sign') : isSuperAdmin;
  const canDeleteMOA = can ? can('moa:delete') : isSuperAdmin;

  const [moas, setMoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState({ mode: 'list' });
  const user = firebaseUser;

  useEffect(() => subscribeMoas(list => {
    setMoas(list);
    setLoading(false);
    setError('');
  }, err => {
    setError(errorText(err));
    setLoading(false);
  }), []);

  const visible = moas.filter(m => {
    if (status !== 'all' && (m.status || 'draft').toLowerCase() !== status) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const num = moaNumberFor(m).toLowerCase();
    const title = (m.title || m.purpose || '').toLowerCase();
    const client = (m.clientName || '').toLowerCase();
    const business = (m.clientBusiness || '').toLowerCase();
    return num.includes(q) || title.includes(q) || client.includes(q) || business.includes(q);
  });

  if (view.mode === 'edit') {
    return <Editor user={user} moa={view.moa} onClose={() => setView({ mode: 'list' })} onSaved={id => setView({ mode: 'detail', id })} />;
  }

  if (view.mode === 'detail') {
    return (
      <Detail
        user={user}
        id={view.id}
        onBack={() => setView({ mode: 'list' })}
        onEdit={m => setView({ mode: 'edit', moa: m })}
        canEdit={canEditMOA}
        canSign={canSignMOA}
        canDelete={canDeleteMOA}
      />
    );
  }

  return (
    <div className="task-module">
      <div className="task-heading">
        <div>
          <h2>Memorandum of Agreement</h2>
          <span className="task-muted">Draft, issue, sign, and manage legal agreements with clients and partners.</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canCreateMOA && (
            <button type="button" className="task-primary task-heading-action" onClick={() => setView({ mode: 'edit' })}>
              <Plus size={16} /> New MOA
            </button>
          )}
        </div>
      </div>

      <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Total MOAs', v: moas.length, c: '#fff' },
          { l: 'Issued / In Review', v: moas.filter(m => (m.status || '').toLowerCase() === 'issued' || (m.status || '').toLowerCase() === 'pending').length, c: '#ff6a13' },
          { l: 'Executed', v: moas.filter(m => (m.status || '').toLowerCase() === 'executed' || (m.providerSigned && m.clientSigned)).length, c: '#10b981' },
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
            placeholder="Search control no., client, or title…"
            aria-label="Search agreements"
          />
        </label>
        <div className="task-pills" role="radiogroup" aria-label="Filter by status">
          {['all', 'draft', 'issued', 'executed', 'revoked'].map(s => (
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
        <div className="task-skeleton" role="status" aria-label="Loading agreements" />
      ) : visible.length === 0 ? (
        <div className="task-empty">
          <FileText size={32} />
          <h3>{moas.length ? 'No agreements match your search' : 'No agreements generated yet'}</h3>
          <p>{moas.length ? 'Try a different filter or search term.' : 'Create an agreement with the visual editor or paste an AI draft.'}</p>
        </div>
      ) : (
        <div className="task-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="task-table">
            <thead>
              <tr>
                <th>MOA Number</th>
                <th>Client / Entity</th>
                <th>Project Cost</th>
                <th>Status</th>
                <th>Signatures</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(m => {
                const num = moaNumberFor(m);
                const st = (m.status || 'draft').toLowerCase();
                const signers = Object.values(m.signers || emptyMoaSigners());
                return (
                  <tr key={m.id} onClick={() => setView({ mode: 'detail', id: m.id })} style={{ cursor: 'pointer' }}>
                    <td><strong style={{ color: '#fff' }}>{num}</strong></td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{m.clientName || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--task-muted)' }}>{m.clientBusiness || m.title || 'Client Partner'}</div>
                    </td>
                    <td><strong style={{ color: '#ff6a13' }}>₱{money(m.projectCost)}</strong></td>
                    <td><span className={`task-pill ar-status-${st}`}>{STATUS_LABEL[st] || st.toUpperCase()}</span></td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--task-muted)' }}>
                        {(m.providerSigned && m.clientSigned) || st === 'executed' ? '2/2 Signed' : m.providerSigned || m.clientSigned ? '1/2 Signed' : '0/2 Signed'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setView({ mode: 'detail', id: m.id }); }}
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
