import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer, ImageDown, Link2, Check, PenLine, ShieldCheck } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import OfficeOrderFrame from '../components/officeOrders/OfficeOrderFrame';
import { SIGNER_KINDS } from '../utils/officeOrderDocument';
import { longDate } from '../utils/brandDocument';
import { subscribeOfficeOrder, subscribeSignatures, signOfficeOrder, normalizeSignerName } from '../services/officeOrderService';
import { useBrandFonts } from '../hooks/useBrandFonts';
import './OfficeOrderPage.css';

const STATUS_LABEL = { issued: 'Issued', revoked: 'Revoked' };

/** Public, link-only view of an issued office order: read, save as PDF/PNG, and sign. */
export default function OfficeOrderPage() {
  useBrandFonts();
  const { id } = useParams();
  const [params] = useSearchParams();
  const frame = useRef(null);
  const holder = useRef(null);
  const [order, setOrder] = useState(undefined);
  const [signatures, setSignatures] = useState({});
  const [scale, setScale] = useState(1);
  const [slot, setSlot] = useState(params.get('sign') || '');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ tone: '', text: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeOfficeOrder(id, setOrder, () => setOrder(null)), [id]);
  useEffect(() => subscribeSignatures(id, setSignatures, () => setSignatures({})), [id]);
  useEffect(() => {
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);
  useEffect(() => { if (order) document.title = `${order.controlNumber} — ${order.subject}`; }, [order]);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, ((holder.current?.clientWidth || 816) - 2) / 816));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [order]);

  if (order === undefined) return <main className="oop"><p className="oop-state" role="status">Loading office order…</p></main>;
  if (order === null) {
    return (
      <main className="oop">
        <div className="oop-state">
          <h1>Office order not available</h1>
          <p>The link may be incorrect, or the order has not been issued yet. Check the link with the person who sent it.</p>
        </div>
      </main>
    );
  }

  const signers = Object.entries(order.signers || {}).map(([key, s]) => ({ slot: key, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const pending = signers.filter(s => !signatures[s.slot] && s.kind !== 'issuer');
  const chosen = signers.find(s => s.slot === slot && !signatures[s.slot] && s.kind !== 'issuer');

  const run = async (key, work, success) => {
    setBusy(key); setMessage({ tone: '', text: '' });
    try { await work(); if (success) setMessage({ tone: 'ok', text: success }); } catch (err) {
      setMessage({ tone: 'error', text: err?.code === 'permission-denied' ? 'This signature could not be saved. This line may have just been signed, or the order was revoked. Refresh the page and try again.' : err?.message || 'Something went wrong. Please try again.' });
    } finally { setBusy(''); }
  };
  const sign = e => {
    e.preventDefault();
    if (!agree) { setMessage({ tone: 'error', text: 'Tick the box to confirm you have read and understood the order.' }); return; }
    // The rules only accept the name listed on the order (ignoring capital letters), so catch a mismatch here with a clear message.
    if (chosen.name && normalizeSignerName(name).toLowerCase() !== normalizeSignerName(chosen.name).toLowerCase()) {
      setMessage({ tone: 'error', text: `Type the name exactly as it appears on the order: “${normalizeSignerName(chosen.name)}”. Capital letters don't matter, but spelling, middle initials and periods do.` });
      return;
    }
    run('sign', async () => { await signOfficeOrder(order.id, chosen.slot, name); setSlot(''); setName(''); setAgree(false); }, 'Thank you — your signature has been recorded.');
  };

  return (
    <main className="oop">
      <header className="oop-bar">
        <div className="oop-id">
          <img src="/brand/odc-mark.svg" alt="ODC" />
          <div>
            <small>Office Order · Control / tracking no.</small>
            <strong>{order.controlNumber}</strong>
          </div>
          <span className={`oop-status oop-status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        <div className="oop-actions">
          <button type="button" onClick={() => frame.current?.print()}><Printer size={15} /> Save as PDF</button>
          <LoadingButton type="button" loading={busy === 'png'} loadingLabel="Rendering…" onClick={() => run('png', () => frame.current.savePng(`${order.controlNumber}.png`))}><ImageDown size={15} /> Save as PNG</LoadingButton>
          <button type="button" onClick={() => navigator.clipboard.writeText(window.location.href.split('?')[0]).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Copied' : 'Copy link'}</button>
        </div>
      </header>

      <div className="oop-layout">
        <div className="oop-doc" ref={holder}>
          <OfficeOrderFrame ref={frame} order={order} signatures={signatures} scale={scale} title={`Office order ${order.controlNumber}`} />
        </div>
        <aside className="oop-side">
          <section>
            <h2><ShieldCheck size={16} aria-hidden="true" /> Document record</h2>
            <dl>
              <dt>Control no.</dt><dd>{order.controlNumber}</dd>
              <dt>Subject</dt><dd>{order.subject}</dd>
              {order.date && <><dt>Dated</dt><dd>{longDate(order.date)}</dd></>}
              {order.effectivity && <><dt>Effective</dt><dd>{longDate(order.effectivity)}</dd></>}
              <dt>Status</dt><dd>{STATUS_LABEL[order.status]}{order.status === 'revoked' && order.revokedReason ? ` — ${order.revokedReason}` : ''}</dd>
            </dl>
          </section>
          <section>
            <h2><PenLine size={16} aria-hidden="true" /> Signatures <small>{signers.filter(s => signatures[s.slot]).length}/{signers.length}</small></h2>
            <ul className="oop-signers">
              {signers.map(s => (
                <li key={s.slot} className={signatures[s.slot] ? 'is-signed' : ''}>
                  <b>{signatures[s.slot]?.name || s.name || s.title}</b>
                  <small>{SIGNER_KINDS[s.kind]}{s.title && (signatures[s.slot]?.name || s.name) ? ` · ${s.title}` : ''}</small>
                  <small>{signatures[s.slot] ? `Signed ${new Date(signatures[s.slot].signedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Pending'}</small>
                </li>
              ))}
            </ul>
            {message.text && <p className={`oop-msg oop-msg-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p>}
            {order.status === 'issued' && pending.length > 0 && (
              <form className="oop-sign" onSubmit={sign}>
                <label>
                  <span>Sign as</span>
                  <select value={chosen?.slot || ''} onChange={e => { setSlot(e.target.value); setName(''); }} required>
                    <option value="">Choose your line…</option>
                    {pending.map(s => <option key={s.slot} value={s.slot}>{[s.name, s.title].filter(Boolean).join(' — ')}</option>)}
                  </select>
                </label>
                {chosen && (
                  <>
                    <label>
                      <span>Type your full name{chosen.name ? ` exactly as shown: “${chosen.name}”` : ''}</span>
                      <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={200} autoComplete="name" />
                    </label>
                    {name.trim() && <p className="oop-preview" aria-label="Signature preview">{name}</p>}
                    <label className="oop-check">
                      <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                      <span>I have read and understood this Office Order and agree that typing my name is my electronic signature.</span>
                    </label>
                    <LoadingButton type="submit" className="oop-primary" loading={busy === 'sign'} loadingLabel="Signing…">Sign office order</LoadingButton>
                  </>
                )}
              </form>
            )}
            {order.status === 'revoked' && <p className="oop-msg oop-msg-error">This order was revoked and can no longer be signed.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
