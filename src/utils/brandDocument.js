// Shared brand-bible shell for printable documents (acknowledgement receipts, payslips):
// company header with the ODC mark, navy title band, footer bar, and formatting helpers.

export const BRAND_CO = {
  name: 'OdysseyPH IT Solutions',
  address: '3F Roxas Building, N. Bacalso National Road, Lawaan 3, Talisay City, Cebu',
  email: 'odysseyphitsolutions@gmail.com',
  phone: '0909 985 5322',
  site: 'odysseyph.com',
  approvedBy: 'Jetch Merald S. Madaya',
};

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const longDate = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
export const monthLabel = (ym) => ym ? new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '';

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION'];

function under1000(n) {
  const words = [];
  if (n >= 100) { words.push(ONES[Math.floor(n / 100)], 'HUNDRED'); n %= 100; }
  if (n >= 20) { words.push(TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')); }
  else if (n > 0) words.push(ONES[n]);
  return words.join(' ');
}

// 27507.81 -> "TWENTY-SEVEN THOUSAND FIVE HUNDRED SEVEN PESOS AND 81/100"
export function amountInWords(amount) {
  const cents = Math.round(Number(amount || 0) * 100);
  let pesos = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts = [];
  for (let i = 0; pesos > 0; i++, pesos = Math.floor(pesos / 1000)) {
    const chunk = pesos % 1000;
    if (chunk) parts.unshift(under1000(chunk) + (SCALES[i] ? ' ' + SCALES[i] : ''));
  }
  return `${parts.join(' ') || 'ZERO'} PESOS AND ${pad(centavos)}/100`;
}

const BRAND_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--navy:#16273a;--orange:#ff6a13;--ink:#1d2939;--muted:#5b6574;--line:#d9dde3}
body{font-family:Inter,Arial,sans-serif;color:var(--ink);background:#fff;font-size:13px}
.pg{width:816px;min-height:1056px;margin:0 auto;position:relative;display:flex;flex-direction:column;background:#fff}
.hd{display:flex;align-items:center;gap:20px;padding:46px 64px 34px}
.hd img{height:58px;width:auto;display:block}
.co-name{font-family:Poppins,sans-serif;font-weight:700;font-size:19px;letter-spacing:.3px;color:var(--navy);text-transform:uppercase}
.co-line{font-size:11.5px;color:var(--muted);margin-top:4px}
.band{display:flex;align-items:stretch;height:64px}
.band .tab{width:64px;background:var(--orange)}
.band .bar{flex:1;background:var(--navy);display:flex;justify-content:space-between;align-items:center;padding:0 64px 0 28px}
.band h1{font-family:Poppins,sans-serif;color:#fff;font-size:24px;font-weight:700;letter-spacing:1.5px}
.docno{text-align:right}
.docno small{display:block;color:#c4cbd4;font-size:10px;font-weight:700;letter-spacing:1.5px}
.docno b{font-family:Poppins,sans-serif;color:var(--orange);font-size:17px;letter-spacing:.5px}
.body{padding:30px 64px 0;flex:1}
.meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px}
.eyebrow{font-size:10px;font-weight:700;letter-spacing:1.5px;color:#c2410c;text-transform:uppercase}
.party{font-family:Poppins,sans-serif;font-size:19px;font-weight:600;color:var(--navy);margin:8px 0 6px}
.sub{font-size:12px;color:var(--muted)}
.sub b{color:var(--ink)}
.pill{display:inline-flex;align-items:center;gap:7px;background:var(--navy);color:#fff;border-radius:999px;padding:5px 13px;font-size:10px;font-weight:700;letter-spacing:1px;margin-top:12px}
.pill i{width:7px;height:7px;border-radius:50%;background:var(--orange);display:block}
.kv{display:grid;grid-template-columns:120px auto;row-gap:10px;font-size:12px;align-self:flex-start}
.kv dt{color:var(--muted)}
.kv dd{font-weight:700}
.tbl{border:1px solid #3a4a5c;border-radius:10px;overflow:hidden}
table{width:100%;border-collapse:collapse}
th{background:#ebe5dc;font-size:10px;letter-spacing:1.5px;text-align:left;padding:12px 20px;border-bottom:1px solid #3a4a5c}
td{padding:14px 20px;border-top:1px solid var(--line);font-size:13px}
tbody tr:first-child td{border-top:none}
.ar{text-align:right}
.muted{color:var(--muted)}
.tot{background:var(--navy);display:flex;justify-content:flex-end;align-items:center;gap:80px;padding:14px 20px}
.tot span{color:#fff;font-size:12px;font-weight:700;letter-spacing:1.5px}
.tot b{font-family:Poppins,sans-serif;color:var(--orange);font-size:23px;font-weight:800}
.note{margin-top:24px;background:#f8f6f2;border:1px solid #ebe7e0;border-radius:10px;padding:20px 24px}
.note .eyebrow{color:var(--navy);display:flex;align-items:center;gap:12px;margin-bottom:12px}
.note .eyebrow:before{content:'';width:22px;height:3px;background:var(--orange);display:block}
.note p{line-height:1.7;font-size:12.5px}
.via{display:flex;flex-wrap:wrap;gap:8px 32px;border-top:1px solid #e6e1d8;margin-top:14px;padding-top:12px;font-size:12px;color:#3d4756}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:64px;margin:84px 0 40px}
.sigs .eyebrow{color:var(--navy)}
.sig-line{border-bottom:1px solid #3a4a5c;margin:36px 0 10px}
.sig-mark + .sig-line{margin-top:0}
.sig-name{font-family:Poppins,sans-serif;font-size:14px;font-weight:600;color:var(--navy)}
.sig-tag{font-size:9.5px;font-weight:700;letter-spacing:1px;color:#c2410c;margin-top:4px}
.sig-date{font-size:11px;color:var(--muted);margin-top:3px}
.ft{display:flex;justify-content:space-between;border-top:1px solid var(--line);padding:14px 64px;font-size:10px;color:var(--muted)}
.foot-bar{display:flex;height:6px}.foot-bar i{width:64px;background:var(--orange)}.foot-bar b{flex:1;background:var(--navy)}
@page{size:letter;margin:0}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media screen and (max-width:840px){.pg{width:100%;min-height:0}.hd,.body,.ft{padding-left:20px;padding-right:20px}.band .bar{padding:0 20px}.band .tab{width:16px}.band h1{font-size:15px}.meta{flex-direction:column}.tot{gap:20px}.sigs{grid-template-columns:1fr;gap:12px;margin:40px 0}}
`;

// Wraps document body markup in the branded page: header, title band, footer.
export function brandPage({ title, numberLabel, number, body, footLeft, footRight, extraCss = '', origin = window.location.origin, autoPrint = false }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(number)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${BRAND_CSS}${extraCss}</style></head><body>
<div class="pg">
  <div class="hd">
    <img src="${origin}/brand/odc-mark.svg" alt="ODC">
    <div>
      <div class="co-name">${esc(BRAND_CO.name)}</div>
      <div class="co-line">${esc(BRAND_CO.address)}</div>
      <div class="co-line">${esc(BRAND_CO.email)} · ${esc(BRAND_CO.phone)} · ${esc(BRAND_CO.site)}</div>
    </div>
  </div>
  <div class="band"><div class="tab"></div><div class="bar">
    <h1>${esc(title)}</h1>
    <div class="docno"><small>${esc(numberLabel)}</small><b>${esc(number)}</b></div>
  </div></div>
  <div class="body">${body}</div>
  <div class="ft"><span>${esc(footLeft)}</span><span>${esc(footRight)}</span></div>
  <div class="foot-bar"><i></i><b></b></div>
</div>
${autoPrint ? '<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})</script>' : ''}
</body></html>`;
}

// Pass a window opened synchronously in the click handler when printing after an await,
// otherwise popup blockers (Safari especially) return null.
export function openPrintWindow(html, target) {
  const w = target || window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
