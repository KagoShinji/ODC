import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
// eslint-disable-next-line no-unused-vars
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Plus, X, Trash2, Printer, Edit2, RefreshCw, Copy, Check, Eye, Link } from 'lucide-react';

const CO = {
  address: '3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City',
  email: 'odysseyclinsys1@gmail.com',
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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const getSigFontSizePrint = (name) => {
  const len = (name || '').length;
  if (len > 25) return '15px';
  if (len > 20) return '18px';
  if (len > 15) return '22px';
  return '30px';
};
// eslint-disable-next-line react-refresh/only-export-components
export function printCertificate(coa) {
  const logoUrl = window.location.origin + '/images/odcclearlogo.png';

  const hasScope = coa.scope && coa.scope.length > 0;
  const formattedScope = hasScope ? `
    <div class="scope-section">
      <p class="scope-intro">The turnover covers the completed and verified deliverables listed below:</p>
      <ul class="scope-list">
        ${coa.scope.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  ` : `
    <p class="scope-whole">This turnover covers the <strong>${coa.projectName}</strong> system in its entirety, representing all agreed functionalities, specifications, and deliverables turned over as a whole.</p>
  `;

  const descriptionText = coa.customText || `This Certificate of Completion and Acceptance is formally issued to certify that **${coa.providerBusiness || CO.serviceProviderBusiness}** has successfully completed and delivered the project specified below. The Client has inspected, tested, and verified the project deliverables and acknowledges that they satisfy the agreed specifications.`;

  const clientSignSection = coa.status === 'Accepted' ? `
    <div class="sig-block signed">
      <div class="sig-badge">DIGITALLY ACCEPTED</div>
      <div class="signature-cursive" style="font-size: ${getSigFontSizePrint(coa.signeeName)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${coa.signeeName}</div>
      <div class="sig-name">${coa.signeeName}</div>
      <div class="sig-title">${coa.signeeTitle || 'Authorized Representative'}</div>
      <div class="sig-metadata">
        Accepted: ${fmtDateTimeLong(coa.acceptedAt)}<br>
        IP Address: ${coa.ipAddress || 'Not Recorded'}<br>
        Doc ID: ${coa.id}
      </div>
    </div>
  ` : `
    <div class="sig-block unsigned">
      <div style="height: 60px;"></div>
      <div class="sig-name-line"></div>
      <div class="sig-name">${coa.clientName}</div>
      <div class="sig-title">Authorized Representative</div>
      <div class="sig-date">Date: __________________________</div>
    </div>
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificate of Acceptance - ${coa.projectName || 'Project'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; font-size: 14px; color: #111; background: #fff; line-height: 1.6; }
    .pg { width: 794px; padding: 60px 80px; margin: 0 auto; position: relative; min-height: 1123px; display: flex; flex-direction: column; justify-content: space-between; }
    .hd { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eaeaea; padding-bottom: 25px; }
    .logo img { height: 75px; width: auto; display: block; margin: 0 auto 10px; }
    .ci { text-align: center; line-height: 1.4; color: #555; font-size: 11px; }
    .ci strong { font-size: 13px; color: #111; }
    
    .cert-container { flex: 1; display: flex; flex-direction: column; justify-content: center; margin: 20px 0; }
    .ttl { text-align: center; font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 30px; text-transform: uppercase; }
    .cert-sub { text-align: center; font-style: italic; color: #475569; font-size: 15px; margin-bottom: 25px; font-family: 'Playfair Display', serif; }
    
    .desc { text-align: justify; margin-bottom: 25px; color: #334155; font-size: 13.5px; text-indent: 30px; }
    
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .details-table td { padding: 12px 18px; border-bottom: 1px solid #e2e8f0; }
    .details-table tr:last-child td { border-bottom: none; }
    .details-table td.label { font-weight: 600; color: #475569; width: 30%; border-right: 1px solid #e2e8f0; }
    .details-table td.value { color: #0f172a; font-weight: 500; }
    
    .scope-section { margin-bottom: 25px; }
    .scope-intro { font-weight: 600; color: #334155; margin-bottom: 10px; font-size: 13px; }
    .scope-list { margin-left: 24px; color: #475569; font-size: 12.5px; }
    .scope-list li { margin-bottom: 6px; }
    .scope-whole { font-size: 13.5px; color: #334155; margin-bottom: 25px; text-align: justify; line-height: 1.6; }
    
    .legal-text { font-size: 11px; color: #64748b; text-align: justify; line-height: 1.5; border-top: 1px dashed #e2e8f0; padding-top: 15px; margin-top: auto; margin-bottom: 30px; }
    
    .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 20px; }
    .sig-block { position: relative; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background: #fafafa; }
    .sig-block.signed { border: 1px solid #b9f6ca; background: #f9fdfa; }
    .sig-badge { position: absolute; top: 12px; right: 12px; font-size: 8px; font-weight: 700; color: #00c853; border: 1.5px solid #00c853; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; transform: rotate(-5deg); font-family: 'Inter', sans-serif; }
    .signature-cursive { font-family: 'Great Vibes', cursive; font-size: 30px; color: #004d40; text-align: center; margin: 10px 0; min-height: 38px; transform: translateY(-5px); }
    .sig-provider-line { border-bottom: 1.5px solid #004d40; width: 80%; margin: 15px auto 5px; height: 35px; }
    .sig-name-line { border-top: 1px solid #94a3b8; width: 100%; margin-top: 35px; }
    .sig-name { text-align: center; font-weight: 700; font-size: 13px; color: #0f172a; margin-top: 5px; }
    .sig-title { text-align: center; font-size: 11px; color: #64748b; margin-top: 2px; }
    .sig-date { text-align: center; font-size: 11px; color: #64748b; margin-top: 4px; }
    .sig-metadata { font-size: 8px; color: #94a3b8; line-height: 1.3; text-align: center; margin-top: 12px; border-top: 1px dotted #e2e8f0; padding-top: 8px; }
    
    .ft { border-top: 1px solid #eaeaea; padding-top: 15px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; }
      .pg { padding: 40px 50px; width: 100%; min-height: 100vh; margin: 0; box-shadow: none; }
      .sig-block { background: #fff !important; }
    }
  </style>
</head>
<body>

<div class="pg">
  <div>
    <div class="hd">
      <div class="logo"><img src="${logoUrl}" alt="ODC" /></div>
      <div class="ci">
        <strong>${CO.serviceProviderBusiness}</strong><br>
        ${CO.address}<br>
        Email: ${CO.email} | Contact: ${CO.phone}
      </div>
    </div>

    <div class="cert-container">
      <div class="ttl">Certificate of Acceptance</div>
      <div class="cert-sub">Issued for the turnover of digital project deliverables</div>

      <div class="desc">${descriptionText}</div>

      <table class="details-table">
        <tr>
          <td class="label">Project / System</td>
          <td class="value">${coa.projectName}</td>
        </tr>
        <tr>
          <td class="label">Client Business</td>
          <td class="value">${coa.clientBusiness}</td>
        </tr>
        <tr>
          <td class="label">Client Representative</td>
          <td class="value">${coa.clientName}</td>
        </tr>
        <tr>
          <td class="label">Turnover / Date</td>
          <td class="value">${fmtDateLong(coa.turnoverDate)}</td>
        </tr>
      </table>

      ${formattedScope}
    </div>
  </div>

  <div>
    <p class="legal-text">
      <strong>Statement of Conformity:</strong> The signing parties hereby acknowledge that the deliverables detailed above represent the complete fulfillment of OdysseyPH IT Solutions' development scope for this project. The Client formally accepts ownership, and agrees that warranty and maintenance terms specified in the service agreement shall begin immediately from the date of acceptance.
    </p>

    <div class="sig-section">
      <!-- Odyssey Rep -->
      <div class="sig-block signed">
        <div class="sig-badge">ISSUER</div>
        <div class="signature-cursive" style="font-size: ${getSigFontSizePrint(coa.providerRep || CO.serviceProviderName)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${coa.providerRep || CO.serviceProviderName}</div>
        <div class="sig-name">${coa.providerRep || CO.serviceProviderName}</div>
        <div class="sig-title">Lead Developer, ${coa.providerBusiness || CO.serviceProviderBusiness}</div>
        <div class="sig-metadata">
          Issued On: ${fmtDateLong(coa.turnoverDate)}<br>
          Verification Code: ODC-COA-VERIFIED
        </div>
      </div>

      <!-- Client Signee -->
      ${clientSignSection}
    </div>

    <footer class="ft" style="margin-top: 40px;">
      <div>Certificate No: ${coa.certificateNumber}</div>
      <div>ODC Client Operations & Deliverables Turnover System</div>
      <div>Page 1 of 1</div>
    </footer>
  </div>
</div>

<script>
  document.fonts.ready.then(function() {
    setTimeout(function() {
      window.print();
    }, 250);
  });
</script>
</body>
</html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

const emptyForm = () => ({
  clientName: '',
  clientBusiness: '',
  clientAddress: '',
  projectName: '',
  projectCost: '',
  turnoverDate: today(),
  providerRep: CO.serviceProviderName,
  providerBusiness: CO.serviceProviderBusiness,
  customText: '',
  scope: [],
});

export default function AdminAcceptance({ firebaseUser, isSuperAdmin }) {
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [copiedId, setCopiedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newScopeItem, setNewScopeItem] = useState('');

  const load = useCallback(async (spin = true) => {
    if (spin) setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    setLoading(true);
    const q = query(collection(db, 'certificates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCoas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.error('Error listening to certificates:', err);
      setLoading(false);
      setRefreshing(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCopyLink = (coaId) => {
    const link = `${window.location.origin}/acceptance/${coaId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(coaId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleAddScope = () => {
    if (!newScopeItem.trim()) return;
    setForm(f => ({ ...f, scope: [...f.scope, newScopeItem.trim()] }));
    setNewScopeItem('');
  };

  const handleRemoveScope = (index) => {
    setForm(f => ({ ...f, scope: f.scope.filter((_, i) => i !== index) }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowSidebar(true);
  };

  const openEdit = (coa) => {
    setEditingId(coa.id);
    setForm({
      ...emptyForm(),
      ...coa,
      scope: coa.scope || [],
    });
    setShowSidebar(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      updatedAt: serverTimestamp(),
    };
    try {
      if (editingId) {
        await updateDoc(doc(db, 'certificates', editingId), payload);
      } else {
        const now = new Date();
        const num = `COA-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(coas.length + 1).padStart(3, '0')}`;
        await addDoc(collection(db, 'certificates'), {
          ...payload,
          certificateNumber: num,
          status: 'Pending',
          createdAt: serverTimestamp(),
          createdBy: firebaseUser.email,
        });
      }
      setShowSidebar(false);
      load();
    } catch (err) {
      console.error('Error saving certificate:', err);
    }
    setSaving(false);
  };

  const handleDelete = async (coa) => {
    if (!window.confirm(`Delete turnover certificate ${coa.certificateNumber} for ${coa.projectName}?`)) return;
    try {
      await deleteDoc(doc(db, 'certificates', coa.id));
      setCoas(prev => prev.filter(c => c.id !== coa.id));
    } catch (err) {
      console.error('Error deleting certificate:', err);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Certificates of Acceptance</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0 0' }}>Issue project completion and turnover records to clients for digital signature.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => load()} disabled={refreshing} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          {isSuperAdmin && (
            <button onClick={openCreate} style={{ ...S.btn, background: 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '10px 18px', boxShadow: '0 4px 14px rgba(255,106,26,0.3)' }}>
              <Plus size={16} /> Create Certificate
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { l: 'Total Certificates', v: coas.length, c: '#fff' },
          { l: 'Accepted & Signed', v: coas.filter(c => c.status === 'Accepted').length, c: '#34d399' },
          { l: 'Pending Acceptance', v: coas.filter(c => c.status === 'Pending').length, c: '#fbbf24' },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ ...S.card }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{l}</div>
            <div style={{ color: c, fontSize: 24, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
          <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px', display: 'block' }} /><p>Loading Certificates…</p>
        </div>
      ) : coas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
          No certificates generated yet. Click "Create Certificate" to turn over a project.
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 950 }}>
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Cert No</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Project / Client</th>
                <th style={{ padding: '16px 24px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Turnover Date</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Status</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Cost</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coas.map(coa => {
                const isAccepted = coa.status === 'Accepted';
                return (
                  <tr key={coa.id} className="moa-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '18px 24px', fontWeight: 700, color: '#fff', verticalAlign: 'middle' }}>{coa.certificateNumber}</td>
                    <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{coa.projectName}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                        {coa.clientBusiness} &bull; {coa.clientName}
                      </div>
                    </td>
                    <td style={{ padding: '18px 24px', color: 'rgba(255,255,255,0.5)', fontSize: 13, verticalAlign: 'middle' }}>
                      {fmtDateLong(coa.turnoverDate)}
                    </td>
                    <td style={{ padding: '18px 24px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <span style={{
                        display: 'inline-flex', padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8,
                        background: isAccepted ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
                        color: isAccepted ? '#34d399' : '#fbbf24',
                        border: `1px solid ${isAccepted ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.2)'}`
                      }}>
                        {coa.status}
                      </span>
                    </td>
                    <td style={{ padding: '18px 24px', textAlign: 'right', color: '#ff9a4a', fontWeight: 700, fontSize: 15, verticalAlign: 'middle' }}>
                      {coa.projectCost ? `₱${fmt(coa.projectCost)}` : '—'}
                    </td>
                    <td style={{ padding: '18px 24px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleCopyLink(coa.id)}
                          style={{
                            ...S.btn,
                            background: copiedId === coa.id ? 'rgba(52,211,153,0.15)' : 'rgba(96,165,250,0.1)',
                            color: copiedId === coa.id ? '#34d399' : '#60a5fa',
                            minWidth: 120
                          }}
                          title="Copy Sign-off Link"
                        >
                          {copiedId === coa.id ? <Check size={14} /> : <Copy size={14} />}
                          {copiedId === coa.id ? 'Copied Link!' : 'Copy Link'}
                        </button>
                        <button onClick={() => printCertificate(coa)} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} title="Print / PDF"><Printer size={14} /> Print</button>
                        {isSuperAdmin && (
                          <button onClick={() => openEdit(coa)} disabled={isAccepted} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: isAccepted ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', padding: 8, cursor: isAccepted ? 'not-allowed' : 'pointer' }} title="Edit"><Edit2 size={14} /></button>
                        )}
                        {isSuperAdmin && (
                          <button onClick={() => handleDelete(coa)} style={{ ...S.btn, background: 'rgba(239,68,68,0.1)', color: '#f87171', padding: 8 }} title="Delete"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Sidebar */}
      {showSidebar && (
        <>
          <div onClick={() => setShowSidebar(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 550, background: '#0f1218', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 101, overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editingId ? 'Edit Turnover Certificate' : 'New Turnover Certificate'}
              </h3>
              <button type="button" onClick={() => setShowSidebar(false)} style={{ ...S.btn, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Project Title & Cost */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#ff9a4a', margin: '0 0 14px 0', fontSize: 13, fontWeight: 600 }}>Project Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={S.lbl}>Project / System Name</label>
                    <input style={S.inp} value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} placeholder="e.g. Multi-Tenant Pickleball Court Booking System" required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={S.lbl}>Project Cost (₱)</label>
                      <input type="number" min="0" step="0.01" style={S.inp} value={form.projectCost} onChange={e => setForm(f => ({ ...f, projectCost: e.target.value }))} placeholder="Optional cost" />
                    </div>
                    <div>
                      <label style={S.lbl}>Turnover Date</label>
                      <input type="date" style={S.inp} value={form.turnoverDate} onChange={e => setForm(f => ({ ...f, turnoverDate: e.target.value }))} required />
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Representative */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#60a5fa', margin: '0 0 14px 0', fontSize: 13, fontWeight: 600 }}>Client Information</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={S.lbl}>Representative Full Name</label>
                    <input style={S.inp} value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="e.g. Kharyl Simolde" required />
                  </div>
                  <div>
                    <label style={S.lbl}>Company / Business Name</label>
                    <input style={S.inp} value={form.clientBusiness} onChange={e => setForm(f => ({ ...f, clientBusiness: e.target.value }))} placeholder="e.g. International Marketing Services" required />
                  </div>
                  <div>
                    <label style={S.lbl}>Business Address</label>
                    <input style={S.inp} value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="e.g. Mabolo, Cebu City" required />
                  </div>
                </div>
              </div>

              {/* Odyssey Rep Defaults */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ color: '#94a3b8', margin: '0 0 14px 0', fontSize: 13, fontWeight: 600 }}>Odyssey Representative Details</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={S.lbl}>Rep Name</label>
                    <input style={S.inp} value={form.providerRep} onChange={e => setForm(f => ({ ...f, providerRep: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={S.lbl}>Business Name</label>
                    <input style={S.inp} value={form.providerBusiness} onChange={e => setForm(f => ({ ...f, providerBusiness: e.target.value }))} required />
                  </div>
                </div>
              </div>

              {/* Scope Features List (Optional) */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ color: '#34d399', margin: 0, fontSize: 13, fontWeight: 600 }}>Project Scope / Completed Deliverables</h4>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>OPTIONAL</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 12px 0', lineHeight: 1.4 }}>
                  Add bullet points to list specific components completed. If left blank, the certificate dynamically states that the project system is accepted as a whole.
                </p>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    style={{ ...S.inp, flex: 1, padding: '8px 12px', fontSize: 13 }}
                    placeholder="e.g. Real-Time Admin TV Display Board"
                    value={newScopeItem}
                    onChange={e => setNewScopeItem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddScope(); } }}
                  />
                  <button type="button" onClick={handleAddScope} style={{ ...S.btn, background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Add</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.scope.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.15)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5 }}>&bull; {item}</span>
                      <button type="button" onClick={() => handleRemoveScope(idx)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 2 }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Text Override */}
              <div>
                <label style={S.lbl}>Custom Description Text (Optional)</label>
                <textarea
                  style={{ ...S.inp, resize: 'vertical', minHeight: 80, fontSize: 13 }}
                  value={form.customText}
                  onChange={e => setForm(f => ({ ...f, customText: e.target.value }))}
                  placeholder="Override the default certificate explanation text..."
                />
              </div>

              <button type="submit" disabled={saving} style={{ ...S.btn, background: saving ? 'rgba(255,106,26,0.4)' : 'linear-gradient(135deg,#ff6a1a,#ff9a4a)', color: '#fff', padding: '13px 0', justifyContent: 'center', fontSize: 15, fontWeight: 600, boxShadow: saving ? 'none' : '0 4px 16px rgba(255,106,26,0.3)', width: '100%', marginTop: 8 }}>
                {saving ? 'Saving…' : editingId ? 'Update Certificate' : 'Create Certificate'}
              </button>
            </form>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .moa-row:hover { background: rgba(255,255,255,0.06) !important; }
      `}</style>
    </div>
  );
}
