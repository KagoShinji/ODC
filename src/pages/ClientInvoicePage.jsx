import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { ShieldCheck, Printer, CheckCircle2, FileText, Globe, Award, Sparkles, RefreshCw, CreditCard, DollarSign, Clock } from 'lucide-react';

const CO = {
  address: '3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City',
  email: 'odysseyphitsolutions@gmail.com',
  phone: '09930050994 / 08099855322',
  preparedBy: 'Johnjosefir Roca',
  approvedBy: 'Jetch Merald S. Madaya',
  approvedPhone: '0909-985-5322',
  bankName: 'GoTyme',
  bankAccount: '012267894321',
  bankAccountName: 'Johnjosefir Roca',
};

const S = {
  container: {
    minHeight: '100vh',
    background: '#07090e',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    position: 'relative',
    overflowX: 'hidden',
  },
  glow1: {
    position: 'absolute',
    top: '-10%',
    left: '10%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(255,106,26,0.12) 0%, rgba(0,0,0,0) 70%)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  glow2: {
    position: 'absolute',
    bottom: '-10%',
    right: '10%',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)',
    zIndex: 0,
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(255,255,255,0.02)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '24px',
    padding: '40px',
    width: '100%',
    maxWidth: '800px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
    zIndex: 1,
    position: 'relative',
  },
  heading: {
    fontSize: '28px',
    fontWeight: 800,
    textAlign: 'center',
    background: 'linear-gradient(135deg, #fff 30%, #a5b4fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: '0 0 8px 0',
  },
  subheading: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    margin: '0 0 32px 0',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  infoValue: {
    fontSize: '14px',
    color: '#fff',
    fontWeight: 600,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '28px',
    fontSize: '13.5px',
  },
  th: {
    background: 'rgba(255,255,255,0.04)',
    padding: '12px 16px',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 600,
    textAlign: 'left',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  totRow: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#ff9a4a',
  },
  qrSection: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '28px',
    paddingTop: '28px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  qrCard: {
    background: '#fff',
    padding: '12px',
    borderRadius: '16px',
    textAlign: 'center',
    width: '180px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  },
  qrImage: {
    width: '100%',
    height: 'auto',
    borderRadius: '8px',
    imageRendering: 'crisp-edges',
  },
  qrText: {
    color: '#333',
    fontSize: '11px',
    fontWeight: 700,
    marginTop: '8px',
    letterSpacing: '0.5px',
  },
  btn: {
    cursor: 'pointer',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    transition: 'all 0.2s',
  },
};

const fmtDate = (s) => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

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

const getSigFontSize = (name) => {
  const len = (name || '').length;
  if (len > 25) return '14px';
  if (len > 20) return '17px';
  if (len > 15) return '21px';
  return '28px';
};

const getSigFontSizePrint = (name) => {
  const len = (name || '').length;
  if (len > 25) return '14px';
  if (len > 20) return '16px';
  if (len > 15) return '19px';
  return '24px';
};

