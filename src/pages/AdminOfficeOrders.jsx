import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, ScrollText, Link2, Check, Printer, ImageDown, Pencil, Send, Ban, Trash2, ArrowLeft, UserPlus, X, PenLine } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import OfficeOrderFrame from '../components/officeOrders/OfficeOrderFrame';
import OfficeOrderEditor from '../components/officeOrders/OfficeOrderEditor';
import { SIGNER_KINDS, emptySigners, editorContentOf, officeOrderLink, isRoleLine } from '../utils/officeOrderDocument';
import { longDate } from '../utils/brandDocument';
import {
  subscribeOfficeOrders, subscribeOfficeOrder, subscribeSignatures, createOfficeOrder, updateOfficeOrder, issueOfficeOrder,
  revokeOfficeOrder, deleteOfficeOrderDraft, signOfficeOrder,
} from '../services/officeOrderService';
import './AdminTasks.css';
import './AdminOfficeOrders.css';

const STATUS_LABEL = { draft: 'Draft', issued: 'Issued', revoked: 'Revoked' };
const newSlotId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const errorText = err => (err?.code === 'permission-denied' ? 'You do not have permission for this action, or the order changed. Refresh and try again.' : err?.message || 'Something went wrong. Please try again.');

function formFrom(order) {
  const signers = Object.entries(order?.signers || emptySigners()).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0));
  return {
    subject: order?.subject || '', to: order?.to || '', cc: order?.cc || '',
    fromName: order?.fromName ?? 'Jetch Merald S. Madaya', fromTitle: order?.fromTitle ?? 'Founder',
    date: order?.date || todayIso(), effectivity: order?.effectivity || '', bodyJson: order?.bodyJson || '', bodyText: order?.body || '', signers,
  };
}

/** Fills memo fields and signers from a pasted draft, keeping anything the paste did not mention. */
function mergeParsed(f, parsed) {
  const next = { ...f };
  for (const key of ['subject', 'to', 'cc', 'fromName', 'fromTitle', 'date', 'effectivity']) if (parsed[key]) next[key] = parsed[key];
  if (!parsed.issuers.length && !parsed.acknowledgers.length) return next;
  const [issuer, ...cosigners] = parsed.issuers;
  const keptIssuer = f.signers.find(s => s.kind === 'issuer');
  next.signers = [
    { ...(keptIssuer || { id: 's1' }), kind: 'issuer', ...(issuer ? { name: issuer.name, title: issuer.title || keptIssuer?.title || '' } : {}) },
    ...(cosigners.length ? cosigners.map(p => ({ id: newSlotId(), kind: 'cosigner', ...p })) : f.signers.filter(s => s.kind === 'cosigner')),
    ...(parsed.acknowledgers.length
      ? parsed.acknowledgers.map(p => (isRoleLine(p.name) && !p.title ? { id: newSlotId(), kind: 'acknowledger', name: '', title: p.name } : { id: newSlotId(), kind: 'acknowledger', ...p }))
      : f.signers.filter(s => s.kind === 'acknowledger')),
  ];
  return next;
}

function SignerRows({ kind, rows, onChange, onRemove, onAdd, addLabel, hint }) {
  return (
    <fieldset className="task-field oo-signers">
      <legend>{SIGNER_KINDS[kind]} {hint && <small>{hint}</small>}</legend>
      {rows.map(s => (
        <div className="oo-signer-row" key={s.id}>
          <input aria-label={`${SIGNER_KINDS[kind]} name`} value={s.name} maxLength={200} placeholder={kind === 'acknowledger' ? 'Name (optional)' : 'Full name'} onChange={e => onChange(s.id, 'name', e.target.value)} />
          <input aria-label={`${SIGNER_KINDS[kind]} position`} value={s.title} maxLength={200} placeholder={kind === 'acknowledger' ? 'Role, e.g. Operations Manager' : 'Position, e.g. Co-Founder'} onChange={e => onChange(s.id, 'title', e.target.value)} />
          {(kind !== 'issuer') && <button type="button" aria-label="Remove signer" onClick={() => onRemove(s.id)}><X size={14} /></button>}
        </div>
      ))}
      {onAdd && <button type="button" className="oo-add" onClick={onAdd}><UserPlus size={14} /> {addLabel}</button>}
    </fieldset>
  );
}

