import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
// eslint-disable-next-line no-unused-vars
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Plus, X, Trash2, Printer, Edit2, RefreshCw, Eye, Copy, Check, Award } from 'lucide-react';
import CustomModal from '../components/ui/CustomModal';
import LoadingButton from '../components/ui/LoadingButton';
import { buildMoaHtml } from '../utils/moaDocument';
import { openPrintWindow } from '../utils/brandDocument';

const CO = {
  address: '3F Roxas Building, N. Bacalso National Road, Lawaan 3, Talisay City, Cebu',
  email: 'odysseyphitsolutions@gmail.com',
  phone: '09930050994 / 09099855322',
  serviceProviderName: 'Johnjosfir B. Roca',
  serviceProviderBusiness: 'OdysseyPH IT Solutions',
};

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const today = () => new Date().toISOString().split('T')[0];
const fmtDateLong = (s) => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

const getSigFontSizePrint = (name) => {
  const len = (name || '').length;
  if (len > 25) return '16px';
  if (len > 20) return '20px';
  if (len > 15) return '24px';
  return '32px';
};

function printMOA(moa) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const html = buildMoaHtml(moa, {}, { origin, autoPrint: true });
  openPrintWindow(html);
}

const emptyForm = () => ({
  clientName: '',
  clientBusiness: '',
  clientAddress: '',
  providerName: CO.serviceProviderName,
  providerBusiness: CO.serviceProviderBusiness,
  purpose: 'The purpose of this Agreement is to define the terms and conditions under which Party B shall implement specific enhancements to the existing system of Party A.',
  scope: [
    { id: 1, title: 'QR Code CMS Booking Receipt Feature', items: ['Generation of booking receipts based on booking data', 'Display of complete booking details', 'Printable receipt layout', 'Option to save/download receipt as PDF', 'Option to save/download receipt as Image'] },
    { id: 2, title: 'Booking Filter Functionality', items: ['Filter bookings from newest to oldest', 'Filter bookings to display today\'s bookings only'] }
  ],
  projectCost: '5000',
  paymentTerms: [
    'Payment shall be made 100% upon completion and turnover of the project.',
    'Upon completion, Party B shall present the system for review.',
    'Party A agrees to sign a Certificate of Acceptance once the deliverables meet the agreed scope.',
    'Payment shall be released after acceptance.'
  ],
  timeline: 'One (1) Week',
  maintenancePeriod: 'one (1) month',
  warranty: [
    'Party B guarantees that the system will function according to the agreed scope upon delivery',
    'Party A is responsible for reviewing and testing the system upon turnover',
    'Once accepted, the project is considered complete and fulfilled'
  ],
  liability: [
    'Changes requested outside the agreed scope',
    'Third-party system issues',
    'User misuse or improper system handling'
  ],
  generalTerms: [
    'This Agreement represents the entire understanding between both parties',
    'Any amendments must be made in writing and signed by both parties'
  ],
  date: today(),
  hideFooter: false,
});

