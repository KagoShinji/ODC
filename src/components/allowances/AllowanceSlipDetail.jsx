import { ArrowSquareOut, CalendarBlank, ClockCounterClockwise, FileText, Printer, Receipt } from '@phosphor-icons/react';
import { peso, timestampLabel } from '../../utils/allowanceDocuments';
import { allowanceBalanceTerms } from '../../../functions/src/domain.js';
import AllowanceStatusBadge from './AllowanceStatusBadge';

const label = value => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').trim();
const title = value => {
  const text = label(value);
  return text ? text[0].toUpperCase() + text.slice(1) : 'Activity recorded';
};
const dateLabel = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || 'Not recorded';
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
};

export default function AllowanceSlipDetail({ slip, account, evidence = [], history = [], busy, onOpenEvidence, onPrint }) {
  const attachmentIds = slip.attachmentIds || [];
  const attachments = evidence.filter(file => attachmentIds.includes(file.id));
  const total = slip.correctedTotalCentavos ?? slip.totalCentavos;
  const corrected = slip.correctedTotalCentavos !== undefined && slip.correctedTotalCentavos !== slip.totalCentavos;
  const terms = allowanceBalanceTerms(account);

  return <div className="allowance-slip-detail">
    <section className="allowance-slip-summary" aria-labelledby="allowance-slip-client">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#d9a66a]">Liquidation <AllowanceStatusBadge status={slip.status} /></div>
        <h4 id="allowance-slip-client">{slip.clientName}</h4>
        <p>Submitted by <strong>{slip.staffName}</strong></p>
      </div>
      <div className="allowance-slip-amount">
        <span>Total spent</span>
        <strong>{peso(total)}</strong>
        {corrected && <small>Original total {peso(slip.totalCentavos)}</small>}
      </div>
    </section>

    <dl className="allowance-slip-meta">
      <div><dt><FileText size={16} aria-hidden="true" /> Slip number</dt><dd>{slip.slipNumber}</dd></div>
      <div><dt><CalendarBlank size={16} aria-hidden="true" /> Meeting date</dt><dd>{dateLabel(slip.date)}</dd></div>
      <div><dt>{terms.declared}</dt><dd>{peso(slip.declaredCashCentavos)}</dd></div>
    </dl>

    {slip.reviewNote && <div className="allowance-slip-review-note"><span>Review note</span><p>{slip.reviewNote}</p></div>}

    <section className="allowance-slip-section" aria-labelledby="allowance-expenses-title">
      <header><div><span>Expense breakdown</span><h4 id="allowance-expenses-title">Claimed items</h4></div><strong>{slip.lines?.length || 0} item{slip.lines?.length === 1 ? '' : 's'}</strong></header>
      {slip.lines?.length ? <div className="allowance-slip-table-wrap"><table className="allowance-slip-table">
        <thead><tr><th scope="col">Description</th><th scope="col">Category</th><th scope="col">Amount</th></tr></thead>
        <tbody>{slip.lines.map((line, index) => <tr key={`${line.description}-${index}`}><td>{line.description}</td><td>{line.category}</td><td>{peso(line.amountCentavos)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan="2">Total</th><td>{peso(total)}</td></tr></tfoot>
      </table></div> : <div className="allowance-slip-empty"><Receipt size={22} aria-hidden="true" /><p>No expenses were recorded for this meeting.</p></div>}
    </section>

    <section className="allowance-slip-section" aria-labelledby="allowance-evidence-title">
      <header><div><span>Supporting records</span><h4 id="allowance-evidence-title">Receipts and vouchers</h4></div><strong>{attachments.length} file{attachments.length === 1 ? '' : 's'}</strong></header>
      {attachments.length ? <div className="allowance-slip-evidence">{attachments.map(file => {
        const canOpen = file.kind !== 'reference' || Boolean(file.referenceUri);
        return <article key={file.id}>
          <span className="allowance-slip-file-icon"><Receipt size={18} aria-hidden="true" /></span>
          <div><strong>{file.name}</strong><small>{file.kind === 'reference' ? `Reference: ${file.reference}` : 'Private evidence file'}</small></div>
          {canOpen ? <button type="button" disabled={busy} onClick={() => onOpenEvidence(file)}>Open <ArrowSquareOut size={15} aria-hidden="true" /></button> : <span className="allowance-slip-file-state">Reference recorded</span>}
        </article>;
      })}</div> : <div className="allowance-slip-empty"><Receipt size={22} aria-hidden="true" /><p>No supporting evidence is linked to this slip.</p></div>}
    </section>

    <section className="allowance-slip-section" aria-labelledby="allowance-history-title">
      <header><div><span>Audit trail</span><h4 id="allowance-history-title">Action history</h4></div><strong>{history.length} event{history.length === 1 ? '' : 's'}</strong></header>
      {history.length ? <ol className="allowance-slip-timeline">{history.map(event => <li key={event.id}>
        <span className="allowance-slip-timeline-marker" aria-hidden="true"><ClockCounterClockwise size={14} /></span>
        <div><strong>{title(event.command)}</strong><time>{timestampLabel(event.createdAt)}</time>{(event.before || event.after) && <p>{event.before ? title(event.before) : 'Created'} <span aria-hidden="true">→</span> {title(event.after)}</p>}{event.reason && <small>{event.reason}</small>}</div>
      </li>)}</ol> : <div className="allowance-slip-empty"><ClockCounterClockwise size={22} aria-hidden="true" /><p>No action history is available yet.</p></div>}
    </section>

    <footer className="allowance-slip-footer">
      <p>Print or save this slip as a PDF for your records.</p>
      <button type="button" className="allowance-primary" disabled={busy} onClick={onPrint}><Printer size={17} aria-hidden="true" /> Print slip</button>
    </footer>
  </div>;
}
