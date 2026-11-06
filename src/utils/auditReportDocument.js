// Audit Report: official corporate audit review and assessment document.
// The tracking number follows AR-<year>-<month>-<sequence>, e.g. AR-2026-11-001.
import { BRAND_CO, esc, longDate, brandPage } from './brandDocument.js';

export const AUDIT_REPORT_PREFIX = 'AR';
const pad = (n, size = 2) => String(n).padStart(size, '0');
export const controlMonthOf = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const formatControlNumber = (month, seq) => `${AUDIT_REPORT_PREFIX}-${month}-${pad(seq, 3)}`;
export const auditReportLink = (id, origin = (typeof window !== 'undefined' ? window.location.origin : '')) =>
  `${origin}/audit-report/${id}`;

export const AUDIT_RATINGS = {
  satisfactory: { label: 'Satisfactory', color: '#027a48', bg: '#ecfdf3' },
  needs_improvement: { label: 'Needs Improvement', color: '#b54708', bg: '#fffaeb' },
  unsatisfactory: { label: 'Unsatisfactory', color: '#b42318', bg: '#fef3f2' },
};

export const AUDIT_CATEGORIES = {
  it_security: 'IT & Cybersecurity / Systems',
  operations: 'Operations & Process',
  financial: 'Financial & Accounting',
  compliance: 'Compliance & Regulatory',
  inventory: 'Inventory & Asset Control',
  quality: 'Quality Assurance & SOP',
  other: 'General Audit',
};

export const SIGNER_KINDS = {
  auditor: 'Audited by',
  reviewer: 'Reviewed by',
  approver: 'Approved by',
  acknowledger: 'Acknowledged by',
};

export const emptyAuditSigners = () => ({
  s1: { kind: 'auditor', name: '', title: 'Lead Auditor', order: 1 },
  s2: { kind: 'reviewer', name: '', title: 'Audit Reviewer', order: 2 },
  s3: { kind: 'approver', name: BRAND_CO.approvedBy, title: 'Founder', order: 3 },
  s4: { kind: 'acknowledger', name: '', title: 'Auditee / Dept. Head', order: 4 },
});

/* ─── AI prompt & paste parsing ─── */

export const AI_AUDIT_PROMPT = `Write an Audit Report for OdysseyPH IT Solutions about the audit engagement below. Use exactly this plain-text format, no extra commentary:

TITLE: (Concise audit title)
CATEGORY: (IT & Security | Operations | Financial | Compliance | Inventory | Quality | Other)
RATING: (Satisfactory | Needs Improvement | Unsatisfactory)
PERIOD COVERED: (Month Day, Year to Month Day, Year)
DATE CONDUCTED: (Month Day, Year)
DATE ISSUED: (Month Day, Year)
LEAD AUDITOR: (Name, Position)
AUDITEE: (Department, System, or Facility Audited)
AUDIT TEAM: (Names and roles, comma-separated)

## 1. Executive Summary & Audit Objectives
(Executive narrative summarizing background, objectives, and overall conclusion)

## 2. Scope & Methodology
(Audit parameters, systems inspected, sampling methodology, and evaluation criteria)

## 3. Audit Findings & Observations
(Condition observed, criteria/standards benchmarked, root cause, and risk level)

## 4. Recommendations & Corrective Action Plan (CAPA)
(Prescribed remediations, corrective action items, assigned owners, and target resolution dates)

Audited by:
(Full name)
(Position)

Reviewed by:
(Full name)
(Position)

Approved by:
Jetch Merald S. Madaya
Founder

Acknowledged by:
(Full name or Dept. Head)
(Position)

If supporting logs, testing evidence, or check-sheets are needed, start after the signatures with "# Annex A — (Title)".

Audit Engagement Details:
`;

