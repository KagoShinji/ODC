import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';
import { SalesDialog, Empty } from './SalesUi';
import { formatPeso, localDateKey } from '../../../functions/src/salesDomain.js';
import { subscribeDeals, confirmConversion, rejectConversion } from '../../services/salesService';
import { errorText, formatWhen, downloadCsv } from '../../utils/salesFormat';

const TABS = [{ id: 'pending', label: 'Awaiting confirmation' }, { id: 'confirmed', label: 'Confirmed' }, { id: 'rejected', label: 'Returned' }];
const peso = c => (c ? String(c / 100) : '');

function ReviewDialog({ ctx, deal, onClose, onDone }) {
  const { role, settings, user } = ctx;
  const [form, setForm] = useState({ final: peso(deal.finalCentavos || deal.quotedCentavos), downPayment: peso(deal.downPaymentCentavos), paymentDate: deal.paymentDate || '', paymentReference: deal.paymentReference || '', notes: '', paymentVerified: false });
  const [returnNotes, setReturnNotes] = useState('');
  const [step, setStep] = useState('review');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const run = async work => {
    setBusy(true); setError('');
    try { await work(); onDone(); } catch (err) { setError(errorText(err)); setStep('review'); } finally { setBusy(false); }
  };
  return (
    <SalesDialog title={`Conversion: ${deal.businessName}`} busy={busy} onClose={onClose}>
      {error && <p className="task-error" role="alert">{error}</p>}
      <dl className="task-detail-grid">
        <dt>Service</dt><dd>{deal.service}</dd>
        <dt>Quoted value</dt><dd>{formatPeso(deal.quotedCentavos)}</dd>
        <dt>Requested by</dt><dd>{deal.submittedByName}<span>{formatWhen(deal.submittedAt, settings.timezone)}</span></dd>
        <dt>KPI credit</dt><dd>{deal.attributedName || deal.attributedEmail}<span>Lead created {formatWhen(deal.leadCreatedAt, settings.timezone)}</span></dd>
        {deal.requestNotes && <><dt>Notes</dt><dd>{deal.requestNotes}</dd></>}
      </dl>
      {role.canConfirm ? (
        <form onSubmit={e => { e.preventDefault(); if (step === 'review') setStep('confirm'); else run(() => confirmConversion(user, deal.leadId, form, settings)); }}>
          <h4>Verify payment</h4>
          <div className="task-form-grid sales-grid-2">
            <label className="task-field"><span>Final agreed amount (₱)</span><input required inputMode="decimal" value={form.final} onChange={e => { set('final', e.target.value); setStep('review'); }} /></label>
            <label className="task-field"><span>Down payment received (₱)</span><input required inputMode="decimal" value={form.downPayment} onChange={e => { set('downPayment', e.target.value); setStep('review'); }} /></label>
            <label className="task-field"><span>Payment date</span><input type="date" required max={localDateKey(new Date(), settings.timezone)} value={form.paymentDate} onChange={e => { set('paymentDate', e.target.value); setStep('review'); }} /></label>
            <label className="task-field"><span>Payment reference <small>(optional)</small></span><input maxLength={120} value={form.paymentReference} onChange={e => set('paymentReference', e.target.value)} placeholder="Bank / GCash reference, OR no." /></label>
          </div>
          <label className="task-field"><span>Review notes <small>(optional)</small></span><textarea maxLength={1000} value={form.notes} onChange={e => set('notes', e.target.value)} /></label>
          <label className="task-assignee-option">
            <input type="checkbox" checked={form.paymentVerified} onChange={e => { set('paymentVerified', e.target.checked); setStep('review'); }} />
            <span>I verified the client's down payment was received<small>Only confirmed conversions count toward the official conversion KPI. This cannot be undone by sales staff.</small></span>
          </label>
          <footer className="task-form-footer">
            {step === 'confirm' ? (
              <div className="task-inline task-confirm" role="group" aria-label="Confirm conversion">
                <span>Confirm {deal.businessName} as a converted client?</span>
                <button type="button" onClick={() => setStep('review')} disabled={busy}>Back</button>
                <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Confirming…">Yes, confirm conversion</LoadingButton>
              </div>
            ) : (
              <>
                {role.isManager && <button type="button" className="task-danger" onClick={() => setStep('return')} disabled={busy}>Return to associate</button>}
                <button type="submit" className="task-primary" disabled={busy || !form.paymentVerified}>Confirm conversion…</button>
              </>
            )}
          </footer>
        </form>
      ) : <p className="task-muted">You can return this request with notes. Confirming a conversion requires the “Confirm Conversions” permission.</p>}
      {(step === 'return' || (!role.canConfirm && role.isManager)) && (
        <form onSubmit={e => { e.preventDefault(); run(() => rejectConversion(user, deal.leadId, returnNotes)); }}>
          <label className="task-field"><span>What needs to change?</span><textarea required data-autofocus="true" maxLength={1000} value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="e.g. Down payment not yet reflected in the account" /></label>
          <footer className="task-form-footer">
            {role.canConfirm && <button type="button" onClick={() => setStep('review')} disabled={busy}>Back</button>}
            <LoadingButton type="submit" className="task-danger" loading={busy} loadingLabel="Returning…">Return request</LoadingButton>
          </footer>
        </form>
      )}
    </SalesDialog>
  );
}

