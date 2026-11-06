// Incident Report: an official record and investigation document for incidents.
// The tracking number follows IR-<year>-<month>-<sequence>, e.g. IR-2026-11-001.
import { BRAND_CO, esc, longDate, brandPage } from './brandDocument.js';

export const INCIDENT_REPORT_PREFIX = 'IR';
const pad = (n, size = 2) => String(n).padStart(size, '0');
export const controlMonthOf = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const formatControlNumber = (month, seq) => `${INCIDENT_REPORT_PREFIX}-${month}-${pad(seq, 3)}`;
export const incidentReportLink = (id, origin = (typeof window !== 'undefined' ? window.location.origin : '')) =>
  `${origin}/incident-report/${id}`;

export const SEVERITIES = {
  low: { label: 'Low', color: '#344054', bg: '#f2f4f7' },
  medium: { label: 'Medium', color: '#b54708', bg: '#fffaeb' },
  high: { label: 'High', color: '#c2410c', bg: '#fff6ed' },
  critical: { label: 'Critical', color: '#b42318', bg: '#fef3f2' },
};

export const CATEGORIES = {
  operational: 'Operational / Service Interruption',
  security: 'Security / Data & Privacy',
  conduct: 'Workplace Conduct / Disciplinary',
  safety: 'Health & Safety',
  equipment: 'Equipment / Asset Damage',
  other: 'Other Incident',
};

export const SIGNER_KINDS = {
  reporter: 'Reported by',
  investigator: 'Investigated by',
  approver: 'Approved by',
  acknowledger: 'Acknowledged by',
};

export const emptyIncidentSigners = () => ({
  s1: { kind: 'reporter', name: '', title: '', order: 1 },
  s2: { kind: 'approver', name: BRAND_CO.approvedBy, title: 'Founder', order: 2 },
});

/* ─── AI prompt & paste parsing ─── */

export const AI_INCIDENT_PROMPT = `Write an Incident Report for OdysseyPH IT Solutions about the incident below. Use exactly this plain-text format, no extra commentary:

TITLE: (Concise incident title)
INCIDENT DATE: (Month Day, Year)
TIME: (e.g. 09:30 AM)
DATE REPORTED: (Month Day, Year)
LOCATION: (Office / Remote / Facility / System)
CATEGORY: (Operational | Security | Conduct | Safety | Equipment | Other)
SEVERITY: (Low | Medium | High | Critical)
REPORTED BY: (Name, Position)
PERSONS INVOLVED: (Names and roles, comma-separated)

## 1. Incident Overview & Summary
(Detailed chronological narrative of what occurred)

## 2. Immediate Actions Taken
(Containment and immediate emergency response)

## 3. Root Cause Analysis
(Underlying causes and vulnerabilities identified)

## 4. Corrective & Preventive Actions
(Action items, assignees, and target completion dates)

Reported by:
(Full name)
(Position)

Investigated by:
(Full name)
(Position)

Approved by:
Jetch Merald S. Madaya
Founder

Acknowledged by:
(Full name)
(Position)

If supporting logs or evidence are needed, start after the signatures with "# Annex A — (Title)".

Incident Description:
`;

const FIELD_PATTERNS = [
  ['title', /^(?:title|subject|regarding|re)\s*[:\-–]\s*(.+)$/i],
  ['incidentDate', /^(?:incident date|date of incident|occurrence date)\s*[:\-–]\s*(.+)$/i],
  ['incidentTime', /^(?:time|time of incident|incident time)\s*[:\-–]\s*(.+)$/i],
  ['dateReported', /^(?:date reported|date of report|reported date|date)\s*[:\-–]\s*(.+)$/i],
  ['location', /^(?:location|place|site|facility|department)\s*[:\-–]\s*(.+)$/i],
  ['category', /^(?:category|incident type|type)\s*[:\-–]\s*(.+)$/i],
  ['severity', /^(?:severity|severity level|impact)\s*[:\-–]\s*(.+)$/i],
  ['reportedBy', /^(?:reported by|prepared by|filed by)\s*[:\-–]\s*(.+)$/i],
  ['personsInvolved', /^(?:persons involved|involved parties|witnesses|personnel involved)\s*[:\-–]\s*(.+)$/i],
];

