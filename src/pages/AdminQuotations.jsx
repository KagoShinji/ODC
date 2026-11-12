import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Search, ReceiptText, Link2, Check, Printer, ImageDown,
  Pencil, Send, Ban, Trash2, ArrowLeft, PenLine,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { useSystemModal } from '../components/ui/SystemModalContext';
import QuotationFrame from '../components/quotations/QuotationFrame';
import QuotationEditor from '../components/quotations/QuotationEditor';
import {
  emptyQuotationSigners, quotationLink, SIGNER_KINDS, defaultValidUntil,
  mergeQuotationParsed,
} from '../utils/quotationDocument';
import { BRAND_CO, longDate, money } from '../utils/brandDocument';
import {
  subscribeQuotations, subscribeQuotation, subscribeQuotationSignatures,
  createQuotation, updateQuotation, issueQuotation, revokeQuotation,
  deleteQuotationDraft, signQuotation,
} from '../services/quotationService';
import './AdminTasks.css';
import './AdminQuotations.css';

const STATUS_LABEL = {
  draft: 'Draft',
  issued: 'Issued / In Review',
  accepted: 'Accepted & Conforme',
  revoked: 'Revoked',
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const errorText = err => (err?.code === 'permission-denied'
  ? 'You do not have permission for this action, or the quotation changed. Refresh and try again.'
  : err?.message || 'Something went wrong. Please try again.');

function formFrom(quote) {
  const signers = Object.entries(quote?.signers || emptyQuotationSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    projectName: quote?.projectName || '',
    clientBusiness: quote?.clientBusiness || '',
    clientName: quote?.clientName || '',
    clientAddress: quote?.clientAddress || '',
    clientEmail: quote?.clientEmail || '',
    clientPhone: quote?.clientPhone || '',
    date: quote?.date || todayIso(),
    validUntil: quote?.validUntil || defaultValidUntil(),
    paymentTerms: quote?.paymentTerms || '50% Downpayment upon signing, 50% upon final deployment',
    items: quote?.items && quote.items.length ? quote.items : [
      { id: 'item_1', description: 'Custom Software Development & Implementation', quantity: 1, unitPrice: 50000, amount: 50000 },
    ],
    discountPercent: quote?.discountPercent || 0,
    taxPercent: quote?.taxPercent || 0,
    scopeJson: quote?.scopeJson || '',
    scopeText: quote?.scopeText || '',
    signers,
  };
}

function Editor({ user, quotation, onClose, onSaved }) {
  const [form, setForm] = useState(() => formFrom(quotation));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const setItems = items => setForm(f => ({ ...f, items }));
  const onDoc = useCallback((json, text) => {
    setForm(f => ({ ...f, scopeJson: JSON.stringify(json), scopeText: text }));
  }, []);

  const onParsed = useCallback(parsed => {
    setForm(f => mergeQuotationParsed(f, parsed));
    setNotice('Draft parsed and populated onto the quotation sheet.');
  }, []);

  const setSigner = (id, key, value) => {
    setForm(f => ({
      ...f,
      signers: f.signers.map(s => (s.id === id ? { ...s, [key]: value } : s)),
    }));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const id = quotation
        ? (await updateQuotation(user, quotation.id, form), quotation.id)
        : await createQuotation(user, form);
      onSaved(id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="qt-doc-editor">
      <div className="qt-doc-head">
        <button type="button" className="task-back" onClick={onClose}>
          <ArrowLeft size={14} /> Back to quotations
        </button>
        <h3>{quotation ? `Editing ${quotation.controlNumber}` : 'New Price Quotation'}</h3>
        <span className="task-muted">
          {quotation
            ? 'Draft — only you and authorized managers can view this.'
            : 'The official tracking number (QT-YYYY-MM-XXX) is assigned upon first save.'}
        </span>
      </div>

      {error && <p className="task-error" role="alert">{error}</p>}
      {notice && <p className="task-notice" role="status">{notice}</p>}

      <div className="qt-doc-layout">
        <QuotationEditor
          form={form}
          controlNumber={quotation?.controlNumber}
          initialContent={quotation?.scopeText}
          onField={set}
          onItemsChange={setItems}
          onDoc={onDoc}
          onParsed={onParsed}
        />

        <aside className="qt-doc-side" aria-label="Signers and publishing">
          <h4>Authorized Signatories</h4>
          {form.signers.map(s => (
            <fieldset className="qt-signer-block" key={s.id}>
              <legend>{SIGNER_KINDS[s.kind] || 'Signer'}</legend>
              <input
                aria-label={`${s.kind} name`}
                value={s.name}
                maxLength={200}
                placeholder={s.kind === 'accepted' ? 'Client Representative' : BRAND_CO.approvedBy}
                onChange={e => setSigner(s.id, 'name', e.target.value)}
              />
              <input
                aria-label={`${s.kind} title`}
                value={s.title}
                maxLength={200}
                placeholder={s.kind === 'accepted' ? 'Position / Title' : 'Founder & Lead'}
                onChange={e => setSigner(s.id, 'title', e.target.value)}
              />
            </fieldset>
          ))}

          <div className="qt-doc-save">
            <LoadingButton
              type="button"
              className="task-primary"
              loading={busy}
              loadingLabel="Saving…"
              onClick={save}
            >
              {quotation ? 'Save changes' : 'Save draft'}
            </LoadingButton>
            <button type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
          <p className="task-muted" style={{ fontSize: '11px', lineHeight: '1.4' }}>
            After saving your draft, issue the quotation to share the live public link with your client.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Detail({ user, id, onBack, onEdit }) {
  const modal = useSystemModal();
  const frame = useRef(null);
  const [quotation, setQuotation] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [signName, setSignName] = useState('');

  useEffect(() => {
    return subscribeQuotation(id, setQuotation, err => setError(errorText(err)));
  }, [id]);

  useEffect(() => {
    return subscribeQuotationSignatures(id, setSignatures, () => setSignatures({}));
  }, [id]);

  if (quotation === undefined) return <div className="task-skeleton" role="status" aria-label="Loading quotation" />;
  if (quotation === null) return <p className="task-error" role="alert">This quotation no longer exists.</p>;

  const link = quotationLink(quotation.id);
  const signers = Object.entries(quotation.signers || {})
    .map(([slot, s]) => ({ slot, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const preparedSlot = signers.find(s => s.kind === 'prepared' && !signatures[s.slot]);

  const run = async (key, work) => {
    setBusy(key);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const issue = async () => {
    if (!await modal.confirm({
      title: `Issue ${quotation.controlNumber}?`,
      message: 'Issuing locks the pricing sheet and makes the quotation viewable and signable through its public client link.',
      confirmLabel: 'Issue Quotation',
    })) return;
    run('issue', () => issueQuotation(user, quotation.id));
  };

  const remove = async () => {
    if (!await modal.confirm({
      title: `Delete draft ${quotation.controlNumber}?`,
      message: 'The draft will be permanently removed. The tracking number will not be reused.',
      confirmLabel: 'Delete Draft',
    })) return;
    run('delete', async () => {
      await deleteQuotationDraft(quotation.id);
      onBack();
    });
  };

  return (
    <div className="qt-detail">
      <div className="qt-detail-side">
        <button type="button" className="task-back" onClick={onBack}>
          <ArrowLeft size={14} /> Back to quotations
        </button>

        <div>
          <p className="task-eyebrow">Tracking Control No.</p>
          <h3 className="qt-number">{quotation.controlNumber}</h3>
          <p className="qt-project">{quotation.projectName}</p>
          <p className="qt-client">{quotation.clientBusiness}</p>
          <span className={`task-pill qt-status-${quotation.status}`}>
            {STATUS_LABEL[quotation.status]}
          </span>
        </div>

        {error && <p className="task-error" role="alert">{error}</p>}

        <div className="qt-actions">
          {quotation.status === 'draft' && (
            <button type="button" onClick={() => onEdit(quotation)}>
              <Pencil size={14} /> Edit Quotation
            </button>
          )}

          {quotation.status === 'draft' && (
            <LoadingButton
              type="button"
              className="task-primary"
              loading={busy === 'issue'}
              loadingLabel="Issuing…"
              onClick={issue}
            >
              <Send size={14} /> Issue Quotation
            </LoadingButton>
          )}

          {quotation.status !== 'draft' && (
            <button type="button" onClick={() => copy(link, 'link')}>
              {copied === 'link' ? <Check size={14} /> : <Link2 size={14} />}
              {copied === 'link' ? 'Link copied' : 'Copy Client Link'}
            </button>
          )}

          <button type="button" onClick={() => frame.current?.print()}>
            <Printer size={14} /> Print / Save as PDF
          </button>

          <LoadingButton
            type="button"
            loading={busy === 'png'}
            loadingLabel="Rendering…"
            onClick={() => run('png', () => frame.current.savePng(`${quotation.controlNumber}.png`))}
          >
            <ImageDown size={14} /> Save as PNG
          </LoadingButton>

          {quotation.status === 'issued' && (
            <button type="button" className="task-danger" onClick={() => setRevoking(v => !v)}>
              <Ban size={14} /> Revoke Quotation
            </button>
          )}

          {quotation.status === 'draft' && (
            <LoadingButton
              type="button"
              className="task-danger"
              loading={busy === 'delete'}
              loadingLabel="Deleting…"
              onClick={remove}
            >
              <Trash2 size={14} /> Delete Draft
            </LoadingButton>
          )}
        </div>

        {quotation.status !== 'draft' && (
          <p className="qt-link-box">
            <code>{link}</code>
          </p>
        )}

        {revoking && (
          <form
            className="task-inline-form"
            onSubmit={e => {
              e.preventDefault();
              run('revoke', async () => {
                await revokeQuotation(user, quotation.id, reason);
                setRevoking(false);
              });
            }}
          >
            <label className="task-field">
              <span>Reason for revocation:</span>
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Client requested cancellation, expired validity, or scope overhaul..."
              />
            </label>
            <LoadingButton type="submit" className="task-danger" loading={busy === 'revoke'} loadingLabel="Revoking…">
              Revoke
            </LoadingButton>
          </form>
        )}

        <h4>Signatures ({signers.filter(s => signatures[s.slot]).length}/{signers.length})</h4>
        <ul className="task-sign-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {signers.map(s => {
            const sig = signatures[s.slot];
            return (
              <li
                key={s.slot}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: sig ? '#10b981' : '#f59e0b',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <b style={{ display: 'block', fontSize: '13px', color: '#fff' }}>
                    {sig?.name || s.name || s.title}
                  </b>
                  <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {SIGNER_KINDS[s.kind]} · {sig ? `Signed on ${longDate(sig.signedAt?.split?.('T')?.[0] || sig.signedAt)}` : 'Pending'}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>

        {preparedSlot && quotation.status === 'issued' && (
          <form
            style={{ marginTop: '12px' }}
            onSubmit={e => {
              e.preventDefault();
              run('sign', () => signQuotation(quotation.id, preparedSlot.slot, {
                name: signName || preparedSlot.name,
                title: preparedSlot.title,
              }));
            }}
          >
            <label className="task-field">
              <span>Affix Issuer Signature — type “{preparedSlot.name}”:</span>
              <input
                value={signName}
                onChange={e => setSignName(e.target.value)}
                placeholder={preparedSlot.name}
              />
            </label>
            <LoadingButton type="submit" className="task-primary" loading={busy === 'sign'} loadingLabel="Signing…">
              <PenLine size={14} /> Sign Quotation
            </LoadingButton>
          </form>
        )}
      </div>

      <div className="qt-detail-doc">
        <QuotationFrame
          ref={frame}
          quotation={quotation}
          signatures={signatures}
          title={`Quotation ${quotation.controlNumber}`}
        />
      </div>
    </div>
  );
}

export default function AdminQuotations({ firebaseUser, can }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState({ mode: 'list' });
  const user = firebaseUser;

  useEffect(() => {
    return subscribeQuotations(
      list => {
        setQuotations(list);
        setLoading(false);
        setError('');
      },
      err => {
        setError(errorText(err));
        setLoading(false);
      },
    );
  }, []);

  if (!can('quotations:manage')) {
    return (
      <div className="task-module">
        <p className="task-error" role="alert">
          You need the “Manage Quotations” permission to access this module.
        </p>
      </div>
    );
  }

  const visible = quotations.filter(q => {
    const matchStatus = status === 'all' || q.status === status;
    const matchSearch = !search || `${q.controlNumber} ${q.projectName} ${q.clientBusiness} ${q.clientName}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="task-module qt-module">
      {view.mode === 'list' && (
        <>
          <header className="task-heading">
            <div>
              <p className="task-eyebrow">Commercial Proposals</p>
              <h2>Price Quotations</h2>
              <p>Create itemized project quotes, detail deliverables, share with clients, and collect digital Conforme.</p>
            </div>
            <button
              type="button"
              className="task-primary task-heading-action"
              onClick={() => setView({ mode: 'edit' })}
            >
              <Plus size={16} /> New Quotation
            </button>
          </header>

          <div className="task-toolbar">
            <label className="task-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tracking no., project or client..."
                aria-label="Search quotations"
              />
            </label>
            <div className="task-segmented" role="group" aria-label="Status filter">
              {['all', 'draft', 'issued', 'accepted', 'revoked'].map(s => (
                <button
                  type="button"
                  key={s}
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                >
                  {s === 'all' ? 'All' : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="task-error" role="alert">{error}</p>}

          {loading ? (
            <div className="task-skeleton" role="status" aria-label="Loading quotations" />
          ) : visible.length === 0 ? (
            <div className="task-empty">
              <ReceiptText size={32} aria-hidden="true" />
              <h3>{quotations.length ? 'No quotations match' : 'No quotations yet'}</h3>
              <p>
                {quotations.length
                  ? 'Try clearing the search query or status filter.'
                  : 'Click "+ New Quotation" to generate your first client price estimate.'}
              </p>
            </div>
          ) : (
            <div className="qt-table-wrap">
              <table className="qt-table">
                <thead>
                  <tr>
                    <th scope="col">Tracking No.</th>
                    <th scope="col">Project Solution</th>
                    <th scope="col">Client Enterprise</th>
                    <th scope="col">Total Amount</th>
                    <th scope="col">Valid Until</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(q => (
                    <tr key={q.id}>
                      <th scope="row">
                        <button
                          type="button"
                          className="qt-link-btn"
                          onClick={() => setView({ mode: 'detail', id: q.id })}
                        >
                          {q.controlNumber}
                        </button>
                      </th>
                      <td><b>{q.projectName}</b></td>
                      <td>{q.clientBusiness || '—'}</td>
                      <td><b>₱ {money(q.total || 0)}</b></td>
                      <td>{q.validUntil ? longDate(q.validUntil) : '—'}</td>
                      <td>
                        <span className={`task-pill qt-status-${q.status}`}>
                          {STATUS_LABEL[q.status]}
                        </span>
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
          quotation={view.quotation}
          onClose={() => setView(view.quotation ? { mode: 'detail', id: view.quotation.id } : { mode: 'list' })}
          onSaved={id => setView({ mode: 'detail', id })}
        />
      )}

      {view.mode === 'detail' && (
        <Detail
          user={user}
          id={view.id}
          onBack={() => setView({ mode: 'list' })}
          onEdit={quote => setView({ mode: 'edit', quotation: quote })}
        />
      )}
    </div>
  );
}
