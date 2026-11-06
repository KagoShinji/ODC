import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  Printer, Check, Link2, FileText, CheckCircle2,
  ShieldCheck, Award,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import BrandedDocumentFrame from '../components/common/BrandedDocumentFrame';
import {
  buildAcceptanceCertificateHtml,
  certificateNumberFor,
} from '../utils/acceptanceDocument';
import {
  subscribeDocumentSignatures,
  signDocumentSlot,
  normalizeSignerName,
} from '../services/documentSignatureService';
import { BRAND_CO, longDate } from '../utils/brandDocument';
import './DocumentPortalPage.css';

export default function AcceptancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const frameRef = useRef(null);

  const [coa, setCoa] = useState(null);
  const [signatures, setSignatures] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Signing form state
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ tone: '', text: '' });

  useEffect(() => {
    if (!id) return;
    const unsubDoc = onSnapshot(
      doc(db, 'certificates', id),
      snap => {
        if (snap.exists()) {
          setCoa({ id: snap.id, ...snap.data() });
          setError('');
        } else {
          setError('Certificate of Acceptance not found. Please verify the link or certificate ID.');
        }
        setLoading(false);
      },
      err => {
        console.error('Error fetching COA:', err);
        setError('Failed to retrieve certificate details. Please check your network connection.');
        setLoading(false);
      }
    );

    const unsubSigs = subscribeDocumentSignatures('certificates', id, setSignatures, () => setSignatures({}));

    return () => {
      unsubDoc();
      unsubSigs();
    };
  }, [id]);

  const certificateNumber = useMemo(() => certificateNumberFor(coa), [coa]);

  const isAccepted = useMemo(() => {
    return coa?.status === 'Accepted' || Boolean(signatures.acceptor || coa?.signeeName);
  }, [coa, signatures]);

  const resolvedSigners = useMemo(() => {
    const providerName = coa?.providerName || BRAND_CO.approvedBy;
    const clientName = coa?.clientName || coa?.signeeName || 'Client Representative';

    const issuerSig = signatures.issuer || {
      name: providerName,
      signedAt: coa?.createdAt?.toDate?.()?.toISOString() || coa?.createdAt || new Date().toISOString(),
    };

    const acceptorSig = signatures.acceptor || (isAccepted ? {
      name: coa?.signeeName || clientName,
      signedAt: coa?.acceptedAt?.toDate?.()?.toISOString() || coa?.acceptedAt || new Date().toISOString(),
    } : null);

    return [
      {
        slot: 'issuer',
        label: 'Issued by (Service Provider)',
        expectedName: providerName,
        signature: issuerSig,
      },
      {
        slot: 'acceptor',
        label: 'Accepted by (Client Partner)',
        expectedName: clientName,
        signature: acceptorSig,
      },
    ];
  }, [coa, signatures, isAccepted]);

  const html = useMemo(() => {
    if (!coa) return '';
    return buildAcceptanceCertificateHtml(coa, signatures);
  }, [coa, signatures]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback */
    }
  };

  const handleAccept = async e => {
    e.preventDefault();
    if (isAccepted) return;
    if (!agree) {
      setMessage({ tone: 'error', text: 'Please check the verification checkbox to confirm acceptance.' });
      return;
    }

    const expected = coa?.clientName;
    if (expected && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(expected).toLowerCase()) {
      setMessage({
        tone: 'error',
        text: `Please type your designated full name exactly: “${expected}”.`,
      });
      return;
    }

    setSubmitting(true);
    setMessage({ tone: '', text: '' });
    try {
      await signDocumentSlot('certificates', coa.id, 'acceptor', name);
      // Also update parent document for backwards-compatibility
      await updateDoc(doc(db, 'certificates', coa.id), {
        status: 'Accepted',
        signeeName: name.trim(),
        signeeTitle: (title || 'Authorized Representative').trim(),
        acceptedAt: serverTimestamp(),
      });
      setName('');
      setTitle('');
      setAgree(false);
      setMessage({ tone: 'ok', text: 'Thank you — project turnover and completion has been formally accepted.' });
    } catch (err) {
      console.error('Acceptance error:', err);
      setMessage({
        tone: 'error',
        text: err?.code === 'permission-denied'
          ? 'You do not have permission to accept this turnover or it has already been closed.'
          : err?.message || 'Failed to submit acceptance. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="docp">
        <div className="docp-state">
          <p>Loading verified turnover certificate…</p>
        </div>
      </main>
    );
  }

  if (error || !coa) {
    return (
      <main className="docp">
        <div className="docp-state">
          <FileText size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h1>Certificate Verification Error</h1>
          <p>{error || 'Certificate not found.'}</p>
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={() => navigate('/')} style={{ background: '#fff', color: '#16273a' }}>
              Return to Odyssey Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="docp">
      <header className="docp-bar">
        <div className="docp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Certificate of Acceptance · Cert No.</small>
            <strong>{certificateNumber}</strong>
          </div>
          <span className={`docp-status docp-status-${isAccepted ? 'accepted' : 'pending'}`}>
            {isAccepted ? 'Accepted & Turned Over' : 'Pending Client Acceptance'}
          </span>
        </div>
        <div className="docp-actions">
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={14} color="#10b981" /> : <Link2 size={14} />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => frameRef.current?.print()}>
            <Printer size={14} /> Print Official Certificate
          </button>
        </div>
      </header>

      <div className="docp-layout">
        <div className="docp-doc">
          <BrandedDocumentFrame ref={frameRef} html={html} title={certificateNumber} />
        </div>

        <aside className="docp-side" aria-label="Certificate details and acceptance">
          <section>
            <h2><ShieldCheck size={16} /> Turnover Summary</h2>
            <dl>
              <dt>Client</dt><dd>{coa.clientBusiness || '—'}</dd>
              <dt>Project</dt><dd>{coa.projectName || '—'}</dd>
              <dt>Turnover</dt><dd>{longDate(coa.turnoverDate) || coa.turnoverDate || '—'}</dd>
              <dt>Status</dt><dd style={{ color: isAccepted ? '#10b981' : '#f59e0b', fontWeight: 800 }}>{isAccepted ? 'Fully Accepted' : 'Pending Acceptance'}</dd>
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

            {!isAccepted && (
              <form onSubmit={handleAccept} className="docp-sign">
                <label>
                  <span>Your Full Legal Name {coa.clientName ? `(“${coa.clientName}”)` : ''}</span>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Type full legal name…"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </label>

                <label>
                  <span>Position / Title</span>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. CEO / Managing Director"
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
                  <span>I verify that I am authorized to represent <strong>{coa.clientBusiness}</strong>, and formally confirm that all software deliverables have been inspected, tested, and fully accepted.</span>
                </label>

                <LoadingButton type="submit" className="docp-primary" loading={submitting} loadingLabel="Submitting acceptance…">
                  Accept &amp; Complete Turnover
                </LoadingButton>
              </form>
            )}
          </section>

          <section>
            <h2><Award size={16} /> Official Certificate Notice</h2>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#475569', margin: 0 }}>
              This Certificate of Acceptance serves as formal, non-repudiable documentation that the project deliverables satisfy all contracted requirements.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