const FIELD_PATTERNS = [
  ['title', /^(?:#+\s*)?(?:\*\*)?(?:title|subject|audit title|engagement title|re)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['referenceNo', /^(?:\*\*)?(?:incident reference|audit reference|reference no\.?|reference|ref no\.?|ref)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['classification', /^(?:\*\*)?(?:classification|confidentiality|security classification)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['category', /^(?:\*\*)?(?:category|audit type|type of audit|scope area)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['rating', /^(?:\*\*)?(?:status|overall rating|rating|audit rating|outcome|audit opinion)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['periodCovered', /^(?:\*\*)?(?:period covered|audit period|period|coverage)\s*[:\-–]\s*(.+)$/i],
  ['auditDate', /^(?:\*\*)?(?:date conducted|audit date|date of audit|conducted on|date & time|date and time|date)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['dateIssued', /^(?:\*\*)?(?:date issued|report date|date of report|issued date)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['leadAuditor', /^(?:\*\*)?(?:lead auditor|audited by|prepared by|auditor|investigated by)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['auditeeEntity', /^(?:\*\*)?(?:target venue|target entity|venue|auditee|department|entity audited|target|system audited)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['venueDomain', /^(?:\*\*)?(?:domain|website|url|host)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['auditeeContact', /^(?:\*\*)?(?:auditee contact|contact person|auditee head)\s*[:\-–]\s*(.+)$/i],
  ['auditTeam', /^(?:\*\*)?(?:audit team|team members|auditors|observers)\s*[:\-–]\s*(.+)$/i],
];

const NOISE = /^(?:\*\*)?(?:audit report(?:\s*(?:no\.?|number|#).*)?|[-=_*]{3,})(?:\*\*)?$/i;
const SIGN_AUD = /^(?:audited|prepared)\s*by\s*:?\s*$/i;
const SIGN_REV = /^(?:reviewed|noted|verified)\s*by\s*:?\s*$/i;
const SIGN_APP = /^(?:approved|authorized)\s*by\s*:?\s*$/i;
const SIGN_ACK = /^(?:acknowledged|conforme|received)\s*(?:by)?\s*:?\s*$/i;

export const clean = s => String(s || '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/^\s*[#>*\-\s]+|\*\*|__|`/g, '')
  .replace(/[`\s]+$/, '')
  .trim();

export function toIsoDate(text) {
  const value = clean(String(text || ''))
    .replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*/i, '')
    .split(/\s*(?:·|at|@|\sat\s)\s*/)[0]
    .trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function splitPerson(text) {
  const [name, ...rest] = clean(text).split(/\s*(?:,|—|–| - |\|)\s*/);
  return { name: name || '', title: rest.join(', ') };
}

export function normalizeCategory(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('sec') || s.includes('it') || s.includes('cyber') || s.includes('forensic') || s.includes('database') || s.includes('post-mortem') || s.includes('api')) return 'it_security';
  if (s.includes('oper') || s.includes('proc')) return 'operations';
  if (s.includes('fin') || s.includes('money') || s.includes('acc') || s.includes('revenue') || s.includes('billing')) return 'financial';
  if (s.includes('comp') || s.includes('reg') || s.includes('legal')) return 'compliance';
  if (s.includes('inv') || s.includes('asset') || s.includes('stock')) return 'inventory';
  if (s.includes('qual') || s.includes('sop') || s.includes('qa')) return 'quality';
  return 'other';
}

export function normalizeRating(val) {
  const s = String(val || '').toLowerCase();
  if (s.includes('unsat') || s.includes('fail') || s.includes('critical') || s.includes('non-complian')) return 'unsatisfactory';
  if (s.includes('need') || s.includes('improv') || s.includes('qual') || s.includes('fair') || s.includes('cond')) return 'needs_improvement';
  if (s.includes('resolv') || s.includes('reconcil') || s.includes('pass') || s.includes('satisfact') || s.includes('clean') || s.includes('complian')) return 'satisfactory';
  return 'satisfactory';
}

export function parseAuditReportText(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n');
  const fields = {};
  const body = [];
  const auditors = [];
  const reviewers = [];
  const approvers = [];
  const acknowledgers = [];
  let mode = 'body';
  let pending = null;
  let headerDone = false;

  const pushPending = () => {
    if (!pending) return;
    const item = { name: clean(pending.name || ''), title: clean(pending.title || '') };
    if (pending.target === 'aud') auditors.push(item);
    else if (pending.target === 'rev') reviewers.push(item);
    else if (pending.target === 'app') approvers.push(item);
    else if (pending.target === 'ack') acknowledgers.push(item);
    pending = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!headerDone) {
      if (line === '---' || line === '***' || line === '___') continue;
      if (line.startsWith('# ') && !fields.title) {
        fields.title = clean(line.replace(/^#+\s*/, ''));
        continue;
      }
      if (NOISE.test(line)) continue;
      let matched = false;
      for (const [key, pattern] of FIELD_PATTERNS) {
        const m = line.match(pattern);
        if (m) {
          fields[key] = m[1].trim();
          matched = true;
          break;
        }
      }
      if (matched) continue;
      if (line.startsWith('## ') || line.startsWith('### ')) {
        headerDone = true;
      } else if (!line.startsWith('#') && line.length > 0 && !line.startsWith('**') && !line.startsWith('*')) {
        headerDone = true;
      }
    }

    if (SIGN_AUD.test(line)) { pushPending(); mode = 'signers'; pending = { target: 'aud' }; continue; }
    if (SIGN_REV.test(line)) { pushPending(); mode = 'signers'; pending = { target: 'rev' }; continue; }
    if (SIGN_APP.test(line)) { pushPending(); mode = 'signers'; pending = { target: 'app' }; continue; }
    if (SIGN_ACK.test(line)) { pushPending(); mode = 'signers'; pending = { target: 'ack' }; continue; }

    if (mode === 'signers') {
      if (!line) { pushPending(); continue; }
      if (line.startsWith('#')) { pushPending(); mode = 'annex'; body.push(rawLine); continue; }
      if (!pending) {
        const p = splitPerson(line);
        auditors.push(p);
        continue;
      }
      if (!pending.name) {
        if (line.includes(',') || line.includes('—') || line.includes('–')) {
          const p = splitPerson(line);
          pending.name = p.name;
          pending.title = p.title;
          pushPending();
        } else {
          pending.name = line;
        }
      } else if (!pending.title) {
        pending.title = line;
        pushPending();
      }
      continue;
    }

    body.push(rawLine);
  }
  pushPending();

  const out = {};
  if (fields.title) out.title = clean(fields.title);
  if (fields.referenceNo) out.referenceNo = clean(fields.referenceNo);
  if (fields.classification) out.classification = clean(fields.classification);
  if (fields.category) out.category = normalizeCategory(fields.category);
  else if (fields.classification) out.category = normalizeCategory(fields.classification);
  else out.category = 'it_security';

  if (fields.rating) out.rating = normalizeRating(fields.rating);

  if (fields.periodCovered) {
    const parts = fields.periodCovered.split(/\s+(?:to|through|until|—|–|-)\s+|\s*[—–]\s*/i);
    if (parts[0]) out.auditPeriodStart = toIsoDate(parts[0]) || parts[0].trim();
    if (parts[1]) out.auditPeriodEnd = toIsoDate(parts[1]) || parts[1].trim();
  }
  if (fields.auditDate) out.auditDate = toIsoDate(fields.auditDate) || fields.auditDate.trim();
  if (fields.dateIssued) out.dateIssued = toIsoDate(fields.dateIssued) || fields.dateIssued.trim();
  else if (out.auditDate) out.dateIssued = out.auditDate;

  if (fields.leadAuditor) {
    const p = splitPerson(fields.leadAuditor);
    out.leadAuditorName = p.name;
    out.leadAuditorTitle = p.title || 'Lead Auditor';
  }
  if (fields.auditeeEntity) out.auditeeEntity = clean(fields.auditeeEntity);
  if (fields.venueDomain) out.venueDomain = clean(fields.venueDomain).replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (fields.auditeeContact) out.auditeeContact = clean(fields.auditeeContact);
  if (fields.auditTeam) out.auditTeam = clean(fields.auditTeam);

  const signers = {};
  let slotIdx = 1;

  const addSigners = (list, kind, defaultTitle) => {
    for (const item of list) {
      if (!item.name && !item.title) continue;
      signers[`s${slotIdx}`] = {
        kind,
        name: item.name || '',
        title: item.title || defaultTitle,
        order: slotIdx,
      };
      slotIdx++;
    }
  };

  addSigners(auditors, 'auditor', 'Lead Auditor');
  addSigners(reviewers, 'reviewer', 'Audit Reviewer');
  if (approvers.length) {
    addSigners(approvers, 'approver', 'Founder');
  } else {
    signers[`s${slotIdx}`] = { kind: 'approver', name: BRAND_CO.approvedBy, title: 'Founder', order: slotIdx };
    slotIdx++;
  }
  addSigners(acknowledgers, 'acknowledger', 'Auditee / Dept. Head');

  if (Object.keys(signers).length === 0) {
    Object.assign(signers, emptyAuditSigners());
  }

  return { fields: out, body: body.join('\n').trim(), signers };
}

/* ─── Markdown / TipTap HTML Rendering ─── */

function renderTable(table) {
  const rows = table.content || [];
  const htmlRows = rows.map((row, rIdx) => {
    const cells = (row.content || []).map(cell => {
      const isHeader = cell.type === 'tableHeader' || rIdx === 0;
      const tag = isHeader ? 'th' : 'td';
      const cellHtml = (cell.content || []).map(p => (p.content || []).map(renderInline).join('')).join('<br>');
      return `<${tag}>${cellHtml || '&nbsp;'}</${tag}>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table class="tbl">${htmlRows}</table>`;
}

function renderInline(node) {
  if (!node) return '';
  if (node.type === 'text') {
    let t = esc(node.text || '');
    if (node.marks) {
      for (const m of node.marks) {
        if (m.type === 'bold') t = `<b>${t}</b>`;
        else if (m.type === 'italic') t = `<i>${t}</i>`;
        else if (m.type === 'underline') t = `<u>${t}</u>`;
        else if (m.type === 'strike') t = `<s>${t}</s>`;
        else if (m.type === 'code') t = `<code>${t}</code>`;
        else if (m.type === 'link') t = `<a href="${esc(m.attrs?.href || '#')}">${t}</a>`;
      }
    }
    return t;
  }
  if (node.type === 'hardBreak') return '<br>';
  return '';
}

function renderBlock(block) {
  if (!block) return '';
  const text = (block.content || []).map(renderInline).join('');
  switch (block.type) {
    case 'paragraph':
      return text.trim() ? `<p>${text}</p>` : '<p class="gap"></p>';
    case 'heading': {
      const level = block.attrs?.level || 2;
      return `<h${level}>${text}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${(block.content || []).map(renderBlock).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(block.content || []).map(renderBlock).join('')}</ol>`;
    case 'listItem':
      return `<li>${(block.content || []).map(renderBlock).join('')}</li>`;
    case 'blockquote':
      return `<div class="callout">${text}</div>`;
    case 'table':
      return renderTable(block);
    case 'codeBlock': {
      const lang = block.attrs?.language || '';
      const langClass = lang ? ` class="language-${esc(lang)}"` : '';
      return `<pre><code${langClass}>${text}</code></pre>`;
    }
    case 'horizontalRule':
      return '<hr>';
    default:
      return text ? `<p>${text}</p>` : '';
  }
}

export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableRows = [];
  let tableAlignments = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines = [];

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };
  const closeTable = () => {
    if (!inTable) return;
    out.push(`<div class="tbl-wrap"><table class="tbl">${tableRows.join('')}</table></div>`);
    inTable = false;
    tableRows = [];
    tableAlignments = [];
  };
  const closeCodeBlock = () => {
    if (!inCodeBlock) return;
    const langClass = codeBlockLang ? ` class="language-${esc(codeBlockLang)}"` : '';
    out.push(`<pre><code${langClass}>${esc(codeBlockLines.join('\n'))}</code></pre>`);
    inCodeBlock = false;
    codeBlockLang = '';
    codeBlockLines = [];
  };

  const inline = s => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/__([^_]+)__/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith('```')) {
      closeList();
      closeTable();
      if (inCodeBlock) {
        closeCodeBlock();
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
        codeBlockLines = [];
      }
      continue;
    }
    if (inCodeBlock) {
      codeBlockLines.push(raw);
      continue;
    }

    if (!line) { closeList(); closeTable(); continue; }

    if (line.startsWith('$$') && line.endsWith('$$') && line.length >= 4) {
      closeList();
      closeTable();
      const mathText = line.slice(2, -2).trim();
      out.push(`<div class="math-block"><code>${esc(mathText)}</code></div>`);
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      closeList();
      closeTable();
      out.push('<hr>');
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      closeList();
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        tableAlignments = line.slice(1, -1).split('|').map(c => {
          const s = c.trim();
          if (s.startsWith(':') && s.endsWith(':')) return 'center';
          if (s.endsWith(':')) return 'right';
          return 'left';
        });
        continue;
      }
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      const isHeader = !inTable;
      inTable = true;
      const tag = isHeader ? 'th' : 'td';
      tableRows.push(`<tr>${cells.map((c, idx) => {
        const align = tableAlignments[idx] || (isHeader ? 'left' : 'left');
        const alignStyle = align !== 'left' ? ` style="text-align:${align}"` : '';
        return `<${tag}${alignStyle}>${inline(c)}</${tag}>`;
      }).join('')}</tr>`);
      continue;
    }
    closeTable();

    if (/^#{1,6}\s+/.test(line)) {
      closeList();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#+\s*/, '');
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(line.replace(/^[-*•]\s+/, ''))}</li>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inline(line.replace(/^\d+[.)]\s+/, ''))}</li>`);
      continue;
    }
    if (line.startsWith('>')) {
      closeList();
      out.push(`<div class="callout">${inline(line.replace(/^>\s*/, ''))}</div>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  closeCodeBlock();
  return out.join('\n');
}

export function renderBody(markdown) {
  const rawHtml = markdownToHtml(markdown);
  const sections = rawHtml.split(/(?=<h[23])/i);
  return sections.map(sec => {
    const m = sec.match(/^<h([23])>(.*?)<\/h\1>([\s\S]*)$/i);
    if (!m) return sec.trim() ? `<div class="sec body">${sec}</div>` : '';
    const [, lvl, hText, rest] = m;
    const numMatch = hText.match(/^(\d+(?:\.\d+)*|[A-Z])\s*(?:[·•\.\-\)]\s*|\s+-\s+)\s*(.*)$/);
    const badge = numMatch ? `<span>${esc(numMatch[1])}</span>` : '<span class="dot"></span>';
    const cleanTitle = numMatch ? numMatch[2] : hText;
    return `<div class="sec body"><h${lvl}>${badge}${cleanTitle}</h${lvl}>${rest}</div>`;
  }).join('\n');
}

export function splitAnnexes(markdown) {
  const parts = String(markdown || '').split(/(?=\n#\s+Annex\s+[A-Z]\b)/i);
  const main = parts[0] || '';
  const annexes = parts.slice(1).map(a => {
    const lines = a.trim().split('\n');
    const header = lines[0].replace(/^#\s*/, '').trim();
    const body = lines.slice(1).join('\n').trim();
    return { title: header, body };
  });
  return { main, annexes };
}

export function renderDocJson(doc) {
  if (!doc?.content) return { main: '', annexes: [] };
  const parts = [{ title: 'main', html: [] }];
  let current = parts[0];
  const closeSection = () => {};

  for (const block of doc.content) {
    if (block.type === 'heading' && block.attrs?.level === 1) {
      const text = (block.content || []).map(renderInline).join('').trim();
      if (/^Annex\s+[A-Z]\b/i.test(text)) {
        current = { title: text, html: [] };
        parts.push(current);
        continue;
      }
    }
    if (block.type === 'heading' && (block.attrs?.level === 2 || block.attrs?.level === 3)) {
      const lvl = block.attrs.level;
      const text = (block.content || []).map(renderInline).join('');
      const numMatch = text.match(/^(\d+(?:\.\d+)*|[A-Z])\s*(?:[·•\.\-\)]\s*|\s+-\s+)\s*(.*)$/);
      const badge = numMatch ? `<span>${esc(numMatch[1])}</span>` : '<span class="dot"></span>';
      const cleanTitle = numMatch ? numMatch[2] : text;
      current.html.push(`<div class="sec body"><h${lvl}>${badge}${cleanTitle}</h${lvl}></div>`);
      continue;
    }
    current.html.push(renderBlock(block));
  }
  closeSection();
  const [main, ...annexes] = parts;
  return { main: main.html.join('\n'), annexes: annexes.map(a => ({ title: a.title, html: a.html.join('\n') })) };
}

/* ─── Stylesheet ─── */

const AUDIT_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.audit-grid{display:grid;grid-template-columns:130px 1fr 130px 1fr;row-gap:8px;column-gap:16px;font-size:12.3px;padding-bottom:16px;margin-bottom:18px;border-bottom:2px solid var(--navy)}
.audit-grid dt{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding-top:2px}
.audit-grid dd{font-weight:600}
.audit-grid dd.title{grid-column:2/-1;font-family:Poppins,sans-serif;font-size:14px;color:var(--navy)}
.audit-grid dd.full{grid-column:2/-1}
.rating-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.rating-pill i{width:6px;height:6px;border-radius:50%;display:inline-block}
.rating-satisfactory{background:#ecfdf3;color:#027a48}.rating-satisfactory i{background:#12b76a}
.rating-needs_improvement{background:#fffaeb;color:#b54708}.rating-needs_improvement i{background:#f79009}
.rating-unsatisfactory{background:#fef3f2;color:#b42318}.rating-unsatisfactory i{background:#f04438}
.sec{margin-bottom:18px}
.sec h2{font-family:Poppins,sans-serif;font-size:13.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:10px;margin-bottom:8px;break-after:avoid}
.sec h2 span{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:6px;background:var(--orange);color:#fff;font-size:11px}
.sec h2 span.dot{min-width:8px;width:8px;height:8px;padding:0;border-radius:50%}
.body p,.body li{line-height:1.65;font-size:12.3px}
.body p{margin:0 0 7px}
.body ol,.body ul{padding-left:20px;margin:4px 0 8px}
.body li{margin-bottom:3px}
.tbl-wrap{width:100%;overflow-x:auto;margin:10px 0 14px}
.body .tbl{width:100%;border-collapse:collapse;font-size:11.5px;border:1px solid #d0d5dd}
.body td{padding:7px 10px;font-size:11.5px;vertical-align:top;border:1px solid #e4e7ec}
.body th{padding:8px 10px;font-size:11px;font-weight:700;background:#f8fafc;color:var(--navy);border:1px solid #e4e7ec;text-align:left}
.body tr:nth-child(even){background:#fafbfd}
.callout{margin:8px 0;border-left:3px solid var(--orange);background:#f8f6f2;padding:9px 14px;font-size:12px;line-height:1.6;border-radius:0 8px 8px 0}
.math-block{margin:12px 0;padding:12px 18px;background:#f8fafc;border:1px solid #cbd5e1;border-left:4px solid var(--orange);border-radius:6px;font-family:'Fira Code',Consolas,'Cambria Math',monospace;font-size:12.5px;text-align:center;color:var(--navy);overflow-x:auto;font-weight:600}
pre{background:#0f172a;color:#f8fafc;padding:12px 16px;border-radius:8px;font-family:'Fira Code',Consolas,Menlo,monospace;font-size:11.5px;line-height:1.55;overflow-x:auto;margin:10px 0}
pre code{background:none!important;color:inherit!important;padding:0!important;font-size:inherit!important}
.signers{display:grid;grid-template-columns:1fr 1fr;gap:28px 56px;margin:34px 0 18px;break-inside:avoid}
.signers.ack{grid-template-columns:repeat(2,1fr);gap:24px;margin-top:10px}
.signer .eyebrow{color:var(--navy)}
.sig-mark{font-family:'Great Vibes',cursive;font-size:32px;line-height:1;color:#111;height:44px;display:flex;align-items:flex-end;padding-bottom:2px;margin-bottom:-4px;white-space:nowrap;overflow:visible}
.sig-mark.empty{height:44px}
.signer .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
.signer .sig-name{font-size:13px;font-weight:700;color:var(--navy)}
.signer .sig-name.blank{color:var(--muted);font-weight:400;font-style:italic}
.signer .sig-tag{font-size:10.5px;font-weight:600;color:var(--muted);letter-spacing:0.5px}
.sig-meta{font-size:9.5px;color:var(--muted);margin-top:3px;line-height:1.4}
.ack-block{break-inside:avoid;margin-top:14px;padding-top:12px;border-top:1px dashed #cbd5e1}
.ack-block p{font-size:12px;line-height:1.6;margin-bottom:6px;color:#475467}
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

export function buildAuditReportHtml(report, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
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

  const rating = report.rating || 'satisfactory';
  const ratingInfo = AUDIT_RATINGS[rating] || AUDIT_RATINGS.satisfactory;
  const ratingBadge = `<span class="rating-pill rating-${esc(rating)}"><i></i>${esc(ratingInfo.label.toUpperCase())}</span>`;
  const catLabel = AUDIT_CATEGORIES[report.category] || report.category || 'General Audit';
  const leadAuditor = [report.leadAuditorName, report.leadAuditorTitle].filter(Boolean).join(', ');

  const safeLongDate = d => {
    if (!d) return '—';
    const formatted = longDate(d);
    return formatted && formatted !== 'Invalid Date' ? formatted : esc(d);
  };

  const periodString = report.auditPeriodStart
    ? `${safeLongDate(report.auditPeriodStart)}${report.auditPeriodEnd ? ` to ${safeLongDate(report.auditPeriodEnd)}` : ''}`
    : '';

  const grid = `<dl class="audit-grid">
    <dt>Engagement</dt><dd class="title">${esc(report.title || 'Untitled Audit Engagement')}</dd>
    ${report.referenceNo ? `<dt>Reference</dt><dd><code>${esc(report.referenceNo)}</code></dd>` : ''}
    ${report.classification ? `<dt>Classification</dt><dd>${esc(report.classification)}</dd>` : ''}
    <dt>Scope Area</dt><dd>${esc(catLabel)}</dd>
    <dt>Overall Rating</dt><dd>${ratingBadge}</dd>
    ${periodString ? `<dt>Period Covered</dt><dd>${periodString}</dd>` : ''}
    <dt>Date Conducted</dt><dd>${safeLongDate(report.auditDate)}</dd>
    <dt>Date Issued</dt><dd>${safeLongDate(report.dateIssued)}</dd>
    ${leadAuditor ? `<dt>Lead Auditor</dt><dd>${esc(leadAuditor)}</dd>` : ''}
    <dt>Audited Entity</dt><dd>${esc(report.auditeeEntity || '—')}${report.auditeeContact ? ` (${esc(report.auditeeContact)})` : ''}</dd>
    ${report.venueDomain ? `<dt>Domain</dt><dd><a href="https://${esc(report.venueDomain.replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">${esc(report.venueDomain)}</a></dd>` : ''}
    ${report.auditTeam ? `<dt>Audit Team</dt><dd class="full">${esc(report.auditTeam)}</dd>` : ''}
  </dl>`;

  const statusNote = report.status === 'revoked' ? `<div class="revoked-note"><b>This Audit Report has been revoked</b>${report.statusReason ? ` — ${esc(report.statusReason)}` : ''}. It is retained for historical archive only.</div>` :
                     report.status === 'closed' ? `<div class="closed-note"><b>This Audit Engagement has been closed</b>${report.statusReason ? ` — ${esc(report.statusReason)}` : ''}. All corrective actions and findings have been addressed.</div>` : '';

  const reportContent = `${stamp}
${statusNote}
${grid}
${main}
${top.length ? `<div class="signers">${top.map(s => signerBlock(s, signatures[s.id], timeZone)).join('')}</div>` : ''}
${ack.length ? `<div class="ack-block"><div class="eyebrow" style="color:var(--navy)">Auditee Acknowledgement &amp; Conforme</div><p>We acknowledge receipt of this Audit Report, agree to the factual observations, and commit to the agreed corrective action plan.</p><div class="signers ack">${ack.map(s => signerBlock(s, signatures[s.id], timeZone)).join('')}</div></div>` : ''}`;

  const verify = report.id ? `Verify: ${origin.replace(/^https?:\/\//, '')}/audit-report/${report.id}` : `${BRAND_CO.name} · Audit Report`;
  const page = (title, body, footRight) => brandPage({ title, numberLabel: 'CONTROL / TRACKING NO.', number, body, footLeft: verify, footRight, extraCss: AUDIT_CSS, origin });
  const pageOf = html => html.slice(html.indexOf('<div class="pg">'), html.lastIndexOf('</body>'));

  let html = page('AUDIT REPORT', reportContent, `Audit Report ${number}`);
  const annexPages = annexes.map(a => pageOf(page(a.title.toUpperCase().replace(/\s+[—–-]\s+/, ' · '), `${stamp}${a.html}`, `${a.title.split(/\s+[—–-]\s+/)[0]} · ${number}`))).join('');

  html = html
    .replace('</body>', `${annexPages}${autoPrint ? '<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})</script>' : ''}</body>`)
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(report.title || 'Audit Report')}</title>`)
    .replace(/<h1>([^<]{24,})<\/h1>/g, '<h1 class="long">$1</h1>');

  return html;
}
