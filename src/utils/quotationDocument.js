// Price Quotation: Commercial proposal and project scope document.
// Tracking number format: QT-<year>-<month>-<sequence>, e.g. QT-2026-11-001.
// Strictly adheres to the company Brand Bible (brandDocument.js) and uses brandPage().

import { BRAND_CO, esc, longDate, money, amountInWords, brandPage } from './brandDocument.js';

export const QUOTATION_PREFIX = 'QT';
const pad = (n, size = 2) => String(n).padStart(size, '0');
export const controlMonthOf = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const formatControlNumber = (month, seq) => `${QUOTATION_PREFIX}-${month}-${pad(seq, 3)}`;

export const quotationLink = (id, origin = (typeof window !== 'undefined' ? window.location.origin : '')) =>
  `${origin}/quotation/${id}`;

export const SIGNER_KINDS = {
  prepared: 'Prepared & Approved by',
  accepted: 'Accepted & Conforme',
  noted: 'Noted by',
};

export const emptyQuotationSigners = () => ({
  s1: { kind: 'prepared', name: BRAND_CO.approvedBy, title: 'Founder & Engineering Lead', order: 1 },
  s2: { kind: 'accepted', name: '', title: 'Authorized Representative', order: 2 },
});

export const DEFAULT_VALIDITY_DAYS = 30;