function Editor({ user, order, onClose, onSaved }) {
  const [form, setForm] = useState(() => formFrom(order));
  const [initialContent] = useState(() => editorContentOf(order));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setSigner = (id, key, value) => setForm(f => ({ ...f, signers: f.signers.map(s => (s.id === id ? { ...s, [key]: value } : s)) }));
  const removeSigner = id => setForm(f => ({ ...f, signers: f.signers.filter(s => s.id !== id) }));
  const addSigner = (kind, title = '') => setForm(f => ({ ...f, signers: [...f.signers, { id: newSlotId(), kind, name: '', title }] }));
  const onDoc = useCallback((json, text) => setForm(f => ({ ...f, bodyJson: JSON.stringify(json), bodyText: text })), []);
  const onParsed = useCallback(parsed => {
    setForm(f => mergeParsed(f, parsed));
    setNotice('Draft formatted onto the page. Check the memo lines and signers, then save.');
  }, []);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const id = order ? (await updateOfficeOrder(user, order.id, form), order.id) : await createOfficeOrder(user, form);
      onSaved(id);
    } catch (err) { setError(errorText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="oo-doc-editor">
      <div className="oo-doc-head">
        <button type="button" className="oo-back" onClick={onClose}><ArrowLeft size={14} /> Back to office orders</button>
        <h3>{order ? `Editing ${order.controlNumber}` : 'New office order'}</h3>
        <span className="task-muted">{order ? 'Draft — only you and other managers can see it.' : 'The control number (also the tracking number) is assigned on first save.'}</span>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="oo-notice" role="status">{notice}</p>}
      <div className="oo-doc-layout">
        <OfficeOrderEditor form={form} controlNumber={order?.controlNumber} initialContent={initialContent} onField={set} onDoc={onDoc} onParsed={onParsed} />
        <aside className="oo-doc-side" aria-label="Signers and saving">
          <h4>Signatures</h4>
          <SignerRows kind="issuer" rows={form.signers.filter(s => s.kind === 'issuer')} onChange={setSigner} />
          <SignerRows kind="cosigner" rows={form.signers.filter(s => s.kind === 'cosigner')} hint="(optional — co-founders)" onChange={setSigner} onRemove={removeSigner} onAdd={() => addSigner('cosigner', 'Co-Founder')} addLabel="Add co-founder" />
          <SignerRows kind="acknowledger" rows={form.signers.filter(s => s.kind === 'acknowledger')} hint="(optional — Operations Manager, staff)" onChange={setSigner} onRemove={removeSigner} onAdd={() => addSigner('acknowledger')} addLabel="Add acknowledgement line" />
          <div className="oo-doc-save">
            <LoadingButton type="button" className="task-primary" loading={busy} loadingLabel="Saving…" onClick={save}>{order ? 'Save changes' : 'Save draft'}</LoadingButton>
            <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          </div>
          <p className="task-muted oo-small">After saving, open the order to see the final document, then issue it to share its link and collect signatures.</p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ user, id, onBack, onEdit }) {
  const modal = useSystemModal();
  const frame = useRef(null);
  const [order, setOrder] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [signName, setSignName] = useState('');

  useEffect(() => subscribeOfficeOrder(id, setOrder, err => setError(errorText(err))), [id]);
  useEffect(() => subscribeSignatures(id, setSignatures, () => setSignatures({})), [id]);

  if (order === undefined) return <div className="task-skeleton" role="status" aria-label="Loading office order" />;
  if (order === null) return <p className="task-error" role="alert">This office order no longer exists.</p>;

  const link = officeOrderLink(order.id);
  const signers = Object.entries(order.signers || {}).map(([slot, s]) => ({ slot, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const issuerSlot = signers.find(s => s.kind === 'issuer' && !signatures[s.slot]);
  const run = async (key, work) => {
    setBusy(key); setError('');
    try { await work(); } catch (err) { setError(errorText(err)); } finally { setBusy(''); }
  };
  const copy = (text, key) => navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000); });
  const issue = async () => {
    if (!await modal.confirm({ title: `Issue ${order.controlNumber}?`, message: 'Issuing locks the content and makes the order viewable and signable through its link. Corrections afterwards require revoking it and issuing a new one.', confirmLabel: 'Issue office order' })) return;
    run('issue', () => issueOfficeOrder(user, order.id));
  };
  const remove = async () => {
    if (!await modal.confirm({ title: `Delete draft ${order.controlNumber}?`, message: 'The draft is removed permanently. Its control number is not reused.', confirmLabel: 'Delete draft' })) return;
    run('delete', async () => { await deleteOfficeOrderDraft(order.id); onBack(); });
  };
  const file = order.controlNumber;

  return (
    <div className="oo-detail">
      <div className="oo-detail-side">
        <button type="button" className="oo-back" onClick={onBack}><ArrowLeft size={14} /> Back to office orders</button>
        <p className="task-eyebrow">Control / tracking no.</p>
        <h3 className="oo-number">{order.controlNumber}</h3>
        <p className="oo-subject">{order.subject}</p>
        <span className={`task-pill oo-status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
        {error && <p className="task-error" role="alert">{error}</p>}

        <div className="oo-actions">
          {order.status === 'draft' && <button type="button" onClick={() => onEdit(order)}><Pencil size={14} /> Edit</button>}
          {order.status === 'draft' && <LoadingButton type="button" className="task-primary" loading={busy === 'issue'} loadingLabel="Issuing…" onClick={issue}><Send size={14} /> Issue</LoadingButton>}
          {order.status !== 'draft' && <button type="button" onClick={() => copy(link, 'link')}>{copied === 'link' ? <Check size={14} /> : <Link2 size={14} />} {copied === 'link' ? 'Link copied' : 'Copy link'}</button>}
          <button type="button" onClick={() => frame.current?.print()}><Printer size={14} /> Save as PDF</button>
          <LoadingButton type="button" loading={busy === 'png'} loadingLabel="Rendering…" onClick={() => run('png', () => frame.current.savePng(`${file}.png`))}><ImageDown size={14} /> Save as PNG</LoadingButton>
          {order.status === 'issued' && <button type="button" className="task-danger" onClick={() => setRevoking(v => !v)}><Ban size={14} /> Revoke</button>}
          {order.status === 'draft' && <LoadingButton type="button" className="task-danger" loading={busy === 'delete'} loadingLabel="Deleting…" onClick={remove}><Trash2 size={14} /> Delete draft</LoadingButton>}
        </div>
        {order.status === 'draft' && <p className="task-muted">Drafts are private. Issue the order to share its link and collect signatures.</p>}
        {order.status !== 'draft' && <p className="oo-link-box"><code>{link}</code></p>}

        {revoking && (
          <form className="oo-inline" onSubmit={e => { e.preventDefault(); run('revoke', async () => { await revokeOfficeOrder(user, order.id, reason); setRevoking(false); }); }}>
            <label className="task-field"><span>Reason for revoking</span><textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
            <LoadingButton type="submit" className="task-danger" loading={busy === 'revoke'} loadingLabel="Revoking…">Revoke office order</LoadingButton>
          </form>
        )}

        <h4>Signatures <small>{signers.filter(s => signatures[s.slot]).length}/{signers.length}</small></h4>
        <ul className="oo-sign-list">
          {signers.map(s => {
            const sig = signatures[s.slot];
            return (
              <li key={s.slot}>
                <span className={`oo-dot${sig ? ' is-signed' : ''}`} aria-hidden="true" />
                <span>
                  <b>{sig?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind]}{s.title && (sig?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{sig ? `Signed ${new Date(sig.signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending'}</small>
                </span>
                {!sig && order.status === 'issued' && s.kind !== 'issuer' && (
                  <button type="button" onClick={() => copy(`${link}?sign=${s.slot}`, s.slot)} title="Copy a link that opens this signature line">{copied === s.slot ? <Check size={13} /> : <Link2 size={13} />}</button>
                )}
              </li>
            );
          })}
        </ul>
        {issuerSlot && order.status === 'issued' && (
          <form className="oo-inline" onSubmit={e => { e.preventDefault(); run('sign', () => signOfficeOrder(order.id, issuerSlot.slot, signName || issuerSlot.name, user)); }}>
            <label className="task-field"><span>Sign as {SIGNER_KINDS.issuer.toLowerCase()} — type “{issuerSlot.name}”</span><input value={signName} onChange={e => setSignName(e.target.value)} placeholder={issuerSlot.name} /></label>
            <LoadingButton type="submit" className="task-primary" loading={busy === 'sign'} loadingLabel="Signing…"><PenLine size={14} /> Sign office order</LoadingButton>
          </form>
        )}
        <p className="task-muted oo-small">Co-signers and acknowledgers sign through the link by typing the name shown on the order. Signatures are timestamped and cannot be edited.</p>
      </div>
      <div className="oo-detail-doc">
        <OfficeOrderFrame ref={frame} order={order} signatures={signatures} title={`Office order ${order.controlNumber}`} />
      </div>
    </div>
  );
}

