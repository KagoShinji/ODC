import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Printer, Check, Link2, FileText, BadgeCheck,
  ShieldCheck, CreditCard,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import BrandedDocumentFrame from '../components/common/BrandedDocumentFrame';
import {
  buildReceiptHtml,
  PAYMENT_METHODS,
  receiptNumberFor,
} from '../utils/acknowledgementReceipt';
import {
  subscribeDocumentSignatures,
  signDocumentSlot,
  normalizeSignerName,
} from '../services/documentSignatureService';
import { BRAND_CO, money, longDate } from '../utils/brandDocument';
import './DocumentPortalPage.css';

const RECEIPT_SIGNERS = [
  { slot: 'prepared', label: 'Prepared by (Finance Rep)', defaultName: 'Johnjosefir Roca', defaultTitle: 'Finance Representative' },
  { slot: 'approved', label: 'Approved by (Executive Lead)', defaultName: BRAND_CO.approvedBy, defaultTitle: 'Founder & Executive Lead' },
];

export default function ClientReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const frameRef = useRef(null);

  const [receipt, setReceipt] = useState(null);
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
      doc(db, 'receipts', id),
      snap => {
        if (snap.exists()) {
          setReceipt({ id: snap.id, ...snap.data() });
          setError('');
        } else {
          setError('Acknowledgement Receipt not found. Please verify the receipt link or AR number.');
        }
        setLoading(false);
      },
      err => {
        console.error('Error fetching receipt:', err);
        setError('Failed to retrieve receipt details. Please check your network connection.');
        setLoading(false);
      }
    );

    const unsubSigs = subscribeDocumentSignatures('receipts', id, setSignatures, () => setSignatures({}));

    return () => {
      unsubDoc();
      unsubSigs();
    };
  }, [id]);

  const receiptNumber = useMemo(() => receipt?.receiptNumber || receiptNumberFor(receipt || { id }), [receipt, id]);

  const resolvedSigners = useMemo(() => {
    return RECEIPT_SIGNERS.map(line => {
      let expectedName = line.defaultName;
      if (line.slot === 'prepared' && receipt?.preparedBy) expectedName = receipt.preparedBy;
      if (line.slot === 'approved' && receipt?.approvedBy) expectedName = receipt.approvedBy;

      const sig = signatures[line.slot] || (line.slot === 'prepared' && receipt?.preparedSigned ? {
        name: receipt.preparedSigneeName || expectedName,
        signedAt: receipt.preparedSignedAt?.toDate?.()?.toISOString() || receipt.preparedSignedAt || receipt.paymentDate,
      } : line.slot === 'approved' && receipt?.approvedSigned ? {
        name: receipt.approvedSigneeName || expectedName,
        signedAt: receipt.approvedSignedAt?.toDate?.()?.toISOString() || receipt.approvedSignedAt || receipt.paymentDate,
      } : null);

      return {
        ...line,
        expectedName,
        signature: sig,
      };
    });
  }, [receipt, signatures]);

  const pendingLines = useMemo(() => resolvedSigners.filter(s => !s.signature), [resolvedSigners]);
  const chosen = useMemo(() => resolvedSigners.find(s => s.slot === slot && !s.signature), [resolvedSigners, slot]);

  const html = useMemo(() => {
    if (!receipt) return '';
    return buildReceiptHtml(receipt, { signatures });
  }, [receipt, signatures]);

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
      setMessage({ tone: 'error', text: 'Please choose your signature line.' });
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
      await signDocumentSlot('receipts', receipt.id, chosen.slot, name);
      setSlot('');
      setName('');
      setAgree(false);
      setMessage({ tone: 'ok', text: 'Thank you — your electronic signature has been recorded.' });
    } catch (err) {
      console.error('Sign error:', err);
      setMessage({
        tone: 'error',
        text: err?.code === 'permission-denied'
          ? 'You do not have permission to sign this receipt.'
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
          <p>Loading verified acknowledgement receipt…</p>
        </div>
      </main>
    );
  }

  if (error || !receipt) {
    return (
      <main className="docp">
        <div className="docp-state">
          <FileText size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h1>Receipt Verification Error</h1>
          <p>{error || 'Receipt not found.'}</p>
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={() => navigate('/')} style={{ background: '#fff', color: '#16273a' }}>
              Return to Odyssey Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  const method = PAYMENT_METHODS[receipt.paymentMethod] || receipt.paymentMethod || 'Online Transfer';

  return (
    <main className="docp">
      <header className="docp-bar">
        <div className="docp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Acknowledgement Receipt · AR No.</small>
            <strong>{receiptNumber}</strong>
          </div>
          <span className="docp-status docp-status-paid">
            <BadgeCheck size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            Payment Verified &amp; Settled
          </span>
        </div>
        <div className="docp-actions">
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={14} color="#10b981" /> : <Link2 size={14} />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => frameRef.current?.print()}>
            <Printer size={14} /> Print / Save PDF Receipt
          </button>
        </div>
      </header>

      <div className="docp-layout">
        <div className="docp-doc">
          <BrandedDocumentFrame ref={frameRef} html={html} title={receiptNumber} />
        </div>

        <aside className="docp-side" aria-label="Receipt details and verification">
          <section>
            <h2><ShieldCheck size={16} /> Receipt Summary</h2>
            <dl>
              <dt>Received From</dt><dd>{receipt.billTo || '—'}</dd>
              <dt>Project</dt><dd>{receipt.project || '—'}</dd>
              <dt>Statement</dt><dd>{receipt.invoiceNumber || '—'}</dd>
              <dt>Payment Date</dt><dd>{longDate(receipt.paymentDate) || receipt.paymentDate || '—'}</dd>
              <dt>Amount</dt><dd style={{ color: '#10b981', fontWeight: 800 }}>₱ {money(receipt.total)}</dd>
              <dt>Method</dt><dd>{method}</dd>
              {receipt.referenceNumber && (
                <>
                  <dt>Reference</dt><dd>{receipt.referenceNumber}</dd>
                </>
              )}
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
                      : 'Authorized signature'}
                  </small>
                </li>
              ))}
            </ul>

            {pendingLines.length > 0 && (
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
                      <span>Type full legal name {chosen.expectedName ? `(“${chosen.expectedName}”)` : ''}</span>
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
                      <span>I confirm that the payment details and acknowledgement receipt are accurate, and agree that typing my name constitutes my electronic signature.</span>
                    </label>

                    <LoadingButton type="submit" className="docp-primary" loading={submitting} loadingLabel="Signing receipt…">
                      Sign Acknowledgement Receipt
                    </LoadingButton>
                  </>
                )}
              </form>
            )}
          </section>

          <section>
            <h2><CreditCard size={16} /> Audit Record</h2>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#475569', margin: 0 }}>
              This Acknowledgement Receipt constitutes official and auditable proof of payment received by OdysseyPH IT Solutions under Philippine Law.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
