import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, ImageDown, Link2, Check, PenLine, ShieldCheck } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import IncidentReportFrame from '../components/incidentReports/IncidentReportFrame';
import { SIGNER_KINDS, CATEGORIES, SEVERITIES } from '../utils/incidentReportDocument';
import { longDate } from '../utils/brandDocument';
import {
  subscribeIncidentReport, subscribeIncidentSignatures, signIncidentReport, normalizeSignerName,
} from '../services/incidentReportService';
import { useBrandFonts } from '../hooks/useBrandFonts';
import './IncidentReportPage.css';

const STATUS_LABEL = {
  draft: 'Draft',
  issued: 'Issued / In Investigation',
  closed: 'Closed / Resolved',
  revoked: 'Revoked',
};

/** Public, link-only view of an issued incident report: read, save as PDF/PNG, and sign. */
export default function IncidentReportPage() {
  useBrandFonts();
  const { id } = useParams();
  const [params] = useSearchParams();
  const frame = useRef(null);
  const holder = useRef(null);
  const [report, setReport] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [scale, setScale] = useState(1);
  const [slot, setSlot] = useState(params.get('sign') || '');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ tone: '', text: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeIncidentReport(id, setReport, () => setReport(null)), [id]);
  useEffect(() => subscribeIncidentSignatures(id, setSignatures, () => setSignatures({})), [id]);

  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  useEffect(() => {
    if (report) document.title = `${report.controlNumber} — ${report.title}`;
  }, [report]);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, ((holder.current?.clientWidth || 816) - 2) / 816));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [report]);

  if (report === undefined) {
    return <main className="irp"><p className="irp-state" role="status">Loading incident report…</p></main>;
  }

  if (report === null) {
    return (
      <main className="irp">
        <div className="irp-state">
          <h1>Incident report not found or unavailable</h1>
          <p>The link may be invalid, or the report has not been issued yet. Check with the administrator who shared it.</p>
        </div>
      </main>
    );
  }

  const signers = Object.entries(report.signers || {})
    .map(([key, s]) => ({ slot: key, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const pending = signers.filter(s => !signatures[s.slot]);
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
          ? 'This signature could not be recorded. The line may have already been signed or the report was revoked.'
          : err?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setBusy('');
    }
  };

  const sign = e => {
    e.preventDefault();
    if (!agree) {
      setMessage({ tone: 'error', text: 'Please check the box confirming you acknowledge the facts in this report.' });
      return;
    }

    if (chosen.name && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(chosen.name).toLowerCase()) {
      setMessage({
        tone: 'error',
        text: `Type your name exactly as specified: “${normalizeSignerName(chosen.name)}”. (Spelling, initials, and order must match).`,
      });
      return;
    }

    run('sign', async () => {
      await signIncidentReport(report.id, chosen.slot, name);
      setSlot('');
      setName('');
      setAgree(false);
    }, 'Thank you — your electronic signature has been recorded.');
  };

  const canSign = report.status === 'issued' || report.status === 'closed';

  return (
    <main className="irp">
      <header className="irp-bar">
        <div className="irp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Incident Report · Control / tracking no.</small>
            <strong>{report.controlNumber}</strong>
          </div>
          <span className={`irp-status irp-status-${report.status}`}>{STATUS_LABEL[report.status]}</span>
        </div>
        <div className="irp-actions">
          <button type="button" onClick={() => frame.current?.print()}><Printer size={15} /> Save as PDF</button>
          <LoadingButton
            type="button"
            loading={busy === 'png'}
            loadingLabel="Rendering…"
            onClick={() => run('png', () => frame.current.savePng(`${report.controlNumber}.png`))}
          >
            <ImageDown size={15} /> Save as PNG
          </LoadingButton>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(window.location.href.split('?')[0]).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })}
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </header>

      <div className="irp-layout">
        <div className="irp-doc" ref={holder}>
          <IncidentReportFrame
            ref={frame}
            report={report}
            signatures={signatures}
            scale={scale}
            title={`Incident Report ${report.controlNumber}`}
          />
        </div>
        <aside className="irp-side">
          <section>
            <h2><ShieldCheck size={16} aria-hidden="true" /> Incident Summary</h2>
            <dl>
              <dt>Tracking no.</dt><dd>{report.controlNumber}</dd>
              <dt>Title</dt><dd>{report.title}</dd>
              <dt>Category</dt><dd>{CATEGORIES[report.category] || report.category}</dd>
              <dt>Severity</dt><dd>{SEVERITIES[report.severity]?.label || report.severity}</dd>
              {report.incidentDate && <><dt>Occurred</dt><dd>{longDate(report.incidentDate)}{report.incidentTime ? ` at ${report.incidentTime}` : ''}</dd></>}
              {report.dateReported && <><dt>Reported</dt><dd>{longDate(report.dateReported)}</dd></>}
              <dt>Status</dt><dd>{STATUS_LABEL[report.status]}</dd>
              {report.statusReason && <><dt>Notes</dt><dd>{report.statusReason}</dd></>}
            </dl>
          </section>

          <section>
            <h2><PenLine size={16} aria-hidden="true" /> Signatures <small>{signers.filter(s => signatures[s.slot]).length}/{signers.length}</small></h2>
            <ul className="irp-signers">
              {signers.map(s => (
                <li key={s.slot} className={signatures[s.slot] ? 'is-signed' : ''}>
                  <b>{signatures[s.slot]?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind] || 'Signer'}{s.title && (signatures[s.slot]?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{signatures[s.slot] ? `Signed ${new Date(signatures[s.slot].signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending signature'}</small>
                </li>
              ))}
            </ul>

            {message.text && (
              <p className={`irp-msg irp-msg-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
                {message.text}
              </p>
            )}

            {canSign && pending.length > 0 && (
              <form className="irp-sign" onSubmit={sign}>
                <label>
                  <span>Sign as</span>
                  <select value={chosen?.slot || ''} onChange={e => { setSlot(e.target.value); setName(''); }} required>
                    <option value="">Choose your signature line…</option>
                    {pending.map(s => (
                      <option key={s.slot} value={s.slot}>
                        {SIGNER_KINDS[s.kind] || 'Signer'}: {[s.name, s.title].filter(Boolean).join(' — ')}
                      </option>
                    ))}
                  </select>
                </label>

                {chosen && (
                  <>
                    <label>
                      <span>Type your full name{chosen.name ? ` exactly as shown: “${chosen.name}”` : ''}</span>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        minLength={2}
                        maxLength={200}
                        autoComplete="name"
                        placeholder="Type name here…"
                      />
                    </label>

                    {name.trim() && <p className="irp-preview" aria-label="Signature preview">{name}</p>}

                    <label className="irp-check">
                      <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                      <span>I confirm that the facts and statements recorded in this Incident Report are accurate, and agree that typing my name constitutes my electronic signature.</span>
                    </label>

                    <LoadingButton type="submit" className="irp-primary" loading={busy === 'sign'} loadingLabel="Signing…">
                      Sign Incident Report
                    </LoadingButton>
                  </>
                )}
              </form>
            )}

            {report.status === 'revoked' && (
              <p className="irp-msg irp-msg-error">This report was revoked and is kept for historical audit records only.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
