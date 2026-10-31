// Acknowledgement Receipt (AR): issued when a billing statement (SOA) is paid.
// The AR number is the tracking number and mirrors the SOA it settles
// (SOA-2026-10-076 -> AR-2026-10-076), so either number finds the other.
import { BRAND_CO, isoDate, esc, money, longDate, amountInWords, brandPage, openPrintWindow } from './brandDocument';

export { amountInWords };

export const PAYMENT_METHODS = {
  cash: 'Cash',
  gotyme: 'GoTyme',
  maribank: 'MariBank',
  gcash: 'GCash',
};

const pad = (n) => String(n).padStart(2, '0');

export function receiptNumberFor(inv) {
  const num = inv.invoiceNumber || '';
  if (/^(SOA|INV)-/.test(num)) return num.replace(/^(SOA|INV)-/, 'AR-');
  const d = new Date();
  return `AR-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${inv.id.slice(0, 6).toUpperCase()}`;
}

export const statementNumberFor = (inv) => (inv.invoiceNumber || '').replace(/^INV-/, 'SOA-');

// Firestore payload for receipts/{invoiceId}; one receipt per statement.
export function buildReceipt(inv, payment, issuedBy) {
  const items = (inv.items || []).map(i => ({ service: i.service || '', amount: Number(i.amount || 0) }));
  return {
    receiptNumber: receiptNumberFor(inv),
    invoiceId: inv.id,
    invoiceNumber: statementNumberFor(inv),
    billTo: inv.billTo || '',
    project: inv.project || '',
    billingDate: inv.date || '',
    paymentTerms: inv.paymentTerms || '',
    items,
    total: items.reduce((s, i) => s + i.amount, 0),
    paymentDate: payment.paymentDate || isoDate(),
    paymentMethod: payment.method,
    referenceNumber: payment.method !== 'cash' ? (payment.reference || '').trim() : null,
    accountName: payment.method !== 'cash' ? (payment.accountName || '').trim() : null,
    preparedBy: (payment.preparedBy || '').trim(),
    approvedBy: (payment.approvedBy || BRAND_CO.approvedBy).trim(),
    issuedBy: issuedBy || '',
  };
}

function serviceList(items) {
  const names = items.map(i => i.service.replace(/\s*\(.*?\)\s*/g, '').trim()).filter(Boolean);
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// "Domain Fee (Yearly)" -> "Domain Fee <span class=muted>(Yearly)</span>"
const serviceCell = (s) => esc(s).replace(/(\(.*?\))/g, '<span class="muted">$1</span>');

export function buildReceiptHtml(r, { origin, autoPrint = false } = {}) {
  const method = PAYMENT_METHODS[r.paymentMethod] || r.paymentMethod || '';
  const rows = (r.items || []).map(i => `<tr><td>${serviceCell(i.service)}</td><td class="ar">${money(i.amount)}</td></tr>`).join('');
  const via = [
    `<span>Received via <b>${esc(method)}</b></span>`,
    r.accountName ? `<span>Account name <b>${esc(r.accountName)}</b></span>` : '',
    r.referenceNumber ? `<span>Reference no. <b>${esc(r.referenceNumber)}</b></span>` : '',
  ].join('');
  const services = serviceList(r.items || []);
  const signDate = longDate(r.paymentDate);

  const body = `
    <div class="meta">
      <div>
        <div class="eyebrow">Received from</div>
        <div class="party">${esc(r.billTo)}</div>
        ${r.project ? `<div class="sub">Project: <b>${esc(r.project)}</b></div>` : ''}
        <div class="pill"><i></i>PAID IN FULL</div>
      </div>
      <dl class="kv">
        <dt>Statement No.</dt><dd>${esc(r.invoiceNumber)}</dd>
        <dt>Billing Date</dt><dd>${longDate(r.billingDate)}</dd>
        <dt>Payment Date</dt><dd>${longDate(r.paymentDate)}</dd>
        <dt>Payment Terms</dt><dd>${esc(r.paymentTerms)}</dd>
      </dl>
    </div>
    <div class="tbl">
      <table><thead><tr><th>SERVICE</th><th class="ar">AMOUNT (&#8369;)</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><span>TOTAL AMOUNT RECEIVED</span><b>&#8369; ${money(r.total)}</b></div>
    </div>
    <div class="note">
      <div class="eyebrow">Acknowledgement of payment</div>
      <p>This Acknowledgement Receipt confirms that OdysseyPH IT Solutions has received payment amounting to <b>${amountInWords(r.total)} (&#8369;${money(r.total)})</b> from <b>${esc(r.billTo)}</b>${services ? ` as full settlement for ${esc(services)}` : ''}.</p>
      <div class="via">${via}</div>
    </div>
    <div class="sigs">
      <div><div class="eyebrow">Prepared by</div><div class="sig-line"></div>
        <div class="sig-name">${esc(r.preparedBy)}</div><div class="sig-tag">DIGITALLY PREPARED &amp; SIGNED</div><div class="sig-date">${signDate}</div></div>
      <div><div class="eyebrow">Approved by</div><div class="sig-line"></div>
        <div class="sig-name">${esc(r.approvedBy)}</div><div class="sig-tag">DIGITALLY APPROVED &amp; SIGNED</div><div class="sig-date">${signDate}</div></div>
    </div>`;

  return brandPage({
    title: 'ACKNOWLEDGEMENT RECEIPT',
    numberLabel: 'AR NO.',
    number: r.receiptNumber,
    body,
    footLeft: 'Thank you for choosing Odyssey.',
    footRight: `Ref. ${r.invoiceNumber} · ${r.receiptNumber}`,
    origin,
    autoPrint,
  });
}

export const printReceipt = (r, target) => openPrintWindow(buildReceiptHtml(r, { autoPrint: true }), target);

export const receiptLink = (id) => `${window.location.origin}/receipt/${id}`;
export const todayIso = () => isoDate();
