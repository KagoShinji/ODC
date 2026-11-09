// Certificate of Acceptance (COA): formal project handover and completion certificate
// between OdysseyPH IT Solutions and Client Partners.
// Strictly adheres to the company Brand Bible and uses brandPage().

import { BRAND_CO, esc, longDate, brandPage } from './brandDocument.js';

export const COA_PREFIX = 'COA';
const pad = (n, size = 2) => String(n).padStart(size, '0');
export const controlMonthOf = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const formatControlNumber = (month, seq) => `${COA_PREFIX}-${month}-${pad(seq, 3)}`;

export const acceptanceLink = (id, origin = (typeof window !== 'undefined' ? window.location.origin : '')) =>
  `${origin}/acceptance/${id}`;

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

export const SIGNER_KINDS = {
  turnover: 'Turned Over by (Service Provider)',
  acceptor: 'Accepted & Conforme (Client Partner)',
  inspector: 'Inspected / Verified by',
  noted: 'Noted by',
};

export const emptyAcceptanceSigners = () => ({
  s1: { kind: 'turnover', name: BRAND_CO.approvedBy, title: 'Engineering & Executive Lead', order: 1 },
  s2: { kind: 'acceptor', name: '', title: 'Authorized Representative', order: 2 },
});

export function certificateNumberFor(coa) {
  const num = coa?.controlNumber || coa?.certificateNumber || '';
  if (/^COA-/.test(num)) return num;
  if (num) return `COA-${num.replace(/^[^a-zA-Z0-9]+/, '')}`;
  const id = coa?.id || '';
  return id ? `COA-${id.replace(/^cert_?/, '').slice(0, 8).toUpperCase()}` : 'COA-DRAFT';
}

/* ─── AI prompt & paste parsing ─── */

export const AI_ACCEPTANCE_PROMPT = `Write a Certificate of Acceptance for OdysseyPH IT Solutions about the project turnover below. Use exactly this plain-text format, no extra commentary:

PROJECT NAME: (Full Name of Delivered Software Platform)
CLIENT NAME: (Authorized Client Representative)
BUSINESS NAME: (Client Enterprise / Company Name)
TURNOVER DATE: (Month Day, Year)
REPRESENTATIVE: (Name, Position / Title)

## Verified Project Deliverables & System Scope
(Bullet list of completed modules, technical capabilities, databases, integrations, and deployment environments)

Turned Over by:
Jetch Merald S. Madaya
Engineering & Executive Lead

Accepted by:
(Client Representative Full Name)
(Position / Title)

If supporting test logs or check-sheets are needed, start after the signatures with "# Annex A — (Title)".

Turnover Details:
`;

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

