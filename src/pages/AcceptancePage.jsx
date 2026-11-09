import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, ImageDown, Link2, Check, PenLine, FileText } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import AcceptanceFrame from '../components/acceptance/AcceptanceFrame';
import { SIGNER_KINDS, certificateNumberFor } from '../utils/acceptanceDocument';
import { longDate } from '../utils/brandDocument';
import {
  subscribeCertificate, subscribeCertificateSignatures, signCertificate, normalizeSignerName,
} from '../services/acceptanceService';
import { useBrandFonts } from '../hooks/useBrandFonts';
import './AuditReportPage.css';

const STATUS_LABEL = {
  draft: 'Draft',
  issued: 'Issued / In Review',
  accepted: 'Accepted & Conforme',
  revoked: 'Revoked',
};

/** Public, link-only view of an issued Certificate of Acceptance: read, save as PDF/PNG, and sign. */
export default function AcceptancePage() {
  useBrandFonts();
  const { id } = useParams();
  const [params] = useSearchParams();
  const frame = useRef(null);
  const holder = useRef(null);
  const [coa, setCoa] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [scale, setScale] = useState(1);
  const [slot, setSlot] = useState(params.get('sign') || '');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ tone: '', text: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeCertificate(id, setCoa, () => setCoa(null)), [id]);
  useEffect(() => subscribeCertificateSignatures(id, setSignatures, () => setSignatures({})), [id]);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  const number = coa ? certificateNumberFor(coa) : '';

  useEffect(() => {
    if (coa) document.title = `${number} — ${coa.projectName || 'Certificate of Acceptance'}`;
  }, [coa, number]);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, ((holder.current?.clientWidth || 816) - 2) / 816));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [coa]);

  if (coa === undefined) {
    return <main className="arp"><p className="arp-state" role="status">Loading certificate document…</p></main>;
  }

  if (coa === null) {
    return (
      <main className="arp">
        <div className="arp-state">
          <h1>Certificate not found or unavailable</h1>
          <p>The certificate link may be invalid or has expired. Please verify with the administrator who shared it.</p>
        </div>
      </main>
    );
  }

  const status = (coa.status || 'draft').toLowerCase();

  const signers = Object.entries(coa.signers || {})
    .map(([key, s]) => ({ slot: key, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const pending = signers.filter(s => !signatures[s.slot] && !(s.kind === 'turnover' && (signatures.issuer || coa.providerSigned)) && !(s.kind === 'acceptor' && (signatures.acceptor || coa.signeeName)));
  const chosen = signers.find(s => s.slot === slot && !signatures[s.slot]);

  const run = async (key, work, success) => {
    setBusy(key);
    setMessage({ tone: '', text: '' });
    try {
      await work();
      if (success) setMessage({ tone: 'ok', text: success });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err?.code === 'permission-denied'
          ? 'This signature could not be recorded. The line may have already been signed or the certificate was revoked.'
          : err?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy('');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* fallback */
    }
  };

  const sign = e => {
    e.preventDefault();
    if (!chosen) {
      setMessage({ tone: 'error', text: 'Please choose your designated signature line from the dropdown.' });
      return;
    }
    if (!agree) {
      setMessage({ tone: 'error', text: 'Please check the box confirming you acknowledge and accept the project handover.' });
      return;
    }

    if (chosen.name && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(chosen.name).toLowerCase()) {
      setMessage({
        tone: 'error',
        text: `Type your name exactly as specified: “${normalizeSignerName(chosen.name)}”.`,
      });
      return;
    }

    run('sign', async () => {
      await signCertificate(coa.id, chosen.slot, name);
      setSlot('');
      setName('');
      setAgree(false);
    }, 'Thank you — your electronic acceptance signature has been recorded.');
  };

  const canSign = status === 'issued' || status === 'pending';

  return (
    <main className="arp">
      <header className="arp-bar">
        <div className="arp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Certificate · Control / Tracking No.</small>
            <strong>{number}</strong>
          </div>
          <span className={`arp-status arp-status-${status}`}>{STATUS_LABEL[status] || status.toUpperCase()}</span>
        </div>
        <div className="arp-actions">
          <button type="button" onClick={() => frame.current?.print()}><Printer size={15} /> Save as PDF</button>
          <LoadingButton type="button" loading={busy === 'png'} loadingLabel="Rendering…" onClick={() => run('png', () => frame.current.savePng(`${number}.png`))}>
            <ImageDown size={15} /> Save as PNG
          </LoadingButton>
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </header>

      <div className="arp-layout">
        <div className="arp-doc" ref={holder}>
          <AcceptanceFrame ref={frame} certificate={coa} signatures={signatures} scale={scale} title={`Certificate ${number}`} />
        </div>

        <aside className="arp-side" aria-label="Certificate overview and acceptance">
          <section>
            <h2><FileText size={16} /> Handover Details</h2>
            <dl>
              <dt>Project</dt><dd>{coa.projectName || '—'}</dd>
              <dt>Client</dt><dd>{coa.clientBusiness || coa.clientName || '—'}</dd>
              <dt>Turnover Date</dt><dd>{longDate(coa.turnoverDate) || coa.turnoverDate || '—'}</dd>
              <dt>Status</dt><dd>{STATUS_LABEL[status] || status}</dd>
            </dl>
          </section>

          <section>
            <h2>Signatories &amp; Handover Status</h2>
            <ul className="arp-signers">
              {signers.map(s => {
                const sig = signatures[s.slot] ||
                  (s.kind === 'turnover' && (signatures.issuer || (coa.providerSigned ? { name: coa.providerSigneeName || coa.providerName, signedAt: coa.providerSignedAt } : null))) ||
                  (s.kind === 'acceptor' && (signatures.acceptor || (coa.signeeName ? { name: coa.signeeName, signedAt: coa.acceptedAt } : null)));
                return (
                  <li key={s.slot} className={sig ? 'is-signed' : ''}>
                    <strong>{sig?.name || s.name || s.title}</strong>
                    <small>{SIGNER_KINDS[s.kind] || 'Signer'}{s.title && (sig?.name || s.name) ? ` · ${s.title}` : ''}</small>
                    <small>{sig ? `Signed electronically ${new Date(sig.signedAt?.toDate?.() || sig.signedAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}` : 'Pending sign-off'}</small>
                  </li>
                );
              })}
            </ul>

            {canSign && pending.length > 0 && (
              <form className="arp-sign" onSubmit={sign}>
                {message.text && (
                  <div className={`arp-msg arp-msg-${message.tone}`} role="status">
                    {message.text}
                  </div>
                )}

                <label>
                  <span>Select Signature Line:</span>
                  <select value={slot} onChange={e => { setSlot(e.target.value); setName(signers.find(s => s.slot === e.target.value)?.name || ''); }} required>
                    <option value="">Choose your signature line…</option>
                    {pending.map(s => (
                      <option key={s.slot} value={s.slot}>
                        {s.name ? `${s.name} (${SIGNER_KINDS[s.kind] || s.title})` : (SIGNER_KINDS[s.kind] || s.title)}
                      </option>
                    ))}
                  </select>
                </label>

                {chosen && (
                  <>
                    <label>
                      <span>Full Legal Name:</span>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={chosen.name || 'Type your full legal name'}
                        required
                      />
                    </label>

                    {name.trim() && (
                      <div className="arp-preview">{name}</div>
                    )}

                    <label className="arp-check">
                      <input
                        type="checkbox"
                        checked={agree}
                        onChange={e => setAgree(e.target.checked)}
                        required
                      />
                      <span>I certify full functional acceptance of the designated deliverables and acknowledge the commencement of warranty support.</span>
                    </label>

                    <LoadingButton
                      type="submit"
                      className="arp-primary"
                      loading={busy === 'sign'}
                      loadingLabel="Recording acceptance…"
                    >
                      <PenLine size={14} /> Affix Acceptance Signature
                    </LoadingButton>
                  </>
                )}
              </form>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
