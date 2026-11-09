// Memorandum of Agreement (MOA): official binding contract document
// between OdysseyPH IT Solutions and Client Partners.
// Strictly adheres to the company Brand Bible and uses brandPage().

import { BRAND_CO, esc, money, longDate, brandPage } from './brandDocument.js';

export const MOA_PREFIX = 'MOA';
const pad = (n, size = 2) => String(n).padStart(size, '0');
export const controlMonthOf = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const formatControlNumber = (month, seq) => `${MOA_PREFIX}-${month}-${pad(seq, 3)}`;

export const moaLink = (id, origin = (typeof window !== 'undefined' ? window.location.origin : '')) =>
  `${origin}/moa/${id}`;

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

export const SIGNER_KINDS = {
  provider: 'Party B (Service Provider)',
  client: 'Party A (Client)',
  witness: 'Witnessed by',
  conforme: 'Conforme',
};

export const emptyMoaSigners = () => ({
  s1: { kind: 'provider', name: BRAND_CO.approvedBy, title: 'Engineering & Executive Lead', order: 1 },
  s2: { kind: 'client', name: '', title: 'Authorized Representative', order: 2 },
});

export function moaNumberFor(moa) {
  const num = moa?.controlNumber || moa?.moaNumber || '';
  if (/^MOA-/.test(num)) return num;
  if (num) return `MOA-${num.replace(/^[^a-zA-Z0-9]+/, '')}`;
  const id = moa?.id || '';
  return id ? `MOA-${id.replace(/^moa_?/, '').slice(0, 8).toUpperCase()}` : 'MOA-DRAFT';
}

/* ─── AI prompt & paste parsing ─── */

export const AI_MOA_PROMPT = `Write a Memorandum of Agreement for OdysseyPH IT Solutions about the project below. Use exactly this plain-text format, no extra commentary:

TITLE: (Concise engagement title)
CLIENT NAME: (Representative Full Name)
BUSINESS NAME: (Client Enterprise / Company Name)
ADDRESS: (Client Office Address)
PROJECT COST: (Amount in PHP e.g. 75,000.00)
TIMELINE: (e.g. 4 Weeks or Month Day to Month Day, Year)

## 1. Purpose of Agreement
(Purpose narrative defining scope of professional technical services)

## 2. Scope of Work & Deliverables
(Detailed specifications, modules, and platform capabilities to be delivered)

## 3. Project Cost & Payment Schedule
(Cost terms, billing milestones, and payment conditions)

## 4. Development Timeline & Handover
(Schedule, module review, and inspection terms)

## 5. Intellectual Property & Confidentiality
(IP assignment upon final payment and nondisclosure commitments)

Party B (Service Provider):
Jetch Merald S. Madaya
Engineering & Executive Lead

Party A (Client):
(Client Representative Full Name)
(Position / Title)

If supporting technical annexes or architecture specs are needed, start after the signatures with "# Annex A — (Title)".

Project Engagement Details:
`;

