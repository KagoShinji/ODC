import { allowanceBalanceTerms } from '../../functions/src/domain.js';

export const peso = value => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((value || 0) / 100);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const timestampLabel = value => value?.toDate ? value.toDate().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : value ? new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—';

export function printAllowanceSlip(slip, type, attachments = [], history = [], account) {
  const popup = window.open('', '_blank', 'width=900,height=800');
  if (!popup) throw new Error('Allow pop-ups to print this slip.');
  const e = escapeHtml;
  const terms = allowanceBalanceTerms(account);
  const fields = type === 'liquidation' ? [
    ['Date', slip.date], ['Meeting attended / Client', slip.clientName], ['Total amount spent', peso(slip.totalCentavos)], [terms.declared, peso(slip.declaredCashCentavos)],
    ...(slip.correctedTotalCentavos !== undefined ? [['Corrected total', peso(slip.correctedTotalCentavos)], ['Correction reason', slip.correctionReason]] : []),
  ] : [['Date', slip.date], ['Reason on request', slip.reason], ['Client', slip.clientName], [terms.declared, peso(slip.declaredCashCentavos)], ['Requested amount', peso(slip.amountCentavos)], ['Payment method', slip.paymentMethod], ['Payment reference / acknowledgment', slip.referenceNumber], ['Transfer / release date', slip.paymentDate]];
  popup.document.write(`<!DOCTYPE html><html><head><title>${e(slip.slipNumber)}</title><meta charset="utf-8"><style>body{font:14px Arial,sans-serif;color:#222;margin:48px;line-height:1.6}h1{font-size:24px}img{height:55px}dl{display:grid;grid-template-columns:220px 1fr;gap:8px}dt{font-weight:bold}dd{margin:0}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{padding:10px;border:1px solid #ccc;text-align:left}small{color:#555}@media print{button{display:none}}</style></head><body><img src="${e(window.location.origin)}/images/odcclearlogo.png" alt="ODC"><h1>${type === 'liquidation' ? 'Liquidation Slip' : 'Replenishment Requisition Slip'}</h1><p>${e(slip.slipNumber)} · ${e(slip.status)}</p><dl><dt>Requested / submitted by</dt><dd>${e(slip.staffName)}</dd>${fields.map(([key, value]) => `<dt>${e(key)}</dt><dd>${e(value || '—')}</dd>`).join('')}</dl>${type === 'liquidation' ? `<table><thead><tr><th>Expense</th><th>Category</th><th>Amount</th></tr></thead><tbody>${(slip.lines || []).map(line => `<tr><td>${e(line.description)}</td><td>${e(line.category)}</td><td>${e(peso(line.amountCentavos))}</td></tr>`).join('')}</tbody></table><h3>Receipts and vouchers</h3><ul>${attachments.map(file => `<li>${e(file.name)}</li>`).join('')}</ul>` : ''}<p>${e(slip.notes || slip.reviewNote || '')}</p><h3>Action history</h3>${history.map(event => `<p><small>${e(timestampLabel(event.createdAt))} · ${e(event.command)} · ${e(event.actorUid)} · ${e(event.after)} ${e(event.reason)}</small></p>`).join('')}<button id="print">Print / Save as PDF</button></body></html>`);
  popup.document.close();
  popup.document.getElementById('print').addEventListener('click', () => popup.print());
}
export function exportAllowanceCsv(records) {
  const headers = ['Date', 'Staff', 'Type', 'Amount (PHP)', 'Source', 'Actor'];
  const safe = value => { const str = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(str) ? "'" + str : str).replace(/"/g, '""')}"`; };
  const lines = records.map(row => [row.date, row.staffName, row.kind, (row.amountCentavos / 100).toFixed(2), row.sourceId, row.actorUid].map(safe).join(','));
  const url = URL.createObjectURL(new Blob(['\uFEFF' + [headers.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'odc-allowance-ledger.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
