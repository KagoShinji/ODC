import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  DollarSign,
  Search,
  X,
  ExternalLink,
  Shield,
} from 'lucide-react';

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function AdminDomains({ firebaseUser, isSuperAdmin }) {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Modal
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [editingDomainId, setEditingDomainId] = useState(null);
  const [domainForm, setDomainForm] = useState({
    domainName: '',
    clientName: '',
    registrar: 'Namecheap',
    cost: '',
    currency: 'PHP',
    registrationDate: today(),
    expirationDate: '',
    autoRenew: false,
    notes: '',
  });

  // Renewal Modal
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingDomain, setRenewingDomain] = useState(null);
  const [renewForm, setRenewForm] = useState({
    cost: '',
    currency: 'PHP',
    newExpirationDate: '',
    logExpense: true,
  });

  const [saving, setSaving] = useState(false);
  const [modalAlert, setModalAlert] = useState(null);

  // Load Data
  const loadDomains = useCallback(async (showIndicator = true) => {
    if (showIndicator) setRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, 'domains'), orderBy('domainName', 'asc')));
      setDomains(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching domains:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDomains(false);
  }, [loadDomains]);

  // Expiration Calculations
  const getDaysLeft = (expDateStr) => {
    if (!expDateStr) return 0;
    const exp = new Date(expDateStr + 'T00:00:00');
    const now = new Date(today() + 'T00:00:00');
    const diffTime = exp.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getDomainStatus = (daysLeft) => {
    if (daysLeft < 0) return { label: 'Expired', color: '#f87171', bg: 'rgba(239,68,68,0.12)' };
    if (daysLeft <= 30) return { label: 'Expiring Soon', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
    return { label: 'Active', color: '#34d399', bg: 'rgba(52,211,153,0.12)' };
  };

  // Add/Edit Handlers
  const handleOpenCreate = () => {
    setEditingDomainId(null);
    setDomainForm({
      domainName: '',
      clientName: '',
      registrar: 'Namecheap',
      cost: '',
      currency: 'PHP',
      registrationDate: today(),
      expirationDate: '',
      autoRenew: false,
      notes: '',
    });
    setModalAlert(null);
    setShowDomainModal(true);
  };

  const handleOpenEdit = (domain) => {
    setEditingDomainId(domain.id);
    setDomainForm({
      domainName: domain.domainName || '',
      clientName: domain.clientName || '',
      registrar: domain.registrar || 'Namecheap',
      cost: domain.cost || '',
      currency: domain.currency || 'PHP',
      registrationDate: domain.registrationDate || today(),
      expirationDate: domain.expirationDate || '',
      autoRenew: !!domain.autoRenew,
      notes: domain.notes || '',
    });
    setModalAlert(null);
    setShowDomainModal(true);
  };

  const handleSaveDomain = async (e) => {
    e.preventDefault();
    if (!domainForm.domainName.trim() || !domainForm.expirationDate) {
      setModalAlert('Domain Name and Expiration Date are required.');
      return;
    }

    setSaving(true);
    const payload = {
      domainName: domainForm.domainName.trim().toLowerCase(),
      clientName: domainForm.clientName.trim(),
      registrar: domainForm.registrar,
      cost: Number(domainForm.cost || 0),
      currency: domainForm.currency,
      registrationDate: domainForm.registrationDate,
      expirationDate: domainForm.expirationDate,
      autoRenew: !!domainForm.autoRenew,
      notes: domainForm.notes.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingDomainId) {
        await updateDoc(doc(db, 'domains', editingDomainId), payload);
      } else {
        await addDoc(collection(db, 'domains'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        });
      }
      setShowDomainModal(false);
      loadDomains(false);
    } catch (err) {
      console.error(err);
      setModalAlert('Failed to save domain. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDomain = async (domain) => {
    if (!window.confirm(`Are you sure you want to stop tracking ${domain.domainName}?`)) return;
    try {
      await deleteDoc(doc(db, 'domains', domain.id));
      loadDomains(false);
    } catch (err) {
      console.error(err);
      alert('Failed to delete domain.');
    }
  };

  // Renewal Handlers
  const handleOpenRenew = (domain) => {
    setRenewingDomain(domain);
    
    // Auto-calculate new expiration date (+1 year)
    let newExpDate = '';
    if (domain.expirationDate) {
      const parts = domain.expirationDate.split('-');
      if (parts.length === 3) {
        const year = Number(parts[0]) + 1;
        newExpDate = `${year}-${parts[1]}-${parts[2]}`;
      }
    }

    setRenewForm({
      cost: domain.cost || '',
      currency: domain.currency || 'PHP',
      newExpirationDate: newExpDate || today(),
      logExpense: true,
    });
    setModalAlert(null);
    setShowRenewModal(true);
  };

  const handleRenewDomain = async (e) => {
    e.preventDefault();
    if (!renewingDomain || !renewForm.newExpirationDate) return;
    setSaving(true);

    try {
      // 1. Update Domain document in Firestore
      const domainRef = doc(db, 'domains', renewingDomain.id);
      await updateDoc(domainRef, {
        expirationDate: renewForm.newExpirationDate,
        cost: Number(renewForm.cost || 0),
        currency: renewForm.currency,
        updatedAt: serverTimestamp(),
      });

      // 2. Optionally write to general expenses collection
      if (renewForm.logExpense && Number(renewForm.cost) > 0) {
        const expensePayload = {
          title: `Domain Renewal - ${renewingDomain.domainName}`,
          category: 'Software & Subscriptions',
          amount: Number(renewForm.cost),
          date: today(),
          payee: renewingDomain.registrar || 'Domain Registrar',
          status: 'paid',
          notes: `Yearly renewal for ${renewingDomain.domainName}. Expired date pushed to ${renewForm.newExpirationDate}.`,
          source: 'domain_tracker',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        };
        await addDoc(collection(db, 'expenses'), expensePayload);
      }

      setShowRenewModal(false);
      setRenewingDomain(null);
      loadDomains(false);
    } catch (err) {
      console.error(err);
      setModalAlert('Failed to renew domain. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Domains
  const filteredDomains = domains.filter(d => {
    const q = searchQuery.toLowerCase();
    return (
      d.domainName?.toLowerCase().includes(q) ||
      d.clientName?.toLowerCase().includes(q) ||
      d.registrar?.toLowerCase().includes(q)
    );
  });

  // Aggregate Metrics
  const activeCount = domains.filter(d => getDaysLeft(d.expirationDate) > 30).length;
  const expiringCount = domains.filter(d => {
    const dl = getDaysLeft(d.expirationDate);
    return dl >= 0 && dl <= 30;
  }).length;
  const expiredCount = domains.filter(d => getDaysLeft(d.expirationDate) < 0).length;

  const totalYearlySpendPHP = domains.reduce((sum, d) => {
    const cost = Number(d.cost || 0);
    // Convert USD to PHP approximately at 58.0 if USD
    const rate = d.currency === 'USD' ? 58.0 : 1.0;
    return sum + (cost * rate);
  }, 0);

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={22} color="#ff9a4a" />
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Domain Tracker</h2>
          <span style={{ fontSize: 11, background: 'rgba(255,106,26,0.15)', color: '#ff9a4a', padding: '3px 8px', borderRadius: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Yearly Monitor
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => loadDomains()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          {isSuperAdmin && (
            <button onClick={handleOpenCreate} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Plus size={16} /> Add Domain
            </button>
          )}
        </div>
      </div>

      {/* Metrics Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Globe size={16} color="#60a5fa" />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Monitored Domains</span>
          </div>
          <span style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{domains.length}</span>
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <CheckCircle2 size={16} color="#34d399" />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Active</span>
          </div>
          <span style={{ color: '#34d399', fontSize: 32, fontWeight: 700 }}>{activeCount}</span>
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AlertTriangle size={16} color="#fbbf24" />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Expiring Soon (&le;30d)</span>
          </div>
          <span style={{ color: '#fbbf24', fontSize: 32, fontWeight: 700 }}>{expiringCount}</span>
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <XCircle size={16} color="#f87171" />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Expired</span>
          </div>
          <span style={{ color: '#f87171', fontSize: 32, fontWeight: 700 }}>{expiredCount}</span>
        </div>
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <DollarSign size={16} color="#ff9a4a" />
            <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 500 }}>Yearly Spend (Est)</span>
          </div>
          <span style={{ color: '#ff9a4a', fontSize: 26, fontWeight: 700 }}>₱{fmt(totalYearlySpendPHP)}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search domains by name, client, registrar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...S.inp, paddingLeft: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading domains tracker…</p>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Domain</th>
                <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Registrar / Client</th>
                <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dates</th>
                <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Yearly Cost</th>
                <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDomains.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                    No domains monitored. Click "Add Domain" to get started.
                  </td>
                </tr>
              ) : (
                filteredDomains.map(d => {
                  const daysLeft = getDaysLeft(d.expirationDate);
                  const status = getDomainStatus(daysLeft);
                  
                  let expiryLabel = '';
                  if (daysLeft < 0) {
                    expiryLabel = `Expired ${Math.abs(daysLeft)}d ago`;
                  } else if (daysLeft === 0) {
                    expiryLabel = 'Expires today!';
                  } else {
                    expiryLabel = `${daysLeft} days left`;
                  }

                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      {/* Domain Name */}
                      <td style={{ padding: '18px 24px', fontWeight: 600 }}>
                        <a href={`http://${d.domainName}`} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {d.domainName} <ExternalLink size={12} color="rgba(255,255,255,0.4)" />
                        </a>
                        {d.notes && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginTop: 4, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.notes}>
                            {d.notes}
                          </div>
                        )}
                      </td>
                      {/* Registrar & Client */}
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ color: '#fff', fontSize: 13 }}>{d.registrar || '—'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>{d.clientName || 'ODC Internal'}</div>
                      </td>
                      {/* Dates */}
                      <td style={{ padding: '18px 24px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Exp: <strong>{d.expirationDate}</strong></div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>Reg: {d.registrationDate || '—'}</div>
                      </td>
                      {/* Cost */}
                      <td style={{ padding: '18px 24px', textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                        {d.currency === 'USD' ? '$' : '₱'}{fmt(d.cost)}
                        {d.autoRenew && (
                          <div style={{ fontSize: 10, color: '#34d399', fontWeight: 400, marginTop: 2 }}>Auto-Renew</div>
                        )}
                      </td>
                      {/* Status */}
                      <td style={{ padding: '18px 24px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', background: status.bg, color: status.color, padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                            {status.label}
                          </span>
                          <span style={{ fontSize: 12, color: daysLeft < 0 ? '#f87171' : (daysLeft <= 30 ? '#fbbf24' : 'rgba(255,255,255,0.4)') }}>
                            {expiryLabel}
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '18px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleOpenRenew(d)}
                              style={{ ...S.btn, background: 'linear-gradient(135deg,rgba(255,106,26,0.1),rgba(255,154,74,0.15))', color: '#ff9a4a', border: '1px solid rgba(255,106,26,0.25)' }}
                            >
                              <RefreshCw size={13} /> Renew
                            </button>
                          )}
                          <button onClick={() => handleOpenEdit(d)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                            <Edit2 size={13} /> Edit
                          </button>
                          {isSuperAdmin && (
                            <button onClick={() => handleDeleteDomain(d)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: ADD/EDIT DOMAIN */}
      {showDomainModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 480, padding: 32, boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editingDomainId ? 'Edit Domain Details' : 'Add New Domain'}
              </h3>
              <button onClick={() => setShowDomainModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalAlert && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
                {modalAlert}
              </div>
            )}

            <form onSubmit={handleSaveDomain} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>Domain Name (e.g. acme.com) *</label>
                <input
                  type="text"
                  placeholder="domainname.com"
                  value={domainForm.domainName}
                  onChange={(e) => setDomainForm({ ...domainForm, domainName: e.target.value })}
                  style={S.inp}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Registrar</label>
                  <select
                    value={domainForm.registrar}
                    onChange={(e) => setDomainForm({ ...domainForm, registrar: e.target.value })}
                    style={S.inp}
                  >
                    <option value="Namecheap">Namecheap</option>
                    <option value="GoDaddy">GoDaddy</option>
                    <option value="Hostinger">Hostinger</option>
                    <option value="Google Domains">Google Domains</option>
                    <option value="Cloudflare">Cloudflare</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={S.lbl}>Client / Project Link</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme ERP"
                    value={domainForm.clientName}
                    onChange={(e) => setDomainForm({ ...domainForm, clientName: e.target.value })}
                    style={S.inp}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Yearly Cost</label>
                  <input
                    type="number"
                    placeholder="e.g. 650"
                    value={domainForm.cost}
                    onChange={(e) => setDomainForm({ ...domainForm, cost: e.target.value })}
                    style={S.inp}
                    min="0"
                  />
                </div>
                <div>
                  <label style={S.lbl}>Currency</label>
                  <select
                    value={domainForm.currency}
                    onChange={(e) => setDomainForm({ ...domainForm, currency: e.target.value })}
                    style={S.inp}
                  >
                    <option value="PHP">PHP (₱)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Registration Date</label>
                  <input
                    type="date"
                    value={domainForm.registrationDate}
                    onChange={(e) => setDomainForm({ ...domainForm, registrationDate: e.target.value })}
                    style={S.inp}
                  />
                </div>
                <div>
                  <label style={S.lbl}>Expiration Date *</label>
                  <input
                    type="date"
                    value={domainForm.expirationDate}
                    onChange={(e) => setDomainForm({ ...domainForm, expirationDate: e.target.value })}
                    style={S.inp}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <input
                  id="autoRenew"
                  type="checkbox"
                  checked={domainForm.autoRenew}
                  onChange={(e) => setDomainForm({ ...domainForm, autoRenew: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="autoRenew" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                  Auto-Renewal Enabled
                </label>
              </div>

              <div>
                <label style={S.lbl}>Configuration / DNS / Nameservers Notes</label>
                <textarea
                  placeholder="Enter nameservers, server IP details, etc."
                  value={domainForm.notes}
                  onChange={(e) => setDomainForm({ ...domainForm, notes: e.target.value })}
                  style={{ ...S.inp, height: 60, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowDomainModal(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff' }}>
                  {saving ? 'Saving...' : 'Save Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RENEW DOMAIN */}
      {showRenewModal && renewingDomain && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#10141f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, width: '100%', maxWidth: 460, padding: 32, boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: '0 0 4px 0' }}>Renew Domain</h3>
                <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: 12 }}>Domain: <strong style={{ color: '#fff' }}>{renewingDomain.domainName}</strong></p>
              </div>
              <button onClick={() => setShowRenewModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {modalAlert && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 20 }}>
                {modalAlert}
              </div>
            )}

            <form onSubmit={handleRenewDomain} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.lbl}>New Expiration Date (+1 Year) *</label>
                <input
                  type="date"
                  value={renewForm.newExpirationDate}
                  onChange={(e) => setRenewForm({ ...renewForm, newExpirationDate: e.target.value })}
                  style={S.inp}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.lbl}>Renewal Cost</label>
                  <input
                    type="number"
                    placeholder="650"
                    value={renewForm.cost}
                    onChange={(e) => setRenewForm({ ...renewForm, cost: e.target.value })}
                    style={S.inp}
                    min="0"
                  />
                </div>
                <div>
                  <label style={S.lbl}>Currency</label>
                  <select
                    value={renewForm.currency}
                    onChange={(e) => setRenewForm({ ...renewForm, currency: e.target.value })}
                    style={S.inp}
                  >
                    <option value="PHP">PHP (₱)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0', cursor: 'pointer' }}>
                <input
                  id="logExpense"
                  type="checkbox"
                  checked={renewForm.logExpense}
                  onChange={(e) => setRenewForm({ ...renewForm, logExpense: e.target.checked })}
                  style={{ cursor: 'pointer', marginTop: 3 }}
                />
                <label htmlFor="logExpense" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', lineHeight: 1.4 }}>
                  Log renewal payment as a finance expense (software & subscriptions category)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowRenewModal(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff' }}>
                  {saving ? 'Processing...' : 'Confirm Renewal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
