import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { BadgeCheck, Printer, FileText, RefreshCw } from 'lucide-react';
import { buildReceiptHtml, printReceipt } from '../utils/acknowledgementReceipt';

const btn = { cursor: 'pointer', border: 'none', borderRadius: 12, padding: '12px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 };

export default function ClientReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'receipts', id))
      .then(snap => snap.exists() ? setReceipt({ id: snap.id, ...snap.data() }) : setError('Receipt not found. Please verify the link or tracking number.'))
      .catch(err => { console.error('Error fetching receipt:', err); setError('Failed to retrieve receipt details.'); })
      .finally(() => setLoading(false));
  }, [id]);

  const shell = { minHeight: '100vh', background: '#07090e', color: '#fff', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px' };

  if (loading) {
    return (
      <div style={shell}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading receipt…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div style={shell}>
        <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 400 }}>
          <FileText size={48} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Document Error</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>{error}</p>
          <button onClick={() => navigate('/')} style={{ ...btn, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ width: '100%', maxWidth: 816, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BadgeCheck size={22} color="#34d399" />
          <div>
            <div style={{ fontSize: 13, color: '#34d399', fontWeight: 700 }}>Verified Acknowledgement Receipt</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Tracking No. {receipt.receiptNumber} · Ref. {receipt.invoiceNumber}</div>
          </div>
        </div>
        <button onClick={() => printReceipt(receipt)} style={{ ...btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff' }}>
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>
      <iframe
        title={receipt.receiptNumber}
        srcDoc={buildReceiptHtml(receipt)}
        style={{ width: '100%', maxWidth: 816, height: 1080, border: 'none', borderRadius: 8, background: '#fff', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
      />
    </div>
  );
}
