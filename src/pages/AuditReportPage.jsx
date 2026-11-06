import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, ImageDown, Link2, Check, PenLine, ClipboardCheck } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import AuditReportFrame from '../components/auditReports/AuditReportFrame';
import { SIGNER_KINDS, AUDIT_CATEGORIES, AUDIT_RATINGS } from '../utils/auditReportDocument';
import { longDate } from '../utils/brandDocument';
import {
  subscribeAuditReport, subscribeAuditSignatures, signAuditReport, normalizeSignerName,
} from '../services/auditReportService';
import { useBrandFonts } from '../hooks/useBrandFonts';
import './AuditReportPage.css';

const STATUS_LABEL = {
  draft: 'Draft',
  issued: 'Issued / Official',
  closed: 'Closed / Remediated',
  revoked: 'Revoked',
};

/** Public, link-only view of an issued audit report: read, save as PDF/PNG, and sign. */
export default function AuditReportPage() {
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

  useEffect(() => subscribeAuditReport(id, setReport, () => setReport(null)), [id]);
  useEffect(() => subscribeAuditSignatures(id, setSignatures, () => setSignatures({})), [id]);

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
    return <main className="arp"><p className="arp-state" role="status">Loading audit report…</p></main>;
  }

  if (report === null) {
    return (
      <main className="arp">
        <div className="arp-state">
          <h1>Audit report not found or unavailable</h1>
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
    if (!chosen) {
      setMessage({ tone: 'error', text: 'Please choose a signature line from the dropdown.' });
      return;
    }
    if (!agree) {
      setMessage({ tone: 'error', text: 'Please check the box confirming you acknowledge and accept the findings and action plan in this report.' });
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
      await signAuditReport(report.id, chosen.slot, name);
      setSlot('');
      setName('');
      setAgree(false);
    }, 'Thank you — your electronic signature has been recorded.');
  };

  const canSign = report.status === 'issued' || report.status === 'closed';

  return (
    <main className="arp">
      <header className="arp-bar">
        <div className="arp-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Audit Report · Control / tracking no.</small>
            <strong>{report.controlNumber}</strong>
          </div>
          <span className={`arp-status arp-status-${report.status}`}>{STATUS_LABEL[report.status]}</span>
        </div>
        <div className="arp-actions">
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

      <div className="arp-layout">
        <div className="arp-doc" ref={holder}>
          <AuditReportFrame
            ref={frame}
            report={report}
            signatures={signatures}
            scale={scale}
            title={`Audit Report ${report.controlNumber}`}
          />
        </div>
        <aside className="arp-side">
          <section>
            <h2><ClipboardCheck size={16} aria-hidden="true" /> Audit Engagement Summary</h2>
            <dl>
              <dt>Tracking no.</dt><dd>{report.controlNumber}</dd>
              {report.referenceNo && <><dt>Ref. No.</dt><dd><code>{report.referenceNo}</code></dd></>}
              {report.classification && <><dt>Classification</dt><dd>{report.classification}</dd></>}
              <dt>Engagement</dt><dd>{report.title}</dd>
              {report.venueDomain && <><dt>Domain</dt><dd><a href={`https://${report.venueDomain.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer">{report.venueDomain}</a></dd></>}
              <dt>Scope Area</dt><dd>{AUDIT_CATEGORIES[report.category] || report.category}</dd>
              <dt>Rating</dt><dd>{AUDIT_RATINGS[report.rating]?.label || report.rating}</dd>
              {report.auditPeriodStart && <><dt>Coverage</dt><dd>{longDate(report.auditPeriodStart)}{report.auditPeriodEnd ? ` to ${longDate(report.auditPeriodEnd)}` : ''}</dd></>}
              {report.auditDate && <><dt>Conducted</dt><dd>{longDate(report.auditDate)}</dd></>}
              {report.dateIssued && <><dt>Issued</dt><dd>{longDate(report.dateIssued)}</dd></>}
              <dt>Lead Auditor</dt><dd>{report.leadAuditorName}{report.leadAuditorTitle ? ` · ${report.leadAuditorTitle}` : ''}</dd>
              {report.auditeeEntity && <><dt>Auditee</dt><dd>{report.auditeeEntity}{report.auditeeContact ? ` (${report.auditeeContact})` : ''}</dd></>}
              <dt>Status</dt><dd>{STATUS_LABEL[report.status]}</dd>
              {report.statusReason && <><dt>Notes</dt><dd>{report.statusReason}</dd></>}
            </dl>
          </section>

          <section>
            <h2><PenLine size={16} aria-hidden="true" /> Signatures <small>{signers.filter(s => signatures[s.slot]).length}/{signers.length}</small></h2>
            <ul className="arp-signers">
              {signers.map(s => (
                <li key={s.slot} className={signatures[s.slot] ? 'is-signed' : ''}>
                  <b>{signatures[s.slot]?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind] || 'Signer'}{s.title && (signatures[s.slot]?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{signatures[s.slot] ? `Signed ${new Date(signatures[s.slot].signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending signature'}</small>
                </li>
              ))}
            </ul>

            {message.text && (
              <p className={`arp-msg arp-msg-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
                {message.text}
              </p>
            )}

            {canSign && pending.length > 0 ? (
              <form className="arp-sign" onSubmit={sign}>
                <label>
                  <span>Sign as</span>
                  <select value={slot} onChange={e => { setSlot(e.target.value); setName(''); }}>
                    <option value="">Select your signature slot…</option>
                    {pending.map(s => (
                      <option key={s.slot} value={s.slot}>
                        {s.name ? `${s.name} (${s.title || SIGNER_KINDS[s.kind]})` : `${s.title} (${SIGNER_KINDS[s.kind]})`}
                      </option>
                    ))}
                  </select>
                </label>

                {chosen && (
                  <>
                    <label>
                      <span>Your full name</span>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={chosen.name || 'Type your full legal name'}
                        required
                        autoFocus
                      />
                    </label>

                    {name.trim() && (
                      <div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>Signature preview:</span>
                        <p className="arp-preview">{name.trim()}</p>
                      </div>
                    )}

                    <label className="arp-check">
                      <input
                        type="checkbox"
                        checked={agree}
                        onChange={e => setAgree(e.target.checked)}
                        required
                      />
                      <span>I confirm that I have reviewed this Audit Report, acknowledge its factual findings, and agree to the corrective action plan.</span>
                    </label>

                    <LoadingButton
                      type="submit"
                      className="arp-primary"
                      loading={busy === 'sign'}
                      loadingLabel="Recording signature…"
                    >
                      <PenLine size={15} /> Sign Audit Report
                    </LoadingButton>
                  </>
                )}
              </form>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}

