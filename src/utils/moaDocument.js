// Memorandum of Agreement (MOA): official binding contract document
// between OdysseyPH IT Solutions and Client Partners.
// Strictly adheres to the company Brand Bible and uses brandPage().

import { BRAND_CO, esc, money, longDate, brandPage } from './brandDocument.js';

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

export function moaNumberFor(moa) {
  const num = moa?.moaNumber || '';
  if (/^MOA-/.test(num)) return num;
  if (num) return `MOA-${num.replace(/^[^a-zA-Z0-9]+/, '')}`;
  const id = moa?.id || '';
  return id ? `MOA-${id.replace(/^moa_?/, '').slice(0, 8).toUpperCase()}` : 'MOA-DRAFT';
}

const MOA_CSS = `
.pg{break-after:page;position:relative}
.pg:last-child{break-after:auto}
.moa-intro{font-size:12.5px;line-height:1.7;color:#334155;margin-bottom:20px;text-align:justify}
.moa-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;break-inside:avoid}
.moa-party-card{padding:14px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc}
.moa-party-card.provider{border-left:4px solid var(--orange)}
.moa-party-card.client{border-left:4px solid var(--navy)}
.moa-party-role{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.moa-party-card.provider .moa-party-role{color:var(--orange)}
.moa-party-card.client .moa-party-role{color:var(--navy)}
.moa-party-name{font-family:Poppins,sans-serif;font-size:14.5px;font-weight:700;color:var(--navy);margin-bottom:4px}
.moa-party-details{font-size:12px;line-height:1.5;color:#475569}
.moa-sec{margin-bottom:20px}
.moa-sec h2{font-family:Poppins,sans-serif;font-size:13.5px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:10px;margin-bottom:8px;break-after:avoid}
.moa-sec h2 span{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:6px;background:var(--orange);color:#fff;font-size:11px}
.moa-sec p{font-size:12.3px;line-height:1.65;color:#1e293b;margin:0 0 8px;text-align:justify}
.moa-scope-group{margin:10px 0 14px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;break-inside:avoid}
.moa-scope-title{font-size:12.5px;font-weight:700;color:var(--navy);margin-bottom:6px}
.moa-scope-list{margin:0;padding-left:20px;font-size:12px;color:#334155;line-height:1.6}
.moa-scope-list li{margin-bottom:4px}
.moa-freeform{font-size:12.3px;line-height:1.7;color:#1e293b;white-space:pre-wrap;text-align:justify}
.signers{display:grid;grid-template-columns:1fr 1fr;gap:28px 56px;margin:32px 0 16px;break-inside:avoid}
.signer .eyebrow{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--navy);text-transform:uppercase}
.sig-mark{font-family:'Great Vibes',cursive;font-size:30px;line-height:1;color:#111;height:40px;margin-top:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sig-mark.empty{height:40px}
.signer .sig-line{margin:0 0 8px;border-bottom:1px solid #3a4a5c}
.sig-name{font-weight:700;font-size:12.5px;color:var(--navy)}
.sig-name.blank{color:var(--muted);font-weight:500;font-style:italic}
.sig-tag{font-size:10px;color:var(--muted);letter-spacing:1px;margin-top:2px}
.sig-meta{font-size:9px;color:var(--muted);margin-top:3px;line-height:1.4}
.stamp{position:absolute;top:320px;left:50%;transform:translateX(-50%) rotate(-18deg);font-family:Poppins,sans-serif;font-size:110px;font-weight:800;letter-spacing:8px;color:rgba(22,39,58,.07);pointer-events:none;white-space:nowrap}
.stamp.executed{color:rgba(16,185,129,.14)}
.stamp.void{color:rgba(220,38,38,.14)}
@media screen and (max-width:840px){.pg{width:816px;min-height:1056px}.hd,.body,.ft{padding-left:64px;padding-right:64px}.band .bar{padding:0 64px 0 28px}.band .tab{width:64px}.band h1{font-size:24px}}
`;

function signerBlock(roleTitle, defaultName, defaultTitle, signature, timeZone) {
  const name = signature?.name || defaultName;
  const signed = signature
    ? `<div class="sig-mark">${esc(signature.name)}</div>`
    : '<div class="sig-mark empty"></div>';
  const meta = signature
    ? `<div class="sig-meta">Signed electronically ${esc(new Date(signature.signedAt).toLocaleString('en-PH', { timeZone, dateStyle: 'medium', timeStyle: 'short' }))}</div>`
    : '<div class="sig-meta">Pending Sign-off</div>';

  return `<div class="signer">
    <div class="eyebrow">${esc(roleTitle)}</div>
    ${signed}
    <div class="sig-line"></div>
    ${name ? `<div class="sig-name">${esc(name)}</div>` : '<div class="sig-name blank">Authorized Signature</div>'}
    <div class="sig-tag">${esc((defaultTitle || '').toUpperCase())}</div>
    ${meta}
  </div>`;
}

export function buildMoaHtml(moa, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = moaNumberFor(moa);
  const isExecuted = moa.status === 'Executed' || (moa.providerSigned && moa.clientSigned) || (signatures.provider && signatures.client);
  const isVoid = moa.status === 'Void' || moa.status === 'Cancelled';

  const stamp = isExecuted ? '<div class="stamp executed">EXECUTED</div>' :
                isVoid ? '<div class="stamp void">VOID</div>' :
                '<div class="stamp">DRAFT</div>';

  const providerName = moa.providerName || moa.providerSigneeName || BRAND_CO.approvedBy;
  const clientName = moa.clientName || moa.clientSigneeName || '';
  const clientBusiness = moa.clientBusiness || '';

  // Resolve signatures from subcollection or legacy document fields
  const providerSig = signatures.provider || (moa.providerSigned ? {
    name: moa.providerSigneeName || providerName,
    signedAt: moa.providerSignedAt?.toDate?.()?.toISOString() || moa.providerSignedAt || moa.createdAt,
  } : null);

  const clientSig = signatures.client || (moa.clientSigned ? {
    name: moa.clientSigneeName || clientName,
    signedAt: moa.clientSignedAt?.toDate?.()?.toISOString() || moa.clientSignedAt || moa.updatedAt,
  } : null);

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

  let contentHtml = '';
  if (moa.isFreeform && moa.freeformContent) {
    contentHtml = `<div class="moa-freeform">${esc(moa.freeformContent)}</div>`;
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

  const signersHtml = `
    <div class="signers">
      ${signerBlock('For Party B (Service Provider)', providerName, moa.providerSigneeTitle || 'Engineering & Executive Lead', providerSig, timeZone)}
      ${signerBlock('For Party A (Client)', clientName, moa.clientSigneeTitle || 'Authorized Representative', clientSig, timeZone)}
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
    .replace(/<title>.*?<\/title>/, `<title>${esc(number)} — ${esc(clientBusiness || 'Memorandum of Agreement')}</title>`);

  return html;
}
