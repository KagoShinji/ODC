// Certificate of Acceptance (COA): formal project handover and completion certificate
// between OdysseyPH IT Solutions and Client Partners.
// Strictly adheres to the company Brand Bible and uses brandPage().

import { BRAND_CO, esc, longDate, brandPage } from './brandDocument.js';

export const normalizeSignerName = value => (value || '').trim().replace(/\s+/g, ' ');

export function certificateNumberFor(coa) {
  const num = coa?.certificateNumber || '';
  if (/^COA-/.test(num)) return num;
  if (num) return `COA-${num.replace(/^[^a-zA-Z0-9]+/, '')}`;
  const id = coa?.id || '';
  return id ? `COA-${id.replace(/^cert_?/, '').slice(0, 8).toUpperCase()}` : 'COA-DRAFT';
}

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
.coa-scope-box{margin:18px 0;padding:16px 20px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;break-inside:avoid}
.coa-scope-box h3{font-family:Poppins,sans-serif;font-size:12px;font-weight:700;letter-spacing:1.5px;color:var(--navy);text-transform:uppercase;margin-bottom:10px}
.coa-scope-list{margin:0;padding-left:20px;font-size:12.5px;color:#334155;line-height:1.7}
.coa-scope-list li{margin-bottom:6px}
.coa-legal{font-size:10px;line-height:1.5;color:var(--muted);margin-top:20px;text-align:justify;border-top:1px dashed var(--line);padding-top:10px}
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
.stamp.accepted{color:rgba(16,185,129,.14)}
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

export function buildAcceptanceCertificateHtml(coa, signatures = {}, { origin = (typeof window !== 'undefined' ? window.location.origin : ''), timeZone = 'Asia/Manila', autoPrint = false } = {}) {
  const number = certificateNumberFor(coa);
  const isAccepted = coa.status === 'Accepted' || Boolean(signatures.acceptor || coa.signeeName);

  const stamp = isAccepted ? '<div class="stamp accepted">ACCEPTED</div>' :
                '<div class="stamp">PENDING</div>';

  const pill = isAccepted ? '<span class="coa-pill accepted"><i></i>ACCEPTED &amp; TURNED OVER</span>' :
               '<span class="coa-pill pending"><i></i>PENDING ACCEPTANCE</span>';

  const providerName = coa.providerName || BRAND_CO.approvedBy;
  const clientName = coa.clientName || coa.signeeName || '';
  const clientBusiness = coa.clientBusiness || 'Valued Client';
  const projectName = coa.projectName || 'Digital Engineering Project';
  const turnoverDate = coa.turnoverDate || coa.createdAt || '';

  const issuerSig = signatures.issuer || (coa.providerSigned ? {
    name: coa.providerSigneeName || providerName,
    signedAt: coa.providerSignedAt?.toDate?.()?.toISOString() || coa.providerSignedAt || coa.createdAt,
  } : {
    name: providerName,
    signedAt: coa.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  });

  const acceptorSig = signatures.acceptor || (isAccepted ? {
    name: coa.signeeName || clientName,
    signedAt: coa.acceptedAt?.toDate?.()?.toISOString() || coa.acceptedAt || new Date().toISOString(),
  } : null);

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

  const signers = `
    <div class="signers">
      ${signerBlock('Turned Over by (Service Provider)', providerName, 'Engineering & Executive Lead', issuerSig, timeZone)}
      ${signerBlock('Accepted & Conforme (Client Partner)', clientName || 'Client Representative', coa.signeeTitle || 'Authorized Representative', acceptorSig, timeZone)}
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

    <div class="coa-cert-text">
      ${coa.customText ? esc(coa.customText) : defaultDesc}
    </div>

    ${scopeHtml}

    ${signers}

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