export default function SalesConversions({ ctx, onOpenLead, onChanged }) {
  const { role, settings } = ctx;
  const [tab, setTab] = useState('pending');
  const [deals, setDeals] = useState([]);
  const [loadedTab, setLoadedTab] = useState(null);
  const loading = loadedTab !== tab;
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(null);

  useEffect(() => subscribeDeals({ owner: role.viewAll ? null : ctx.myEmail, status: tab },
    list => { setDeals(list.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))); setLoadedTab(tab); setError(''); },
    err => { setError(errorText(err)); setLoadedTab(tab); }), [tab, role.viewAll, ctx.myEmail]);

  const exportCsv = () => downloadCsv(`odc-sales-deals-${tab}-${localDateKey(new Date(), settings.timezone)}.csv`,
    ['Business name', 'Service purchased', 'Quoted value', 'Final agreed amount', 'Down payment', 'Payment date', 'Payment reference', 'Sales associate', 'Status', 'Submitted', 'Reviewed by', 'Confirmed'],
    deals.map(d => [d.businessName, d.service, d.quotedCentavos / 100, d.finalCentavos / 100, d.downPaymentCentavos / 100, d.paymentDate, d.paymentReference, d.attributedName, d.status,
      formatWhen(d.submittedAt, settings.timezone), d.reviewedByName, d.confirmedAt ? formatWhen(d.confirmedAt, settings.timezone) : '']));

  return (
    <div>
      <div className="task-toolbar">
        <div className="task-segmented" role="group" aria-label="Conversion status">
          {TABS.map(t => <button type="button" key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
        <button type="button" className="sales-push" onClick={exportCsv} disabled={!deals.length}>Export CSV</button>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {loading ? <div className="task-skeleton" role="status" aria-label="Loading conversions" /> : deals.length === 0 ? (
        <Empty icon={BadgeCheck} title={tab === 'pending' ? 'No conversion requests waiting' : tab === 'confirmed' ? 'No confirmed conversions yet' : 'No returned requests'}>
          {tab === 'pending' ? 'Associates submit a request from the lead once the client agrees to proceed.' : null}
        </Empty>
      ) : (
        <div className="sales-table-wrap">
          <table className="sales-table">
            <thead><tr><th scope="col">Business</th><th scope="col">Service</th><th scope="col">Quoted</th><th scope="col">Down payment</th><th scope="col">Associate</th><th scope="col">{tab === 'pending' ? 'Submitted' : 'Reviewed'}</th>{tab === 'pending' && role.isManager && <th scope="col"><span className="task-visually-hidden">Actions</span></th>}</tr></thead>
            <tbody>
              {deals.map(d => (
                <tr key={d.id}>
                  <th scope="row"><button type="button" className="sales-link" onClick={() => onOpenLead(d.leadId)}>{d.businessName}</button>{d.reviewNotes && <small>{d.reviewNotes}</small>}</th>
                  <td>{d.service}</td>
                  <td>{formatPeso(d.quotedCentavos)}</td>
                  <td>{d.downPaymentCentavos ? formatPeso(d.downPaymentCentavos) : '—'}</td>
                  <td>{d.attributedName}</td>
                  <td>{formatWhen(tab === 'pending' ? d.submittedAt : d.reviewedAt, settings.timezone)}</td>
                  {tab === 'pending' && role.isManager && <td><button type="button" className="task-primary" onClick={() => setReviewing(d)}>Review</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reviewing && <ReviewDialog ctx={ctx} deal={reviewing} onClose={() => setReviewing(null)} onDone={() => { setReviewing(null); onChanged?.(); }} />}
    </div>
  );
}
