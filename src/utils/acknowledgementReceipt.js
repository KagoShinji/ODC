// Acknowledgement Receipt (AR): issued when a billing statement (SOA) is paid.
// The AR number is the tracking number and mirrors the SOA it settles
// (SOA-2026-10-076 -> AR-2026-10-076), so either number finds the other.
import { BRAND_CO, isoDate, esc, money, longDate, amountInWords, brandPage, openPrintWindow } from './brandDocument.js';

export { amountInWords };

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

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

const AR_CSS = `
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:64px;margin:40px 0 24px}
.sigs .eyebrow,
.signer .eyebrow{color:var(--navy);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.sig-mark{
  font-family:'Great Vibes',cursive;
  font-size:32px;
  line-height:1;
  color:#111;
  height:44px;
  display:flex;
  align-items:flex-end;
  padding-bottom:2px;
  margin-bottom:-4px;
  white-space:nowrap;
  overflow:visible;
}
.sig-mark.empty{height:44px}
.sigs .sig-line,
.signer .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
.sig-name{font-family:Poppins,sans-serif;font-size:13px;font-weight:700;color:var(--navy)}
.sig-tag{font-size:9.5px;font-weight:700;letter-spacing:1px;color:#c2410c;margin-top:2px}
.sig-meta{font-size:9px;color:var(--muted);margin-top:3px;line-height:1.4}
`;

function signerBlock(title, slotId, defaultName, defaultTitle, signature, signDate, timeZone) {
  const name = signature?.name || defaultName;
  const signed = (signature || name)
    ? `<div class="sig-mark">${esc(signature?.name || name)}</div>`
    : '<div class="sig-mark empty"></div>';
  const meta = signature
    ? `<div class="sig-meta">Signed electronically ${esc(new Date(signature.signedAt).toLocaleString('en-PH', { timeZone, dateStyle: 'medium', timeStyle: 'short' }))}</div>`
    : `<div class="sig-meta">Date: ${signDate}</div>`;

  return `<div class="signer">
    <div class="eyebrow">${esc(title)}</div>
    ${signed}
    <div class="sig-line"></div>
    <div class="sig-name">${esc(name)}</div>
    <div class="sig-tag">${esc((defaultTitle || '').toUpperCase())}</div>
    ${meta}
  </div>`;
}

export function buildReceiptHtml(r, { signatures = {}, origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const method = PAYMENT_METHODS[r.paymentMethod] || r.paymentMethod || '';
  const rows = (r.items || []).map(i => `<tr><td>${serviceCell(i.service)}</td><td class="ar">${money(i.amount)}</td></tr>`).join('');
  const via = [
    `<span>Received via <b>${esc(method)}</b></span>`,
    r.accountName ? `<span>Account name <b>${esc(r.accountName)}</b></span>` : '',
    r.referenceNumber ? `<span>Reference no. <b>${esc(r.referenceNumber)}</b></span>` : '',
  ].join('');
  const services = serviceList(r.items || []);
  const signDate = longDate(r.paymentDate);

  const preparedSig = signatures.prepared || (r.preparedSigned ? {
    name: r.preparedSigneeName || r.preparedBy,
    signedAt: r.preparedSignedAt?.toDate?.()?.toISOString() || r.preparedSignedAt || r.paymentDate,
  } : null);

  const approvedSig = signatures.approved || (r.approvedSigned ? {
    name: r.approvedSigneeName || r.approvedBy,
    signedAt: r.approvedSignedAt?.toDate?.()?.toISOString() || r.approvedSignedAt || r.paymentDate,
  } : null);

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
      ${signerBlock('Prepared by', 'prepared', r.preparedBy, 'Finance Representative', preparedSig, signDate, timeZone)}
      ${signerBlock('Approved by', 'approved', r.approvedBy || BRAND_CO.approvedBy, 'Executive Approval', approvedSig, signDate, timeZone)}
    </div>`;

  let html = brandPage({
    title: 'ACKNOWLEDGEMENT RECEIPT',
    numberLabel: 'AR NO.',
    number: r.receiptNumber,
    body,
    footLeft: 'Thank you for choosing Odyssey.',
    footRight: `Ref. ${r.invoiceNumber} · ${r.receiptNumber}`,
    extraCss: AR_CSS,
    origin,
    autoPrint,
  });

  return html.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>');
}

export const printReceipt = (r, target) => openPrintWindow(buildReceiptHtml(r, { autoPrint: true }), target);

export const receiptLink = (id) => `${window.location.origin}/receipt/${id}`;
export const todayIso = () => isoDate();
