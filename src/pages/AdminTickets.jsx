import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Plus, X, RefreshCw, Eye, MessageSquare, Clock, CheckCircle2, UserPlus, Send } from 'lucide-react';

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

export default function AdminTickets({ firebaseUser, isSuperAdmin }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [filterTab, setFilterTab] = useState('All'); // All, Open, In Progress, Resolved
  
  const [showSidebar, setShowSidebar] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  
  const [assignModal, setAssignModal] = useState(null); // ticket object
  const [assignName, setAssignName] = useState('');
  
  const [viewTicket, setViewTicket] = useState(null);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef(null);

  const load = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, 'supportTickets'), orderBy('createdAt', 'desc')));
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // eslint-disable-next-line
  useEffect(() => { load(false); }, [load]);

  // Real-time listener for current ticket's messages
  useEffect(() => {
    if (!viewTicket) return;
    const q = query(collection(db, `supportTickets/${viewTicket.id}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Scroll to bottom
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [viewTicket]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const now = new Date();
      const num = `TKT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(tickets.length + 1).padStart(3, '0')}`;
      
      const payload = {
        ticketId: num,
        clientId: firebaseUser.uid || firebaseUser.email,
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

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignName.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'supportTickets', assignModal.id), {
        assignedToName: assignName.trim(),
        status: assignModal.status === 'Open' ? 'In Progress' : assignModal.status,
        updatedAt: serverTimestamp()
      });
      setAssignModal(null);
      setAssignName('');
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const updateStatus = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, 'supportTickets', ticketId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      load();
      if (viewTicket && viewTicket.id === ticketId) {
        setViewTicket(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) { console.error(err); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !viewTicket) return;
    setSendingMsg(true);
    try {
      await addDoc(collection(db, `supportTickets/${viewTicket.id}/messages`), {
        senderId: firebaseUser.uid || firebaseUser.email,
        senderName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        senderRole: isSuperAdmin ? 'admin' : 'client',
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

  const filteredTickets = tickets.filter(t => {
    if (filterTab === 'All') return true;
    return t.status === filterTab;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved: tickets.filter(t => t.status === 'Resolved').length,
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Support Tickets</h2>
          {stats.open > 0 && (
            <span style={{ background: '#f87171', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
              {stats.open} Open
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => load()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => { setForm(emptyForm()); setShowSidebar(true); }} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
            <Plus size={16} /> New Ticket
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Total Tickets', v: stats.total, c: '#fff' },
          { l: 'Open', v: stats.open, c: '#f87171' },
          { l: 'In Progress', v: stats.inProgress, c: '#60a5fa' },
          { l: 'Resolved', v: stats.resolved, c: '#34d399' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ ...S.card }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
            <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>
        {['All', 'Open', 'In Progress', 'Resolved'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            style={{
              background: filterTab === tab ? 'rgba(255,106,26,0.1)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              color: filterTab === tab ? '#ff9a4a' : 'rgba(255,255,255,0.5)',
              fontWeight: filterTab === tab ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p>Loading…</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>No tickets found in this view.</div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Ticket ID</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Title & Client</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Priority</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Assigned To</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map(ticket => {
                const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS['Medium'];
                const sc = STATUS_COLORS[ticket.status] || STATUS_COLORS['Open'];
                
                return (
                  <tr key={ticket.id} className="ticket-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '18px 24px', fontWeight: 700, color: '#fff', verticalAlign: 'middle' }}>{ticket.ticketId}</td>
                    <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{ticket.title}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{ticket.clientName}</div>
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
                    <td style={{ padding: '18px 24px', verticalAlign: 'middle', color: ticket.assignedToName ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                      {ticket.assignedToName || 'Unassigned'}
                    </td>
                    <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {isSuperAdmin && (
                           <button onClick={() => setAssignModal(ticket)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} title="Assign">
                             <UserPlus size={14} /> Assign
                           </button>
                        )}
                        <button onClick={() => setViewTicket(ticket)} style={{ ...S.btn, background: 'rgba(96,165,250,0.1)', color: '#60a5fa' }} title="View Ticket">
                          <Eye size={14} /> View
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

              <button type="submit" disabled={saving} style={{ ...S.btn, background: saving ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 12 }}>
                {saving ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <>
          <div onClick={() => setAssignModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, zIndex: 201, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>Assign Ticket</h3>
              <button onClick={() => setAssignModal(null)} style={{ ...S.btn, background: 'none', color: 'rgba(255,255,255,0.5)', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>Assigning <strong style={{ color: '#fff' }}>{assignModal.ticketId}</strong> - {assignModal.title}</div>
            
            <form onSubmit={handleAssign}>
              <div style={{ marginBottom: 18 }}>
                <label style={S.lbl}>Developer Name</label>
                <input style={S.inp} value={assignName} onChange={e => setAssignName(e.target.value)} placeholder="Enter developer name" autoFocus required />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setAssignModal(null)} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                <button type="submit" disabled={!assignName.trim() || saving} style={{ ...S.btn, flex: 2, justifyContent: 'center', background: (!assignName.trim() || saving) ? 'rgba(96,165,250,0.2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 600, boxShadow: (!assignName.trim() || saving) ? 'none' : '0 4px 14px rgba(59,130,246,0.3)' }}>
                  {saving ? 'Assigning...' : 'Assign'}
                </button>
              </div>
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
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Submitted by {viewTicket.clientName}</div>
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
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={S.lbl}>Assigned To</label>
                      <div style={{ color: viewTicket.assignedToName ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 500 }}>
                        {viewTicket.assignedToName || 'Unassigned'}
                      </div>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <label style={S.lbl}>Update Status</label>
                      <select 
                        style={{ ...S.inp, cursor: 'pointer', appearance: 'auto' }}
                        value={viewTicket.status}
                        onChange={(e) => updateStatus(viewTicket.id, e.target.value)}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Client">Pending Client</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Chat System */}
              <div style={{ width: '60%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={18} color="#ff9a4a" />
                    <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Messages</span>
                  </div>
                  <button onClick={() => setViewTicket(null)} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', padding: 6 }}><X size={16} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                      <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.senderId === (firebaseUser.uid || firebaseUser.email);
                      const isAdmin = msg.senderRole === 'admin';
                      return (
                        <div key={msg.id || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>{msg.senderName}</span>
                            {isAdmin && <span style={{ background: 'rgba(255,106,26,0.1)', color: '#ff9a4a', fontSize: 9, padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Admin</span>}
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{fmtDateLong(msg.timestamp)}</span>
                          </div>
                          <div style={{ 
                            background: isMe ? 'linear-gradient(135deg, #ff6a1a, #e85d04)' : 'rgba(255,255,255,0.08)', 
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
                      placeholder="Type a message..." 
                    />
                    <button 
                      type="submit" 
                      disabled={!newMessage.trim() || sendingMsg} 
                      style={{ ...S.btn, borderRadius: 24, width: 48, height: 48, padding: 0, justifyContent: 'center', background: (!newMessage.trim() || sendingMsg) ? 'rgba(255,255,255,0.05)' : '#ff6a1a', color: (!newMessage.trim() || sendingMsg) ? 'rgba(255,255,255,0.3)' : '#fff' }}
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
