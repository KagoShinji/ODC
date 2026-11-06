import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Printer, Check, Link2, FileText, CheckCircle2,
  ShieldCheck, FileCheck, Users,
} from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import BrandedDocumentFrame from '../components/common/BrandedDocumentFrame';
import {
  buildMoaHtml,
  moaNumberFor,
} from '../utils/moaDocument';
import {
  subscribeDocumentSignatures,
  signDocumentSlot,
  normalizeSignerName,
} from '../services/documentSignatureService';
import { BRAND_CO, money } from '../utils/brandDocument';
import './DocumentPortalPage.css';

export default function ClientMOAPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const frameRef = useRef(null);

  const [moa, setMoa] = useState(null);
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
      doc(db, 'moas', id),
      snap => {
        if (snap.exists()) {
          setMoa({ id: snap.id, ...snap.data() });
          setError('');
        } else {
          setError('Memorandum of Agreement not found. Please verify the contract link.');
        }
        setLoading(false);
      },
      err => {
        console.error('Error fetching MOA:', err);
        setError('Failed to retrieve contract. Please check your network connection.');
        setLoading(false);
      }
    );

    const unsubSigs = subscribeDocumentSignatures('moas', id, setSignatures, () => setSignatures({}));

    return () => {
      unsubDoc();
      unsubSigs();
    };
  }, [id]);

  const contractNumber = useMemo(() => moaNumberFor(moa), [moa]);

  const resolvedSigners = useMemo(() => {
    const lines = [
      {
        slot: 'provider',
        label: 'Party B (Service Provider)',
        expectedName: moa?.providerName || moa?.providerSigneeName || BRAND_CO.approvedBy,
        roleTitle: moa?.providerSigneeTitle || 'Engineering & Executive Lead',
        signature: signatures.provider || (moa?.providerSigned ? {
          name: moa?.providerSigneeName || moa?.providerName || BRAND_CO.approvedBy,
          signedAt: moa?.providerSignedAt?.toDate?.()?.toISOString() || moa?.providerSignedAt || moa?.createdAt,
        } : null),
      },
      {
        slot: 'client',
        label: 'Party A (Client)',
        expectedName: moa?.clientName || moa?.clientSigneeName || '',
        roleTitle: moa?.clientSigneeTitle || 'Authorized Representative',
        signature: signatures.client || (moa?.clientSigned ? {
          name: moa?.clientSigneeName || moa?.clientName,
          signedAt: moa?.clientSignedAt?.toDate?.()?.toISOString() || moa?.clientSignedAt || moa?.updatedAt,
        } : null),
      },
    ];
    return lines;
  }, [moa, signatures]);

  const pendingLines = useMemo(() => resolvedSigners.filter(s => !s.signature), [resolvedSigners]);
  const chosen = useMemo(() => resolvedSigners.find(s => s.slot === slot && !s.signature), [resolvedSigners, slot]);

  const html = useMemo(() => {
    if (!moa) return '';
    return buildMoaHtml(moa, signatures);
  }, [moa, signatures]);

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
      setMessage({ tone: 'error', text: 'Please confirm authorization by checking the declaration box.' });
      return;
    }

    if (chosen.expectedName && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(chosen.expectedName).toLowerCase()) {
      setMessage({
        tone: 'error',
        text: `Please type your full legal name exactly as specified: “${chosen.expectedName}”.`,
      });
      return;
    }

    setSubmitting(true);
    setMessage({ tone: '', text: '' });
    try {
      await signDocumentSlot('moas', moa.id, chosen.slot, name);
      setSlot('');
      setName('');
      setAgree(false);
      setMessage({ tone: 'ok', text: 'Thank you — your electronic signature has been recorded and executed on this agreement.' });
    } catch (err) {
      console.error('Sign error:', err);
      setMessage({
        tone: 'error',
        text: err?.code === 'permission-denied'
          ? 'You do not have permission to sign this contract or this agreement has already been executed.'
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
          <p>Loading verified contract…</p>
        </div>
      </main>
    );
  }

  if (error || !moa) {
    return (
      <main className="docp">
        <div className="docp-state">
          <FileText size={48} color="#dc2626" style={{ margin: '0 auto 16px' }} />
          <h1>Contract Verification Error</h1>
          <p>{error || 'Agreement not found.'}</p>
          <div style={{ marginTop: 24 }}>
            <button type="button" onClick={() => navigate('/')} style={{ background: '#fff', color: '#16273a' }}>
              Return to Odyssey Home
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isExecuted = moa.status === 'Executed' || (resolvedSigners.every(s => s.signature));

  return (
    <main className="docp">
      <header className="docp-bar">
        <div className="docp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Memorandum of Agreement · Contract No.</small>
            <strong>{contractNumber}</strong>
          </div>
          <span className={`docp-status docp-status-${isExecuted ? 'executed' : (moa.status || 'pending').toLowerCase()}`}>
            {isExecuted ? 'Executed Agreement' : moa.status === 'Void' ? 'Void' : 'Pending Signatures'}
          </span>
        </div>
        <div className="docp-actions">
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={14} color="#10b981" /> : <Link2 size={14} />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <button type="button" onClick={() => frameRef.current?.print()}>
            <Printer size={14} /> Print Official Agreement
          </button>
        </div>
      </header>

      <div className="docp-layout">
        <div className="docp-doc">
          <BrandedDocumentFrame ref={frameRef} html={html} title={contractNumber} />
        </div>

        <aside className="docp-side" aria-label="Agreement details and signing">
          <section>
            <h2><ShieldCheck size={16} /> Agreement Summary</h2>
            <dl>
              <dt>Client</dt><dd>{moa.clientBusiness || '—'}</dd>
              <dt>Rep</dt><dd>{moa.clientName || '—'}</dd>
              <dt>Provider</dt><dd>{moa.providerBusiness || BRAND_CO.name}</dd>
              <dt>Value</dt><dd style={{ color: '#ff6a13', fontWeight: 800 }}>₱ {money(moa.projectCost)}</dd>
              <dt>Schedule</dt><dd>{moa.timeline || 'Agreed Timeline'}</dd>
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

            {pendingLines.length > 0 && moa.status !== 'Void' && (
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
                      <span>I confirm that I am authorized to represent <strong>{chosen.slot === 'client' ? (moa.clientBusiness || 'the Client') : BRAND_CO.name}</strong> and execute this Memorandum of Agreement.</span>
                    </label>

                    <LoadingButton type="submit" className="docp-primary" loading={submitting} loadingLabel="Signing agreement…">
                      Sign &amp; Execute Agreement
                    </LoadingButton>
                  </>
                )}
              </form>
            )}
          </section>

          <section>
            <h2><Users size={16} /> Legal Binding Clause</h2>
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#475569', margin: 0 }}>
              This Memorandum of Agreement is executed under Philippine e-Commerce Act of 2000 (R.A. 8792). All electronic signatures and timestamps affixed herein have the full force and effect of wet-ink signatures.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
