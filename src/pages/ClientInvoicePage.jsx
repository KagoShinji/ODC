import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Printer, Check, Link2, FileText, CheckCircle2,
  AlertCircle, ShieldCheck, CreditCard, Sparkles,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import BrandedDocumentFrame from '../components/common/BrandedDocumentFrame';
import {
  buildBillingStatementHtml,
  statementNumberFor,
  ODC_BANK_INFO,
} from '../utils/billingStatementDocument';
import {
  subscribeDocumentSignatures,
  signDocumentSlot,
  normalizeSignerName,
} from '../services/documentSignatureService';
import { BRAND_CO, money, longDate } from '../utils/brandDocument';
import './DocumentPortalPage.css';

const SIGNER_LINES = [
  { slot: 'prepared', label: 'Prepared by (Staff Rep)', defaultName: ODC_BANK_INFO.preparedBy, defaultTitle: 'Staff Representative' },
  { slot: 'approved', label: 'Approved by (Executive Lead)', defaultName: BRAND_CO.approvedBy, defaultTitle: 'Founder & Executive Lead' },
  { slot: 'conforme', label: 'Conforme / Received by (Client)', defaultName: '', defaultTitle: 'Client Representative' },
];

export default function ClientInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const frameRef = useRef(null);

  const [invoice, setInvoice] = useState(null);
  const [signatures, setSignatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Signing form state
  const [slot, setSlot] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ tone: '', text: '' });

  useEffect(() => {
    if (!id) return;
    const unsubDoc = onSnapshot(
      doc(db, 'invoices', id),
      snap => {
        if (snap.exists()) {
          setInvoice({ id: snap.id, ...snap.data() });
          setError('');
        } else {
          setError('Billing Statement not found. Please verify the link or reference number.');
        }
        setLoading(false);
      },
      err => {
        console.error('Error fetching invoice:', err);
        setError('Failed to retrieve billing statement. Please check your network connection.');
        setLoading(false);
      }
    );

    const unsubSigs = subscribeDocumentSignatures('invoices', id, setSignatures, () => setSignatures({}));

    return () => {
      unsubDoc();
      unsubSigs();
    };
  }, [id]);

  const statementNumber = useMemo(() => statementNumberFor(invoice), [invoice]);

  const resolvedSigners = useMemo(() => {
    return SIGNER_LINES.map(line => {
      let expectedName = line.defaultName;
      if (line.slot === 'prepared' && invoice?.preparedBy) expectedName = invoice.preparedBy;
      if (line.slot === 'approved' && invoice?.approvedBy) expectedName = invoice.approvedBy;
      if (line.slot === 'conforme') expectedName = invoice?.billTo || 'Client Representative';

      const sig = signatures[line.slot] || (line.slot === 'prepared' && invoice?.preparedSigned ? {
        name: invoice.preparedSigneeName || expectedName,
        signedAt: invoice.preparedSignedAt?.toDate?.()?.toISOString() || invoice.preparedSignedAt,
      } : line.slot === 'approved' && invoice?.approvedSigned ? {
        name: invoice.approvedSigneeName || expectedName,
        signedAt: invoice.approvedSignedAt?.toDate?.()?.toISOString() || invoice.approvedSignedAt,
      } : line.slot === 'conforme' && invoice?.conformeSigned ? {
        name: invoice.conformeSigneeName || expectedName,
        signedAt: invoice.conformeSignedAt?.toDate?.()?.toISOString() || invoice.conformeSignedAt,
      } : null);

      return {
        ...line,
        expectedName,
        signature: sig,
      };
    });
  }, [invoice, signatures]);

  const pendingLines = useMemo(() => resolvedSigners.filter(s => !s.signature), [resolvedSigners]);
  const chosen = useMemo(() => resolvedSigners.find(s => s.slot === slot && !s.signature), [resolvedSigners, slot]);

  const html = useMemo(() => {
    if (!invoice) return '';
    return buildBillingStatementHtml(invoice, signatures);
  }, [invoice, signatures]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback */
    }
  };

  const handleSign = async e => {
    e.preventDefault();
    if (!chosen) {
      setMessage({ tone: 'error', text: 'Please select your designated signature line from the dropdown.' });
      return;
    }
    if (!agree) {
      setMessage({ tone: 'error', text: 'Please check the acknowledgement checkbox before signing.' });
      return;
    }

    if (chosen.expectedName && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(chosen.expectedName).toLowerCase()) {
      setMessage({
        tone: 'error',
        text: `Please type your full name exactly as designated: “${chosen.expectedName}”.`,
      });
      return;
    }

    setSubmitting(true);
    setMessage({ tone: '', text: '' });
    try {
      await signDocumentSlot('invoices', invoice.id, chosen.slot, name);
      setSlot('');
      setName('');
      setAgree(false);
      setMessage({ tone: 'ok', text: 'Thank you — your electronic signature has been recorded and applied to the statement.' });
    } catch (err) {
      console.error('Sign error:', err);
      setMessage({
        tone: 'error',
        text: err?.code === 'permission-denied'
          ? 'You do not have permission to sign this line or this statement has been closed.'
          : err?.message || 'Failed to submit signature. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="docp">
        <div className="docp-state">
          <p>Loading verified billing statement…</p>
        </div>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="docp">
        <div className="docp-state">
          <FileText size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h1>Document Verification Error</h1>
          <p>{error || 'Billing statement not found.'}</p>
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={() => navigate('/')} style={{ background: '#fff', color: '#16273a' }}>
              Return to Odyssey Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isPaid = invoice.status === 'paid';
  const totalAmount = (invoice.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <main className="docp">
      <header className="docp-bar">
        <div className="docp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Billing Statement · Statement No.</small>
            <strong>{statementNumber}</strong>
          </div>
          <span className={`docp-status docp-status-${invoice.status || 'sent'}`}>
            {isPaid ? 'Paid in Full' : invoice.status === 'cancelled' ? 'Cancelled' : 'Outstanding'}
          </span>
        </div>
        <div className="docp-actions">
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={14} color="#10b981" /> : <Link2 size={14} />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => frameRef.current?.print()}>
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </header>

      <div className="docp-layout">
        <div className="docp-doc">
          <BrandedDocumentFrame ref={frameRef} html={html} title={statementNumber} />
        </div>

        <aside className="docp-side" aria-label="Statement details and signing">
          <section>
            <h2><ShieldCheck size={16} /> Statement Summary</h2>
            <dl>
              <dt>Billed To</dt><dd>{invoice.billTo || '—'}</dd>
              <dt>Project</dt><dd>{invoice.project || '—'}</dd>
              <dt>Date</dt><dd>{longDate(invoice.date) || invoice.date || '—'}</dd>
              <dt>Total Due</dt><dd style={{ color: '#ff6a13', fontWeight: 800 }}>₱ {money(totalAmount)}</dd>
              <dt>Terms</dt><dd>{invoice.paymentTerms || 'Due upon receipt'}</dd>
            </dl>
          </section>

          <section>
            <h2>
              Signatures
              <small>{resolvedSigners.filter(s => s.signature).length} of {resolvedSigners.length}</small>
            </h2>

            {message.text && (
              <p className={`docp-msg docp-msg-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
                {message.text}
              </p>
            )}

            <ul className="docp-signers">
              {resolvedSigners.map(s => (
                <li key={s.slot} className={s.signature ? 'is-signed' : ''}>
                  <strong>{s.label}</strong>
                  <span>{s.signature?.name || s.expectedName || 'Pending signature'}</span>
                  <small>
                    {s.signature
                      ? `Signed ${new Date(s.signature.signedAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}`
                      : 'Awaiting signature'}
                  </small>
                </li>
              ))}
            </ul>

            {pendingLines.length > 0 && !isPaid && (
              <form onSubmit={handleSign} className="docp-sign">
                <label>
                  <span>Select signature line</span>
                  <select
                    value={slot}
                    onChange={e => {
                      setSlot(e.target.value);
                      const target = resolvedSigners.find(x => x.slot === e.target.value);
                      setName(target?.expectedName || '');
                    }}
                    required
                  >
                    <option value="">Choose line to sign…</option>
                    {pendingLines.map(s => (
                      <option key={s.slot} value={s.slot}>
                        {s.label}: {s.expectedName || 'Open Signer'}
                      </option>
                    ))}
                  </select>
                </label>

                {chosen && (
                  <>
                    <label>
                      <span>Type full name {chosen.expectedName ? `(“${chosen.expectedName}”)` : ''}</span>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Type full legal name…"
                        required
                        minLength={2}
                        maxLength={200}
                      />
                    </label>

                    {name.trim() && (
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>Cursive Electronic Signature Preview</span>
                        <p className="docp-preview">{name}</p>
                      </div>
                    )}

                    <label className="docp-check">
                      <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} required />
                      <span>I confirm that the deliverables and billing statement figures are acknowledged, and agree that typing my name constitutes my binding electronic signature.</span>
                    </label>

                    <LoadingButton type="submit" className="docp-primary" loading={submitting} loadingLabel="Signing statement…">
                      Sign Billing Statement
                    </LoadingButton>
                  </>
                )}
              </form>
            )}
          </section>

          <section>
            <h2><CreditCard size={16} /> Official Bank Settlement</h2>
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#334155' }}>
              <strong>Bank:</strong> {ODC_BANK_INFO.bankName}<br />
              <strong>Account No.:</strong> {ODC_BANK_INFO.bankAccount}<br />
              <strong>Account Name:</strong> {ODC_BANK_INFO.bankAccountName}<br />
              <strong>Mobile / Contact:</strong> {ODC_BANK_INFO.approvedPhone}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
