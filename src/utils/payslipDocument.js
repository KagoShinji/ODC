// Payslip: generated from a salaryPayouts record when staff are paid.
// Payslip numbers are the tracking number: PS-<payroll month>-<sequence>, e.g. PS-2026-10-003.
import { BRAND_CO, esc, money, longDate, monthLabel, amountInWords, brandPage, openPrintWindow } from './brandDocument';

// Next sequence for the payroll month, from the highest number already issued that month.
export function nextPayslipNumber(payouts, month) {
  const prefix = `PS-${month}-`;
  const max = payouts.reduce((m, p) => {
    const n = (p.payslipNumber || '').startsWith(prefix) ? parseInt(p.payslipNumber.slice(prefix.length), 10) : 0;
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// Payouts recorded before payslips existed have no stored number.
export const payslipNumberOf = (p) => p.payslipNumber || `PS-${p.month}-${(p.id || '').slice(0, 4).toUpperCase()}`;

const line = (label, amount, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="ar">${amount}</td></tr>`;

export function buildPayslipHtml(p, { origin, autoPrint = false } = {}) {
  const number = payslipNumberOf(p);
  const base = Number(p.baseSalary || 0);
  const bonus = Number(p.bonus || 0);
  const deductions = Number(p.deductions || 0);
  const gross = base + bonus;
  const net = Number(p.netPaid ?? gross - deductions);
  const period = monthLabel(p.month);

  const rows = [
    `<tr class="group"><td colspan="2">EARNINGS</td></tr>`,
    line('Basic Salary <span class="muted">(Monthly)</span>', money(base)),
    bonus ? line('Bonus / Allowances', money(bonus)) : '',
    line('<b>Gross Pay</b>', `<b>${money(gross)}</b>`, 'subtotal'),
    `<tr class="group"><td colspan="2">DEDUCTIONS</td></tr>`,
    deductions ? line('Deductions', `(${money(deductions)})`) : line('<span class="muted">No deductions</span>', money(0)),
    line('<b>Total Deductions</b>', `<b>${deductions ? `(${money(deductions)})` : money(0)}</b>`, 'subtotal'),
  ].join('');

  const via = [
    `<span>Paid via <b>${esc(p.paymentMethod || '—')}</b></span>`,
    p.referenceNumber ? `<span>Reference no. <b>${esc(p.referenceNumber)}</b></span>` : '',
  ].join('');

  const body = `
    <div class="meta">
      <div>
        <div class="eyebrow">Employee</div>
        <div class="party">${esc(p.staffName)}</div>
        ${p.role ? `<div class="sub">Position: <b>${esc(p.role)}</b></div>` : ''}
        <div class="pill"><i></i>PAID</div>
      </div>
      <dl class="kv">
        <dt>Pay Period</dt><dd>${esc(period)}</dd>
        <dt>Pay Date</dt><dd>${longDate(p.paidAt)}</dd>
        <dt>Payment Method</dt><dd>${esc(p.paymentMethod || '—')}</dd>
        ${p.referenceNumber ? `<dt>Reference No.</dt><dd>${esc(p.referenceNumber)}</dd>` : ''}
      </dl>
    </div>
    <div class="tbl">
      <table><thead><tr><th>DESCRIPTION</th><th class="ar">AMOUNT (&#8369;)</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><span>NET PAY</span><b>&#8369; ${money(net)}</b></div>
    </div>
    <div class="note">
      <div class="eyebrow">Payment summary</div>
      <p>OdysseyPH IT Solutions has paid <b>${esc(p.staffName)}</b> a net amount of <b>${amountInWords(net)} (&#8369;${money(net)})</b> as salary for the period of <b>${esc(period)}</b>.</p>
      ${p.notes ? `<p class="muted" style="margin-top:8px">${esc(p.notes)}</p>` : ''}
      <div class="via">${via}</div>
    </div>
    <div class="sigs">
      <div><div class="eyebrow">Approved by</div><div class="sig-line"></div>
        <div class="sig-name">${esc(p.approvedBy || BRAND_CO.approvedBy)}</div><div class="sig-tag">DIGITALLY APPROVED &amp; SIGNED</div><div class="sig-date">${longDate(p.paidAt)}</div></div>
      <div><div class="eyebrow">Received by</div><div class="sig-line"></div>
        <div class="sig-name">${esc(p.staffName)}</div><div class="sig-tag">SIGNATURE OVER PRINTED NAME</div><div class="sig-date">Date: ____________________</div></div>
    </div>`;

  return brandPage({
    title: 'PAYSLIP',
    numberLabel: 'PAYSLIP NO.',
    number,
    body,
    footLeft: 'Confidential. For the named employee only.',
    footRight: `${period} · ${number}`,
    extraCss: `
      tr.group td{background:#f8f6f2;font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--navy);padding:9px 20px}
      tr.subtotal td{background:#fbfaf7}
      .sigs{margin-top:64px}`,
    origin,
    autoPrint,
  });
}

export const printPayslip = (p, target) => openPrintWindow(buildPayslipHtml(p, { autoPrint: true }), target);
