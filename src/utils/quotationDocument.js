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

/** Light markdown (AI paste, scope text) -> HTML for editor import */
export function markdownToHtml(text) {
  const out = [];
  const lines = String(text || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i += 1; continue; }

    const h = t.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
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
        out.push(`<table><tr>${cells(head).map(c => `<th><p>${inline(c)}</p></th>`).join('')}</tr>${rest.map(r => `<tr>${cells(r).map(c => `<td><p>${inline(c)}</p></td>`).join('')}</tr>`).join('')}</table>`);
      }
      continue;
    }

    if (/^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const marker = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      const items = [];
      while (i < lines.length && marker.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(marker, ''));
        i += 1;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li><p>${inline(x)}</p></li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\||[-*]\s|\d+[.)]\s|>)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('');
}

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
.pg{position:relative}
.band .bar{gap:24px}
.band h1{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.docno{flex-shrink:0;white-space:nowrap}
.stamp{position:absolute;top:340px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap;z-index:2}
.stamp.revoked{color:rgba(220,38,38,.13)}
.revoked-note{margin:0 0 18px;padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:12px}
.qt-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;background:#f8f9fa;border:1px solid var(--line);border-radius:8px;padding:16px 20px;break-inside:avoid}
.qt-meta-col{min-width:0}
.qt-meta-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.qt-meta-col h3{font-size:10px;font-weight:700;letter-spacing:1.5px;color:#c2410c;text-transform:uppercase;margin:0 0 8px}
.qt-meta-head h3{margin-bottom:0}
.qt-meta-col .qt-lead{font-family:Poppins,sans-serif;font-size:15.5px;font-weight:700;color:var(--navy);margin-bottom:4px;overflow-wrap:break-word}
.qt-meta-col .qt-sub{font-size:12px;color:var(--muted);line-height:1.6;overflow-wrap:break-word}
.qt-table-wrap{border:1px solid #3a4a5c;border-radius:8px;overflow:hidden;margin-bottom:20px}
.qt-table{width:100%;border-collapse:collapse}
.qt-table thead{display:table-header-group}
.qt-table th{background:#ebe5dc;font-size:10px;letter-spacing:1.2px;text-align:left;padding:10px 14px;border-bottom:1px solid #3a4a5c;color:var(--navy);text-transform:uppercase}
.qt-table td{padding:10px 14px;border-top:1px solid var(--line);font-size:12.5px;vertical-align:top}
.qt-table tbody tr:first-child td{border-top:none}
.qt-table tr{break-inside:avoid;page-break-inside:avoid}
.qt-table .ar{text-align:right;white-space:nowrap}
.qt-table .ac{text-align:center}
.qt-summary-box{display:flex;justify-content:flex-end;margin-bottom:24px;break-inside:avoid;page-break-inside:avoid}
.qt-summary-table{min-width:320px;border-collapse:collapse}
.qt-summary-table td{padding:6px 12px;font-size:12.5px}
.qt-summary-table td.ar{text-align:right;font-weight:600;white-space:nowrap}
.qt-summary-table tr.qt-total-row{background:var(--navy);color:#fff}
.qt-summary-table tr.qt-total-row td{padding:10px 14px}
.qt-summary-table tr.qt-total-row td.ar{color:var(--orange);font-family:Poppins,sans-serif;font-size:18px;font-weight:800}
.qt-words{font-size:11px;font-style:italic;color:var(--muted);text-align:right;margin-top:6px}
.qt-scope-section{margin-top:22px;border-top:1px solid var(--line);padding-top:18px}
.qt-scope-section h1,.qt-h1{font-family:Poppins,sans-serif;font-size:16px;font-weight:700;color:var(--navy);margin:18px 0 8px;break-after:avoid;page-break-after:avoid}
.qt-scope-section h2,.qt-h2{display:flex;align-items:center;gap:10px;font-family:Poppins,sans-serif;font-size:13.5px;font-weight:700;color:var(--navy);margin:20px 0 8px;border-bottom:none;padding-bottom:0;break-after:avoid;page-break-after:avoid}
.qt-scope-section h2::before,.qt-h2::before{content:'';width:8px;height:20px;border-radius:4px;background:var(--orange);flex-shrink:0}
.qt-scope-section h2:first-child{margin-top:4px}
.qt-scope-section h3,.qt-h3{font-family:Poppins,sans-serif;font-size:12.5px;font-weight:600;color:#c2410c;margin:14px 0 6px;break-after:avoid;page-break-after:avoid}
.qt-scope-section p,.qt-p{font-size:12.3px;line-height:1.65;color:var(--ink);margin:0 0 8px}
.qt-scope-section p:empty,.qt-scope-section p.gap{height:8px;margin:0}
.qt-scope-section ul,.qt-scope-section ol,.qt-list{padding-left:22px;margin:6px 0 12px;font-size:12.3px;line-height:1.65;color:var(--ink)}
.qt-scope-section li,.qt-list li{margin-bottom:4px}
.qt-scope-section li p{margin:0}
.qt-scope-section blockquote,.qt-callout{margin:10px 0 12px;border-left:3px solid var(--orange);background:#f8f6f2;padding:9px 14px;border-radius:0 8px 8px 0;font-size:12px;line-height:1.6;color:#3d4756;font-style:normal}
.qt-scope-section blockquote p,.qt-callout p{margin:0}
.qt-scope-section hr{border:0;border-top:1px solid var(--line);margin:14px 0}
.qt-scope-section a{color:#c2410c}
.qt-scope-section table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #3a4a5c;border-radius:8px;overflow:hidden;margin:12px 0 16px}
.qt-scope-section .tbl{border:1px solid #3a4a5c;border-radius:8px;overflow:hidden;margin:12px 0 16px}
.qt-scope-section .tbl table{border:none;border-radius:0;margin:0;border-collapse:collapse}
.qt-scope-section thead{display:table-header-group}
.qt-scope-section th{background:#ebe5dc;font-size:10px;letter-spacing:1.1px;text-align:left;text-transform:uppercase;padding:9px 14px;border-bottom:1px solid #3a4a5c;color:var(--navy);font-weight:700}
.qt-scope-section td{padding:9px 14px;border-top:1px solid var(--line);font-size:12px;line-height:1.55;vertical-align:top}
.qt-scope-section tbody tr:first-child td,.qt-scope-section table>tr:first-child td{border-top:none}
.qt-scope-section tr{break-inside:avoid;page-break-inside:avoid}
.qt-scope-section th p,.qt-scope-section td p{margin:0}
.qt-status-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
.qt-status-draft{background:#f1f5f9;color:#475569;border:1px solid #cbd5e1}
.qt-status-issued{background:#fffaeb;color:#b54708;border:1px solid #fedf89}
.qt-status-accepted{background:#ecfdf3;color:#027a48;border:1px solid #a6f4c5}
.qt-status-revoked{background:#fef3f2;color:#b42318;border:1px solid #fecdca}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:40px 0 24px;break-inside:avoid;page-break-inside:avoid}
.sig-card{border:1px solid var(--line);border-radius:8px;padding:16px 18px;background:#fcfcfd}
.sig-card .eyebrow{color:var(--navy)}
.sig-badge{display:inline-flex;align-items:center;gap:6px;background:#ecfdf3;color:#027a48;border:1px solid #a6f4c5;border-radius:999px;padding:3px 10px;font-size:10px;font-weight:700;letter-spacing:.5px;margin-top:6px}
.sig-badge i{width:6px;height:6px;border-radius:50%;background:#12b76a}
.sig-mark{font-family:'Great Vibes',cursive;font-size:32px;line-height:1;color:#111;height:44px;display:flex;align-items:flex-end;padding-bottom:2px;margin:6px 0 -4px;white-space:nowrap;overflow:visible}
.sig-mark.empty{height:44px}
.sig-card .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
@page{size:letter;margin:12mm 0}
@page :first{margin-top:0;margin-bottom:12mm}
@media print{.pg{min-height:995px}.qt-table-wrap,.qt-scope-section .tbl,.qt-scope-section table{overflow:visible}}
/* The page is always rendered at letter width and scaled by the viewer, so keep the print layout on screen. */
@media screen and (max-width:840px){.pg{width:816px;min-height:1056px}.hd,.body,.ft{padding-left:64px;padding-right:64px}.band .bar{padding:0 64px 0 28px}.band .tab{width:64px}.band h1{font-size:24px}.sigs{grid-template-columns:1fr 1fr;gap:32px;margin:40px 0 24px}}
`;

/** Promote leading <th>-only row inside TipTap <table><tbody> into <thead> so multi-page prints repeat table headers. */
export function normalizeScopeHtml(html) {
  return String(html || '').replace(
    /(<table\b[^>]*>(?:\s*<colgroup>[\s\S]*?<\/colgroup>)?)\s*<tbody>\s*(<tr>(?:(?!<\/tr>)(?!<td\b)[\s\S])*?<th\b[\s\S]*?<\/tr>)\s*/gi,
    '$1<thead>$2</thead><tbody>',
  );
}

export function editorContentOf(quotation) {
  if (quotation?.scopeJson) {
    try {
      return JSON.parse(quotation.scopeJson);
    } catch {
      /* fall back to text */
    }
  }
  const text = quotation?.scopeText || '';
  if (!text) return '';
  return text.trim().startsWith('<') ? text : markdownToHtml(text);
}

export function buildQuotationHtml(quotation, signatures = {}, options = {}) {
  const q = quotation || {};
  const origin = options.origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const timeZone = options.timeZone || 'Asia/Manila';
  const autoPrint = Boolean(options.autoPrint);

  const controlNo = q.controlNumber || 'QT-DRAFT';
  const totals = calcQuotationTotals(q.items || [], q.discountPercent, q.taxPercent);

  let statusBadge = '';
  if (q.status === 'accepted') statusBadge = '<span class="qt-status-tag qt-status-accepted">ACCEPTED &amp; CONFORME</span>';
  else if (q.status === 'revoked') statusBadge = '<span class="qt-status-tag qt-status-revoked">REVOKED</span>';
  else if (q.status === 'issued') statusBadge = '<span class="qt-status-tag qt-status-issued">ISSUED</span>';
  else if (q.status === 'draft') statusBadge = '<span class="qt-status-tag qt-status-draft">DRAFT</span>';

  const stamp = q.status === 'revoked'
    ? '<div class="stamp revoked">REVOKED</div>'
    : q.status === 'draft'
      ? '<div class="stamp">DRAFT</div>'
      : '';

  // Items table rows
  const itemRows = (q.items && q.items.length)
    ? q.items.map((it, idx) => {
        const qty = it.quantity ?? 1;
        const unitPrice = it.unitPrice ?? 0;
        const amount = typeof it.amount === 'number' && !Number.isNaN(it.amount)
          ? it.amount
          : calcLineAmount(qty, unitPrice);
        return `
        <tr>
          <td class="ac">${idx + 1}</td>
          <td><b>${esc(it.description || 'Service / Product Item')}</b></td>
          <td class="ac">${esc(qty)}</td>
          <td class="ar">₱ ${money(unitPrice)}</td>
          <td class="ar"><b>₱ ${money(amount)}</b></td>
        </tr>
      `;
      }).join('')
    : `<tr><td colspan="5" class="ac muted">No line items specified.</td></tr>`;

  // Scope & Terms rendering
  const rawScope = q.scopeText
    ? (q.scopeText.trim().startsWith('<') ? q.scopeText : renderMarkdownBody(q.scopeText))
    : '';
  const scopeContent = rawScope ? normalizeScopeHtml(rawScope) : '';

  // Signers Block
  const sigList = Object.entries(q.signers || emptyQuotationSigners())
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const signersMarkup = sigList.map(s => {
    const sig = signatures[s.id];
    const isSigned = Boolean(sig?.signedAt);
    let signedDisplay = '';
    if (isSigned) {
      const parsedDate = new Date(sig.signedAt);
      signedDisplay = !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toLocaleString('en-PH', { timeZone, dateStyle: 'medium', timeStyle: 'short' })
        : longDate(sig.signedAt?.split?.('T')?.[0] || sig.signedAt);
    }
    return `
      <div class="sig-card">
        <div class="eyebrow">${esc(SIGNER_KINDS[s.kind] || 'Signatory')}</div>
        ${isSigned ? '<div class="sig-badge"><i></i> Digitally Verified &amp; Signed</div>' : ''}
        ${isSigned ? `<div class="sig-mark">${esc(sig.name)}</div>` : '<div class="sig-mark empty"></div>'}
        <div class="sig-line"></div>
        <div class="sig-name">${esc(sig?.name || s.name || 'Authorized Signatory')}</div>
        <div class="sig-tag">${esc(s.title || (s.kind === 'accepted' ? 'Client Representative' : 'OdysseyPH Executive'))}</div>
        ${isSigned ? `<div class="sig-date">Signed electronically ${esc(signedDisplay)}</div>` : ''}
      </div>
    `;
  }).join('');

  const contactLine = [q.clientEmail, q.clientPhone].filter(Boolean).map(esc).join(' · ');

  const body = `${stamp}
    ${q.status === 'revoked' ? `<div class="revoked-note"><b>This Price Quotation has been revoked</b>${q.revokedReason ? ` — ${esc(q.revokedReason)}` : ''}. It is kept for record purposes only.</div>` : ''}
    <div class="qt-meta-grid">
      <div class="qt-meta-col">
        <h3>QUOTED TO:</h3>
        <div class="qt-lead">${esc(q.clientBusiness || 'Prospective Client')}</div>
        <div class="qt-sub">
          ${q.clientName ? `<b>Attn:</b> ${esc(q.clientName)}<br>` : ''}
          ${q.clientAddress ? `${esc(q.clientAddress)}<br>` : ''}
          ${contactLine}
        </div>
      </div>
      <div class="qt-meta-col">
        <div class="qt-meta-head">
          <h3>QUOTATION DETAILS:</h3>
          ${statusBadge}
        </div>
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

    <div class="sigs">
      ${signersMarkup}
    </div>
  `;

  const footLeft = q.validUntil
    ? `${BRAND_CO.name} · Valid Until ${longDate(q.validUntil)}`
    : BRAND_CO.name;

  return brandPage({
    title: 'PRICE QUOTATION',
    numberLabel: 'QUOTATION NO.',
    number: controlNo,
    body,
    footLeft,
    footRight: 'Official Quotation Document',
    extraCss: EXTRA_QT_CSS,
    origin,
    autoPrint,
  })
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(controlNo)} — ${esc(q.projectName || 'Price Quotation')}</title>`);
}