export default function ClientInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientIp, setClientIp] = useState('');

  useEffect(() => {
    // Dynamic Font Loading
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Fetch IP
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp('127.0.0.1'));

    const fetchInvoice = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'invoices', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'paid') {
            setError('This link has expired as the invoice has already been paid and settled.');
          } else {
            setInv({ id: docSnap.id, ...data });
          }
        } else {
          setError('Invoice document not found. Please verify the link.');
        }
      } catch (err) {
        console.error('Error fetching invoice:', err);
        if (err.code === 'permission-denied') {
          setError('This link has expired as the invoice has already been paid and settled.');
        } else {
          setError('Failed to retrieve invoice details.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const triggerPrint = () => {
    // Redefine printInvoice locally for public access consistency
    const total = (inv.items || []).reduce((s, item) => s + Number(item.amount || 0), 0);
    const logoUrl = window.location.origin + '/images/odcclearlogo.png';
    const rows = (inv.items || []).map(i =>
      `<tr><td class="td">${i.service || ''}</td><td class="td ar">${Number(i.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>`
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
    <div><b>Date:</b> ${inv.date ? new Date(inv.date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}</div>
    <div><b>Bill To:</b> ${inv.billTo || ''}</div>
    <div><b>Project:</b> ${inv.project || ''}</div>
    <div><b>Payment Terms:</b> ${inv.paymentTerms || ''}</div>
  </div>
  <table>
    <thead><tr><th style="width:70%">SERVICE</th><th style="width:30%">AMOUNT</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="sub-row"><td class="td"></td><td class="td ar">${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr></tfoot>
  </table>
  <div class="tot">Total Due: &#8369; ${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
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
  };

  const fmtCurrency = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading invoice details…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div style={S.container}>
        <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '400px' }}>
          <FileText size={48} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: 12 }}>Document Error</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: 24 }}>{error || 'Invalid Invoice Link'}</p>
          <button onClick={() => navigate('/')} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>Return to Home</button>
        </div>
      </div>
    );
  }

  const isPaid = inv.status === 'paid';
  const totalDue = (inv.items || []).reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div style={S.container}>
      <div style={S.glow1} />
      <div style={S.glow2} />

      {/* Top logo */}
      <div style={{ zIndex: 1, marginBottom: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(255,106,26,0.35)',
        }}>
          <ShieldCheck size={20} color="#fff" />
        </div>
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '0.5px' }}>Odyssey Development Center</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={S.card}
      >
        {isPaid ? (
          <div style={{
            position: 'absolute', top: 24, right: 24,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: '24px', padding: '6px 16px', color: '#34d399', fontSize: '12px', fontWeight: 700
          }}>
            <CheckCircle2 size={13} /> PAID INVOICE
          </div>
        ) : (
          <div style={{
            position: 'absolute', top: 24, right: 24,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: '24px', padding: '6px 16px', color: '#fbbf24', fontSize: '12px', fontWeight: 700
          }}>
            <Sparkles size={13} /> OUTSTANDING PAYMENT
          </div>
        )}

        <h1 style={S.heading}>Odyssey Invoice</h1>
        <p style={S.subheading}>{inv.invoiceNumber}</p>

        {/* Info Grid */}
        <div style={S.infoGrid}>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Bill To</span>
            <span style={S.infoValue}>{inv.billTo}</span>
          </div>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Project</span>
            <span style={S.infoValue}>{inv.project}</span>
          </div>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Invoice Date</span>
            <span style={S.infoValue}>{fmtDate(inv.date)}</span>
          </div>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Payment Terms</span>
            <span style={S.infoValue}>{inv.paymentTerms}</span>
          </div>
        </div>

        {/* Items Table */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Service / Deliverable Description</th>
              <th style={{ ...S.th, textAlign: 'right', width: '30%' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item, idx) => (
              <tr key={item.id || idx}>
                <td style={S.td}>{item.service}</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>₱{fmtCurrency(item.amount)}</td>
              </tr>
            ))}
            <tr style={S.totRow}>
              <td style={{ ...S.td, borderBottom: 'none', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Total Due:</td>
              <td style={{ ...S.td, borderBottom: 'none', textAlign: 'right' }}>₱{fmtCurrency(totalDue)}</td>
            </tr>
          </tbody>
        </table>

        {/* Signatures & Bank Details */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '28px' }}>
          
          {/* Bank Payment Information */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px' }}>
            <h4 style={{ color: '#60a5fa', fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={14} /> Bank Details</h4>
            <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.8' }}>
              <strong>Bank:</strong> {CO.bankName}<br />
              <strong>Account No.:</strong> {CO.bankAccount}<br />
              <strong>Account Name:</strong> {CO.bankAccountName}<br />
              <strong>Mobile:</strong> {CO.approvedPhone}
            </div>
          </div>

          {/* Prepared By */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '120px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', position: 'absolute', top: 16 }}>Prepared By</span>
            {inv.preparedSigned ? (
              <>
                <div style={{ fontFamily: "'Great Vibes', cursive", fontSize: getSigFontSize(inv.preparedSigneeName || inv.preparedBy || CO.preparedBy), color: '#ff9a4a', marginTop: '14px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.preparedSigneeName || inv.preparedBy || CO.preparedBy}</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', width: '80%', textAlign: 'center', paddingTop: '4px' }}>{inv.preparedSigneeName || inv.preparedBy || CO.preparedBy}</div>
                <div style={{ fontSize: '9px', color: '#34d399', marginTop: '4px' }}>Digitally Prepared</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginTop: '16px' }}>{inv.preparedBy || CO.preparedBy}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>Odyssey Staff Rep</div>
              </>
            )}
          </div>

          {/* Approved By */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '120px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', position: 'absolute', top: 16 }}>Approved By</span>
            {inv.approvedSigned ? (
              <>
                <div style={{ fontFamily: "'Great Vibes', cursive", fontSize: getSigFontSize(inv.approvedSigneeName || CO.approvedBy), color: '#ff9a4a', marginTop: '14px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.approvedSigneeName || CO.approvedBy}</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', width: '80%', textAlign: 'center', paddingTop: '4px' }}>{inv.approvedSigneeName || CO.approvedBy}</div>
                <div style={{ fontSize: '9px', color: '#34d399', marginTop: '4px' }}>Digitally Approved</div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                <Clock size={16} style={{ marginBottom: 4 }} />
                <span>Awaiting Digital Approval</span>
              </div>
            )}
          </div>

        </div>

        {/* QR codes for scanning to pay */}
        {(inv.qrCodes || []).length > 0 && (
          <div style={S.qrSection}>
            {(inv.qrCodes || []).includes('gotyme') && (
              <div style={S.qrCard}>
                <img src="/images/jetchgotyme.png" alt="GoTyme QR" style={S.qrImage} />
                <div style={S.qrText}>GoTyme &bull; Scan to Pay</div>
              </div>
            )}
            {(inv.qrCodes || []).includes('maribank') && (
              <div style={S.qrCard}>
                <img src="/images/jetchmaribank.png" alt="MariBank QR" style={S.qrImage} />
                <div style={S.qrText}>MariBank &bull; Scan to Pay</div>
              </div>
            )}
          </div>
        )}

        {/* Action Button for printing */}
        <div style={{ marginTop: '32px' }}>
          <button
            onClick={triggerPrint}
            style={{
              ...S.btn,
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
            }}
          >
            <Printer size={16} /> Print / Save PDF Invoice
          </button>
        </div>
      </motion.div>

      <footer style={{ marginTop: '40px', zIndex: 1, display: 'flex', gap: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
        <span>Secure Electronic Billing System</span>
        <span>&bull;</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Globe size={12} /> IP: {clientIp || 'Detecting...'}
        </span>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