export const clean = s => String(s || '')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/^\s*[#>*\-\s]+|\*\*|__|`/g, '')
  .replace(/[`\s]+$/, '')
  .trim();

export function splitPerson(text) {
  const [name, ...rest] = clean(text).split(/\s*(?:,|—|–| - |\|)\s*/);
  return { name: name || '', title: rest.join(', ') };
}

const FIELD_PATTERNS = [
  ['title', /^(?:#+\s*)?(?:\*\*)?(?:title|engagement title|subject|re|project title)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['clientName', /^(?:\*\*)?(?:client name|representative|authorized representative|party a representative|client)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['clientBusiness', /^(?:\*\*)?(?:business name|company name|client business|enterprise|client enterprise)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['clientAddress', /^(?:\*\*)?(?:address|client address|office address)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['projectCost', /^(?:\*\*)?(?:project cost|cost|total cost|contract price|fee|amount)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['timeline', /^(?:\*\*)?(?:timeline|schedule|delivery timeline|duration)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['providerName', /^(?:\*\*)?(?:provider name|service provider lead|lead)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['providerBusiness', /^(?:\*\*)?(?:provider business|service provider)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
];

const NOISE = /^(?:\*\*)?(?:memorandum of agreement(?:\s*(?:no\.?|number|#).*)?|[-=_*]{3,})(?:\*\*)?$/i;
const SIGN_PROV = /^(?:party b|service provider|for party b|provider)\s*(?:\([^)]+\))?\s*:?\s*$/i;
const SIGN_CLI = /^(?:party a|client|for party a)\s*(?:\([^)]+\))?\s*:?\s*$/i;
const SIGN_WIT = /^(?:witnessed by|witness)\s*:?\s*$/i;
const SIGN_CONF = /^(?:conforme|acknowledged by)\s*:?\s*$/i;

export function parseMoaText(raw) {
  const text = String(raw || '').replace(/\r\n?/g, '\n').trim();
  const fields = {};
  const signers = {};
  let currentSignerKind = null;
  let signerLines = [];
  const bodyLines = [];
  let pastHeader = false;

  const flushSigner = () => {
    if (!currentSignerKind || !signerLines.length) return;
    const combined = signerLines.join(', ');
    const { name, title } = splitPerson(combined);
    if (name) {
      const idx = Object.keys(signers).length + 1;
      signers[`s${idx}`] = { kind: currentSignerKind, name, title, order: idx };
    }
    currentSignerKind = null;
    signerLines = [];
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (NOISE.test(line)) continue;

    if (SIGN_PROV.test(line)) { flushSigner(); currentSignerKind = 'provider'; continue; }
    if (SIGN_CLI.test(line)) { flushSigner(); currentSignerKind = 'client'; continue; }
    if (SIGN_WIT.test(line)) { flushSigner(); currentSignerKind = 'witness'; continue; }
    if (SIGN_CONF.test(line)) { flushSigner(); currentSignerKind = 'conforme'; continue; }

    if (currentSignerKind) {
      if (!line) { flushSigner(); continue; }
      if (line.startsWith('#')) { flushSigner(); bodyLines.push(rawLine); continue; }
      signerLines.push(line);
      continue;
    }

    if (!pastHeader) {
      if (!line) continue;
      if (line.startsWith('#') || line.startsWith('1.') || line.startsWith('1 ')) {
        pastHeader = true;
        bodyLines.push(rawLine);
        continue;
      }
      let matched = false;
      for (const [key, pattern] of FIELD_PATTERNS) {
        const m = line.match(pattern);
        if (m) {
          fields[key] = clean(m[1]);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      pastHeader = true;
    }

    bodyLines.push(rawLine);
  }
  flushSigner();

  if (fields.projectCost) {
    const num = parseFloat(fields.projectCost.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(num)) fields.projectCost = String(num);
  }

  return { fields, body: bodyLines.join('\n').trim(), signers };
}

/* ─── TipTap & Markdown renderers ─── */

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

function renderTable(block) {
  const rows = block.content || [];
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
      const numMatch = text.match(/^(\d+(?:\.\d+)*|[A-Z])\s*(?:[·•.)-]\s*|\s+-\s+)\s*(.*)$/);
      const badge = numMatch ? `<span>${esc(numMatch[1])}</span>` : '<span class="dot"></span>';
      const cleanTitle = numMatch ? numMatch[2] : text;
      current.html.push(`<div class="moa-sec"><h${lvl}>${badge}${cleanTitle}</h${lvl}></div>`);
      continue;
    }
    current.html.push(renderBlock(block));
  }
  const [main, ...annexes] = parts;
  return { main: main.html.join('\n'), annexes: annexes.map(a => ({ title: a.title, html: a.html.join('\n') })) };
}

export function renderBody(markdown) {
  if (!markdown) return '';
  const rawSections = String(markdown || '').split(/(?=\n#{2,3}\s+)/);
  return rawSections.map(sec => {
    const trimmed = sec.trim();
    if (!trimmed) return '';
    const m = trimmed.match(/^#{2,3}\s+(.+)$/m);
    if (!m) {
      return `<p>${esc(trimmed).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
    }
    const hText = m[1].trim();
    const rest = trimmed.slice(m[0].length).trim();
    const numMatch = hText.match(/^(\d+(?:\.\d+)*|[A-Z])\s*(?:[·•.)-]\s*|\s+-\s+)\s*(.*)$/);
    const badge = numMatch ? `<span>${esc(numMatch[1])}</span>` : '<span class="dot"></span>';
    const cleanTitle = numMatch ? numMatch[2] : hText;
    const restHtml = rest ? `<p>${esc(rest).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>` : '';
    return `<div class="moa-sec"><h2>${badge}${cleanTitle}</h2>${restHtml}</div>`;
  }).join('\n');
}

