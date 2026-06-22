import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
// eslint-disable-next-line no-unused-vars
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Plus, X, Trash2, Printer, Edit2, RefreshCw, CheckCircle2, Clock, Eye, CreditCard, DollarSign, TrendingUp, TrendingDown, FileText, ArrowDownRight, ArrowUpRight, Briefcase, Copy, Check, Award, PenTool } from 'lucide-react';
import CustomModal from '../components/ui/CustomModal';

const CO = {
  address: '3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City',
  email: 'odysseyclinsys1@gmail.com',
  phone: '09930050994 / 08099855322',
  preparedBy: 'Johnjosefir Roca',
  approvedBy: 'Jetch Merald S. Madaya',
  approvedPhone: '0909-985-5322',
  bankName: 'GoTyme',
  bankAccount: '012267894321',
  bankAccountName: 'Johnjosefir Roca',
};

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

const EXPENSE_CATEGORIES = [
  'Salaries',
  'Rent & Utilities',
  'Software & Subscriptions',
  'Marketing & Advertising',
  'Equipment & Supplies',
  'Other',
];

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (s) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }); };
const fmtDateTimeLong = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getSigFontSizePrint = (name) => {
  const len = (name || '').length;
  if (len > 25) return '14px';
  if (len > 20) return '16px';
  if (len > 15) return '19px';
  return '24px';
};
const calcTotal = (items) => (items || []).reduce((s, i) => s + Number(i.amount || 0), 0);

