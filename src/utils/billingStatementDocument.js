// Billing Statement (Statement of Account / SOA): official commercial invoice
// and payment billing document for OdysseyPH IT Solutions client projects.
// Strictly adheres to the company Brand Bible and uses brandPage().

import { BRAND_CO, esc, money, longDate, brandPage } from './brandDocument.js';

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

export const ODC_BANK_INFO = {
  bankName: 'GoTyme',
  bankAccount: '012267894321',
  bankAccountName: 'Johnjosefir Roca',
  approvedBy: BRAND_CO.approvedBy,
  approvedPhone: '0909-985-5322',
  preparedBy: 'Johnjosefir Roca',
};

export function statementNumberFor(inv) {
  const num = inv?.invoiceNumber || '';
  if (/^SOA-/.test(num)) return num;
  if (/^INV-/.test(num)) return num.replace(/^INV-/, 'SOA-');
  if (num) return `SOA-${num.replace(/^[^a-zA-Z0-9]+/, '')}`;
  const id = inv?.id || '';
  return id ? `SOA-${id.slice(0, 8).toUpperCase()}` : 'SOA-DRAFT';
}

const STATEMENT_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.soa-grid{display:grid;grid-template-columns:140px 1fr 140px 1fr;row-gap:8px;column-gap:16px;font-size:12.3px;padding-bottom:16px;margin-bottom:18px;border-bottom:2px solid var(--navy)}
.soa-grid dt{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding-top:2px}
.soa-grid dd{font-weight:600}
.soa-grid dd.party{grid-column:2/-1;font-family:Poppins,sans-serif;font-size:15px;color:var(--navy)}
.soa-grid dd.full{grid-column:2/-1}
.soa-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.soa-pill.paid{background:#ecfdf5;color:#065f46}.soa-pill.paid i{background:#10b981;width:6px;height:6px;border-radius:50%}
.soa-pill.pending{background:#fffbeb;color:#b45309}.soa-pill.pending i{background:#f59e0b;width:6px;height:6px;border-radius:50%}
.soa-tbl{margin:16px 0 14px;border:1px solid #3a4a5c;border-radius:8px;overflow:hidden;break-inside:avoid}
.soa-tbl table{width:100%;border-collapse:collapse}
.soa-tbl th{background:#ebe5dc;font-size:10px;letter-spacing:1.5px;text-align:left;padding:10px 16px;border-bottom:1px solid #3a4a5c;color:var(--navy)}
.soa-tbl td{padding:11px 16px;border-top:1px solid var(--line);font-size:12.5px;line-height:1.5}
.soa-tbl tbody tr:first-child td{border-top:none}
.soa-tbl .ar{text-align:right}
.soa-tbl .tot-row td{background:#faf8f5;font-weight:700;border-top:2px solid #3a4a5c}
.soa-tbl .tot{background:var(--navy);color:#fff;display:flex;justify-content:space-between;align-items:center;padding:12px 18px}
.soa-tbl .tot span{font-size:11px;font-weight:700;letter-spacing:1.5px}
.soa-tbl .tot b{font-family:Poppins,sans-serif;color:var(--orange);font-size:20px;font-weight:800}
.soa-pay-box{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px;padding:14px 18px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;break-inside:avoid}
.soa-pay-col h4{font-size:11px;font-weight:700;letter-spacing:1px;color:var(--navy);text-transform:uppercase;margin-bottom:8px}
.soa-pay-col p{font-size:11.5px;line-height:1.6;color:#334155;margin:0}
.soa-qrs{display:flex;gap:18px;justify-content:center;margin:16px 0 10px;break-inside:avoid}
.soa-qr{text-align:center;width:120px}
.soa-qr img{width:100px;height:100px;display:block;margin:0 auto;border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#fff;image-rendering:crisp-edges}
.soa-qr span{display:block;font-size:10px;font-weight:700;color:var(--navy);margin-top:4px}
.soa-disclaimer{font-size:9.5px;color:var(--muted);text-align:center;font-style:italic;margin-top:16px;border-top:1px dashed var(--line);padding-top:8px;line-height:1.4}
.signers{display:grid;grid-template-columns:1fr 1fr;gap:28px 56px;margin:28px 0 14px;break-inside:avoid}
.signers.three{grid-template-columns:repeat(3,1fr);gap:24px}
.signer .eyebrow{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--navy);text-transform:uppercase}
.sig-mark{font-family:'Great Vibes',cursive;font-size:32px;line-height:1;color:#111;height:44px;display:flex;align-items:flex-end;padding-bottom:2px;margin-bottom:-4px;white-space:nowrap;overflow:visible}
.sig-mark.empty{height:44px}
.signer .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
.sig-name{font-weight:700;font-size:12.5px;color:var(--navy)}
.sig-name.blank{color:var(--muted);font-weight:500;font-style:italic}
.sig-tag{font-size:10px;color:var(--muted);letter-spacing:1px;margin-top:2px}
.sig-meta{font-size:9px;color:var(--muted);margin-top:3px;line-height:1.4}
.stamp{position:absolute;top:320px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap}
.stamp.paid{color:rgba(16,185,129,.14)}
.stamp.cancelled{color:rgba(220,38,38,.14)}
@media screen and (max-width:840px){.pg{width:816px;min-height:1056px}.hd,.body,.ft{padding-left:64px;padding-right:64px}.band .bar{padding:0 64px 0 28px}.band .tab{width:64px}.band h1{font-size:24px}}
`;

function signerBlock(title, slotId, defaultName, defaultTitle, signature, timeZone) {
  const name = signature?.name || defaultName;
  const signed = signature
    ? `<div class="sig-mark">${esc(signature.name)}</div>`
    : '<div class="sig-mark empty"></div>';
  const meta = signature
    ? `<div class="sig-meta">Signed electronically ${esc(new Date(signature.signedAt).toLocaleString('en-PH', { timeZone, dateStyle: 'medium', timeStyle: 'short' }))}</div>`
    : '<div class="sig-meta">Digitally Prepared</div>';

  return `<div class="signer">
    <div class="eyebrow">${esc(title)}</div>
    ${signed}
    <div class="sig-line"></div>
    ${name ? `<div class="sig-name">${esc(name)}</div>` : '<div class="sig-name blank">Name &amp; signature</div>'}
    <div class="sig-tag">${esc((defaultTitle || '').toUpperCase())}</div>
    ${meta}
  </div>`;
}

export function buildBillingStatementHtml(invoice, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = statementNumberFor(invoice);
  const items = invoice.items || [];
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';

  const stamp = isPaid ? '<div class="stamp paid">PAID</div>' :
                isCancelled ? '<div class="stamp cancelled">CANCELLED</div>' :
                invoice.status === 'draft' ? '<div class="stamp">DRAFT</div>' : '';

  const pill = isPaid ? '<span class="soa-pill paid"><i></i>PAID IN FULL</span>' :
               '<span class="soa-pill pending"><i></i>OUTSTANDING</span>';

  const rows = items.map(item => `
    <tr>
      <td>${esc(item.service || 'Service')}</td>
      <td class="ar">₱ ${money(item.amount)}</td>
    </tr>
  `).join('');

  const qrCodes = invoice.qrCodes || [];
  const qrSection = qrCodes.length > 0 ? `
    <div class="soa-qrs">
      ${qrCodes.includes('gotyme') ? `<div class="soa-qr"><img src="${origin}/images/jetchgotyme.png" alt="GoTyme QR" /><span>GoTyme</span></div>` : ''}
      ${qrCodes.includes('maribank') ? `<div class="soa-qr"><img src="${origin}/images/jetchmaribank.png" alt="MariBank QR" /><span>MariBank</span></div>` : ''}
    </div>` : '';

  // Resolve signatures from either subcollection map or legacy document fields
  const preparedSig = signatures.prepared || (invoice.preparedSigned ? {
    name: invoice.preparedSigneeName || invoice.preparedBy || ODC_BANK_INFO.preparedBy,
    signedAt: invoice.preparedSignedAt?.toDate?.()?.toISOString() || invoice.preparedSignedAt || invoice.date,
  } : null);

  const approvedSig = signatures.approved || (invoice.approvedSigned ? {
    name: invoice.approvedSigneeName || invoice.approvedBy || BRAND_CO.approvedBy,
    signedAt: invoice.approvedSignedAt?.toDate?.()?.toISOString() || invoice.approvedSignedAt || invoice.date,
  } : null);

  const conformeSig = signatures.conforme || (invoice.conformeSigned ? {
    name: invoice.conformeSigneeName || invoice.billTo,
    signedAt: invoice.conformeSignedAt?.toDate?.()?.toISOString() || invoice.conformeSignedAt,
  } : null);

  const signers = `
    <div class="signers ${conformeSig || signatures.conforme ? 'three' : ''}">
      ${signerBlock('Prepared by', 'prepared', invoice.preparedBy || ODC_BANK_INFO.preparedBy, 'Staff Representative', preparedSig, timeZone)}
      ${signerBlock('Approved by', 'approved', invoice.approvedBy || BRAND_CO.approvedBy, 'Founder & Executive Lead', approvedSig, timeZone)}
      ${(conformeSig || signatures.conforme) ? signerBlock('Conforme / Received by', 'conforme', invoice.billTo || 'Client Representative', 'Authorized Representative', conformeSig, timeZone) : ''}
    </div>
  `;

  const body = `
    ${stamp}
    <dl class="soa-grid">
      <dt>Billed To</dt><dd class="party">${esc(invoice.billTo || 'Valued Client')}</dd>
      <dt>Project</dt><dd class="full">${esc(invoice.project || 'Digital Services')}</dd>
      <dt>Statement Date</dt><dd>${longDate(invoice.date) || esc(invoice.date || '—')}</dd>
      <dt>Payment Status</dt><dd>${pill}</dd>
      <dt>Payment Terms</dt><dd class="full">${esc(invoice.paymentTerms || 'Due upon receipt')}</dd>
    </dl>

    <div class="soa-tbl">
      <table>
        <thead>
          <tr>
            <th>SERVICE / DELIVERABLE DESCRIPTION</th>
            <th class="ar" style="width:28%">AMOUNT (PHP)</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="2" style="text-align:center;color:#888;">No deliverables listed</td></tr>'}
        </tbody>
      </table>
      <div class="tot">
        <span>TOTAL AMOUNT DUE</span>
        <b>₱ ${money(total)}</b>
      </div>
    </div>

    <div class="soa-pay-box">
      <div class="soa-pay-col">
        <h4>Payment Instructions</h4>
        <p>Payments may be settled via direct bank transfer, check payable to <strong>${esc(BRAND_CO.approvedBy)}</strong>, or scanning the authorized payment QR codes.</p>
      </div>
      <div class="soa-pay-col">
        <h4>Bank Details</h4>
        <p>
          Bank: <strong>${esc(ODC_BANK_INFO.bankName)}</strong><br>
          Account No: <strong>${esc(ODC_BANK_INFO.bankAccount)}</strong><br>
          Account Name: <strong>${esc(ODC_BANK_INFO.bankAccountName)}</strong><br>
          Contact: <strong>${esc(ODC_BANK_INFO.approvedPhone)}</strong>
        </p>
      </div>
    </div>

    ${qrSection}

    <div class="soa-disclaimer">
      This document is an official Statement of Account / Billing Statement issued by OdysseyPH IT Solutions and is not valid for claiming input VAT. An Official Acknowledgement Receipt is issued upon full settlement.
    </div>

    ${signers}
  `;

  const verify = invoice.id ? `Verify: ${origin.replace(/^https?:\/\//, '')}/invoice/${invoice.id}` : `${BRAND_CO.name} · Statement of Account`;
  const footRight = `Statement ${number}`;

  let html = brandPage({
    title: 'BILLING STATEMENT',
    numberLabel: 'STATEMENT / REF NO.',
    number,
    body,
    footLeft: verify,
    footRight,
    extraCss: STATEMENT_CSS,
    origin,
    autoPrint,
  });

  html = html
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(invoice.billTo || 'Billing Statement')}</title>`);

  return html;
}

