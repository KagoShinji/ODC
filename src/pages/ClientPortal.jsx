import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { Plus, X, RefreshCw, Eye, MessageSquare, Clock, Send, ShieldCheck, LogOut, ArrowLeft, ExternalLink } from 'lucide-react';
import { PortalLogin } from '../components/ui/PortalLogin';

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

const fmtDateLong = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const emptyForm = () => ({
  title: '',
  description: '',
  priority: 'Medium',
});

const PRIORITY_COLORS = {
  'Low': { bg: 'rgba(96,165,250,0.1)', text: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
  'Medium': { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
  'High': { bg: 'rgba(248,113,113,0.1)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
};

const STATUS_COLORS = {
  'Open': { bg: 'rgba(248,113,113,0.1)', text: '#f87171', border: 'rgba(248,113,113,0.2)' },
  'In Progress': { bg: 'rgba(96,165,250,0.1)', text: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
  'Pending Client': { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
  'Resolved': { bg: 'rgba(52,211,153,0.1)', text: '#34d399', border: 'rgba(52,211,153,0.2)' },
  'Closed': { bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.5)', border: 'rgba(255,255,255,0.1)' },
};

/* ─── Client Dashboard ─── */
function ClientDashboard({ firebaseUser }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef(null);

  const load = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    try {
      const q = query(
        collection(db, 'supportTickets'), 
        where('clientId', '==', firebaseUser.uid)
      );
      const snap = await getDocs(q);
      const fetchedTickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort in JavaScript to avoid requiring a composite index in Firestore
      fetchedTickets.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      
      setTickets(fetchedTickets);
    } catch (e) { 
      console.error("Error loading tickets:", e); 
      // If index is missing, it will log the URL to create it in the console.
    }
    setLoading(false);
    setRefreshing(false);
  }, [firebaseUser.uid]);

  // eslint-disable-next-line
  useEffect(() => { load(false); }, [load]);

  // Real-time chat listener
  useEffect(() => {
    if (!viewTicket) return;
    const q = query(collection(db, `supportTickets/${viewTicket.id}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [viewTicket]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const now = new Date();
      // Client-side generated ID. In a prod app, this might be better handled by a cloud function to ensure sequential uniqueness.
      const num = `TKT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      
      const payload = {
        ticketId: num,
        clientId: firebaseUser.uid,
        clientName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: 'Open',
        assignedTo: null,
        assignedToName: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: firebaseUser.email
      };

      await addDoc(collection(db, 'supportTickets'), payload);
      setShowSidebar(false);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !viewTicket) return;
    setSendingMsg(true);
    try {
      await addDoc(collection(db, `supportTickets/${viewTicket.id}/messages`), {
        senderId: firebaseUser.uid,
        senderName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        senderRole: 'client',
        text: newMessage.trim(),
        timestamp: serverTimestamp()
      });
      setNewMessage('');
      
      // Update ticket updatedAt
      await updateDoc(doc(db, 'supportTickets', viewTicket.id), {
        updatedAt: serverTimestamp()
      });
      
    } catch (err) { console.error(err); }
    setSendingMsg(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0d14', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#fff' }}>
      {/* Sticky topbar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,13,20,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.35)' }}>
              <ShieldCheck size={20} color="#fff" />
            </div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Client Portal</span>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Welcome back, {firebaseUser.displayName || firebaseUser.email.split('@')[0]}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/')} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ExternalLink size={14} /> Visit Main Website
            </button>
            <button onClick={() => signOut(auth)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        
        {/* Tempting Call to Action */}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,106,26,0.1), rgba(255,154,74,0.05))', border: '1px solid rgba(255,106,26,0.2)', borderRadius: 20, padding: 32, marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px 0', color: '#ff9a4a' }}>Looking for more?</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, margin: 0, maxWidth: 600, lineHeight: 1.6 }}>Check out our latest portfolio and services on the main Odyssey Clinic System website. We're always building something new.</p>
          </div>
          <button onClick={() => navigate('/')} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '14px 28px', fontSize: 15, fontWeight: 600, boxShadow: '0 8px 24px rgba(255,106,26,0.3)', borderRadius: 12 }}>
            Explore Our Portfolio <ArrowLeft size={16} style={{ transform: 'rotate(135deg)', marginLeft: 4 }} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>My Support Tickets</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => load()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
            <button onClick={() => { setForm(emptyForm()); setShowSidebar(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>
              <Plus size={16} /> Submit New Ticket
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
            <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', display: 'block' }} /><p>Loading your tickets…</p>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 20 }}>
            <MessageSquare size={48} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, marginBottom: 24 }}>You haven't submitted any support tickets yet.</p>
            <button onClick={() => { setForm(emptyForm()); setShowSidebar(true); }} style={{ ...S.btn, background: 'rgba(255,255,255,0.08)', color: '#fff', margin: '0 auto' }}>
              Submit your first ticket
            </button>
          </div>
        ) : (
          <div style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
                <tr>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Ticket ID</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Title</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Priority</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                  <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Submitted</th>
                  <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];
                  const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
                  
                  return (
                    <tr key={ticket.id} className="ticket-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '18px 24px', fontWeight: 700, color: '#fff', verticalAlign: 'middle' }}>{ticket.ticketId}</td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{ticket.title}</div>
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <span style={{ display: 'inline-flex', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, borderRadius: 8 }}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <span style={{ display: 'inline-flex', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 8 }}>
                          {ticket.status}
                        </span>
                      </td>
                      <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13, verticalAlign: 'middle' }}>
                        {fmtDateLong(ticket.createdAt)}
                      </td>
                      <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => setViewTicket(ticket)} style={{ ...S.btn, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }}>
                            <Eye size={14} /> Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create Ticket Sidebar */}
      {showSidebar && (
        <>
          <div onClick={() => setShowSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 500, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Submit New Ticket</h3>
              <button onClick={() => setShowSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={S.lbl}>Title</label>
                <input style={S.inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief summary of the issue" required />
              </div>
              
              <div>
                <label style={S.lbl}>Description</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 120 }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed explanation..." required />
              </div>

              <div>
                <label style={S.lbl}>Priority</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
                  {['Low', 'Medium', 'High'].map(p => {
                    const c = PRIORITY_COLORS[p];
                    const active = form.priority === p;
                    return (
                      <button
                        key={p} type="button" onClick={() => setForm(f => ({ ...f, priority: p }))}
                        style={{ ...S.btn, justifyContent: 'center', padding: '10px 0', background: active ? c.bg : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? c.border : 'rgba(255,255,255,0.1)'}`, color: active ? c.text : 'rgba(255,255,255,0.4)', fontWeight: active ? 600 : 400, borderRadius: 10 }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={saving} style={{ ...S.btn, background: saving ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(59,130,246,0.3)', width: '100%', marginTop: 12 }}>
                {saving ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Ticket Details & Chat Modal */}
      {viewTicket && (() => {
        const pc = PRIORITY_COLORS[viewTicket.priority] || PRIORITY_COLORS['Medium'];
        const sc = STATUS_COLORS[viewTicket.status] || STATUS_COLORS['Open'];
        
        return (
          <>
            <div onClick={() => setViewTicket(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 200 }} />
            <div style={{ position: 'fixed', top: '5%', bottom: '5%', left: '50%', transform: 'translateX(-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, zIndex: 201, width: '100%', maxWidth: 1000, display: 'flex', overflow: 'hidden' }}>
              
              {/* Left Side: Ticket Details */}
              <div style={{ width: '40%', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>{viewTicket.ticketId}</h3>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Submitted on {fmtDateLong(viewTicket.createdAt)}</div>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{viewTicket.title}</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                      {viewTicket.description}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div>
                      <label style={S.lbl}>Priority</label>
                      <span style={{ display: 'inline-flex', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}`, borderRadius: 8 }}>
                        {viewTicket.priority}
                      </span>
                    </div>
                    <div>
                      <label style={S.lbl}>Status</label>
                      <span style={{ display: 'inline-flex', padding: '4px 10px', fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: 8 }}>
                        {viewTicket.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Chat System */}
              <div style={{ width: '60%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={18} color="#60a5fa" />
                    <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Chat with Support</span>
                  </div>
                  <button onClick={() => setViewTicket(null)} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', padding: 6 }}><X size={16} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <p>Support has been notified. Leave a message here.</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.senderId === firebaseUser.uid;
                      const isAdmin = msg.senderRole === 'admin';
                      return (
                        <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>{isMe ? 'You' : msg.senderName}</span>
                            {isAdmin && <span style={{ background: 'rgba(255,106,26,0.1)', color: '#ff9a4a', fontSize: 9, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Admin</span>}
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{fmtDateLong(msg.timestamp)}</span>
                          </div>
                          <div style={{ 
                            background: isMe ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255,255,255,0.08)', 
                            color: '#fff', 
                            padding: '12px 16px', 
                            borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                            maxWidth: '85%',
                            fontSize: 14,
                            lineHeight: 1.5,
                            border: isMe ? 'none' : '1px solid rgba(255,255,255,0.05)'
                          }}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div style={{ padding: 24, borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
                  <form onSubmit={sendMessage} style={{ display: 'flex', gap: 12 }}>
                    <input 
                      style={{ ...S.inp, flex: 1, padding: '14px 16px', borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} 
                      value={newMessage} 
                      onChange={e => setNewMessage(e.target.value)} 
                      placeholder="Type a reply..." 
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim() || sendingMsg} 
                      style={{ ...S.btn, borderRadius: 24, width: 48, height: 48, padding: 0, justifyContent: 'center', background: (!newMessage.trim() || sendingMsg) ? 'rgba(255,255,255,0.05)' : '#3b82f6', color: (!newMessage.trim() || sendingMsg) ? 'rgba(255,255,255,0.3)' : '#fff' }}
                    >
                      <Send size={18} style={{ marginLeft: -2, marginTop: 2 }} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .ticket-row:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>
    </div>
  );
}

/* ─── Client Login Screen ─── */
function ClientLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in parent will handle transition
    } catch {
      setError('Invalid email or password. Please contact support if you need an account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalLogin
      variant="client"
      eyebrow="Client portal"
      title="Support access for systems already in motion."
      subtitle="Sign in to review tickets, send updates, and keep implementation questions in one place."
      sideTitle="Client workspace"
      sideCopy="Protected access for support tickets and maintenance conversations."
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      error={error}
      loading={loading}
      submitLabel="Sign in"
      loadingLabel="Signing in"
      emailPlaceholder="client@example.com"
    />
  );

}
export default function ClientPortal() {
  const [firebaseUser, setFirebaseUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setFirebaseUser(u ?? null));
    return unsubscribe;
  }, []);

  if (firebaseUser === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0d14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RefreshCw size={32} color="rgba(255,255,255,0.3)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!firebaseUser) return <ClientLogin />;
  return <ClientDashboard firebaseUser={firebaseUser} />;
}