export const defaultValidUntil = (baseDate = new Date()) => {
  const d = baseDate instanceof Date ? new Date(baseDate) : new Date(baseDate || Date.now());
  d.setDate(d.getDate() + DEFAULT_VALIDITY_DAYS);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function calcLineAmount(quantity, unitPrice) {
  const q = Number(quantity);
  const p = Number(unitPrice);
  if (Number.isNaN(q) || Number.isNaN(p) || q <= 0 || p <= 0) return 0;
  return Math.round(q * p * 100) / 100;
}

export function calcQuotationTotals(items = [], discountPercent = 0, taxPercent = 0) {
  const subtotal = (items || []).reduce((sum, item) => {
    const amt = typeof item.amount === 'number' && !Number.isNaN(item.amount) && item.amount > 0
      ? item.amount
      : calcLineAmount(item.quantity, item.unitPrice);
    return sum + amt;
  }, 0);

  const roundedSubtotal = Math.round(subtotal * 100) / 100;
  const discPct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const discountAmount = Math.round(((roundedSubtotal * discPct) / 100) * 100) / 100;
  const taxable = Math.max(0, roundedSubtotal - discountAmount);
  const taxPct = Math.max(0, Number(taxPercent) || 0);
  const taxAmount = Math.round(((taxable * taxPct) / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  const totalWords = amountInWords(total);

  return {
    subtotal: roundedSubtotal,
    discountPercent: discPct,
    discountAmount,
    taxPercent: taxPct,
    taxAmount,
    total,
    totalWords,
  };
}

/* ─── AI Prompt & Paste Parsing ─── */

export const AI_QUOTATION_PROMPT = `Write a Price Quotation for OdysseyPH IT Solutions about the client project below. Use exactly this plain-text format, no extra commentary:

PROJECT: (Full Project / System Name)
CLIENT BUSINESS: (Client Enterprise / Company Name)
CLIENT NAME: (Authorized Client Representative)
CLIENT ADDRESS: (Company Location / Address)
DATE: (Month Day, Year)
VALID UNTIL: (Month Day, Year)
PAYMENT TERMS: (e.g. 50% Mobilization Deposit, 50% Final Handover)

ITEMS:
| Item & Description | Qty | Unit Price |
| (Item 1 Name & Specs) | 1 | 50000 |
| (Item 2 Name & Specs) | 2 | 15000 |

## 1. Project Objectives & Scope of Work
(Paragraphs describing what the system will accomplish and architectural scope)

## 2. Key Modules & Deliverables
(- Bullet list of specific features, portals, databases, APIs, and administrative modules)

## 3. Implementation Schedule & Milestones
(Timeline breakdown from mobilization to deployment)

## 4. Maintenance, Warranty & Service Level Terms
(Warranty period, bug fixes, support channels, and handover policies)

Prepared by:
Jetch Merald S. Madaya
Founder & Engineering Lead

Accepted by:
(Client Representative Full Name)
(Position / Title)

Project Details:
`;

const clean = s => s.replace(/^[#>*\s]+|\*\*|__/g, '').replace(/\s+$/, '').trim();

export function parseQuotationText(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const fields = {};
  const items = [];
  const scope = [];
  let inItemsTable = false;
  let inScope = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Field headers
    const mProject = line.match(/^PROJECT\s*[:\-–]\s*(.+)$/i);
    if (mProject) { fields.projectName = clean(mProject[1]); continue; }

    const mBiz = line.match(/^CLIENT\s*(?:BUSINESS|COMPANY|ENTERPRISE)\s*[:\-–]\s*(.+)$/i);
    if (mBiz) { fields.clientBusiness = clean(mBiz[1]); continue; }

    const mName = line.match(/^CLIENT\s*(?:NAME|ATTN|REPRESENTATIVE)\s*[:\-–]\s*(.+)$/i);
    if (mName) { fields.clientName = clean(mName[1]); continue; }

    const mAddr = line.match(/^CLIENT\s*ADDRESS\s*[:\-–]\s*(.+)$/i);
    if (mAddr) { fields.clientAddress = clean(mAddr[1]); continue; }

    const mDate = line.match(/^DATE\s*[:\-–]\s*(.+)$/i);
    if (mDate) { fields.date = clean(mDate[1]); continue; }

    const mValid = line.match(/^VALID\s*(?:UNTIL|THROUGH|DATE)?\s*[:\-–]\s*(.+)$/i);
    if (mValid) { fields.validUntil = clean(mValid[1]); continue; }

    const mTerms = line.match(/^PAYMENT\s*TERMS\s*[:\-–]\s*(.+)$/i);
    if (mTerms) { fields.paymentTerms = clean(mTerms[1]); continue; }

    if (/^ITEMS\s*:?$/i.test(line)) {
      inItemsTable = true;
      continue;
    }

    if (inItemsTable && /^\|.*\|$/.test(line)) {
      if (/^\|[\s:|-]+\|$/.test(line) || /item\s*&?\s*description/i.test(line)) continue;
      const cells = line.slice(1, -1).split('|').map(c => clean(c));
      if (cells.length >= 3) {
        const desc = cells[0];
        const qty = parseFloat(cells[1].replace(/,/g, '')) || 1;
        const unitPrice = parseFloat(cells[2].replace(/[^0-9.]/g, '')) || 0;
        if (desc) {
          items.push({
            id: `item_${Date.now()}_${items.length}`,
            description: desc,
            quantity: qty,
            unitPrice,
            amount: calcLineAmount(qty, unitPrice),
          });
        }
      }
      continue;
    }

    if (line.startsWith('##') || inScope) {
      inItemsTable = false;
      inScope = true;
      scope.push(lines[i]);
    }
  }

  return { fields, items, scope: scope.join('\n') };
}

export function mergeQuotationParsed(f, parsed) {
  const next = { ...f };
  if (parsed.fields) {
    for (const key of ['projectName', 'clientBusiness', 'clientName', 'clientAddress', 'date', 'validUntil', 'paymentTerms']) {
      if (parsed.fields[key]) next[key] = parsed.fields[key];
    }
  }
  if (parsed.items && parsed.items.length) {
    next.items = parsed.items;
  }
  if (parsed.scope) {
    next.scopeText = parsed.scope;
  }
  return next;
}

/* ─── Light Markdown to HTML Renderer ─── */

const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>')
  .replace(/__(.+?)__/g, '<b>$1</b>');

export function renderMarkdownBody(text) {
  const out = [];
  const lines = String(text || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i += 1; continue; }

    const h = t.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} class="qt-h${level}">${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\|.*\|$/.test(t)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(lines[i].trim()); i += 1; }
      const cells = r => r.slice(1, -1).split('|').map(c => c.trim());
      const filtered = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
      const [head, ...rest] = filtered;
      if (head) {
        out.push(`<div class="tbl"><table><thead><tr>${cells(head).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      }
      continue;
    }

    if (/^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const marker = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      const listItems = [];
      while (i < lines.length && marker.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(marker, ''));
        i += 1;
      }
      out.push(`<${ordered ? 'ol' : 'ul'} class="qt-list">${listItems.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote class="qt-callout"><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\||[-*]\s|\d+[.)]\s|>)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p class="qt-p">${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

/* ─── Branded HTML Builder ─── */

const EXTRA_QT_CSS = `
.qt-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:26px;background:#f8f9fa;border:1px solid var(--line);border-radius:8px;padding:16px 20px}
.qt-meta-col h3{font-size:10px;font-weight:700;letter-spacing:1.5px;color:#c2410c;text-transform:uppercase;margin-bottom:8px}
.qt-meta-col .qt-lead{font-family:Poppins,sans-serif;font-size:16px;font-weight:700;color:var(--navy);margin-bottom:4px}
.qt-meta-col .qt-sub{font-size:12px;color:var(--muted);line-height:1.6}
.qt-table-wrap{border:1px solid #3a4a5c;border-radius:8px;overflow:hidden;margin-bottom:24px}
.qt-table{width:100%;border-collapse:collapse}
.qt-table th{background:#ebe5dc;font-size:10px;letter-spacing:1.2px;text-align:left;padding:10px 14px;border-bottom:1px solid #3a4a5c;color:var(--navy);text-transform:uppercase}
.qt-table td{padding:11px 14px;border-top:1px solid var(--line);font-size:12.5px;vertical-align:top}
.qt-table tr:first-child td{border-top:none}
.qt-table .ar{text-align:right}
.qt-table .ac{text-align:center}
.qt-summary-box{display:flex;justify-content:flex-end;margin-bottom:28px}
.qt-summary-table{min-width:320px;border-collapse:collapse}
.qt-summary-table td{padding:6px 12px;font-size:12.5px}
.qt-summary-table td.ar{text-align:right;font-weight:600}
.qt-summary-table tr.qt-total-row{background:var(--navy);color:#fff}
.qt-summary-table tr.qt-total-row td{padding:10px 14px}
.qt-summary-table tr.qt-total-row td.ar{color:var(--orange);font-family:Poppins,sans-serif;font-size:18px;font-weight:800}
.qt-words{font-size:11px;font-style:italic;color:var(--muted);text-align:right;margin-top:6px}
.qt-scope-section{margin-top:24px;border-top:1px solid var(--line);padding-top:20px}
.qt-h1{font-family:Poppins,sans-serif;font-size:18px;font-weight:700;color:var(--navy);margin:16px 0 8px}
.qt-h2{font-family:Poppins,sans-serif;font-size:15px;font-weight:700;color:var(--navy);margin:16px 0 8px;border-bottom:1px solid #eee;padding-bottom:4px}
.qt-h3{font-family:Poppins,sans-serif;font-size:13px;font-weight:600;color:#c2410c;margin:12px 0 6px}
.qt-p{font-size:12.5px;line-height:1.7;color:#333;margin-bottom:10px}
.qt-list{margin:8px 0 14px 20px;font-size:12.5px;line-height:1.6}
.qt-list li{margin-bottom:4px}
.qt-callout{background:#fdfcf9;border-left:3px solid var(--orange);padding:10px 16px;margin:12px 0;font-style:italic;color:#444}
.qt-status-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-left:8px}
.qt-status-issued{background:#fffaeb;color:#b54708;border:1px solid #fedf89}
.qt-status-accepted{background:#ecfdf3;color:#027a48;border:1px solid #a6f4c5}
.qt-status-revoked{background:#fef3f2;color:#b42318;border:1px solid #fecdca}
.sig-card{border:1px solid var(--line);border-radius:8px;padding:16px;background:#fcfcfd}
.sig-badge{display:inline-flex;align-items:center;gap:6px;background:#ecfdf3;color:#027a48;border:1px solid #a6f4c5;border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;letter-spacing:.5px;margin-bottom:8px}
.sig-badge i{width:6px;height:6px;border-radius:50%;background:#12b76a}
`;

export function editorContentOf(quotation) {
  if (quotation?.scopeJson) {
    try {
      return JSON.parse(quotation.scopeJson);
    } catch {
      /* fall back to text */
    }
  }
  return quotation?.scopeText || '';
}

export function buildQuotationHtml(quotation, signatures = {}, options = {}) {
  const q = quotation || {};
  const origin = options.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const autoPrint = Boolean(options.autoPrint);

  const controlNo = q.controlNumber || 'QT-DRAFT';
  const totals = calcQuotationTotals(q.items || [], q.discountPercent, q.taxPercent);

  // Status badge markup for title bar
  let statusBadge = '';
  if (q.status === 'accepted') statusBadge = '<span class="qt-status-tag qt-status-accepted">ACCEPTED & CONFORME</span>';
  else if (q.status === 'revoked') statusBadge = '<span class="qt-status-tag qt-status-revoked">REVOKED</span>';
  else if (q.status === 'issued') statusBadge = '<span class="qt-status-tag qt-status-issued">ISSUED</span>';

  // Items table rows
  const itemRows = (q.items && q.items.length)
    ? q.items.map((it, idx) => `
        <tr>
          <td class="ac">${idx + 1}</td>
          <td><b>${esc(it.description || 'Service / Product Item')}</b></td>
          <td class="ac">${esc(it.quantity || 1)}</td>
          <td class="ar">₱ ${money(it.unitPrice || 0)}</td>
          <td class="ar"><b>₱ ${money(it.amount || calcLineAmount(it.quantity, it.unitPrice))}</b></td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" class="ac muted">No line items specified.</td></tr>`;

  // Scope & Terms rendering
  const scopeContent = q.scopeText
    ? (q.scopeText.trim().startsWith('<') ? q.scopeText : renderMarkdownBody(q.scopeText))
    : '';

  // Signers Block
  const sigList = Object.entries(q.signers || emptyQuotationSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const signersMarkup = sigList.map(s => {
    const sig = signatures[s.id];
    const isSigned = Boolean(sig?.signedAt);
    return `
      <div class="sig-card">
        <div class="eyebrow">${esc(SIGNER_KINDS[s.kind] || 'Signatory')}</div>
        ${isSigned ? `<div class="sig-badge"><i></i> Digitally Verified & Signed</div>` : ''}
        <div class="sig-line"></div>
        <div class="sig-name">${esc(sig?.name || s.name || 'Authorized Signatory')}</div>
        <div class="sig-tag">${esc(s.title || (s.kind === 'accepted' ? 'Client Representative' : 'OdysseyPH Executive'))}</div>
        ${isSigned ? `<div class="sig-date">Signed on ${longDate(sig.signedAt?.split?.('T')?.[0] || sig.signedAt)}</div>` : ''}
      </div>
    `;
  }).join('');

  const body = `
    <div class="qt-meta-grid">
      <div class="qt-meta-col">
        <h3>QUOTED TO:</h3>
        <div class="qt-lead">${esc(q.clientBusiness || 'Prospective Client')}</div>
        <div class="qt-sub">
          ${q.clientName ? `<b>Attn:</b> ${esc(q.clientName)}<br>` : ''}
          ${q.clientAddress ? `${esc(q.clientAddress)}<br>` : ''}
          ${q.clientEmail ? `${esc(q.clientEmail)} · ` : ''}${q.clientPhone ? esc(q.clientPhone) : ''}
        </div>
      </div>
      <div class="qt-meta-col">
        <h3>QUOTATION DETAILS:</h3>
        <div class="qt-lead">${esc(q.projectName || 'Project Solution')}</div>
        <div class="qt-sub">
          <b>Date:</b> ${longDate(q.date) || '—'}<br>
          <b>Valid Until:</b> ${longDate(q.validUntil) || '30 Days from issuance'}<br>
          <b>Payment Terms:</b> ${esc(q.paymentTerms || 'As agreed')}
        </div>
      </div>
    </div>

    <div class="qt-table-wrap">
      <table class="qt-table">
        <thead>
          <tr>
            <th style="width:36px" class="ac">#</th>
            <th>Item & Specification</th>
            <th style="width:60px" class="ac">Qty</th>
            <th style="width:140px" class="ar">Unit Price (PHP)</th>
            <th style="width:140px" class="ar">Total (PHP)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <div class="qt-summary-box">
      <div>
        <table class="qt-summary-table">
          <tr>
            <td>Subtotal:</td>
            <td class="ar">₱ ${money(totals.subtotal)}</td>
          </tr>
          ${totals.discountAmount > 0 ? `
            <tr>
              <td>Discount (${totals.discountPercent}%):</td>
              <td class="ar" style="color:#b42318">- ₱ ${money(totals.discountAmount)}</td>
            </tr>
          ` : ''}
          ${totals.taxAmount > 0 ? `
            <tr>
              <td>VAT / Tax (${totals.taxPercent}%):</td>
              <td class="ar">₱ ${money(totals.taxAmount)}</td>
            </tr>
          ` : ''}
          <tr class="qt-total-row">
            <td><b>TOTAL AMOUNT:</b></td>
            <td class="ar">₱ ${money(totals.total)}</td>
          </tr>
        </table>
        <div class="qt-words">${esc(totals.totalWords)}</div>
      </div>
    </div>

    ${scopeContent ? `<div class="qt-scope-section">${scopeContent}</div>` : ''}

    <div class="sigs" style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:48px 0 24px">
      ${signersMarkup}
    </div>
  `;

  return brandPage({
    title: `PRICE QUOTATION ${statusBadge}`,
    numberLabel: 'QUOTATION NO.',
    number: controlNo,
    body,
    footLeft: `${esc(BRAND_CO.name)} · Valid Until ${longDate(q.validUntil)}`,
    footRight: 'Official Quotation Document',
    extraCss: EXTRA_QT_CSS,
    origin,
    autoPrint,
  });
}