export default function AdminMOA({ firebaseUser, isSuperAdmin, can }) {
  // Permission flags
  const canCreateMOA = can ? can('moa:create') : isSuperAdmin;
  const canEditMOA = can ? can('moa:edit') : isSuperAdmin;
  const canSignMOA = can ? can('moa:sign') : isSuperAdmin;
  const canDeleteMOA = can ? can('moa:delete') : isSuperAdmin;

  const [moas, setMoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiText, setAiText] = useState('');
  const [showFreeformModal, setShowFreeformModal] = useState(false);
  const [freeformText, setFreeformText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [copiedId, setCopiedId] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', icon: 'info', promptFields: [], onConfirm: null });

  const showAlert = (title, message, icon = 'info') => {
    setModal({ isOpen: true, title, message, type: 'alert', icon });
  };

  const handleCopyLink = (moaId) => {
    const link = `${window.location.origin}/moa/${moaId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(moaId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleProviderSign = (moa) => {
    setModal({
      isOpen: true,
      title: 'Sign as Service Provider',
      message: 'Please enter your signing name and title/designation below:',
      type: 'prompt',
      icon: 'question',
      promptFields: [
        { key: 'name', label: 'Full Name', defaultValue: 'Jetch Merald S. Madaya', placeholder: 'e.g. Jetch Merald S. Madaya' },
        { key: 'title', label: 'Title / Designation', defaultValue: 'Owner, OdysseyPH IT Solutions', placeholder: 'e.g. Owner' }
      ],
      onConfirm: async (fields) => {
        if (!fields.name || !fields.name.trim()) {
          showAlert('Name Required', 'Full Name is required to sign the agreement.', 'warning');
          return;
        }
        try {
          await updateDoc(doc(db, 'moas', moa.id), {
            providerSigned: true,
            providerSigneeName: fields.name.trim(),
            providerSigneeTitle: fields.title.trim() || 'Owner, OdysseyPH IT Solutions',
            providerSignedAt: serverTimestamp(),
          });
          load();
        } catch (e) {
          console.error("Error signing MOA:", e);
          showAlert('Signing Error', 'Failed to sign the agreement. Please try again.', 'warning');
        }
      }
    });
  };
  const [ffFooter, setFfFooter] = useState({ clientName: '', providerName: CO.serviceProviderName, providerBusiness: CO.serviceProviderBusiness, date: today(), hideFooter: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    setLoading(true);
    const q = query(collection(db, 'moas'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMoas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.error("Error listening to MOAs:", err);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsubscribe();
  }, []);

  // Scope Management
  const addScopeGroup = () => setForm(f => ({ ...f, scope: [...(f.scope || []), { id: Date.now(), title: '', items: [''] }] }));
  const removeScopeGroup = (id) => setForm(f => ({ ...f, scope: f.scope.filter(g => g.id !== id) }));
  const updScopeGroupTitle = (id, title) => setForm(f => ({ ...f, scope: f.scope.map(g => g.id === id ? { ...g, title } : g) }));

  const addScopeItem = (groupId) => setForm(f => ({ ...f, scope: f.scope.map(g => g.id === groupId ? { ...g, items: [...g.items, ''] } : g) }));
  const removeScopeItem = (groupId, itemIdx) => setForm(f => ({ ...f, scope: f.scope.map(g => g.id === groupId ? { ...g, items: g.items.filter((_, idx) => idx !== itemIdx) } : g) }));
  const updScopeItem = (groupId, itemIdx, val) => setForm(f => ({ ...f, scope: f.scope.map(g => g.id === groupId ? { ...g, items: g.items.map((v, i) => i === itemIdx ? val : v) } : g) }));

  // List Management (Payment, Warranty, etc.)
  const handleListChange = (key, val) => {
    const list = val.split('\n').filter(s => s.trim() !== '');
    setForm(f => ({ ...f, [key]: list }));
  };

  const handleAiImport = () => {
    let data = {};
    try {
      const jsonStr = aiText.match(/\{[\s\S]*\}/)?.[0];
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (parsed.clientName || parsed.scope) data = parsed;
      }
      // eslint-disable-next-line no-unused-vars
    } catch (e) { /* ignore */ }

    if (!data.clientName && !data.scope) {
      const extract = (regex) => (aiText.match(regex)?.[1] || '').trim().replace(/\*|_/g, '');
      data.clientName = extract(/Client Name:?\s*([^\n]+)/i) || extract(/Name:?\s*([^\n]+)/i);
      data.clientBusiness = extract(/Business Name:?\s*([^\n]+)/i) || extract(/Company:?\s*([^\n]+)/i);

      if (!data.clientBusiness) {
        const clientMatch = aiText.match(/([^\n]+)\s*\n+\(Hereinafter referred to as the [“"']Client[”"']\)/i);
        if (clientMatch) data.clientBusiness = clientMatch[1].trim();
      }

      data.clientAddress = extract(/Address:?\s*([^\n]+)/i);

      const costRaw = extract(/Project Cost:?\s*(?:₱|PHP)?\s*([\d,.]+)/i) || extract(/pay (?:₱|PHP)?\s*([\d,.]+)/i);
      data.projectCost = costRaw ? costRaw.replace(/,/g, '') : '';

      data.timeline = extract(/Timeline:?\s*([^\n]+)/i) || extract(/Development Timeline:?\s*([^\n]+)/i);
      data.maintenancePeriod = extract(/Maintenance(?: Period)?:?\s*([^\n]+)/i);

      const scopeMatch = aiText.match(/(?:Scope of Work|SCOPE OF SERVICES):?([\s\S]+?)(?:\n\d+\.|\n\n[A-Z]|$)/i);
      if (scopeMatch) {
        const scopeLines = scopeMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
        let currentGroup = { id: Date.now(), title: 'General Scope', items: [] };
        data.scope = [currentGroup];

        scopeLines.forEach(line => {
          // If line ends with colon or is all caps, treat as group title
          if (line.endsWith(':') || (line === line.toUpperCase() && line.length > 5 && !line.match(/^[-*]/))) {
            const cleanTitle = line.replace(/^[#\s]+/, '').replace(/[:*_*]/g, '').trim();
            if (cleanTitle) {
              currentGroup = { id: Date.now() + Math.random(), title: cleanTitle, items: [] };
              data.scope.push(currentGroup);
            }
          } else {
            // Treat as item
            const cleanLine = line.replace(/^[-*\d.\s]+/, '').trim();
            if (cleanLine && cleanLine.length > 3 && !cleanLine.toLowerCase().includes('service provider agrees')) {
              currentGroup.items.push(cleanLine);
            }
          }
        });
        data.scope = data.scope.filter(g => g.items.length > 0);
      }
    }

    setForm(f => ({
      ...f,
      ...(data.clientName && { clientName: data.clientName }),
      ...(data.clientBusiness && { clientBusiness: data.clientBusiness }),
      ...(data.clientAddress && { clientAddress: data.clientAddress }),
      ...(data.projectCost && { projectCost: data.projectCost }),
      ...(data.timeline && { timeline: data.timeline }),
      ...(data.maintenancePeriod && { maintenancePeriod: data.maintenancePeriod }),
      ...(data.scope && data.scope.length > 0 && { scope: data.scope }),
    }));
    setShowAiModal(false);
    setAiText('');
  };

  const copyPrompt = () => {
    const prompt = `Please generate a Memorandum of Agreement based on my requirements. You must return ONLY a valid JSON object matching exactly this structure, no markdown formatting or extra text:\n\n{\n  "clientName": "Name of contact",\n  "clientBusiness": "Name of Business",\n  "clientAddress": "Address",\n  "projectCost": "amount in numbers only",\n  "timeline": "e.g. 1 week",\n  "maintenancePeriod": "e.g. 1 month",\n  "scope": [\n    {\n      "title": "Group Title",\n      "items": ["Feature 1", "Feature 2"]\n    }\n  ]\n}`;
    navigator.clipboard.writeText(prompt);
    showAlert(
      'Prompt Copied!',
      'Prompt copied to clipboard! Paste this into ChatGPT/Claude along with your MOA requirements, then paste the resulting JSON here.',
      'success'
    );
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const autoExtractFfFooter = useCallback(() => {
    if (!freeformText.trim()) return;
    const extract = (regex) => (freeformText.match(regex)?.[1] || '').trim().replace(/\*|_/g, '');
    let cName = extract(/Client Name:?\s*([^\n]+)/i) || extract(/Name:?\s*([^\n]+)/i);
    let cBusiness = extract(/Business Name:?\s*([^\n]+)/i) || extract(/Company:?\s*([^\n]+)/i);

    if (!cBusiness) {
      const clientMatch = freeformText.match(/([^\n]+)\s*\n+\(Hereinafter referred to as the [“"']Client[”"']\)/i);
      if (clientMatch) cBusiness = clientMatch[1].trim();
    }

    if (!cName && cBusiness) cName = cBusiness;

    setFfFooter(prev => ({
      ...prev,
      clientName: cName || prev.clientName,
      date: today()
    }));
  }, [freeformText]);

  const handleFreeformSubmit = async () => {
    if (!freeformText.trim()) return;
    setSaving(true);

    const payload = {
      isFreeform: true,
      freeformContent: freeformText,
      clientName: ffFooter.clientName || "Unknown Client",
      clientBusiness: ffFooter.clientName || "Unknown Business", // Use client name as business if not found
      projectCost: '0',
      date: ffFooter.date || today(),
      providerName: ffFooter.providerName || CO.serviceProviderName,
      providerBusiness: ffFooter.providerBusiness || CO.serviceProviderBusiness,
      hideFooter: ffFooter.hideFooter,
      clientSigned: false,
      providerSigned: false,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: firebaseUser.email,
    };

    // Try to extract cost if available in text
    const extract = (regex) => (freeformText.match(regex)?.[1] || '').trim().replace(/\*|_/g, '');
    const costRaw = extract(/Project Cost:?\s*(?:₱|PHP)?\s*([\d,.]+)/i) || extract(/pay (?:₱|PHP)?\s*([\d,.]+)/i);
    if (costRaw) payload.projectCost = costRaw.replace(/,/g, '');

    try {
      if (editingId) {
        await updateDoc(doc(db, 'moas', editingId), payload);
        setShowFreeformModal(false);
        setFreeformText('');
        setEditingId(null);
        load();
      } else {
        const now = new Date();
        const num = `MOA-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(moas.length + 1).padStart(3, '0')}`;
        payload.moaNumber = num;

        const docRef = await addDoc(collection(db, 'moas'), payload);

        setShowFreeformModal(false);
        setFreeformText('');
        load();

        // Auto print
        printMOA({ ...payload, id: docRef.id });
      }
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setShowSidebar(true); };
  const openEdit = (moa) => {
    setEditingId(moa.id);
    setForm({
      ...emptyForm(),
      ...moa,
      date: moa.date || today()
    });
    setShowSidebar(true);
  };
  const openFreeformEdit = (moa) => {
    setEditingId(moa.id);
    setFreeformText(moa.freeformContent || '');
    setFfFooter({
      clientName: moa.clientName || '',
      providerName: moa.providerName || CO.serviceProviderName,
      providerBusiness: moa.providerBusiness || CO.serviceProviderBusiness,
      date: moa.date || today(),
      hideFooter: moa.hideFooter || false
    });
    setShowFreeformModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, updatedAt: serverTimestamp() };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'moas', editingId), payload);
      } else {
        const now = new Date();
        const num = `MOA-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(moas.length + 1).padStart(3, '0')}`;
        await addDoc(collection(db, 'moas'), { ...payload, moaNumber: num, clientSigned: false, providerSigned: false, createdAt: serverTimestamp(), createdBy: firebaseUser.email });
      }
      setShowSidebar(false);
      load();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = (moa) => {
    setModal({
      isOpen: true,
      title: 'Delete MOA',
      message: `Are you sure you want to delete agreement ${moa.moaNumber} for ${moa.clientName}? This action cannot be undone.`,
      type: 'confirm',
      icon: 'warning',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'moas', moa.id));
          setMoas(prev => prev.filter(i => i.id !== moa.id));
        } catch (e) {
          console.error("Error deleting:", e);
          showAlert('Delete Error', 'Failed to delete MOA document.', 'warning');
        }
      }
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Memorandum of Agreement</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <LoadingButton onClick={() => load()} loading={refreshing} loadingLabel="Refreshing…" style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} /> Refresh
          </LoadingButton>
          {canCreateMOA && (
            <>
              <button onClick={() => { setEditingId(null); setShowFreeformModal(true); setFreeformText(''); }} style={{ ...S.btn, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', padding: '10px 18px', border: '1px solid rgba(96,165,250,0.3)' }}>
                ⚡ Quick AI Paste
              </button>
              <button onClick={openCreate} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
                <Plus size={16} /> New MOA
              </button>
            </>
          )}
        </div>
      </div>

      <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { l: 'Total MOAs', v: moas.length, c: '#fff' },
        ].map(({ l, v, c }) => (
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
      ) : moas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>No MOAs generated yet.</div>
      ) : (
        <div className="admin-table-card" style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>MOA Number</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Client</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Date</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Project Cost</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {moas.map(moa => (
                <tr key={moa.id} className="moa-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '18px 24px', fontWeight: 700, color: '#fff', verticalAlign: 'middle' }}>{moa.moaNumber}</td>
                  <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{moa.clientName}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>{moa.clientBusiness}</div>
                  </td>
                  <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13, verticalAlign: 'middle' }}>{fmtDateLong(moa.date)}</td>
                  <td style={{ padding: '18px 24px', textAlign: 'right', color: '#ff9a4a', fontWeight: 700, fontSize: 16, verticalAlign: 'middle' }}>₱{fmt(moa.projectCost)}</td>
                  <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleCopyLink(moa.id)}
                        style={{
                          ...S.btn,
                          background: copiedId === moa.id ? 'rgba(52,211,153,0.15)' : 'rgba(96,165,250,0.1)',
                          color: copiedId === moa.id ? '#34d399' : '#60a5fa',
                        }}
                        title="Copy Client Sign-off Link"
                      >
                        {copiedId === moa.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === moa.id ? 'Copied Link!' : 'Copy Link'}
                      </button>

                      {canSignMOA && !moa.providerSigned && (
                        <button
                          onClick={() => handleProviderSign(moa)}
                          style={{ ...S.btn, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', border: '1px solid rgba(255,106,26,0.3)' }}
                          title="Sign MOA as Provider"
                        >
                          <Award size={12} /> Sign
                        </button>
                      )}

                      <button onClick={() => printMOA(moa)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} title="Print MOA"><Printer size={14} /> Print</button>
                      {canEditMOA && (
                        <button onClick={() => moa.isFreeform ? openFreeformEdit(moa) : openEdit(moa)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', padding: 8 }} title="Edit Form"><Edit2 size={14} /></button>
                      )}
                      {canDeleteMOA && (
                        <button onClick={() => handleDelete(moa)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: 8 }} title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showSidebar && (
        <>
          <div onClick={() => setShowSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 600, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>{editingId ? 'Edit MOA' : 'New MOA'}</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowAiModal(true)} style={{ ...S.btn, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', padding: '6px 12px' }}>✨ Auto-Fill from AI</button>
                <button type="button" onClick={() => setShowSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Party A (Client) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#ff9a4a', margin: '0 0 16px 0', fontSize: 14 }}>Party A (Client) Details</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={S.lbl}>Client Name</label>
                    <input style={S.inp} value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="e.g. Kharyl Simolde" required />
                  </div>
                  <div>
                    <label style={S.lbl}>Business Name</label>
                    <input style={S.inp} value={form.clientBusiness} onChange={e => setForm(f => ({ ...f, clientBusiness: e.target.value }))} placeholder="e.g. International Marketing Services" required />
                  </div>
                  <div>
                    <label style={S.lbl}>Address</label>
                    <input style={S.inp} value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="e.g. Cebu City" required />
                  </div>
                </div>
              </div>

              {/* Party B & General */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#60a5fa', margin: '0 0 16px 0', fontSize: 14 }}>Party B (Provider) Details</h4>
                <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                  <div>
                    <label style={S.lbl}>Provider Rep Name</label>
                    <input style={S.inp} value={form.providerName} onChange={e => setForm(f => ({ ...f, providerName: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={S.lbl}>Date</label>
                    <input type="date" style={S.inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={S.lbl}>Provider Business Name</label>
                  <input style={S.inp} value={form.providerBusiness} onChange={e => setForm(f => ({ ...f, providerBusiness: e.target.value }))} required />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="hideFooter" checked={form.hideFooter} onChange={e => setForm(f => ({ ...f, hideFooter: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="hideFooter" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>Hide Signature Footer</label>
                </div>
              </div>

              <div>
                <label style={S.lbl}>1. Purpose of Agreement</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 80 }} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} required />
              </div>

              {/* Scope of Work */}
              <div>
                <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ ...S.lbl, marginBottom: 0 }}>2. Scope of Work</label>
                  <button type="button" onClick={addScopeGroup} style={{ ...S.btn, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', fontSize: 12, padding: '4px 10px' }}><Plus size={13} /> Add Group</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(form.scope || []).map((group) => (
                    <div key={group.id} style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                        <input style={{ ...S.inp, flex: 1 }} value={group.title} onChange={e => updScopeGroupTitle(group.id, e.target.value)} placeholder="Feature Group Title" required />
                        <button type="button" onClick={() => removeScopeGroup(group.id)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: '0 12px' }}><Trash2 size={14} /></button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16 }}>
                        {group.items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                            <input style={{ ...S.inp, padding: '8px 12px', fontSize: 13 }} value={item} onChange={e => updScopeItem(group.id, idx, e.target.value)} placeholder="Bullet point item" required />
                            <button type="button" onClick={() => removeScopeItem(group.id, idx)} disabled={group.items.length === 1} style={{ ...S.btn, background: 'none', color: '#f87171', padding: 4, opacity: group.items.length === 1 ? 0.3 : 1 }}><X size={14} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addScopeItem(group.id)} style={{ ...S.btn, background: 'transparent', color: '#60a5fa', fontSize: 12, width: 'fit-content', padding: '4px 8px', marginTop: 4 }}><Plus size={12} /> Add Item</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={S.lbl}>4. Project Cost (₱)</label>
                <input type="number" min="0" step="0.01" style={S.inp} value={form.projectCost} onChange={e => setForm(f => ({ ...f, projectCost: e.target.value }))} required />
              </div>

              <div>
                <label style={S.lbl}>5. Payment Terms (One per line)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 100 }} value={(form.paymentTerms || []).join('\n')} onChange={e => handleListChange('paymentTerms', e.target.value)} required />
              </div>

              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.lbl}>6. Dev Timeline</label>
                  <input style={S.inp} value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))} placeholder="e.g. One (1) Week" required />
                </div>
                <div>
                  <label style={S.lbl}>7. Maint. Period</label>
                  <input style={S.inp} value={form.maintenancePeriod} onChange={e => setForm(f => ({ ...f, maintenancePeriod: e.target.value }))} placeholder="e.g. one (1) month" required />
                </div>
              </div>

              <div>
                <label style={S.lbl}>8. Warranty & Acceptance (One per line)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 100 }} value={(form.warranty || []).join('\n')} onChange={e => handleListChange('warranty', e.target.value)} required />
              </div>

              <div>
                <label style={S.lbl}>9. Liability Limitation (One per line)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 100 }} value={(form.liability || []).join('\n')} onChange={e => handleListChange('liability', e.target.value)} required />
              </div>

              <div>
                <label style={S.lbl}>10. General Terms (One per line)</label>
                <textarea style={{ ...S.inp, resize: 'vertical', minHeight: 100 }} value={(form.generalTerms || []).join('\n')} onChange={e => handleListChange('generalTerms', e.target.value)} required />
              </div>

              <LoadingButton type="submit" loading={saving} loadingLabel="Saving…" style={{ ...S.btn, background: saving ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 8 }}>
                {editingId ? 'Update MOA' : 'Create MOA'}
              </LoadingButton>
            </form>
          </div>
        </>
      )}

      {/* AI Import Modal */}
      {showAiModal && (
        <>
          <div onClick={() => setShowAiModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, zIndex: 201, width: '100%', maxWidth: 500 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>✨ Auto-Fill from AI</h3>
              <button onClick={() => setShowAiModal(false)} style={{ ...S.btn, background: 'none', color: 'rgba(255,255,255,0.5)', padding: 4 }}><X size={16} /></button>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Paste the MOA content generated by an AI here. The system will extract the Client Name, Business, Address, Cost, Timeline, Maintenance, and Scope of Work to auto-fill the form. For best results, use standard labels like "Client Name:" or paste a JSON object.
            </p>

            <textarea
              style={{ ...S.inp, resize: 'vertical', minHeight: 200, marginBottom: 16, fontFamily: 'monospace', fontSize: 12 }}
              placeholder="Paste AI output here..."
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              autoFocus
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={copyPrompt} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>📋 Copy AI Prompt</button>
              <button onClick={() => setShowAiModal(false)} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
              <button onClick={handleAiImport} disabled={!aiText.trim()} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: !aiText.trim() ? 'rgba(96,165,250,0.2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 600, boxShadow: !aiText.trim() ? 'none' : '0 4px 14px rgba(59,130,246,0.3)' }}>
                Parse
              </button>
            </div>
          </div>
        </>
      )}

      {/* Freeform Quick Paste Modal */}
      {showFreeformModal && (
        <>
          <div onClick={() => setShowFreeformModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#0f1218', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 32, zIndex: 201, width: '100%', maxWidth: 700 }}>
            <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 }}>⚡ Quick Paste (Freeform MOA)</h3>
              <button onClick={() => setShowFreeformModal(false)} style={{ ...S.btn, background: 'none', color: 'rgba(255,255,255,0.5)', padding: 4 }}><X size={16} /></button>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
              Paste or edit the entire raw text of your MOA here. The system will automatically generate a print-ready MOA exactly as you pasted it, enclosed within the official ODC letterhead and signature blocks.
            </p>

            <textarea
              style={{ ...S.inp, resize: 'vertical', minHeight: 300, marginBottom: 20, fontFamily: 'monospace', fontSize: 12, padding: 16, lineHeight: 1.6 }}
              placeholder="Paste raw MOA text here..."
              value={freeformText}
              onChange={e => setFreeformText(e.target.value)}
              autoFocus
            />

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
              <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ color: '#ff9a4a', margin: 0, fontSize: 14, fontWeight: 600 }}>Footer / Signature Details</h4>
                <button type="button" onClick={autoExtractFfFooter} style={{ ...S.btn, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: 11, padding: '4px 10px' }}>⚡ Auto-fill from text</button>
              </div>

              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={S.lbl}>Client Representative (Party A)</label>
                  <input style={{ ...S.inp, fontSize: 13 }} value={ffFooter.clientName} onChange={e => setFfFooter(prev => ({ ...prev, clientName: e.target.value }))} placeholder="e.g. JETCH MERALD S. MADAYA" />
                </div>
                <div>
                  <label style={S.lbl}>Date</label>
                  <input type="date" style={{ ...S.inp, fontSize: 13 }} value={ffFooter.date} onChange={e => setFfFooter(prev => ({ ...prev, date: e.target.value }))} />
                </div>
              </div>

              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Provider Representative (Party B)</label>
                  <input style={{ ...S.inp, fontSize: 13 }} value={ffFooter.providerName} onChange={e => setFfFooter(prev => ({ ...prev, providerName: e.target.value }))} />
                </div>
                <div>
                  <label style={S.lbl}>Provider Business</label>
                  <input style={{ ...S.inp, fontSize: 13 }} value={ffFooter.providerBusiness} onChange={e => setFfFooter(prev => ({ ...prev, providerBusiness: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <input type="checkbox" id="ffHideFooter" checked={ffFooter.hideFooter} onChange={e => setFfFooter(prev => ({ ...prev, hideFooter: e.target.checked }))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="ffHideFooter" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}>Hide Signature Footer</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFreeformModal(false)} disabled={saving} style={{ ...S.btn, flex: 1, justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
              <LoadingButton onClick={handleFreeformSubmit} loading={saving} loadingLabel="Saving…" disabled={!freeformText.trim()} style={{ ...S.btn, flex: 2, justifyContent: 'center', background: (!freeformText.trim() || saving) ? 'rgba(96,165,250,0.2)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff', fontWeight: 600, boxShadow: (!freeformText.trim() || saving) ? 'none' : '0 4px 14px rgba(59,130,246,0.3)' }}>
                {editingId ? 'Update Freeform MOA' : 'Save & Print MOA'}
              </LoadingButton>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .moa-row:hover { background: rgba(255,255,255,0.06) !important; }
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
