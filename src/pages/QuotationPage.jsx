import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, ImageDown, Link2, Check, PenLine, ShieldCheck } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import QuotationFrame from '../components/quotations/QuotationFrame';
import { SIGNER_KINDS } from '../utils/quotationDocument';
import { longDate, money } from '../utils/brandDocument';
import {
  subscribeQuotation, subscribeQuotationSignatures, signQuotation,
  normalizeSignerName,
} from '../services/quotationService';
import { useBrandFonts } from '../hooks/useBrandFonts';
import './QuotationPage.css';

const STATUS_LABEL = {
  issued: 'Issued & Active',
  accepted: 'Accepted & Conforme',
  revoked: 'Revoked',
  draft: 'Draft (In Review)',
};

/**
 * Public, link-only portal for client review, printing, and digital Conforme acceptance.
 */
export default function QuotationPage() {
  useBrandFonts();
  const { id } = useParams();
  const frame = useRef(null);
  const holder = useRef(null);

  const [quotation, setQuotation] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [scale, setScale] = useState(1);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ tone: '', text: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeQuotation(id, setQuotation, () => setQuotation(null));
  }, [id]);

  useEffect(() => {
    return subscribeQuotationSignatures(id, setSignatures, () => setSignatures({}));
  }, [id]);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  useEffect(() => {
    if (quotation) {
      document.title = `${quotation.controlNumber} — ${quotation.projectName} | OdysseyPH Quotation`;
    }
  }, [quotation]);

  useLayoutEffect(() => {
    const fit = () => {
      setScale(Math.min(1, ((holder.current?.clientWidth || 816) - 2) / 816));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [quotation]);

  if (quotation === undefined) {
    return (
      <main className="qtp">
        <p className="qtp-state" role="status">Loading price quotation…</p>
      </main>
    );
  }

  if (quotation === null) {
    return (
      <main className="qtp">
        <div className="qtp-state">
          <h1>Quotation unavailable</h1>
          <p>
            The link may be expired, revoked, or invalid. Please check the URL or contact OdysseyPH IT Solutions.
          </p>
        </div>
      </main>
    );
  }

  const signers = Object.entries(quotation.signers || {})
    .map(([key, s]) => ({ slot: key, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const clientSlot = signers.find(s => s.kind === 'accepted' && !signatures[s.slot]);

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
          ? 'This signature could not be recorded. The quotation may have already been accepted or revoked. Please refresh the page.'
          : err?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy('');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href.split('?')[0]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSignConforme = e => {
    e.preventDefault();
    if (!agree) {
      setMessage({
        tone: 'error',
        text: 'Please confirm that you have reviewed and accept the quotation scope and payment terms.',
      });
      return;
    }

    if (!name.trim()) {
      setMessage({
        tone: 'error',
        text: 'Please enter your full legal name as authorized representative.',
      });
      return;
    }

    if (clientSlot?.name && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(clientSlot.name).toLowerCase()) {
      setMessage({
        tone: 'error',
        text: `Please enter the authorized name as listed: “${clientSlot.name}”.`,
      });
      return;
    }

    run(
      'sign',
      async () => {
        await signQuotation(quotation.id, clientSlot.slot, {
          name: name.trim(),
          title: title.trim() || clientSlot.title,
        });
        setName('');
        setTitle('');
        setAgree(false);
      },
      'Quotation Accepted! Your digital Conforme has been recorded.',
    );
  };

  return (
    <main className="qtp">
      <header className="qtp-bar">
        <div className="qtp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>PRICE QUOTATION · TRACKING NO.</small>
            <strong>{quotation.controlNumber}</strong>
          </div>
          <span className={`qtp-status qtp-status-${quotation.status}`}>
            {STATUS_LABEL[quotation.status] || quotation.status}
          </span>
        </div>

        <div className="qtp-actions">
          <button type="button" onClick={() => frame.current?.print()}>
            <Printer size={15} /> Print / Save as PDF
          </button>
          <LoadingButton
            type="button"
            loading={busy === 'png'}
            loadingLabel="Rendering…"
            onClick={() => run('png', () => frame.current.savePng(`${quotation.controlNumber}.png`))}
          >
            <ImageDown size={15} /> Save as PNG
          </LoadingButton>
          <button type="button" onClick={copyLink}>
            {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Copied Link' : 'Share Link'}
          </button>
        </div>
      </header>

      <div className="qtp-layout">
        <div className="qtp-doc" ref={holder}>
          <QuotationFrame
            ref={frame}
            quotation={quotation}
            signatures={signatures}
            scale={scale}
            title={`Quotation ${quotation.controlNumber}`}
          />
        </div>

        <aside className="qtp-side">
          <section>
            <h2>
              <ShieldCheck size={16} /> Quotation Particulars
            </h2>
            <dl>
              <dt>Project:</dt>
              <dd>{quotation.projectName}</dd>
              <dt>Client:</dt>
              <dd>{quotation.clientBusiness}</dd>
              <dt>Total (PHP):</dt>
              <dd style={{ color: 'var(--orange)', fontSize: '15px' }}>₱ {money(quotation.total || 0)}</dd>
              <dt>Valid Until:</dt>
              <dd>{longDate(quotation.validUntil)}</dd>
              <dt>Status:</dt>
              <dd style={{ textTransform: 'capitalize' }}>{quotation.status}</dd>
            </dl>
          </section>

          <section>
            <h2>Signatories & Audit Trail</h2>
            {message.text && (
              <p className={`qtp-msg qtp-msg-${message.tone}`} role="alert">
                {message.text}
              </p>
            )}

            <ul className="qtp-signers">
              {signers.map(s => {
                const sig = signatures[s.slot];
                return (
                  <li key={s.slot} className={sig ? 'is-signed' : ''}>
                    <b>{sig?.name || s.name || s.title}</b>
                    <small>
                      {SIGNER_KINDS[s.kind]}
                      {s.title && (sig?.name || s.name) ? ` · ${s.title}` : ''}
                    </small>
                    <small style={{ color: sig ? '#16a34a' : 'inherit' }}>
                      {sig ? `Digitally signed on ${longDate(sig.signedAt?.split?.('T')?.[0] || sig.signedAt)}` : 'Pending Signature'}
                    </small>
                  </li>
                );
              })}
            </ul>

            {clientSlot && quotation.status === 'issued' && (
              <form className="qtp-sign" onSubmit={handleSignConforme}>
                <label>
                  <span>Authorized Client Representative:</span>
                  <input
                    required
                    value={name}
                    placeholder={clientSlot.name || 'Full Legal Name'}
                    onChange={e => setName(e.target.value)}
                  />
                </label>

                <label>
                  <span>Designation / Position:</span>
                  <input
                    value={title}
                    placeholder={clientSlot.title || 'e.g. Managing Director, CEO'}
                    onChange={e => setTitle(e.target.value)}
                  />
                </label>

                {name.trim() && (
                  <label>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Digital Signature Mark:</span>
                    <p className="qtp-preview">{name}</p>
                  </label>
                )}

                <label className="qtp-check">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={e => setAgree(e.target.checked)}
                  />
                  <span>
                    I confirm that I am authorized to approve this project proposal, and accept the itemized pricing, scope of deliverables, and payment terms.
                  </span>
                </label>

                <LoadingButton
                  type="submit"
                  className="qtp-primary"
                  loading={busy === 'sign'}
                  loadingLabel="Confirming…"
                >
                  <PenLine size={15} /> Accept Quotation & Conforme
                </LoadingButton>
              </form>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