function printInvoice(inv) {
  const total = calcTotal(inv.items);
  const logoUrl = window.location.origin + '/images/odcclearlogo.png';
  const rows = (inv.items || []).map(i =>
    `<tr><td class="td">${i.service || ''}</td><td class="td ar">${fmt(i.amount)}</td></tr>`
  ).join('');

  const preparedSection = inv.preparedSigned ? `
    <div style="font-family: 'Great Vibes', cursive; font-size: ${getSigFontSizePrint(inv.preparedSigneeName || inv.preparedBy || CO.preparedBy)}; color: #111; text-align: center; margin-top: 10px; min-height: 28px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${inv.preparedSigneeName || inv.preparedBy || CO.preparedBy}</div>
    <div class="sig" style="border-bottom: 1px solid #333; margin-top: 4px;"></div>
    <div style="font-size: 8px; color: #777; text-align: center; margin-top: 4px; line-height: 1.3;">
      DIGITALLY PREPARED & SIGNED<br>
      Date: ${fmtDateTimeLong(inv.preparedSignedAt)}
    </div>
  ` : `
    <div class="sig-block" style="text-align:center;margin-top:32px;margin-bottom:2px">${inv.preparedBy || CO.preparedBy}</div>
    <div class="sig" style="border-bottom: 1px solid #333; margin-top: 4px;"></div>
  `;

  const approvedSection = inv.approvedSigned ? `
    <div style="font-family: 'Great Vibes', cursive; font-size: ${getSigFontSizePrint(inv.approvedSigneeName || CO.approvedBy)}; color: #111; text-align: center; margin-top: 10px; min-height: 28px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${inv.approvedSigneeName || CO.approvedBy}</div>
    <div class="sig" style="border-bottom: 1px solid #333; margin-top: 4px;"></div>
    <div style="font-size: 8px; color: #777; text-align: center; margin-top: 4px; line-height: 1.3;">
      DIGITALLY APPROVED & SIGNED<br>
      Date: ${fmtDateTimeLong(inv.approvedSignedAt)}
    </div>
  ` : `
    <div class="sig-block" style="text-align:center;margin-top:32px;margin-bottom:2px">${CO.approvedBy}</div>
    <div class="sig" style="border-bottom: 1px solid #333; margin-top: 4px;"></div>
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${inv.invoiceNumber}</title>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
  <style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#333;background:#fff}
.pg{width:794px;min-height:1100px;padding:50px 60px;margin:0 auto}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
.logo img{height:80px;width:auto;display:block}
.ci{text-align:right;line-height:1.9;color:#555;font-size:11px}
.ci a{color:#e85d04}
.ttl{text-align:center;font-size:20px;font-weight:700;letter-spacing:5px;padding:10px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:20px 0}
.det{line-height:2;margin-bottom:22px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#f0f0f0;padding:10px 14px;font-size:11px;letter-spacing:1px;border:1px solid #ccc;text-align:center}
.td{padding:10px 14px;border:1px solid #ccc}
.ar{text-align:right}
.sub-row td{border-top:2px solid #ccc;font-weight:600}
.tot{text-align:right;font-size:22px;font-weight:700;margin:16px 0 24px}
.pi{margin-bottom:28px;line-height:1.8}
.ft{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;padding-top:20px;border-top:1px solid #ddd}
.sig{border-bottom:1px solid #333;margin-top:4px}
.sig-block{text-align:center;margin-top:32px;margin-bottom:2px}
.qr-row{display:flex;gap:40px;justify-content:center;margin-top:32px;padding-top:20px;border-top:1px solid #eee}
.qr-item{text-align:center}
.qr-item img{width:160px;height:160px;display:block;padding:10px;background:#fff;border:1px solid #ddd;border-radius:8px;image-rendering:crisp-edges}
.qr-label{font-size:12px;font-weight:700;color:#444;margin-top:8px;letter-spacing:0.5px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="pg">
  <div class="hd">
    <div class="logo"><img src="${logoUrl}" alt="ODC" /></div>
    <div class="ci">${CO.address}<br><a href="mailto:${CO.email}">${CO.email}</a><br>${CO.phone}</div>
  </div>
  <div class="ttl">INVOICE</div>
  <div class="det">
    <div><b>Invoice #:</b> ${inv.invoiceNumber || ''}</div>
    <div><b>Date:</b> ${fmtDate(inv.date)}</div>
    <div><b>Bill To:</b> ${inv.billTo || ''}</div>
    <div><b>Project:</b> ${inv.project || ''}</div>
    <div><b>Payment Terms:</b> ${inv.paymentTerms || ''}</div>
  </div>
  <table>
    <thead><tr><th style="width:70%">SERVICE</th><th style="width:30%">AMOUNT</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="sub-row"><td class="td"></td><td class="td ar">${fmt(total)}</td></tr></tfoot>
  </table>
  <div class="tot">Total Due: &#8369; ${fmt(total)}</div>
  <div class="pi"><b>Payment Instruction:</b><br>
    &nbsp;&nbsp;We kindly request that the payment be prepared either in cash or through a check payable to <b>${CO.approvedBy}</b>, or via bank transfer.
  </div>
  <div class="ft">
    <div><b>Payment Information:</b><br><br>Bank Name: ${CO.bankName}<br>Account No.: ${CO.bankAccount}<br>Account Name: ${CO.bankAccountName}<br><br>Contact Name: ${CO.approvedBy}<br>Number: ${CO.approvedPhone}</div>
    <div><b>Prepared By:</b><br>${preparedSection}</div>
    <div><b>Approved By:</b><br>${approvedSection}</div>
  </div>
  ${(inv.qrCodes || []).length > 0 ? `
  <div class="qr-row">
    ${(inv.qrCodes || []).includes('gotyme') ? `<div class="qr-item"><img src="${window.location.origin}/images/jetchgotyme.png" alt="GoTyme QR" /><div class="qr-label">GoTyme — Scan to Pay</div></div>` : ''}
    ${(inv.qrCodes || []).includes('maribank') ? `<div class="qr-item"><img src="${window.location.origin}/images/jetchmaribank.png" alt="MariBank QR" /><div class="qr-label">MariBank — Scan to Pay</div></div>` : ''}
  </div>` : ''}
</div>
<script>
  document.fonts.ready.then(function() {
    setTimeout(function() {
      window.print();
    }, 250);
  });
</script>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

function printFinancialReport(invoices, expenses, scope = 'overall', scopeValue = '', preparedBy = CO.preparedBy) {
  let paidInvs = invoices.filter(i => i.status === 'paid');
  let paidExps = expenses.filter(e => e.status === 'paid');
  
  let reportTitle = 'SHAREHOLDER FINANCIAL REPORT';
  let scopeSubtitle = 'All-Time Performance';
  
  if (scope === 'yearly') {
    paidInvs = paidInvs.filter(i => (i.date || '').startsWith(scopeValue));
    paidExps = paidExps.filter(e => (e.date || '').startsWith(scopeValue));
    reportTitle = `YEARLY SHAREHOLDER FINANCIAL REPORT - ${scopeValue}`;
    scopeSubtitle = `Yearly Performance for Calendar Year ${scopeValue}`;
  } else if (scope === 'monthly') {
    paidInvs = paidInvs.filter(i => (i.date || '').startsWith(scopeValue));
    paidExps = paidExps.filter(e => (e.date || '').startsWith(scopeValue));
    const [yr, mo] = scopeValue.split('-');
    const d = new Date(Number(yr), Number(mo) - 1, 1);
    const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    reportTitle = `MONTHLY SHAREHOLDER FINANCIAL REPORT - ${monthName.toUpperCase()}`;
    scopeSubtitle = `Monthly Performance for ${monthName}`;
  }
  
  const totalRevenue = paidInvs.reduce((s, i) => s + (i.total || 0), 0);
  const totalExpenses = paidExps.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  // Group expenses by category
  const catTotals = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = paidExps.filter(e => e.category === cat).reduce((sum, e) => sum + (e.amount || 0), 0);
    return acc;
  }, {});
  
  const logoUrl = window.location.origin + '/images/odcclearlogo.png';
  
  // Group by month
  const monthlyMap = {};
  paidInvs.forEach(inv => {
    const ym = (inv.date || '').substring(0, 7);
    if (ym) {
      if (!monthlyMap[ym]) monthlyMap[ym] = { revenue: 0, expenses: 0 };
      monthlyMap[ym].revenue += (inv.total || 0);
    }
  });
  paidExps.forEach(exp => {
    const ym = (exp.date || '').substring(0, 7);
    if (ym) {
      if (!monthlyMap[ym]) monthlyMap[ym] = { revenue: 0, expenses: 0 };
      monthlyMap[ym].expenses += (exp.amount || 0);
    }
  });
  const monthlyRows = Object.keys(monthlyMap)
    .sort((a, b) => b.localeCompare(a))
    .map(ym => {
      const [year, month] = ym.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const rev = monthlyMap[ym].revenue;
      const exp = monthlyMap[ym].expenses;
      const net = rev - exp;
      return `<tr>
        <td class="td">${monthName}</td>
        <td class="td ar">&#8369; ${fmt(rev)}</td>
        <td class="td ar">&#8369; ${fmt(exp)}</td>
        <td class="td ar ${net >= 0 ? 'pos' : 'neg'}">&#8369; ${fmt(net)}</td>
      </tr>`;
    }).join('');
    
  // Category breakdown rows
  const catRows = EXPENSE_CATEGORIES.map(cat => {
    const amt = catTotals[cat] || 0;
    const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
    return `<tr>
      <td class="td">${cat}</td>
      <td class="td ar">&#8369; ${fmt(amt)}</td>
      <td class="td ar">${pct.toFixed(1)}%</td>
    </tr>`;
  }).join('');
  
  let middleSection = '';
  
  if (scope === 'monthly') {
    // Combine paid invoices and paid expenses into a single ledger list
    const ledger = [];
    paidInvs.forEach(inv => {
      ledger.push({
        date: inv.date,
        type: 'Revenue (Invoice)',
        desc: `${inv.billTo} - ${inv.project} (${inv.invoiceNumber})`,
        category: 'Invoiced Service',
        revenue: inv.total || 0,
        expense: 0
      });
    });
    paidExps.forEach(exp => {
      ledger.push({
        date: exp.date,
        type: 'Expense',
        desc: exp.title,
        category: exp.category,
        revenue: 0,
        expense: exp.amount || 0
      });
    });
    
    // Sort by date ascending
    ledger.sort((a, b) => a.date.localeCompare(b.date));
    
    const ledgerRows = ledger.map(item => `
      <tr>
        <td class="td">${fmtDate(item.date)}</td>
        <td class="td">${item.type}</td>
        <td class="td">${item.desc}</td>
        <td class="td">${item.category}</td>
        <td class="td ar" style="color: #0f9d58">${item.revenue > 0 ? '&#8369; ' + fmt(item.revenue) : '—'}</td>
        <td class="td ar" style="color: #d93025">${item.expense > 0 ? '&#8369; ' + fmt(item.expense) : '—'}</td>
      </tr>
    `).join('');
    
    middleSection = `
      <div class="section-title">Transactional Details</div>
      <table>
        <thead>
          <tr>
            <th style="width:15%">DATE</th>
            <th style="width:15%">TYPE</th>
            <th style="width:30%">DESCRIPTION</th>
            <th style="width:15%">CATEGORY</th>
            <th style="width:12.5%">REVENUE</th>
            <th style="width:12.5%">EXPENSE</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRows || '<tr><td colspan="6" class="td" style="text-align:center">No transactions recorded for this month.</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="sub-row">
            <td class="td" colspan="4">Total</td>
            <td class="td ar" style="color: #0f9d58">&#8369; ${fmt(totalRevenue)}</td>
            <td class="td ar" style="color: #d93025">&#8369; ${fmt(totalExpenses)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  } else {
    // Show Monthly Operating Performance table for Overall or Yearly reports
    middleSection = `
      <div class="section-title">Monthly Operating Performance</div>
      <table>
        <thead>
          <tr>
            <th style="width:40%">MONTH</th>
            <th style="width:20%">REVENUE</th>
            <th style="width:20%">EXPENSES</th>
            <th style="width:20%">NET PROFIT</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyRows || '<tr><td colspan="4" class="td" style="text-align:center">No monthly transactional data available.</td></tr>'}
        </tbody>
        <tfoot>
          <tr class="sub-row">
            <td class="td">Total</td>
            <td class="td ar">&#8369; ${fmt(totalRevenue)}</td>
            <td class="td ar">&#8369; ${fmt(totalExpenses)}</td>
            <td class="td ar ${netProfit >= 0 ? 'pos' : 'neg'}">&#8369; ${fmt(netProfit)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }
  
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${reportTitle}</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#333;background:#fff}
.pg{width:794px;min-height:1100px;padding:50px 60px;margin:0 auto}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
.logo img{height:80px;width:auto;display:block}
.ci{text-align:right;line-height:1.9;color:#555;font-size:11px}
.ci a{color:#e85d04}
.ttl{text-align:center;font-size:20px;font-weight:700;letter-spacing:5px;padding:10px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:20px 0}
.section-title{font-size:14px;font-weight:700;margin:24px 0 10px;text-transform:uppercase;letter-spacing:1px;color:#222}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:28px}
.stat-card{border:1px solid #ddd;border-radius:8px;padding:16px;text-align:center;background:#fcfcfc}
.stat-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:6px;letter-spacing:0.5px}
.stat-val{font-size:18px;font-weight:700;color:#111}
.stat-val.pos{color:#0f9d58}
.stat-val.neg{color:#d93025}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#f0f0f0;padding:10px 14px;font-size:11px;letter-spacing:1px;border:1px solid #ccc;text-align:center}
.td{padding:8px 12px;border:1px solid #ccc}
.ar{text-align:right}
.pos{color:#0f9d58;font-weight:600}
.neg{color:#d93025;font-weight:600}
.sub-row td{border-top:2px solid #ccc;font-weight:600;background:#fafafa}
.ft{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px;padding-top:20px;border-top:1px solid #ddd}
.sig{border-bottom:1px solid #333;margin-top:4px}
.sig-block{text-align:center;margin-top:32px;margin-bottom:2px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="pg">
  <div class="hd">
    <div class="logo"><img src="${logoUrl}" alt="ODC" /></div>
    <div class="ci">${CO.address}<br><a href="mailto:${CO.email}">${CO.email}</a><br>${CO.phone}</div>
  </div>
  <div class="ttl">${reportTitle}</div>
  <div style="margin-bottom: 24px; color:#555; text-align:center; font-size:11px">
    Scope: <b>${scopeSubtitle}</b><br>
    Prepared on ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
  </div>
  
  <div class="grid-3">
    <div class="stat-card">
      <div class="stat-label">Total Paid Revenue</div>
      <div class="stat-val pos">&#8369; ${fmt(totalRevenue)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Paid Expenses</div>
      <div class="stat-val neg">&#8369; ${fmt(totalExpenses)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Net Profit (Margin)</div>
      <div class="stat-val ${netProfit >= 0 ? 'pos' : 'neg'}">&#8369; ${fmt(netProfit)} (${profitMargin.toFixed(1)}%)</div>
    </div>
  </div>

  ${middleSection}

  <div class="section-title">Expense Breakdown by Category</div>
  <table>
    <thead>
      <tr>
        <th style="width:50%">CATEGORY</th>
        <th style="width:30%">TOTAL AMOUNT</th>
        <th style="width:20%">PERCENTAGE</th>
      </tr>
    </thead>
    <tbody>
      ${catRows}
    </tbody>
    <tfoot>
      <tr class="sub-row">
        <td class="td">Total Expenses</td>
        <td class="td ar">&#8369; ${fmt(totalExpenses)}</td>
        <td class="td ar">100.0%</td>
      </tr>
    </tfoot>
  </table>

  <div class="ft">
    <div><b>Prepared By:</b><br><div class="sig-block">${preparedBy}</div><div class="sig"></div></div>
    <div><b>Approved By:</b><br><div class="sig-block">${CO.approvedBy}</div><div class="sig"></div></div>
  </div>
</div>
<script>
  document.fonts.ready.then(function() {
    setTimeout(function() {
      window.print();
    }, 250);
  });
</script>
</body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

const emptyForm = () => ({ billTo: '', project: '', date: today(), paymentTerms: 'Cash/Bank Transfer', items: [{ id: 1, service: '', amount: '' }], notes: '', qrCodes: ['gotyme', 'maribank'], preparedBy: CO.preparedBy });

const emptyExpenseForm = () => ({ title: '', category: 'Salaries', amount: '', date: today(), payee: '', referenceNumber: '', status: 'paid', notes: '' });

export default function AdminInvoices({ firebaseUser, isSuperAdmin }) {
  // Invoices State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', icon: 'info', promptFields: [], onConfirm: null });

  const showAlert = (title, message, icon = 'info') => {
    setModal({ isOpen: true, title, message, type: 'alert', icon });
  };

  const handleCopyLink = (invId) => {
    const link = `${window.location.origin}/invoice/${invId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(invId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handlePrepareSign = (inv) => {
    setModal({
      isOpen: true,
      title: 'Sign as Preparer',
      message: 'Please enter your signing details:',
      type: 'prompt',
      icon: 'question',
      promptFields: [
        { key: 'name', label: 'Full Name', defaultValue: inv.preparedBy || "Johnjosefir Roca", placeholder: 'e.g. Johnjosefir Roca' },
        { key: 'title', label: 'Title / Designation', defaultValue: 'Odyssey Staff Rep', placeholder: 'e.g. Odyssey Staff Rep' }
      ],
      onConfirm: async (fields) => {
        if (!fields.name || !fields.name.trim()) {
          showAlert('Name Required', 'Full Name is required to sign.', 'warning');
          return;
        }
        try {
          await updateDoc(doc(db, 'invoices', inv.id), {
            preparedSigned: true,
            preparedSigneeName: fields.name.trim(),
            preparedSigneeTitle: fields.title.trim() || 'Odyssey Staff Rep',
            preparedSignedAt: serverTimestamp(),
          });
          load();
        } catch (e) {
          console.error("Error signing prepared invoice:", e);
          showAlert('Signing Error', 'Failed to sign invoice. Please try again.', 'warning');
        }
      }
    });
  };

  const handleApproveSign = (inv) => {
    setModal({
      isOpen: true,
      title: 'Approve & Sign Invoice',
      message: 'Please enter your approval signature details:',
      type: 'prompt',
      icon: 'question',
      promptFields: [
        { key: 'name', label: 'Full Name', defaultValue: CO.approvedBy, placeholder: 'e.g. Jetch Merald S. Madaya' },
        { key: 'title', label: 'Title / Designation', defaultValue: 'Owner, OdysseyPH IT Solutions', placeholder: 'e.g. Owner' }
      ],
      onConfirm: async (fields) => {
        if (!fields.name || !fields.name.trim()) {
          showAlert('Name Required', 'Full Name is required to sign.', 'warning');
          return;
        }
        try {
          await updateDoc(doc(db, 'invoices', inv.id), {
            approvedSigned: true,
            approvedSigneeName: fields.name.trim(),
            approvedSigneeTitle: fields.title.trim() || 'Owner, OdysseyPH IT Solutions',
            approvedSignedAt: serverTimestamp(),
          });
          load();
        } catch (e) {
          console.error("Error signing approved invoice:", e);
          showAlert('Signing Error', 'Failed to approve and sign invoice.', 'warning');
        }
      }
    });
  };
  const [refreshing, setRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [payModal, setPayModal] = useState(null); // { inv }
  const [payMethod, setPayMethod] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payConfirming, setPayConfirming] = useState(false);
  const [viewInv, setViewInv] = useState(null);

  // Expenses State
  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [showExpenseSidebar, setShowExpenseSidebar] = useState(false);
  const [expenseEditingId, setExpenseEditingId] = useState(null);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm());
  const [savingExpense, setSavingExpense] = useState(false);

  // Sub-Navigation State
  const [activeSubTab, setActiveSubTab] = useState('invoices'); // 'invoices' | 'expenses' | 'summary'

  // Report Generation Modal State
  const [reportModal, setReportModal] = useState(false);
  const [selectedScope, setSelectedScope] = useState('overall'); // 'overall' | 'yearly' | 'monthly'
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [reportPreparedBy, setReportPreparedBy] = useState(CO.preparedBy);

  const getAvailablePeriods = () => {
    const years = new Set();
    const months = new Set();
    
    invoices.forEach(inv => {
      if (inv.date) {
        years.add(inv.date.substring(0, 4));
        months.add(inv.date.substring(0, 7));
      }
    });
    expenses.forEach(exp => {
      if (exp.date) {
        years.add(exp.date.substring(0, 4));
        months.add(exp.date.substring(0, 7));
      }
    });
    
    return {
      years: Array.from(years).sort((a, b) => b.localeCompare(a)),
      months: Array.from(months).sort((a, b) => b.localeCompare(a))
    };
  };

  const openReportModal = () => {
    const { years, months } = getAvailablePeriods();
    setSelectedYear(years[0] || new Date().getFullYear().toString());
    setSelectedMonth(months[0] || new Date().toISOString().substring(0, 7));
    setSelectedScope('overall');
    setReportPreparedBy(CO.preparedBy);
    setReportModal(true);
  };

  // Load Invoices and Expenses
  const load = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    setLoading(true);
    setExpensesLoading(true);
    
    // Listen to invoices
    const qInvoices = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const unsubscribeInvoices = onSnapshot(qInvoices, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error listening to invoices:", err);
      setLoading(false);
    });

    // Listen to expenses
    const qExpenses = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
    const unsubscribeExpenses = onSnapshot(qExpenses, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setExpensesLoading(false);
    }, (err) => {
      console.error("Error listening to expenses:", err);
      setExpensesLoading(false);
    });

    return () => {
      unsubscribeInvoices();
      unsubscribeExpenses();
    };
  }, []);

  // Invoice Items Management
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), service: '', amount: '' }] }));
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }));
  const updItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }));
  const formTotal = calcTotal(form.items);

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setShowSidebar(true); };
  const openEdit = (inv) => {
    setEditingId(inv.id);
    setForm({ billTo: inv.billTo || '', project: inv.project || '', date: inv.date || today(), paymentTerms: inv.paymentTerms || 'Cash/Bank Transfer', items: (inv.items || []).map((i, idx) => ({ ...i, id: idx })), notes: inv.notes || '', qrCodes: inv.qrCodes || ['gotyme', 'maribank'], preparedBy: inv.preparedBy || CO.preparedBy });
    setShowSidebar(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, total: formTotal, updatedAt: serverTimestamp() };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'invoices', editingId), payload);
      } else {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const num = `INV-${year}-${month}-${String(invoices.length + 1).padStart(3, '0')}`;
        await addDoc(collection(db, 'invoices'), { ...payload, invoiceNumber: num, status: 'unpaid', createdAt: serverTimestamp(), createdBy: firebaseUser.email });
      }
      setShowSidebar(false);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const openPayModal = (inv) => { setPayModal({ inv }); setPayMethod(''); setPayRef(''); };

  const confirmPayment = async () => {
    if (!payMethod) return;
    if (payMethod !== 'cash' && !payRef.trim()) return;
    setPayConfirming(true);
    const update = { status: 'paid', paidAt: serverTimestamp(), paymentMethod: payMethod, referenceNumber: payMethod !== 'cash' ? payRef.trim() : null };
    await updateDoc(doc(db, 'invoices', payModal.inv.id), update);
    setInvoices(prev => prev.map(i => i.id === payModal.inv.id ? { ...i, ...update, paidAt: new Date() } : i));
    setPayModal(null);
    setPayConfirming(false);
  };

  const handleDelete = (inv) => {
    setModal({
      isOpen: true,
      title: 'Delete Invoice',
      message: `Are you sure you want to delete invoice ${inv.invoiceNumber}? This action cannot be undone.`,
      type: 'confirm',
      icon: 'warning',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'invoices', inv.id));
          setInvoices(prev => prev.filter(i => i.id !== inv.id));
        } catch (e) {
          console.error("Error deleting:", e);
          showAlert('Delete Error', 'Failed to delete invoice document.', 'warning');
        }
      }
    });
  };

  // Expenses CRUD handlers
  const openCreateExpense = () => { setExpenseEditingId(null); setExpenseForm(emptyExpenseForm()); setShowExpenseSidebar(true); };
  const openEditExpense = (exp) => {
    setExpenseEditingId(exp.id);
    setExpenseForm({
      title: exp.title || '',
      category: exp.category || 'Salaries',
      amount: exp.amount || '',
      date: exp.date || today(),
      payee: exp.payee || '',
      referenceNumber: exp.referenceNumber || '',
      status: exp.status || 'paid',
      notes: exp.notes || '',
    });
    setShowExpenseSidebar(true);
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    setSavingExpense(true);
    const payload = {
      ...expenseForm,
      amount: Number(expenseForm.amount || 0),
      updatedAt: serverTimestamp(),
    };
    try {
      if (expenseEditingId) {
        await updateDoc(doc(db, 'expenses', expenseEditingId), payload);
      } else {
        await addDoc(collection(db, 'expenses'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        });
      }
      setShowExpenseSidebar(false);
      load();
    } catch (err) { console.error(err); }
    setSavingExpense(false);
  };

  const handleDeleteExpense = (exp) => {
    setModal({
      isOpen: true,
      title: 'Delete Expense',
      message: `Are you sure you want to delete expense "${exp.title}"? This action cannot be undone.`,
      type: 'confirm',
      icon: 'warning',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'expenses', exp.id));
          setExpenses(prev => prev.filter(e => e.id !== exp.id));
        } catch (e) {
          console.error("Error deleting:", e);
          showAlert('Delete Error', 'Failed to delete expense entry.', 'warning');
        }
      }
    });
  };

  // Pre-calculations
  const paid = invoices.filter(i => i.status === 'paid');
  const unpaid = invoices.filter(i => i.status !== 'paid');
  const revenue = paid.reduce((s, i) => s + (i.total || 0), 0);

  const paidExpensesList = expenses.filter(e => e.status === 'paid');
  const pendingExpensesList = expenses.filter(e => e.status !== 'paid');
  const totalExpensesAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const paidExpensesAmount = paidExpensesList.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingExpensesAmount = pendingExpensesList.reduce((s, e) => s + (e.amount || 0), 0);

  // Group monthly performance data
  const getMonthlyData = () => {
    const monthly = {};
    const getYearMonth = (dateStr) => (dateStr || '').substring(0, 7);
    
    paid.forEach(inv => {
      const ym = getYearMonth(inv.date);
      if (!ym) return;
      if (!monthly[ym]) monthly[ym] = { revenue: 0, expenses: 0 };
      monthly[ym].revenue += (inv.total || 0);
    });
    
    paidExpensesList.forEach(exp => {
      const ym = getYearMonth(exp.date);
      if (!ym) return;
      if (!monthly[ym]) monthly[ym] = { revenue: 0, expenses: 0 };
      monthly[ym].expenses += (exp.amount || 0);
    });
    
    return Object.keys(monthly)
      .sort((a, b) => b.localeCompare(a))
      .map(ym => {
        const [year, month] = ym.split('-');
        const d = new Date(Number(year), Number(month) - 1, 1);
        const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return {
          ym,
          monthName,
          revenue: monthly[ym].revenue,
          expenses: monthly[ym].expenses,
          net: monthly[ym].revenue - monthly[ym].expenses
        };
      });
  };

  const monthlyData = getMonthlyData();

  // Group category totals
  const categoryTotals = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = expenses.filter(e => e.category === cat).reduce((sum, e) => sum + (e.amount || 0), 0);
    return acc;
  }, {});

  return (
    <div style={{ position: 'relative' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Invoices & Finance</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => load()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          {isSuperAdmin && activeSubTab === 'invoices' && (
            <button onClick={openCreate} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Plus size={16} /> New Invoice
            </button>
          )}
          {isSuperAdmin && activeSubTab === 'expenses' && (
            <button onClick={openCreateExpense} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Plus size={16} /> Record Expense
            </button>
          )}
          {activeSubTab === 'summary' && (
            <button onClick={openReportModal} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Printer size={16} /> Print Shareholder Report
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Sub-navigation */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 12 }}>
        {[
          { id: 'invoices', label: 'Invoices', count: invoices.length, Icon: FileText },
          { id: 'expenses', label: 'Expenses', count: expenses.length, Icon: Briefcase },
          { id: 'summary', label: 'Financial Summary', count: null, Icon: TrendingUp }
        ].map(tab => {
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                cursor: 'pointer',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: activeSubTab === tab.id ? 'rgba(255,106,26,0.15)' : 'transparent',
                color: activeSubTab === tab.id ? '#ff9a4a' : 'rgba(255,255,255,0.5)',
                fontWeight: activeSubTab === tab.id ? 600 : 400,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Icon size={14} />
              {tab.label}
              {tab.count !== null && (
                <span style={{
                  background: activeSubTab === tab.id ? 'rgba(255,106,26,0.25)' : 'rgba(255,255,255,0.08)',
                  color: activeSubTab === tab.id ? '#ff9a4a' : 'rgba(255,255,255,0.4)',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 6
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* RENDER ACTIVE TAB */}

      {/* 1. INVOICES TAB */}
      {activeSubTab === 'invoices' && (
        <>
          {/* Invoice Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
            {[{ l: 'Total Invoices', v: invoices.length, c: '#fff' }, { l: 'Paid Invoices', v: paid.length, c: '#34d399' }, { l: 'Unpaid Invoices', v: unpaid.length, c: '#f87171' }, { l: 'Total Revenue', v: `₱${fmt(revenue)}`, c: '#ff9a4a' }].map(({ l, v, c }) => (
              <div key={l} style={{ ...S.card }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
                <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p>Loading…</p>
            </div>
          ) : invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>No invoices yet.</div>
          ) : (
            <div style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Invoice</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Client / Project</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Date</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Amount</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="inv-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '18px 24px', fontWeight: 700, color: '#fff', verticalAlign: 'middle' }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{inv.billTo}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{inv.project}</div>
                      </td>
                      <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13, verticalAlign: 'middle' }}>{fmtDate(inv.date)}</td>
                      <td style={{ padding: '18px 24px', textAlign: 'right', color: '#ff9a4a', fontWeight: 700, fontSize: 16, verticalAlign: 'middle' }}>₱{fmt(inv.total)}</td>
                      <td style={{ padding: '18px 24px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {inv.status === 'paid' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8 }}>
                            <CheckCircle2 size={11} /> Paid
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8 }}>
                            <Clock size={11} /> Unpaid
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleCopyLink(inv.id)}
                            style={{
                              ...S.btn,
                              background: copiedId === inv.id ? 'rgba(52,211,153,0.15)' : 'rgba(96,165,250,0.1)',
                              color: copiedId === inv.id ? '#34d399' : '#60a5fa',
                            }}
                            title="Copy Client Invoice Link"
                          >
                            {copiedId === inv.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === inv.id ? 'Copied Link!' : 'Copy Link'}
                          </button>

                          {!inv.preparedSigned && (
                            <button
                              onClick={() => handlePrepareSign(inv)}
                              style={{ ...S.btn, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
                              title="Sign as Prepared By"
                            >
                              <PenTool size={12} /> Sign Prepared
                            </button>
                          )}

                          {isSuperAdmin && !inv.approvedSigned && (
                            <button
                              onClick={() => handleApproveSign(inv)}
                              style={{ ...S.btn, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', border: '1px solid rgba(255,106,26,0.3)' }}
                              title="Approve & Sign Invoice"
                            >
                              <Award size={12} /> Sign Approved
                            </button>
                          )}

                          {inv.status === 'paid' ? (
                            <button onClick={() => setViewInv(inv)} style={{ ...S.btn, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }} title="View Details"><Eye size={14} /> View</button>
                          ) : (
                            <button onClick={() => openPayModal(inv)} style={{ ...S.btn, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }} title="Mark as Paid"><CreditCard size={14} /> Mark As Paid</button>
                          )}
                          <button onClick={() => printInvoice(inv)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} title="Print Invoice"><Printer size={14} /> Print</button>
                          {isSuperAdmin && (
                            <>
                              <button onClick={() => openEdit(inv)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', padding: 8 }} title="Edit"><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(inv)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: 8 }} title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 2. EXPENSES TAB */}
      {activeSubTab === 'expenses' && (
        <>
          {/* Expenses Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
            {[
              { l: 'Total Expenses Recorded', v: expenses.length, c: '#fff' },
              { l: 'Paid Expenses', v: `₱${fmt(paidExpensesAmount)}`, c: '#34d399' },
              { l: 'Pending Expenses', v: `₱${fmt(pendingExpensesAmount)}`, c: '#f87171' },
              { l: 'Total Outflow', v: `₱${fmt(totalExpensesAmount)}`, c: '#ff9a4a' }
            ].map(({ l, v, c }) => (
              <div key={l} style={{ ...S.card }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
                <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
              </div>
            ))}
          </div>

          {expensesLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p>Loading Expenses…</p>
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>No expenses recorded yet.</div>
          ) : (
            <div style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Description / Vendor</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Category</th>
                    <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Date</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Amount</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(exp => (
                    <tr key={exp.id} className="inv-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{exp.title}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Payee: {exp.payee} {exp.referenceNumber ? `(Ref: ${exp.referenceNumber})` : ''}</div>
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '4px 8px', borderRadius: 6 }}>
                          {exp.category}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13, verticalAlign: 'middle' }}>{fmtDate(exp.date)}</td>
                      <td style={{ padding: '18px 24px', textAlign: 'right', color: '#ff9a4a', fontWeight: 700, fontSize: 16, verticalAlign: 'middle' }}>₱{fmt(exp.amount)}</td>
                      <td style={{ padding: '18px 24px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {exp.status === 'paid' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8 }}>
                            <CheckCircle2 size={11} /> Paid
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8 }}>
                            <Clock size={11} /> Pending
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          {isSuperAdmin && (
                            <>
                              <button onClick={() => openEditExpense(exp)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', padding: 8 }} title="Edit"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteExpense(exp)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: 8 }} title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* 3. FINANCIAL SUMMARY TAB */}
      {activeSubTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Key Combined Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {/* Revenue card */}
            <div style={{ ...S.card, border: '1px solid rgba(52,211,153,0.15)', background: 'linear-gradient(135deg, rgba(52,211,153,0.02), rgba(255,255,255,0.03))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total Net Revenue</span>
                <span style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', borderRadius: '50%', p: 6, display: 'flex', padding: 6 }}><ArrowUpRight size={16} /></span>
              </div>
              <div style={{ color: '#34d399', fontSize: 26, fontWeight: 700 }}>₱{fmt(revenue)}</div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '6px 0 0' }}>From paid client invoices</p>
            </div>

            {/* Operating Expense card */}
            <div style={{ ...S.card, border: '1px solid rgba(248,113,113,0.15)', background: 'linear-gradient(135deg, rgba(248,113,113,0.02), rgba(255,255,255,0.03))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operating Expenditures</span>
                <span style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', borderRadius: '50%', p: 6, display: 'flex', padding: 6 }}><ArrowDownRight size={16} /></span>
              </div>
              <div style={{ color: '#f87171', fontSize: 26, fontWeight: 700 }}>₱{fmt(paidExpensesAmount)}</div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '6px 0 0' }}>Paid operational expenses</p>
            </div>

            {/* Net Profit Card */}
            {(() => {
              const netProfit = revenue - paidExpensesAmount;
              const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
              const positive = netProfit >= 0;
              return (
                <div style={{ ...S.card, border: `1px solid ${positive ? 'rgba(251,191,36,0.15)' : 'rgba(239,68,68,0.2)'}`, background: 'linear-gradient(135deg, rgba(251,191,36,0.02), rgba(255,255,255,0.03))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Net Income</span>
                    <span style={{ background: positive ? 'rgba(251,191,36,0.12)' : 'rgba(239,68,68,0.15)', color: positive ? '#fbbf24' : '#ef4444', borderRadius: '50%', display: 'flex', padding: 6 }}><DollarSign size={16} /></span>
                  </div>
                  <div style={{ color: positive ? '#fbbf24' : '#ef4444', fontSize: 26, fontWeight: 700 }}>₱{fmt(netProfit)}</div>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '6px 0 0' }}>
                    Margin: <span style={{ color: positive ? '#34d399' : '#f87171', fontWeight: 600 }}>{margin.toFixed(1)}%</span>
                  </p>
                </div>
              );
            })()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Category Breakdown list */}
            <div style={{ ...S.card }}>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>Expenditure Category Breakdown</h3>
              {EXPENSE_CATEGORIES.map(cat => {
                const amt = categoryTotals[cat] || 0;
                const pct = totalExpensesAmount > 0 ? (amt / totalExpensesAmount) * 100 : 0;
                return (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{cat}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>₱{fmt(amt)} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 400 }}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#ff6a1a,#ff9a4a)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Monthly Profitability Table */}
            <div style={{ ...S.card, paddingRight: 0, paddingLeft: 0 }}>
              <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10, paddingLeft: 24, paddingRight: 24 }}>Monthly Earnings</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.1)' }}>
                      <th style={{ padding: '12px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Month</th>
                      <th style={{ padding: '12px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Revenue</th>
                      <th style={{ padding: '12px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Expenses</th>
                      <th style={{ padding: '12px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No historical performance recorded.</td>
                      </tr>
                    ) : (
                      monthlyData.map(m => (
                        <tr key={m.ym} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '12px 24px', color: '#fff', fontSize: 13, fontWeight: 600 }}>{m.monthName}</td>
                          <td style={{ padding: '12px 24px', textAlign: 'right', color: '#34d399', fontSize: 13, fontWeight: 500 }}>₱{fmt(m.revenue)}</td>
                          <td style={{ padding: '12px 24px', textAlign: 'right', color: '#f87171', fontSize: 13, fontWeight: 500 }}>₱{fmt(m.expenses)}</td>
                          <td style={{ padding: '12px 24px', textAlign: 'right', color: m.net >= 0 ? '#fbbf24' : '#ef4444', fontSize: 13, fontWeight: 700 }}>₱{fmt(m.net)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALS SECTION */}

      {/* Shareholder Report Selection Modal */}
      {reportModal && (() => {
        const { years, months } = getAvailablePeriods();
        return (
          <>
            <div onClick={() => setReportModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, zIndex: 201, width: '100%', maxWidth: 440 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Generate Shareholder Report</h3>
                <button onClick={() => setReportModal(false)} style={{ ...S.btn, background: 'none', color: 'rgba(255,255,255,0.5)', padding: 4 }}><X size={16} /></button>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>Select the scope of the financial report you want to view and generate.</div>
              
              <div style={{ marginBottom: 18 }}>
                <label style={S.lbl}>Report Scope</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                  {[
                    { id: 'overall', label: 'Overall' },
                    { id: 'yearly', label: 'Yearly' },
                    { id: 'monthly', label: 'Monthly' }
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedScope(id)}
                      style={{
                        ...S.btn,
                        justifyContent: 'center',
                        padding: '10px 0',
                        background: selectedScope === id ? 'rgba(255,106,26,0.15)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${selectedScope === id ? 'rgba(255,106,26,0.5)' : 'rgba(255,255,255,0.1)'}`,
                        color: selectedScope === id ? '#ff9a4a' : 'rgba(255,255,255,0.6)',
                        fontWeight: selectedScope === id ? 700 : 400,
                        borderRadius: 10
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedScope === 'yearly' && (
                <div style={{ marginBottom: 18 }}>
                  <label style={S.lbl}>Select Year</label>
                  {years.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '10px 0' }}>No yearly data available</div>
                  ) : (
                    <select
                      style={S.inp}
                      value={selectedYear}
                      onChange={e => setSelectedYear(e.target.value)}
                    >
                      {years.map(yr => (
                        <option key={yr} value={yr} style={{ background: '#0f1218', color: '#fff' }}>{yr}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {selectedScope === 'monthly' && (
                <div style={{ marginBottom: 18 }}>
                  <label style={S.lbl}>Select Month</label>
                  {months.length === 0 ? (
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, padding: '10px 0' }}>No monthly data available</div>
                  ) : (
                    <select
                      style={S.inp}
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                    >
                      {months.map(ym => {
                        const [year, month] = ym.split('-');
                        const d = new Date(Number(year), Number(month) - 1, 1);
                        const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        return (
                          <option key={ym} value={ym} style={{ background: '#0f1218', color: '#fff' }}>{monthLabel}</option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={S.lbl}>Prepared By</label>
                <input
                  style={S.inp}
                  value={reportPreparedBy}
                  onChange={e => setReportPreparedBy(e.target.value)}
                  placeholder="e.g. Johnjosefir Roca"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setReportModal(false)} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                <button
                  onClick={() => {
                    const val = selectedScope === 'yearly' ? selectedYear : selectedScope === 'monthly' ? selectedMonth : '';
                    printFinancialReport(invoices, expenses, selectedScope, val, reportPreparedBy);
                    setReportModal(false);
                  }}
                  disabled={(selectedScope === 'yearly' && !selectedYear) || (selectedScope === 'monthly' && !selectedMonth)}
                  style={{
                    ...S.btn,
                    flex: 2,
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)',
                    color: '#fff',
                    fontWeight: 600,
                    padding: '12px 0',
                    boxShadow: '0 4px 14px rgba(255,106,26,0.3)'
                  }}
                >
                  <Printer size={15} /> Generate & Print
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Invoice Pay Modal */}
      {payModal && (
        <>
          <div onClick={() => setPayModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, zIndex: 201, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Mark as Paid</h3>
              <button onClick={() => setPayModal(null)} style={{ ...S.btn, background: 'none', color: 'rgba(255,255,255,0.5)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>{payModal.inv.invoiceNumber} · {payModal.inv.billTo} · <span style={{ color: '#ff9a4a', fontWeight: 700 }}>₱{fmt(payModal.inv.total)}</span></div>
            <div style={{ marginBottom: 18 }}>
              <label style={S.lbl}>Payment Method</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                {[{ id: 'cash', label: '💵 Cash' }, { id: 'gotyme', label: '🏦 GoTyme' }, { id: 'maribank', label: '🏧 MariBank' }, { id: 'gcash', label: '📱 GCash' }].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setPayMethod(id)} style={{ ...S.btn, justifyContent: 'center', padding: '12px 0', background: payMethod === id ? 'rgba(255,106,26,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${payMethod === id ? 'rgba(255,106,26,0.6)' : 'rgba(255,255,255,0.1)'}`, color: payMethod === id ? '#ff9a4a' : 'rgba(255,255,255,0.6)', fontWeight: payMethod === id ? 700 : 400, borderRadius: 12 }}>{label}</button>
                ))}
              </div>
            </div>
            {payMethod && payMethod !== 'cash' && (
              <div style={{ marginBottom: 18 }}>
                <label style={S.lbl}>Reference Number</label>
                <input style={S.inp} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="e.g. REF-20260506-001" autoFocus />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setPayModal(null)} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
              <button onClick={confirmPayment} disabled={!payMethod || (payMethod !== 'cash' && !payRef.trim()) || payConfirming} style={{ ...S.btn, flex: 2, justifyContent: 'center', background: (!payMethod || (payMethod !== 'cash' && !payRef.trim())) ? 'rgba(52,211,153,0.2)' : 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', fontWeight: 600, padding: '12px 0', boxShadow: '0 4px 14px rgba(52,211,153,0.2)' }}>
                <CreditCard size={15} /> {payConfirming ? 'Confirming…' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* View Invoice Modal */}
      {viewInv && (
        <>
          <div onClick={() => setViewInv(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, zIndex: 201, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>{viewInv.invoiceNumber}</h3>
              <button onClick={() => setViewInv(null)} style={{ ...S.btn, background: 'none', color: 'rgba(255,255,255,0.5)', padding: 4 }}><X size={16} /></button>
            </div>
            {[['Bill To', viewInv.billTo], ['Project', viewInv.project], ['Date', fmtDate(viewInv.date)], ['Payment Terms', viewInv.paymentTerms], ['Prepared By', viewInv.preparedSigned ? `${viewInv.preparedSigneeName} (Signed)` : (viewInv.preparedBy || CO.preparedBy)], ['Approved By', viewInv.approvedSigned ? `${viewInv.approvedSigneeName} (Signed)` : CO.approvedBy]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{k}</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ margin: '16px 0 8px', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Line Items</div>
            {(viewInv.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{item.service}</span>
                <span style={{ color: '#ff9a4a', fontSize: 13, fontWeight: 600 }}>₱{fmt(item.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderTop: '2px solid rgba(255,255,255,0.1)', marginTop: 4 }}>
              <span style={{ color: '#fff', fontWeight: 700 }}>Total Due</span>
              <span style={{ color: '#ff9a4a', fontWeight: 700, fontSize: 18 }}>₱{fmt(viewInv.total)}</span>
            </div>
            <div style={{ marginTop: 16, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ color: '#34d399', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>✓ Payment Received</div>
              {[['Method', viewInv.paymentMethod ? viewInv.paymentMethod.charAt(0).toUpperCase() + viewInv.paymentMethod.slice(1) : '—'], ...(viewInv.referenceNumber ? [['Reference #', viewInv.referenceNumber]] : []), ['Paid At', viewInv.paidAt ? (viewInv.paidAt.toDate ? viewInv.paidAt.toDate() : new Date(viewInv.paidAt)).toLocaleString('en-PH') : '—']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)' }}>{k}</span>
                  <span style={{ color: '#fff', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={() => { printInvoice(viewInv); }} style={{ ...S.btn, width: '100%', justifyContent: 'center', marginTop: 16, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', padding: '11px 0' }}><Printer size={14} /> Print Invoice</button>
          </div>
        </>
      )}

      {/* Invoice Drawer Sidebar */}
      {showSidebar && (
        <>
          <div onClick={() => setShowSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{editingId ? 'Edit Invoice' : 'New Invoice'}</h3>
              <button onClick={() => setShowSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={S.lbl}>Bill To (Client)</label>
                <input style={S.inp} value={form.billTo} onChange={e => setForm(f => ({ ...f, billTo: e.target.value }))} placeholder="e.g. CPRMed" required />
              </div>
              <div>
                <label style={S.lbl}>Project</label>
                <input style={S.inp} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} placeholder="e.g. Clinic Management" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.lbl}>Date</label>
                  <input type="date" style={S.inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label style={S.lbl}>Payment Terms</label>
                  <input style={S.inp} value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} placeholder="Cash/Bank Transfer" />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={S.lbl}>Line Items</label>
                  <button type="button" onClick={addItem} style={{ ...S.btn, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', fontSize: 12, padding: '4px 10px' }}><Plus size={13} /> Add Row</button>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 32px', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Service</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Amount (₱)</span>
                    <span />
                  </div>
                  {form.items.map((item) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '4px 8px', alignItems: 'center' }}>
                      <input style={{ ...S.inp, background: 'transparent', border: 'none', padding: '6px 8px', fontSize: 13 }} value={item.service} onChange={e => updItem(item.id, 'service', e.target.value)} placeholder="Description" />
                      <input type="number" min="0" step="0.01" style={{ ...S.inp, background: 'transparent', border: 'none', padding: '6px 8px', fontSize: 13, textAlign: 'right' }} value={item.amount} onChange={e => updItem(item.id, 'amount', e.target.value)} placeholder="0" />
                      <button type="button" onClick={() => removeItem(item.id)} disabled={form.items.length === 1} style={{ ...S.btn, padding: 4, background: 'none', color: '#f87171', opacity: form.items.length === 1 ? 0.3 : 1 }}><X size={14} /></button>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 32px', padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 }}>Total</span>
                    <span style={{ color: '#ff9a4a', fontSize: 16, fontWeight: 700, textAlign: 'right' }}>₱{fmt(formTotal)}</span>
                    <span />
                  </div>
                </div>
              </div>

              <div>
                <label style={S.lbl}>Prepared By</label>
                <input style={S.inp} value={form.preparedBy} onChange={e => setForm(f => ({ ...f, preparedBy: e.target.value }))} placeholder="e.g. Johnjosefir Roca" />
              </div>

              <div>
                <label style={S.lbl}>Notes (Optional)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 70 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" />
              </div>

              <div>
                <label style={S.lbl}>QR Code on Invoice</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  {[{ id: 'gotyme', label: 'GoTyme', img: '/images/jetchgotyme.png' }, { id: 'maribank', label: 'MariBank', img: '/images/jetchmaribank.png' }].map(({ id, label, img }) => {
                    const active = (form.qrCodes || []).includes(id);
                    const toggle = () => setForm(f => ({ ...f, qrCodes: active ? (f.qrCodes || []).filter(q => q !== id) : [...(f.qrCodes || []), id] }));
                    return (
                      <button key={id} type="button" onClick={toggle} style={{ ...S.btn, flexDirection: 'column', gap: 6, padding: '10px 14px', background: active ? 'rgba(255,106,26,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? 'rgba(255,106,26,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, color: active ? '#ff9a4a' : 'rgba(255,255,255,0.4)', minWidth: 90 }}>
                        <img src={img} alt={label} style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover', opacity: active ? 1 : 0.4 }} />
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 10 }}>{active ? '✓ Included' : 'Excluded'}</span>
                      </button>
                    );
                  })}
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
                    <button type="button" onClick={() => setForm(f => ({ ...f, qrCodes: ['gotyme', 'maribank'] }))} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', fontSize: 11, padding: '6px 10px' }}>Both</button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, qrCodes: [] }))} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', fontSize: 11, padding: '6px 10px' }}>None</button>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={saving} style={{ ...S.btn, background: saving ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 4 }}>
                {saving ? 'Saving…' : editingId ? 'Update Invoice' : 'Create Invoice'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Expenses Drawer Sidebar */}
      {showExpenseSidebar && (
        <>
          <div onClick={() => setShowExpenseSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{expenseEditingId ? 'Edit Expense' : 'Record Expense'}</h3>
              <button onClick={() => setShowExpenseSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmitExpense} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={S.lbl}>Expense Description</label>
                <input style={S.inp} value={expenseForm.title} onChange={e => setExpenseForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Office Internet - May" required />
              </div>
              <div>
                <label style={S.lbl}>Category</label>
                <select style={S.inp} value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} required>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ background: '#0f1218', color: '#fff' }}>{cat}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.lbl}>Amount (₱)</label>
                  <input type="number" min="0" step="0.01" style={S.inp} value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
                </div>
                <div>
                  <label style={S.lbl}>Date</label>
                  <input type="date" style={S.inp} value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.lbl}>Payee / Vendor</label>
                  <input style={S.inp} value={expenseForm.payee} onChange={e => setExpenseForm(f => ({ ...f, payee: e.target.value }))} placeholder="e.g. PLDT" required />
                </div>
                <div>
                  <label style={S.lbl}>Reference / Invoice #</label>
                  <input style={S.inp} value={expenseForm.referenceNumber} onChange={e => setExpenseForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g. Receipt Reference" />
                </div>
              </div>
              <div>
                <label style={S.lbl}>Status</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { id: 'paid', label: '✓ Paid', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
                    { id: 'pending', label: '⏰ Pending', color: '#f87171', bg: 'rgba(248,113,113,0.1)' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setExpenseForm(f => ({ ...f, status: st.id }))}
                      style={{
                        ...S.btn,
                        flex: 1,
                        justifyContent: 'center',
                        background: expenseForm.status === st.id ? st.bg : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${expenseForm.status === st.id ? st.color : 'rgba(255,255,255,0.1)'}`,
                        color: expenseForm.status === st.id ? st.color : 'rgba(255,255,255,0.5)',
                        fontWeight: 600,
                        padding: '10px 0',
                        borderRadius: 10
                      }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={S.lbl}>Notes (Optional)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 70 }} value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" />
              </div>
              <button type="submit" disabled={savingExpense} style={{ ...S.btn, background: savingExpense ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: savingExpense ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 4 }}>
                {savingExpense ? 'Saving…' : expenseEditingId ? 'Update Expense' : 'Record Expense'}
              </button>
            </form>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .inv-row:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>
      <CustomModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        icon={modal.icon}
        promptFields={modal.promptFields}
        onConfirm={modal.onConfirm}
        confirmText="Confirm"
      />
    </div>
  );
}