const NOISE = /^(?:\*\*)?(?:incident report(?:\s*(?:no\.?|number|#).*)?|[-=_*]{3,})(?:\*\*)?$/i;
const SIGN_REP = /^(?:reported|prepared|filed)\s*by\s*:?\s*$/i;
const SIGN_INV = /^(?:investigated|reviewed|noted)\s*by\s*:?\s*$/i;
const SIGN_APP = /^(?:approved|authorized)\s*by\s*:?\s*$/i;
const SIGN_ACK = /^(?:acknowledged|conforme|received)\s*(?:by)?\s*:?\s*$/i;

const clean = s => s.replace(/^[#>*\s]+|\*\*|__/g, '').replace(/\s+$/, '').trim();

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

export function parseIncidentReportText(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const fields = {};
  const body = [];
  const reporters = [];
  const investigators = [];
  const approvers = [];
  const acknowledgers = [];
  let mode = 'body';
  let pending = null;
  let headerDone = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const text = clean(line);
    const annexLine = text.length < 90 && (/^#{1,3}\s*annex\b/i.test(line.trim()) || /^ANNEX\s+[A-Z0-9]+\b/.test(text));
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
    if (SIGN_REP.test(text)) { mode = 'rep'; pending = null; continue; }
    if (SIGN_INV.test(text)) { mode = 'inv'; pending = null; continue; }
    if (SIGN_APP.test(text)) { mode = 'app'; pending = null; continue; }
    if (SIGN_ACK.test(text)) { mode = 'ack'; pending = null; continue; }

    if (mode !== 'body') {
      if (!text || /^_{3,}$/.test(text) || /^(?:signature|date)\s*:?.*$/i.test(text)) continue;
      const target = mode === 'rep' ? reporters : mode === 'inv' ? investigators : mode === 'app' ? approvers : acknowledgers;
      if (/[,—–|]| - /.test(text)) { target.push(splitPerson(text)); pending = null; continue; }
      if (pending && !pending.title) { pending.title = text; pending = null; continue; }
      pending = { name: text, title: '' };
      target.push(pending);
      continue;
    }
    body.push(line);
  }

  const reportedBy = fields.reportedBy ? splitPerson(fields.reportedBy) : null;
  const rawCat = (fields.category || '').toLowerCase().trim();
  const rawSev = (fields.severity || '').toLowerCase().trim();

  let category = 'operational';
  if (rawCat.includes('sec') || rawCat.includes('data')) category = 'security';
  else if (rawCat.includes('conduct') || rawCat.includes('disciplin')) category = 'conduct';
  else if (rawCat.includes('safe') || rawCat.includes('health')) category = 'safety';
  else if (rawCat.includes('equip') || rawCat.includes('asset') || rawCat.includes('damage')) category = 'equipment';
  else if (rawCat.includes('other')) category = 'other';

  let severity = 'medium';
  if (rawSev.includes('crit')) severity = 'critical';
  else if (rawSev.includes('high')) severity = 'high';
  else if (rawSev.includes('low')) severity = 'low';

  return {
    title: fields.title || '',
    incidentDate: toIsoDate(fields.incidentDate),
    incidentTime: fields.incidentTime || '',
    dateReported: toIsoDate(fields.dateReported) || toIsoDate(new Date()),
    location: fields.location || '',
    category,
    severity,
    reportedByName: reportedBy?.name || '',
    reportedByTitle: reportedBy?.title || '',
    personsInvolved: fields.personsInvolved || '',
    body: normalizeBody(body.join('\n')),
    reporters,
    investigators,
    approvers,
    acknowledgers,
  };
}

export function normalizeBody(text) {
  let lastSection = 0;
  return String(text || '').split('\n').map(line => {
    const t = line.trim();
    if (!t) return '';
    if (/^#\s*annex\b/i.test(t)) { lastSection = 0; return t; }
    const heading = t.replace(/^#{1,6}\s*/, '').replace(/^\*\*(.+)\*\*:?$/, '$1').match(/^(?:section\s+)?(\d{1,2}|[IVX]{1,5})[.):\-–]?\s+([^.]{2,80}?)[:.]?$/i);
    const isHeadingStyle = /^#{1,6}\s/.test(t) || /^\*\*.+\*\*:?$/.test(t) || (heading && heading[2] === heading[2].toUpperCase() && /[A-Z]/.test(heading[2]));
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

const INCIDENT_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.inc-grid{display:grid;grid-template-columns:120px 1fr 120px 1fr;row-gap:8px;column-gap:16px;font-size:12.3px;padding-bottom:16px;margin-bottom:18px;border-bottom:2px solid var(--navy)}
.inc-grid dt{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding-top:2px}
.inc-grid dd{font-weight:600}
.inc-grid dd.title{grid-column:2/-1;font-family:Poppins,sans-serif;font-size:14px;color:var(--navy)}
.inc-grid dd.full{grid-column:2/-1}
.sev-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.sev-pill i{width:6px;height:6px;border-radius:50%;display:inline-block}
.sev-low{background:#f2f4f7;color:#344054}.sev-low i{background:#667085}
.sev-medium{background:#fffaeb;color:#b54708}.sev-medium i{background:#f79009}
.sev-high{background:#fff6ed;color:#c2410c}.sev-high i{background:#ff6a13}
.sev-critical{background:#fef3f2;color:#b42318}.sev-critical i{background:#f04438}
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
.signer .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
.signers.ack .sig-name{font-size:12.5px}
.sig-meta{font-size:9.5px;color:var(--muted);margin-top:3px;line-height:1.4}
.ack-block{break-inside:avoid;margin-top:8px}
.ack-block p{font-size:12px;line-height:1.6;margin-bottom:4px}
.stamp{position:absolute;top:340px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap}
.stamp.revoked{color:rgba(220,38,38,.13)}
.stamp.closed{color:rgba(16,185,129,.12)}
.revoked-note{margin:0 0 18px;padding:10px 14px;border:1px solid #fca5a5;background:#fef2f2;color:#991b1b;border-radius:8px;font-size:12px}
.closed-note{margin:0 0 18px;padding:10px 14px;border:1px solid #6ee7b7;background:#ecfdf5;color:#065f46;border-radius:8px;font-size:12px}
.body h3.sub{font-family:Poppins,sans-serif;font-size:12.5px;font-weight:600;color:var(--navy);margin:12px 0 6px}
.body p.gap{height:8px;margin:0}
.body hr{border:0;border-top:1px solid var(--line);margin:14px 0}
.body a{color:#c2410c}
.band .bar{gap:24px}
.band h1{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.band h1.long{font-size:19px}
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
    <div class="eyebrow">${esc(SIGNER_KINDS[signer.kind] || 'Signer')}</div>
    ${signed}
    <div class="sig-line"></div>
    ${signer.name || signature ? `<div class="sig-name">${esc(signature?.name || signer.name)}</div>` : '<div class="sig-name blank">Name &amp; signature</div>'}
    <div class="sig-tag">${esc((signer.title || '').toUpperCase())}</div>
    ${meta}
  </div>`;
}

export function buildIncidentReportHtml(report, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = report.controlNumber || 'DRAFT';
  let parsed = null;
  if (report.bodyJson) { try { parsed = renderDocJson(JSON.parse(report.bodyJson)); } catch { parsed = null; } }
  const legacy = splitAnnexes(report.body);
  const main = parsed ? parsed.main : renderBody(legacy.main);
  const annexes = parsed ? parsed.annexes : legacy.annexes.map(a => ({ title: a.title, html: renderBody(a.body) }));
  const signers = Object.entries(report.signers || {}).map(([id, s]) => ({ id, ...s })).sort((a, b) => (a.order || 0) - (b.order || 0));
  const top = signers.filter(s => s.kind !== 'acknowledger');
  const ack = signers.filter(s => s.kind === 'acknowledger');

  const stamp = report.status === 'revoked' ? '<div class="stamp revoked">REVOKED</div>' :
                report.status === 'closed' ? '<div class="stamp closed">CLOSED</div>' :
                report.status === 'draft' ? '<div class="stamp">DRAFT</div>' : '';

  const sev = report.severity || 'medium';
  const sevBadge = `<span class="sev-pill sev-${esc(sev)}"><i></i>${esc(sev.toUpperCase())}</span>`;
  const catLabel = CATEGORIES[report.category] || report.category || 'Operational';
  const reportedBy = [report.reportedByName, report.reportedByTitle].filter(Boolean).join(', ');

  const grid = `<dl class="inc-grid">
    <dt>Title</dt><dd class="title">${esc(report.title || 'Untitled Incident')}</dd>
    <dt>Incident Date</dt><dd>${longDate(report.incidentDate) || esc(report.incidentDate || '—')}${report.incidentTime ? ` at ${esc(report.incidentTime)}` : ''}</dd>
    <dt>Date Reported</dt><dd>${longDate(report.dateReported) || esc(report.dateReported || '—')}</dd>
    <dt>Location</dt><dd>${esc(report.location || '—')}</dd>
    <dt>Severity</dt><dd>${sevBadge}</dd>
    <dt>Category</dt><dd>${esc(catLabel)}</dd>
    <dt>Reported By</dt><dd>${esc(reportedBy || '—')}</dd>
    ${report.personsInvolved ? `<dt>Involved</dt><dd class="full">${esc(report.personsInvolved)}</dd>` : ''}
  </dl>`;

  const statusNote = report.status === 'revoked' ? `<div class="revoked-note"><b>This Incident Report has been revoked</b>${report.statusReason ? ` — ${esc(report.statusReason)}` : ''}. It is kept for historical audit purposes only.</div>` :
                     report.status === 'closed' ? `<div class="closed-note"><b>This Incident has been investigated and closed</b>${report.statusReason ? ` — ${esc(report.statusReason)}` : ''}.</div>` : '';

  const reportContent = `${stamp}
${statusNote}
${grid}
${main}
${top.length ? `<div class="signers">${top.map(s => signerBlock(s, signatures[s.id], timeZone)).join('')}</div>` : ''}
${ack.length ? `<div class="ack-block"><div class="eyebrow" style="color:var(--navy)">Acknowledgement</div><p>I have read and acknowledged this Incident Report and understand the actions recorded.</p><div class="signers ack">${ack.map(s => signerBlock(s, signatures[s.id], timeZone)).join('')}</div></div>` : ''}`;

  const verify = report.id ? `Verify: ${origin.replace(/^https?:\/\//, '')}/incident-report/${report.id}` : `${BRAND_CO.name} · Incident Report`;
  const page = (title, body, footRight) => brandPage({ title, numberLabel: 'CONTROL / TRACKING NO.', number, body, footLeft: verify, footRight, extraCss: INCIDENT_CSS, origin });
  const pageOf = html => html.slice(html.indexOf('<div class="pg">'), html.lastIndexOf('</body>'));

  let html = page('INCIDENT REPORT', reportContent, `Incident Report ${number}`);
  const annexPages = annexes.map(a => pageOf(page(a.title.toUpperCase().replace(/\s+[—–-]\s+/, ' · '), `${stamp}${a.html}`, `${a.title.split(/\s+[—–-]\s+/)[0]} · ${number}`))).join('');

  html = html
    .replace('</body>', `${annexPages}${autoPrint ? '<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})</script>' : ''}</body>`)
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(report.title || 'Incident Report')}</title>`)
    .replace(/<h1>([^<]{24,})<\/h1>/g, '<h1 class="long">$1</h1>');

  return html;
}
