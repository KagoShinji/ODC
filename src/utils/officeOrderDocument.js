// Office Order: an internal directive issued by management.
// The control number is the tracking number: OO-<year>-<month>-<sequence>, e.g. OO-2026-11-001,
// following the MOA / COA / SOA / PS numbering used by other documents.
import { BRAND_CO, esc, longDate, brandPage } from './brandDocument';

export const OFFICE_ORDER_PREFIX = 'OO';
const pad = (n, size = 2) => String(n).padStart(size, '0');
export const controlMonthOf = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const formatControlNumber = (month, seq) => `${OFFICE_ORDER_PREFIX}-${month}-${pad(seq, 3)}`;
export const officeOrderLink = (id, origin = window.location.origin) => `${origin}/office-order/${id}`;

export const SIGNER_KINDS = {
  issuer: 'Approved by',
  cosigner: 'Co-signed by',
  acknowledger: 'Acknowledged by',
};

export const emptySigners = () => ({
  s1: { kind: 'issuer', name: BRAND_CO.approvedBy, title: 'Founder', order: 1 },
});

/* ─── AI prompt & paste parsing ─── */

export const AI_PROMPT = `Write an Office Order for OdysseyPH IT Solutions about the topic below. Use exactly this plain-text format, no extra commentary:

TO: (recipients)
CC: (optional)
FROM: (name, position)
DATE: (Month Day, Year)
SUBJECT: (one line)
EFFECTIVITY: (Month Day, Year)

## 1. Purpose
(paragraphs)

## 2. Coverage
(paragraphs)

## 3. (next section title)
(paragraphs, "- " bullet lists, "1. " numbered lists, or markdown tables like | Column | Column |)

(continue numbering sections; end with an Effectivity section)

Approved by:
(Full name)
(Position)

Acknowledged by:
(Full name or role) — (Position)

If a step-by-step guide or attachment is needed, start it with a line "# Annex A — (Title)" after the signatures.

Topic:
`;