export default function AdminOfficeOrders({ firebaseUser, can }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState({ mode: 'list' }); // { mode: 'edit', order? } | { mode: 'detail', id }
  const user = firebaseUser;

  useEffect(() => subscribeOfficeOrders(list => { setOrders(list); setLoading(false); setError(''); }, err => { setError(errorText(err)); setLoading(false); }), []);

  if (!can('officeorders:manage')) {
    return <div className="task-module"><p className="task-error" role="alert">You need the “Manage Office Orders” permission.</p></div>;
  }

  const visible = orders.filter(o => (status === 'all' || o.status === status)
    && (!search || `${o.controlNumber} ${o.subject} ${o.to}`.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="task-module oo-module">
      {view.mode === 'list' && (
        <>
          <header className="task-heading">
            <div>
              <p className="task-eyebrow">Company directives</p>
              <h2>Office Orders</h2>
              <p>Draft with AI paste, issue with a control number, share by link, and collect signatures.</p>
            </div>
            <button type="button" className="task-primary task-heading-action" onClick={() => setView({ mode: 'edit' })}><Plus size={16} /> New office order</button>
          </header>
          <div className="task-toolbar">
            <label className="task-search"><Search size={15} aria-hidden="true" /><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search control no., subject or recipients…" aria-label="Search office orders" /></label>
            <div className="task-segmented" role="group" aria-label="Status">
              {['all', 'draft', 'issued', 'revoked'].map(s => <button type="button" key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : STATUS_LABEL[s]}</button>)}
            </div>
          </div>
          {error && <p className="task-error" role="alert">{error}</p>}
          {loading ? <div className="task-skeleton" role="status" aria-label="Loading office orders" /> : visible.length === 0 ? (
            <div className="task-empty">
              <ScrollText size={32} aria-hidden="true" />
              <h3>{orders.length ? 'No office orders match' : 'No office orders yet'}</h3>
              <p>{orders.length ? 'Clear the search or status filter.' : 'Create one, or paste AI-generated text and let it format itself.'}</p>
            </div>
          ) : (
            <div className="oo-table-wrap">
              <table className="oo-table">
                <thead><tr><th scope="col">Control / tracking no.</th><th scope="col">Subject</th><th scope="col">To</th><th scope="col">Date</th><th scope="col">Signatures</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {visible.map(o => (
                    <tr key={o.id}>
                      <th scope="row"><button type="button" className="oo-link" onClick={() => setView({ mode: 'detail', id: o.id })}>{o.controlNumber}</button></th>
                      <td>{o.subject}</td>
                      <td>{o.to || '—'}</td>
                      <td>{o.date ? longDate(o.date) : '—'}</td>
                      <td>{Object.keys(o.signers || {}).length} signer{Object.keys(o.signers || {}).length === 1 ? '' : 's'}</td>
                      <td><span className={`task-pill oo-status-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {view.mode === 'edit' && (
        <Editor user={user} order={view.order} onClose={() => setView(view.order ? { mode: 'detail', id: view.order.id } : { mode: 'list' })} onSaved={id => setView({ mode: 'detail', id })} />
      )}
      {view.mode === 'detail' && (
        <Detail user={user} id={view.id} onBack={() => setView({ mode: 'list' })} onEdit={order => setView({ mode: 'edit', order })} />
      )}
    </div>
  );
}