const FIELD_PATTERNS = [
  ['projectName', /^(?:#+\s*)?(?:\*\*)?(?:project name|project|system name|deliverables title|title)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['clientName', /^(?:\*\*)?(?:client name|accepted by name)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['representative', /^(?:\*\*)?(?:representative|client representative|authorized representative)\s*[:\-–]\s*(.+)$/i],
  ['clientBusiness', /^(?:\*\*)?(?:business name|client enterprise|company name|client business|client)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['clientAddress', /^(?:\*\*)?(?:address|client address|office address)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['turnoverDate', /^(?:\*\*)?(?:turnover date|date of turnover|handover date|acceptance date|date)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['providerName', /^(?:\*\*)?(?:provider name|service provider lead|turned over by name|lead)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
  ['providerBusiness', /^(?:\*\*)?(?:provider business|service provider)(?:\*\*)?\s*[:\-–]\s*(.+)$/i],
];

const NOISE = /^(?:\*\*)?(?:certificate of acceptance(?:\s*(?:no\.?|number|#).*)?|[-=_*]{3,})(?:\*\*)?$/i;
const SIGN_TURNOVER = /^(?:turned over by|issued by|service provider|for party b|provider)\s*(?:\([^)]+\))?\s*:?\s*$/i;
const SIGN_ACCEPT = /^(?:accepted by|accepted & conforme|conforme|for party a|client)\s*(?:\([^)]+\))?\s*:?\s*$/i;
const SIGN_INSP = /^(?:inspected by|verified by|qa inspector)\s*:?\s*$/i;
const SIGN_NOTE = /^(?:noted by|witnessed by)\s*:?\s*$/i;

export function parseAcceptanceText(raw) {
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

    if (SIGN_TURNOVER.test(line)) { flushSigner(); currentSignerKind = 'turnover'; continue; }
    if (SIGN_ACCEPT.test(line)) { flushSigner(); currentSignerKind = 'acceptor'; continue; }
    if (SIGN_INSP.test(line)) { flushSigner(); currentSignerKind = 'inspector'; continue; }
    if (SIGN_NOTE.test(line)) { flushSigner(); currentSignerKind = 'noted'; continue; }

    if (currentSignerKind) {
      if (!line) { flushSigner(); continue; }
      if (line.startsWith('#')) { flushSigner(); bodyLines.push(rawLine); continue; }
      signerLines.push(line);
      continue;
    }

    if (!pastHeader) {
      if (!line) continue;
      if (line.startsWith('#') || line.startsWith('1.') || line.startsWith('1 ') || line.startsWith('-')) {
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

  if (fields.representative && !fields.clientName) {
    const { name, title } = splitPerson(fields.representative);
    fields.clientName = name;
    if (title && !fields.clientTitle) fields.clientTitle = title;
  }

  if (fields.turnoverDate) {
    fields.turnoverDate = toIsoDate(fields.turnoverDate) || fields.turnoverDate;
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
      current.html.push(`<div class="coa-sec"><h${lvl}>${badge}${cleanTitle}</h${lvl}></div>`);
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
    return `<div class="coa-sec"><h2>${badge}${cleanTitle}</h2>${restHtml}</div>`;
  }).join('\n');
}

/* ─── Stylesheet ─── */

const ACCEPTANCE_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.coa-grid{display:grid;grid-template-columns:140px 1fr 140px 1fr;row-gap:8px;column-gap:16px;font-size:12.3px;padding-bottom:16px;margin-bottom:18px;border-bottom:2px solid var(--navy)}
.coa-grid dt{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--muted);text-transform:uppercase;padding-top:2px}
.coa-grid dd{font-weight:600}
.coa-grid dd.party{grid-column:2/-1;font-family:Poppins,sans-serif;font-size:15px;color:var(--navy)}
.coa-grid dd.full{grid-column:2/-1}
.coa-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.coa-pill.accepted{background:#ecfdf5;color:#065f46}.coa-pill.accepted i{background:#10b981;width:6px;height:6px;border-radius:50%}
.coa-pill.pending{background:#fffbeb;color:#b45309}.coa-pill.pending i{background:#f59e0b;width:6px;height:6px;border-radius:50%}
.coa-cert-text{font-size:13px;line-height:1.75;color:#1e293b;margin:18px 0;text-align:justify;background:#f8fafc;padding:16px 20px;border-left:4px solid var(--orange);border-radius:0 8px 8px 0}
.coa-sec{margin-bottom:18px}
.coa-sec h2,.coa-sec h3{font-family:Poppins,sans-serif;font-size:13px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:10px;margin-bottom:8px;break-after:avoid}
.coa-sec h2 span,.coa-sec h3 span{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:6px;background:var(--orange);color:#fff;font-size:11px}
.coa-sec h2 span.dot,.coa-sec h3 span.dot{min-width:8px;width:8px;height:8px;padding:0;border-radius:50%}
.body p,.body li{line-height:1.65;font-size:12.3px;color:#1e293b}
.body p{margin:0 0 8px}
.body ol,.body ul{padding-left:20px;margin:4px 0 8px}
.body li{margin-bottom:3px}
.coa-scope-box{margin:18px 0;padding:16px 20px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;break-inside:avoid}
.coa-scope-box h3{font-family:Poppins,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:var(--navy);text-transform:uppercase;margin-bottom:10px}
.coa-scope-list{margin:0;padding-left:20px;font-size:12.5px;color:#334155;line-height:1.7}
.coa-scope-list li{margin-bottom:6px}
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
.coa-legal{font-size:10px;line-height:1.5;color:var(--muted);margin-top:20px;text-align:justify;border-top:1px dashed var(--line);padding-top:10px}
.stamp{position:absolute;top:320px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap}
.stamp.accepted{color:rgba(16,185,129,.14)}
.stamp.revoked{color:rgba(220,38,38,.14)}
.stamp.pending{color:rgba(255,106,19,.12)}
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

export function buildAcceptanceCertificateHtml(coa, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = certificateNumberFor(coa);
  const status = (coa.status || '').toLowerCase();
  const isAccepted = status === 'accepted' || Boolean(signatures.acceptor || coa.signeeName);
  const isRevoked = status === 'revoked' || status === 'void';

  const stamp = isAccepted ? '<div class="stamp accepted">ACCEPTED</div>' :
    isRevoked ? '<div class="stamp revoked">REVOKED</div>' :
      '<div class="stamp">PENDING</div>';

  const pill = isAccepted ? '<span class="coa-pill accepted"><i></i>ACCEPTED &amp; TURNED OVER</span>' :
    '<span class="coa-pill pending"><i></i>PENDING ACCEPTANCE</span>';

  const providerName = coa.providerName || BRAND_CO.approvedBy;
  const clientName = coa.clientName || coa.signeeName || '';
  const clientBusiness = coa.clientBusiness || 'Valued Client';
  const projectName = coa.projectName || 'Digital Engineering Project';
  const turnoverDate = coa.turnoverDate || coa.createdAt || '';

  // Resolve signers configuration
  let signersList = [];
  if (coa.signers && Object.keys(coa.signers).length) {
    signersList = Object.entries(coa.signers)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } else {
    // Default 2-slot signers for legacy certificates
    signersList = [
      { id: 's1', kind: 'turnover', name: providerName, title: 'Engineering & Executive Lead', order: 1 },
      { id: 's2', kind: 'acceptor', name: clientName || 'Client Representative', title: coa.signeeTitle || 'Authorized Representative', order: 2 },
    ];
  }

  // Render Body Content (TipTap JSON or Fallback/Legacy)
  let contentHtml = '';
  if (coa.bodyJson) {
    try {
      const parsed = renderDocJson(JSON.parse(coa.bodyJson));
      contentHtml = parsed.main;
      if (parsed.annexes && parsed.annexes.length) {
        contentHtml += parsed.annexes.map(a => `
          <div class="coa-annex">
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
    const defaultDesc = `This Certificate of Completion and Acceptance is formally issued to certify that <strong>${esc(coa.providerBusiness || BRAND_CO.name)}</strong> has successfully engineered, configured, and turned over the software deliverables for <strong>${esc(projectName)}</strong>. The Client has inspected, tested, and verified the project deliverables and hereby accepts the system as complete and conforming to agreed specifications.`;

    const scope = coa.scope || [];
    const scopeHtml = scope.length > 0 ? `
      <div class="coa-scope-box">
        <h3>Verified Project Deliverables &amp; System Scope</h3>
        <ul class="coa-scope-list">
          ${scope.map(s => `<li>${esc(s)}</li>`).join('')}
        </ul>
      </div>
    ` : `
      <div class="coa-scope-box">
        <h3>Verified Project Deliverables &amp; System Scope</h3>
        <p style="font-size:12.5px;color:#334155;margin:0;">This turnover covers the <strong>${esc(projectName)}</strong> platform in its entirety, encompassing all system modules, underlying databases, security integrations, and production deployment environments.</p>
      </div>
    `;

    contentHtml = `
      <div class="coa-cert-text">
        ${coa.customText ? esc(coa.customText) : defaultDesc}
      </div>
      ${scopeHtml}
    `;
  }

  // Render Signers
  const signersHtml = `
    <div class="signers">
      ${signersList.map(s => {
        const sig = signatures[s.id] ||
          (s.kind === 'turnover' && (signatures.issuer || (coa.providerSigned ? {
            name: coa.providerSigneeName || providerName,
            signedAt: coa.providerSignedAt?.toDate?.()?.toISOString() || coa.providerSignedAt || coa.createdAt,
          } : {
            name: providerName,
            signedAt: coa.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          }))) ||
          (s.kind === 'acceptor' && (signatures.acceptor || (isAccepted ? {
            name: coa.signeeName || clientName,
            signedAt: coa.acceptedAt?.toDate?.()?.toISOString() || coa.acceptedAt || new Date().toISOString(),
          } : null)));
        return signerBlock(s, sig, timeZone);
      }).join('')}
    </div>
  `;

  const body = `
    ${stamp}
    <dl class="coa-grid">
      <dt>Client Partner</dt><dd class="party">${esc(clientBusiness)}</dd>
      <dt>Project Name</dt><dd class="full">${esc(projectName)}</dd>
      <dt>Turnover Date</dt><dd>${longDate(turnoverDate) || esc(turnoverDate || '—')}</dd>
      <dt>Status</dt><dd>${pill}</dd>
      <dt>Representative</dt><dd class="full">${esc(clientName || 'Authorized Signer')}</dd>
    </dl>

    ${contentHtml}

    ${signersHtml}

    <div class="coa-legal">
      By signing this document, the Client Partner certifies full functional acceptance of the designated software deliverables and acknowledges the official commencement of warranty support.
    </div>
  `;

  const verify = coa.id ? `Verify: ${origin.replace(/^https?:\/\//, '')}/acceptance/${coa.id}` : `${BRAND_CO.name} · Certificate of Acceptance`;
  const footRight = `Certificate ${number}`;

  let html = brandPage({
    title: 'CERTIFICATE OF ACCEPTANCE',
    numberLabel: 'CERTIFICATE NO.',
    number,
    body,
    footLeft: verify,
    footRight,
    extraCss: ACCEPTANCE_CSS,
    origin,
    autoPrint,
  });

  html = html
    .replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet"></head>')
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(projectName)} Acceptance</title>`);

  return html;
}