const FIELD_PATTERNS = [
  ['to', /^(?:to|for)\s*[:\-–]\s*(.+)$/i],
  ['cc', /^(?:cc|copy furnished|copy to)\s*[:\-–]\s*(.+)$/i],
  ['from', /^from\s*[:\-–]\s*(.+)$/i],
  ['date', /^date\s*[:\-–]\s*(.+)$/i],
  ['subject', /^(?:subject|re|regarding|title)\s*[:\-–]\s*(.+)$/i],
  ['effectivity', /^(?:effectivity|effective(?: date)?|effective on)\s*[:\-–]\s*(.+)$/i],
];
const NOISE = /^(?:\*\*)?(?:office order(?:\s*(?:no\.?|number|#).*)?|series of \d{4}|memorandum|[-=_*]{3,})(?:\*\*)?$/i;
const SIGN_START = /^(?:approved|signed|issued)\s*by\s*:?\s*$/i;
const ACK_START = /^(?:acknowledged|received|conforme|noted)\s*(?:by)?\s*:?\s*$/i;

const clean = s => s.replace(/^[#>*\s]+|\*\*|__/g, '').replace(/\s+$/, '').trim();
// Job titles / roles, so "Sales Associate" on its own line is a signer line rather than someone's position.
const ROLE = /\b(associate|manager|officer|staff|director|head|lead|supervisor|founder|co-?founder|ceo|coo|cto|cfo|president|secretary|treasurer|assistant|coordinator|specialist|developer|owner|employee|team)\b/i;
/** True for a role or job title such as "Operations Manager", as opposed to a person's name. */
export const isRoleLine = text => ROLE.test(String(text || ''));

/** "November 9, 2026" | "2026-11-09" | "Nov 9 2026" → "2026-11-09"; '' when unreadable. */
export function toIsoDate(text) {
  const value = clean(String(text || '')).replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*/i, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function splitPerson(text) {
  const [name, ...rest] = clean(text).split(/\s*(?:,|—|–| - |\|)\s*/);
  return { name: name || '', title: rest.join(', ') };
}

/**
 * Turns pasted text (AI output, Word, email) into office order fields.
 * Header lines (TO/CC/FROM/DATE/SUBJECT/EFFECTIVITY) become fields, signature blocks become
 * signers, and the rest is kept as the body, normalised to the light markdown the renderer reads.
 */
export function parseOfficeOrderText(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const fields = {};
  const body = [];
  const issuers = [];
  const acknowledgers = [];
  let mode = 'body';
  let pending = null;
  let headerDone = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const text = clean(line);
    // "# Annex A — Guide", "ANNEX A — Guide", or "Annex A …" once the signature blocks have started.
    const annexLine = text.length < 90 && (/^#{1,3}\s*annex\b/i.test(line.trim()) || /^ANNEX\s+[A-Z0-9]+\b/.test(text) || (mode !== 'body' && /^annex\s+[a-z0-9]+\b/i.test(text)));
    if (annexLine) {
      mode = 'body'; pending = null; headerDone = true;
      body.push(`# ${text}`);
      continue;
    }
    if (mode === 'body' && !headerDone) {
      const field = FIELD_PATTERNS.find(([, re]) => re.test(text));
      if (field) { fields[field[0]] = clean(text.match(field[1])[1]); continue; }
      if (!text || NOISE.test(text)) continue;
      headerDone = true;
    }
    if (SIGN_START.test(text)) { mode = 'issuer'; pending = null; continue; }
    if (ACK_START.test(text)) { mode = 'ack'; pending = null; continue; }
    if (mode !== 'body') {
      if (!text || /^_{3,}$/.test(text) || /^(?:signature|date)\s*:?.*$/i.test(text)) continue;
      const target = mode === 'issuer' ? issuers : acknowledgers;
      if (/[,—–|]| - /.test(text)) { target.push(splitPerson(text)); pending = null; continue; }
      // A position line follows a person's name; consecutive role lines are separate signer lines.
      if (pending && !pending.title && !ROLE.test(pending.name) && ROLE.test(text)) { pending.title = text; pending = null; continue; }
      pending = { name: text, title: '' };
      target.push(pending);
      continue;
    }
    body.push(line);
  }

  const from = fields.from ? splitPerson(fields.from) : null;
  return {
    subject: fields.subject || '',
    to: fields.to || '',
    cc: fields.cc || '',
    fromName: from?.name || '',
    fromTitle: from?.title || '',
    date: toIsoDate(fields.date),
    effectivity: toIsoDate(fields.effectivity),
    body: normalizeBody(body.join('\n')),
    issuers,
    acknowledgers,
  };
}

/** True when pasted plain text looks like a drafted order (AI/markdown/memo style) rather than a snippet. */
export function looksLikeDraftedOrder(text) {
  const t = String(text || '');
  if (t.trim().length < 40) return false;
  const lines = t.split(/\r?\n/).map(l => l.trim());
  const fields = lines.filter(l => FIELD_PATTERNS.some(([, re]) => re.test(clean(l)))).length;
  const markdown = lines.filter(l => /^#{1,3}\s|^\|.*\|$|^\*\*.+\*\*:?$/.test(l)).length;
  return fields >= 2 || markdown >= 2 || lines.some(l => SIGN_START.test(clean(l)));
}

/** Normalises headings and bullets from common AI/Word styles into the renderer's markdown. */
export function normalizeBody(text) {
  let lastSection = 0;
  return String(text || '').split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (/^#\s*annex\b/i.test(t)) { lastSection = 0; return t; }
    // "SECTION 1. PURPOSE", "1. PURPOSE", "I. Purpose", "**1. Purpose**", "### 1 - Purpose"
    const heading = t.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.+)\*\*:?$/, '$1').match(/^(?:section\s+)?(\d{1,2}|[IVX]{1,5})[.):\-–]?\s+([^.]{2,80}?)[:.]?$/i);
    const isHeadingStyle = /^#{1,6}\s/.test(t) || /^\*\*.+\*\*:?$/.test(t) || (heading && heading[2] === heading[2].toUpperCase() && /[A-Z]/.test(heading[2]));
    // A short "4. Weekly schedule" that continues the section numbering is a heading, not a list item.
    const continuesSections = heading && /^\d+$/.test(heading[1]) && Number(heading[1]) === lastSection + 1 && lastSection > 0
      && !/[.!?]$/.test(t) && heading[2].split(/\s+/).length <= 7;
    if (heading && (isHeadingStyle || continuesSections)) {
      if (/^\d+$/.test(heading[1])) lastSection = Number(heading[1]);
      return `## ${heading[1]}. ${titleCase(heading[2])}`;
    }
    if (/^#{1,6}\s/.test(t)) return `## ${t.replace(/^#{1,6}\s*/, '')}`;
    if (/^[•●▪◦‣–]\s+/.test(t)) return `- ${t.replace(/^[•●▪◦‣–]\s+/, '')}`;
    if (/^\(?[a-z]\)\s+/i.test(t)) return `- ${t.replace(/^\(?[a-z]\)\s+/i, '')}`;
    return line.replace(/\s+$/, '');
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
const titleCase = s => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\b(And|Of|The|For|To|In|On|With|A|An|Or)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase()) : s);

/* ─── Rendering ─── */

const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>')
  .replace(/__(.+?)__/g, '<b>$1</b>');

/** Renders the body markdown subset to HTML. Input is escaped first, so pasted HTML stays inert. */
export function renderBody(text) {
  const out = [];
  const lines = String(text || '').split('\n');
  let i = 0;
  let section = null;
  const close = () => { if (section) { out.push('</section>'); section = null; } };
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i += 1; continue; }
    const h = t.match(/^##\s+(?:(\d{1,2}|[IVX]{1,5})[.)]?\s+)?(.+)$/);
    if (h) {
      close();
      section = true;
      out.push(`<section class="sec"><h2>${h[1] ? `<span>${esc(h[1])}</span>` : '<span class="dot"></span>'}${inline(h[2])}</h2>`);
      i += 1; continue;
    }
    if (/^\|.*\|$/.test(t)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(lines[i].trim()); i += 1; }
      const cells = r => r.slice(1, -1).split('|').map(c => c.trim());
      const body = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
      const [head, ...rest] = body;
      out.push(`<div class="tbl"><table><thead><tr>${cells(head).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/).test(lines[i].trim())) {
        items.push(lines[i].trim().replace(ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/, ''));
        i += 1;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { quote.push(lines[i].trim().replace(/^>\s?/, '')); i += 1; }
      out.push(`<div class="callout">${inline(quote.join(' '))}</div>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(##\s|\||[-*]\s|\d+[.)]\s|>)/.test(lines[i].trim())) { para.push(lines[i].trim()); i += 1; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  close();
  return out.join('\n');
}

/** Light markdown (AI paste, legacy orders) → semantic HTML the on-page editor imports. */
export function markdownToHtml(text) {
  const out = [];
  const lines = String(text || '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i += 1; continue; }
    const h = t.match(/^(#{1,3})\s+(.+)$/);
    if (h) { const level = h[1].length; out.push(`<h${level}>${inline(h[2])}</h${level}>`); i += 1; continue; }
    if (/^\|.*\|$/.test(t)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(lines[i].trim()); i += 1; }
      const cells = r => r.slice(1, -1).split('|').map(c => c.trim());
      const [head, ...rest] = rows.filter(r => !/^\|[\s:|-]+\|$/.test(r));
      out.push(`<table><tr>${cells(head).map(c => `<th><p>${inline(c)}</p></th>`).join('')}</tr>${rest.map(r => `<tr>${cells(r).map(c => `<td><p>${inline(c)}</p></td>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    if (/^[-*]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const marker = ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/;
      const items = [];
      while (i < lines.length && marker.test(lines[i].trim())) { items.push(lines[i].trim().replace(marker, '')); i += 1; }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li><p>${inline(x)}</p></li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(t)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { quote.push(lines[i].trim().replace(/^>\s?/, '')); i += 1; }
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\||[-*]\s|\d+[.)]\s|>)/.test(lines[i].trim())) { para.push(lines[i].trim()); i += 1; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('');
}

const SAFE_HREF = /^(https?:|mailto:|tel:)/i;
const ALIGN = new Set(['left', 'center', 'right', 'justify']);
const textOf = node => (node.text || '') + (node.content || []).map(textOf).join('');
function marksHtml(node) {
  let html = esc(node.text || '');
  for (const mark of node.marks || []) {
    if (mark.type === 'bold') html = `<b>${html}</b>`;
    else if (mark.type === 'italic') html = `<i>${html}</i>`;
    else if (mark.type === 'underline') html = `<u>${html}</u>`;
    else if (mark.type === 'strike') html = `<s>${html}</s>`;
    else if (mark.type === 'code') html = `<code>${html}</code>`;
    else if (mark.type === 'link' && SAFE_HREF.test(mark.attrs?.href || '')) html = `<a href="${esc(mark.attrs.href)}">${html}</a>`;
  }
  return html;
}
const alignAttr = node => (ALIGN.has(node.attrs?.textAlign) && node.attrs.textAlign !== 'left' ? ` style="text-align:${node.attrs.textAlign}"` : '');
const span = n => { const v = Number(n); return Number.isInteger(v) && v > 1 && v < 50 ? v : 0; };

/** One editor block node → document HTML. Unknown node types are dropped, and all text is escaped. */
function blockHtml(node) {
  const kids = (node.content || []).map(child => (child.type === 'text' ? marksHtml(child) : child.type === 'hardBreak' ? '<br>' : blockHtml(child))).join('');
  switch (node.type) {
    case 'paragraph': return kids ? `<p${alignAttr(node)}>${kids}</p>` : '<p class="gap"></p>';
    case 'heading': return `<h3 class="sub"${alignAttr(node)}>${kids}</h3>`;
    case 'bulletList': return `<ul>${kids}</ul>`;
    case 'orderedList': return `<ol${span(node.attrs?.start) ? ` start="${span(node.attrs.start)}"` : ''}>${kids}</ol>`;
    case 'listItem': return `<li>${kids.replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`;
    case 'blockquote': return `<div class="callout">${kids}</div>`;
    case 'horizontalRule': return '<hr>';
    case 'table': return `<div class="tbl"><table>${kids}</table></div>`;
    case 'tableRow': return `<tr>${kids}</tr>`;
    case 'tableHeader':
    case 'tableCell': {
      const tag = node.type === 'tableHeader' ? 'th' : 'td';
      const attrs = `${span(node.attrs?.colspan) ? ` colspan="${span(node.attrs.colspan)}"` : ''}${span(node.attrs?.rowspan) ? ` rowspan="${span(node.attrs.rowspan)}"` : ''}`;
      return `<${tag}${attrs}>${kids.replace(/<p class="gap"><\/p>/g, '')}</${tag}>`;
    }
    default: return '';
  }
}

/**
 * Editor JSON → { main, annexes } HTML. Section headings (H2) get the numbered orange badge when they
 * start with "1." / "IV." etc.; each H1 starts an annex page titled with its text.
 */
export function renderDocJson(doc) {
  const parts = [{ title: '', html: [] }];
  let open = false;
  const closeSection = () => { if (open) { parts[parts.length - 1].html.push('</section>'); open = false; } };
  for (const node of doc?.content || []) {
    if (node.type === 'heading' && node.attrs?.level === 1) {
      closeSection();
      parts.push({ title: textOf(node).trim() || 'Annex', html: [] });
      continue;
    }
    if (node.type === 'heading' && node.attrs?.level === 2) {
      closeSection();
      const title = textOf(node).trim();
      const num = title.match(/^(\d{1,2}|[IVX]{1,5})[.)]\s+(.+)$/);
      const heading = num ? { badge: `<span>${esc(num[1])}</span>`, text: esc(num[2]) } : { badge: '<span class="dot"></span>', text: (node.content || []).map(marksHtml).join('') };
      parts[parts.length - 1].html.push(`<section class="sec"><h2>${heading.badge}${heading.text}</h2>`);
      open = true;
      continue;
    }
    parts[parts.length - 1].html.push(blockHtml(node));
  }
  closeSection();
  const [main, ...annexes] = parts;
  return { main: main.html.join('\n'), annexes: annexes.map(a => ({ title: a.title, html: a.html.join('\n') })) };
}

/** Editor JSON → plain text (search, empty checks). */
export const docPlainText = doc => (doc?.content || []).map(textOf).join('\n').trim();

/** Starting content for the editor: stored JSON, or legacy markdown converted to HTML. */
export function editorContentOf(order) {
  if (order?.bodyJson) { try { return JSON.parse(order.bodyJson); } catch { /* fall back to markdown */ } }
  return markdownToHtml(order?.body || '');
}

/** Splits the body into the order itself and its annexes (each "# Annex …" line starts one). */
export function splitAnnexes(text) {
  const parts = String(text || '').split(/^#\s+(?=annex\b)/im);
  const [main, ...annexes] = parts;
  return {
    main,
    annexes: annexes.map(part => {
      const [title, ...rest] = part.split('\n');
      return { title: title.trim(), body: rest.join('\n') };
    }),
  };
}

const ORDER_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.memo{display:grid;grid-template-columns:110px 1fr;row-gap:9px;font-size:12.5px;padding-bottom:20px;margin-bottom:22px;border-bottom:2px solid var(--navy)}
.memo dt{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding-top:2px}
.memo dd{font-weight:600}
.memo dd.subject{font-family:Poppins,sans-serif;font-size:14px;color:var(--navy)}
.sec{margin-bottom:18px}
.sec h2{font-family:Poppins,sans-serif;font-size:13.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:10px;margin-bottom:8px;break-after:avoid}
.sec h2 span{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:6px;background:var(--orange);color:#fff;font-size:11px}
.sec h2 span.dot{min-width:8px;width:8px;height:8px;padding:0;border-radius:50%}
.body p,.body li{line-height:1.65;font-size:12.3px}
.body p{margin:0 0 7px}
.body ol,.body ul{padding-left:20px;margin:4px 0 8px}
.body li{margin-bottom:3px}
.body .tbl{margin:8px 0 10px;break-inside:avoid}
.body td{padding:9px 16px;font-size:12px;vertical-align:top}
.body th{padding:9px 16px}
.callout{margin:8px 0;border-left:3px solid var(--orange);background:#f8f6f2;padding:9px 14px;font-size:12px;line-height:1.6;border-radius:0 8px 8px 0}
.signers{display:grid;grid-template-columns:1fr 1fr;gap:28px 56px;margin:34px 0 18px;break-inside:avoid}
.signers.ack{grid-template-columns:repeat(3,1fr);gap:24px;margin-top:10px}
.signer .eyebrow{color:var(--navy)}
.sig-mark{font-family:'Great Vibes',cursive;font-size:30px;line-height:1;color:#111;height:40px;margin-top:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sig-mark.empty{height:40px}
.signer .sig-line{margin:0 0 8px}
.signers.ack .sig-name{font-size:12.5px}
.sig-meta{font-size:9.5px;color:var(--muted);margin-top:3px;line-height:1.4}
.ack-block{break-inside:avoid;margin-top:8px}
.ack-block p{font-size:12px;line-height:1.6;margin-bottom:4px}
.stamp{position:absolute;top:340px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap}
.stamp.revoked{color:rgba(220,38,38,.13)}
.revoked-note{margin:0 0 18px;padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:12px}
.annex-intro{font-size:12.3px;color:var(--muted);margin-bottom:14px}
.sig-name.blank{color:var(--muted);font-weight:500}
.body h3.sub{font-family:Poppins,sans-serif;font-size:12.5px;font-weight:600;color:var(--navy);margin:12px 0 6px}
.body p.gap{height:8px;margin:0}
.body hr{border:0;border-top:1px solid var(--line);margin:14px 0}
.body a{color:#c2410c}
.body td p,.body th p{margin:0}
.band .bar{gap:24px}
.band h1{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.band h1.long{font-size:19px}
/* The page is always rendered at letter width and scaled by the viewer, so keep the print layout on screen. */
@media screen and (max-width:840px){.pg{width:816px;min-height:1056px}.hd,.body,.ft{padding-left:64px;padding-right:64px}.band .bar{padding:0 64px 0 28px}.band .tab{width:64px}.band h1{font-size:24px}}
`;

function signerBlock(signer, signature, timeZone) {
  const signed = signature
    ? `<div class="sig-mark">${esc(signature.name)}</div>`
    : '<div class="sig-mark empty"></div>';
  const meta = signature
    ? `<div class="sig-meta">Signed electronically ${esc(new Date(signature.signedAt).toLocaleString('en-PH', { timeZone, dateStyle: 'medium', timeStyle: 'short' }))}</div>`
    : '<div class="sig-meta">Date: ____________</div>';
  return `<div class="signer">
    ${signer.kind === 'acknowledger' ? '' : `<div class="eyebrow">${esc(SIGNER_KINDS[signer.kind])}</div>`}
    ${signed}
    <div class="sig-line"></div>
    ${signer.name || signature ? `<div class="sig-name">${esc(signature?.name || signer.name)}</div>` : '<div class="sig-name blank">Name &amp; signature</div>'}
    <div class="sig-tag">${esc((signer.title || '').toUpperCase())}</div>
    ${meta}
  </div>`;
}

/**
 * Full branded HTML for an office order (order page plus annex pages).
 * `signatures` maps signer slot id → { name, signedAt (ISO) }.
 */
export function buildOfficeOrderHtml(order, signatures = {}, { origin = window.location.origin, timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = order.controlNumber || 'DRAFT';
  let parsed = null;
  if (order.bodyJson) { try { parsed = renderDocJson(JSON.parse(order.bodyJson)); } catch { parsed = null; } }
  const legacy = splitAnnexes(order.body);
  const main = parsed ? parsed.main : renderBody(legacy.main);
  const annexes = parsed ? parsed.annexes : legacy.annexes.map(a => ({ title: a.title, html: renderBody(a.body) }));
  const signers = Object.entries(order.signers || {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const top = signers.filter(s => s.kind !== 'acknowledger');
  const ack = signers.filter(s => s.kind === 'acknowledger');
  const stamp = order.status === 'revoked' ? '<div class="stamp revoked">REVOKED</div>' : order.status === 'draft' ? '<div class="stamp">DRAFT</div>' : '';
  const memoRow = (label, value, cls = '') => (value ? `<dt>${label}</dt><dd class="${cls}">${esc(value)}</dd>` : '');
  const from = [order.fromName, order.fromTitle].filter(Boolean).join(', ');

  const orderBody = `${stamp}
${order.status === 'revoked' ? `<div class="revoked-note"><b>This Office Order has been revoked</b>${order.revokedReason ? ` — ${esc(order.revokedReason)}` : ''}. It is kept for record purposes only.</div>` : ''}
<dl class="memo">
  ${memoRow('To', order.to)}
  ${memoRow('Cc', order.cc)}
  ${memoRow('From', from)}
  ${memoRow('Date', longDate(order.date))}
  ${memoRow('Subject', order.subject, 'subject')}
  ${memoRow('Effectivity', longDate(order.effectivity))}
</dl>
${main}
${top.length ? `<div class="signers">${top.map(s => signerBlock(s, signatures[s.id], timeZone)).join('')}</div>` : ''}
${ack.length ? `<div class="ack-block"><div class="eyebrow" style="color:var(--navy)">Acknowledgement</div><p>I have received, read and understood this Office Order${annexes.length ? ' and its annex' + (annexes.length > 1 ? 'es' : '') : ''}, and I will comply with it.</p><div class="signers ack">${ack.map(s => signerBlock(s, signatures[s.id], timeZone)).join('')}</div></div>` : ''}`;

  const verify = order.id ? `Verify: ${origin.replace(/^https?:\/\//, '')}/office-order/${order.id}` : `${BRAND_CO.name} · Office Order`;
  const page = (title, body, footRight) => brandPage({ title, numberLabel: 'CONTROL / TRACKING NO.', number, body, footLeft: verify, footRight, extraCss: ORDER_CSS, origin });
  const pageOf = html => html.slice(html.indexOf('<div class="pg">'), html.lastIndexOf('</body>'));

  let html = page('OFFICE ORDER', orderBody, `Office Order ${number}`);
  const annexPages = annexes.map(a => pageOf(page(a.title.toUpperCase().replace(/\s+[—–-]\s+/, ' · '), `${stamp}${a.html}`, `${a.title.split(/\s+[—–-]\s+/)[0]} · ${number}`))).join('');
  html = html
    .replace('</body>', `${annexPages}${autoPrint ? '<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})</script>' : ''}</body>`)
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(order.subject || 'Office Order')}</title>`)
    .replace(/<h1>([^<]{24,})<\/h1>/g, '<h1 class="long">$1</h1>');
  return html;
}