/* ─── Stylesheet ─── */

const MOA_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.moa-intro{font-size:12.5px;line-height:1.7;color:#334155;margin-bottom:18px;text-align:justify}
.moa-grid{display:grid;grid-template-columns:130px 1fr 130px 1fr;row-gap:8px;column-gap:16px;font-size:12.3px;padding-bottom:16px;margin-bottom:18px;border-bottom:2px solid var(--navy)}
.moa-grid dt{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding-top:2px}
.moa-grid dd{font-weight:600}
.moa-grid dd.title{grid-column:2/-1;font-family:Poppins,sans-serif;font-size:14px;color:var(--navy)}
.moa-grid dd.full{grid-column:2/-1}
.moa-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;break-inside:avoid}
.moa-party-card{padding:14px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc}
.moa-party-card.provider{border-left:4px solid var(--orange)}
.moa-party-card.client{border-left:4px solid var(--navy)}
.moa-party-role{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.moa-party-card.provider .moa-party-role{color:var(--orange)}
.moa-party-card.client .moa-party-role{color:var(--navy)}
.moa-party-name{font-family:Poppins,sans-serif;font-size:14.5px;font-weight:700;color:var(--navy);margin-bottom:4px}
.moa-party-details{font-size:12px;line-height:1.5;color:#475569}
.moa-sec{margin-bottom:18px}
.moa-sec h2,.moa-sec h3{font-family:Poppins,sans-serif;font-size:13.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:10px;margin-bottom:8px;break-after:avoid}
.moa-sec h2 span,.moa-sec h3 span{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:6px;background:var(--orange);color:#fff;font-size:11px}
.moa-sec h2 span.dot,.moa-sec h3 span.dot{min-width:8px;width:8px;height:8px;padding:0;border-radius:50%}
.body p,.body li{line-height:1.65;font-size:12.3px;color:#1e293b}
.body p{margin:0 0 8px;text-align:justify}
.body ol,.body ul{padding-left:20px;margin:4px 0 8px}
.body li{margin-bottom:3px}
.moa-scope-group{margin:10px 0 14px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;break-inside:avoid}
.moa-scope-title{font-size:12.5px;font-weight:700;color:var(--navy);margin-bottom:6px}
.moa-scope-list{margin:0;padding-left:20px;font-size:12px;color:#334155;line-height:1.6}
.moa-scope-list li{margin-bottom:4px}
.moa-freeform{font-size:12.3px;line-height:1.7;color:#1e293b;white-space:pre-wrap;text-align:justify}
.tbl-wrap{width:100%;overflow-x:auto;margin:10px 0 14px}
.body .tbl{width:100%;border-collapse:collapse;font-size:11.5px;border:1px solid #d0d5dd;margin:10px 0 14px}
.body td{padding:7px 10px;font-size:11.5px;vertical-align:top;border:1px solid #e4e7ec}
.body th{padding:8px 10px;font-size:11px;font-weight:700;background:#f8fafc;color:var(--navy);border:1px solid #e4e7ec;text-align:left}
.body tr:nth-child(even){background:#fafbfd}
.callout{margin:8px 0;border-left:3px solid var(--orange);background:#f8f6f2;padding:9px 14px;font-size:12px;line-height:1.6;border-radius:0 8px 8px 0}
.signers{display:grid;grid-template-columns:1fr 1fr;gap:28px 56px;margin:34px 0 18px;break-inside:avoid}
.signer .eyebrow{color:var(--navy);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
.sig-mark{font-family:'Great Vibes',cursive;font-size:32px;line-height:1;color:#111;height:44px;display:flex;align-items:flex-end;padding-bottom:2px;margin-bottom:-4px;white-space:nowrap;overflow:visible}
.sig-mark.empty{height:44px}
.signer .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
.signer .sig-name{font-size:13px;font-weight:700;color:var(--navy)}
.signer .sig-name.blank{color:var(--muted);font-weight:400;font-style:italic}
.signer .sig-tag{font-size:10.5px;font-weight:600;color:var(--muted);letter-spacing:0.5px}
.sig-meta{font-size:9.5px;color:var(--muted);margin-top:3px;line-height:1.4}
.stamp{position:absolute;top:320px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap}
.stamp.executed{color:rgba(16,185,129,.14)}
.stamp.void,.stamp.revoked{color:rgba(220,38,38,.14)}
.stamp.issued{color:rgba(255,106,19,.12)}
@media screen and (max-width:840px){.pg{width:816px;min-height:1056px}.hd,.body,.ft{padding-left:64px;padding-right:64px}.band .bar{padding:0 64px 0 28px}.band .tab{width:64px}.band h1{font-size:24px}}
`;

function signerBlock(signer, signature, timeZone) {
  const roleTitle = SIGNER_KINDS[signer.kind] || signer.kindLabel || 'Authorized Signatory';
  const name = signature?.name || signer.name;
  const signed = signature
    ? `<div class="sig-mark">${esc(signature.name)}</div>`
    : '<div class="sig-mark empty"></div>';
  const meta = signature
    ? `<div class="sig-meta">Signed electronically ${esc(new Date(signature.signedAt).toLocaleString('en-PH', { timeZone, dateStyle: 'medium', timeStyle: 'short' }))}</div>`
    : '<div class="sig-meta">Date: ____________</div>';

  return `<div class="signer">
    <div class="eyebrow">${esc(roleTitle)}</div>
    ${signed}
    <div class="sig-line"></div>
    ${name ? `<div class="sig-name">${esc(name)}</div>` : '<div class="sig-name blank">Name &amp; signature</div>'}
    <div class="sig-tag">${esc((signer.title || '').toUpperCase())}</div>
    ${meta}
  </div>`;
}

export function buildMoaHtml(moa, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = moaNumberFor(moa);
  const status = (moa.status || '').toLowerCase();
  const isExecuted = status === 'executed' || (moa.providerSigned && moa.clientSigned) || (signatures.provider && signatures.client);
  const isRevoked = status === 'revoked' || status === 'void' || status === 'cancelled';
  const isIssued = status === 'issued' || status === 'pending';

  const stamp = isExecuted ? '<div class="stamp executed">EXECUTED</div>' :
    isRevoked ? '<div class="stamp revoked">REVOKED</div>' :
    isIssued ? '<div class="stamp issued">ISSUED</div>' :
      '<div class="stamp">DRAFT</div>';

  const providerName = moa.providerName || moa.providerSigneeName || BRAND_CO.approvedBy;
  const clientName = moa.clientName || moa.clientSigneeName || '';
  const clientBusiness = moa.clientBusiness || '';

  // Resolve signers configuration
  let signersList = [];
  if (moa.signers && Object.keys(moa.signers).length) {
    signersList = Object.entries(moa.signers)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } else {
    // Default 2-slot signers for legacy MOAs
    signersList = [
      { id: 's1', kind: 'provider', name: providerName, title: moa.providerSigneeTitle || 'Engineering & Executive Lead', order: 1 },
      { id: 's2', kind: 'client', name: clientName, title: moa.clientSigneeTitle || 'Authorized Representative', order: 2 },
    ];
  }

  // Parties Header Card
  const partiesSection = `
    <div class="moa-parties">
      <div class="moa-party-card provider">
        <div class="moa-party-role">Party B (Service Provider)</div>
        <div class="moa-party-name">${esc(moa.providerBusiness || BRAND_CO.name)}</div>
        <div class="moa-party-details">
          <strong>Authorized Lead:</strong> ${esc(providerName)}<br>
          <strong>Address:</strong> ${esc(BRAND_CO.address)}<br>
          <strong>Contact:</strong> ${esc(BRAND_CO.email)} · ${esc(BRAND_CO.phone)}
        </div>
      </div>
      <div class="moa-party-card client">
        <div class="moa-party-role">Party A (Client)</div>
        <div class="moa-party-name">${esc(clientBusiness || 'Client Enterprise')}</div>
        <div class="moa-party-details">
          <strong>Representative:</strong> ${esc(clientName || 'Authorized Representative')}<br>
          <strong>Address:</strong> ${esc(moa.clientAddress || 'Client Office Address')}
        </div>
      </div>
    </div>
  `;

  // Render Body Content (TipTap JSON or Fallback/Legacy)
  let contentHtml = '';
  if (moa.bodyJson) {
    try {
      const parsed = renderDocJson(JSON.parse(moa.bodyJson));
      contentHtml = parsed.main;
      if (parsed.annexes && parsed.annexes.length) {
        contentHtml += parsed.annexes.map(a => `
          <div class="moa-annex">
            <h2 style="margin-top:24px;border-top:2px solid var(--navy);padding-top:14px;">${esc(a.title)}</h2>
            ${a.html}
          </div>
        `).join('');
      }
    } catch {
      contentHtml = '';
    }
  }

  if (!contentHtml) {
    if (moa.isFreeform && moa.freeformContent) {
      contentHtml = `<div class="moa-freeform">${esc(moa.freeformContent)}</div>`;
    } else if (moa.body) {
      contentHtml = renderBody(moa.body);
    } else {
      const scopeHtml = (moa.scope || []).map((group, idx) => `
        <div class="moa-scope-group">
          <div class="moa-scope-title">${idx + 1}. ${esc(group.title || 'Deliverables')}</div>
          <ul class="moa-scope-list">
            ${(group.items || []).map(item => `<li>${esc(item)}</li>`).join('')}
          </ul>
        </div>
      `).join('');

      contentHtml = `
        <section class="moa-sec">
          <h2><span>1</span>Purpose of Agreement</h2>
          <p>${esc(moa.purpose || 'Formal engagement for technical architecture, development, deployment, and digital platform maintenance.')}</p>
        </section>

        <section class="moa-sec">
          <h2><span>2</span>Scope of Work &amp; Deliverables</h2>
          ${scopeHtml || '<p>Deliverables specified in the accompanying technical specification.</p>'}
        </section>

        <section class="moa-sec">
          <h2><span>3</span>Project Cost &amp; Payment Schedule</h2>
          <p>The total project development and delivery cost is <strong>₱ ${money(moa.projectCost)}</strong> (Philippine Pesos), payable according to the agreed milestone billing schedule.</p>
        </section>

        <section class="moa-sec">
          <h2><span>4</span>Development Timeline &amp; Acceptance</h2>
          <p>The project development and handover schedule is <strong>${esc(moa.timeline || 'Agreed project schedule')}</strong>. Upon completion of each module, the Client shall inspect and confirm acceptance.</p>
        </section>

        <section class="moa-sec">
          <h2><span>5</span>Intellectual Property &amp; Confidentiality</h2>
          <p>Upon full payment of all contracted fees, all custom software code, data schemas, and assets developed specifically for this project are assigned to the Client. Both parties agree to maintain strict confidentiality regarding proprietary business logic and sensitive customer records.</p>
        </section>
      `;
    }
  }

  // Render Signers
  const signersHtml = `
    <div class="signers">
      ${signersList.map(s => {
        // Resolve signature either by slot ID, kind, or legacy flags
        const sig = signatures[s.id] ||
          (s.kind === 'provider' && (signatures.provider || (moa.providerSigned ? {
            name: moa.providerSigneeName || providerName,
            signedAt: moa.providerSignedAt?.toDate?.()?.toISOString() || moa.providerSignedAt || moa.createdAt,
          } : null))) ||
          (s.kind === 'client' && (signatures.client || (moa.clientSigned ? {
            name: moa.clientSigneeName || clientName,
            signedAt: moa.clientSignedAt?.toDate?.()?.toISOString() || moa.clientSignedAt || moa.updatedAt,
          } : null)));
        return signerBlock(s, sig, timeZone);
      }).join('')}
    </div>
  `;

  const body = `
    ${stamp}
    <p class="moa-intro">This Memorandum of Agreement is entered into by and between the parties identified below for professional technology engineering, deployment, and digital services.</p>
    ${partiesSection}
    ${contentHtml}
    ${signersHtml}
  `;

  const verify = moa.id ? `Verify: ${origin.replace(/^https?:\/\//, '')}/moa/${moa.id}` : `${BRAND_CO.name} · Agreement Portal`;
  const footRight = `Agreement ${number}`;

  let html = brandPage({
    title: 'MEMORANDUM OF AGREEMENT',
    numberLabel: 'CONTRACT / MOA NO.',
    number,
    body,
    footLeft: verify,
    footRight,
    extraCss: MOA_CSS,
    origin,
    autoPrint,
  });

  html = html
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(clientBusiness || moa.title || 'Memorandum of Agreement')}</title>`);

  return html;
}
