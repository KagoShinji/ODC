import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { 
  Search, RefreshCw, Trash2, Mail, Building2, 
  Calendar, Clock, CheckCircle2, MessageSquare,
  Filter, Tag, User, Globe
} from 'lucide-react';

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchInquiries = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const q = query(collection(db, 'serviceInquiries'), orderBy('submittedAt', 'desc'));
      const snap = await getDocs(q);
      setInquiries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // eslint-disable-next-line
  useEffect(() => { fetchInquiries(false); }, [fetchInquiries]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this inquiry?')) return;
    await deleteDoc(doc(db, 'serviceInquiries', id));
    setInquiries(prev => prev.filter(i => i.id !== id));
  };

  const handleStatusUpdate = async (id, newStatus) => {
    await updateDoc(doc(db, 'serviceInquiries', id), { status: newStatus });
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
  };

  const filtered = inquiries.filter(i => {
    const q = search.toLowerCase();
    const matchesSearch = 
      i.name?.toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q) ||
      i.company?.toLowerCase().includes(q) ||
      i.planName?.toLowerCase().includes(q);
    
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><RefreshCw size={32} className="spin" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Service Inquiries</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0' }}>Manage maintenance plan requests from the pricing page.</p>
        </div>
        <button onClick={() => fetchInquiries()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}>
          <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input style={{ ...S.inp, paddingLeft: 40 }} placeholder="Search name, email, company, or plan..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['All', 'New', 'Contacted', 'Closed'].map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} style={{ ...S.btn, background: statusFilter === status ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: statusFilter === status ? '#60a5fa' : 'rgba(255,255,255,0.4)', border: `1px solid ${statusFilter === status ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)' }}>No inquiries found.</p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
                    {item.name?.[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{item.name}</h4>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', fontWeight: 600 }}>{item.planName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {item.email}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} /> {item.company}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <select 
                    value={item.status || 'New'} 
                    onChange={e => handleStatusUpdate(item.id, e.target.value)}
                    style={{ ...S.inp, width: 'auto', fontSize: 12, padding: '4px 8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <button onClick={() => handleDelete(item.id)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}><Trash2 size={14} /></button>
                </div>
              </div>

              {item.message && (
                <div style={{ marginTop: 16, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Message:</div>
                  {item.message}
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {formatDate(item.submittedAt)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={12} /> {item.referrer}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
