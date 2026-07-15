import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

const S = {
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '24px' },
  btn: { cursor: 'pointer', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  inp: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' },
  lbl: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 },
  sectionTtl: { fontSize: 18, fontWeight: 700, margin: '0 0 20px 0', color: '#ff9a4a', display: 'flex', alignItems: 'center', gap: 10 }
};

const DEFAULT_CONFIG = {
  plans: [
    {
      name: 'Basic Care Plan', price: '₱1,500', period: '/month', color: '#3b82f6',
      desc: 'Recommended for portfolio websites and small business landing pages.',
      includes: ['Website uptime monitoring', 'Minor text/image updates', 'Basic bug fixes', 'Monthly database backup', 'Basic technical support', 'Security monitoring'],
      limitations: ['Max 2 minor requests per month', 'Completion within 3–7 business days', 'No new features or redesigns', 'Hosting/domain fees excluded']
    },
    {
      name: 'Standard Care Plan', price: '₱3,500', period: '/month', color: '#f59e0b', recommended: true,
      desc: 'Perfect for booking systems, small clinics, and ERP/POS systems.',
      includes: ['Everything in Basic Plan', 'Minor UI/UX improvements', 'Small workflow adjustments', 'Database optimization', 'Priority technical support', 'Minor feature enhancements', 'Monthly system health checks'],
      limitations: ['Max 5 minor requests per month', 'Max 1 small feature monthly', 'Completion within 2–5 business days', 'Major features quoted separately', 'Third-party API costs excluded']
    },
    {
      name: 'Premium Continuous Improvement', price: '₱7,500', period: '/month+', color: '#10b981',
      desc: 'For high-traffic platforms, multi-branch ERPs, and growing businesses.',
      includes: ['Everything in Standard Plan', 'Priority development queue', 'Continuous system improvements', 'Advanced reporting enhancements', 'Performance optimization', 'Consultation & scaling recommendations', 'Advanced troubleshooting', 'Dedicated support assistance'],
      limitations: ['Max 10 minor requests monthly', 'Max 2 moderate enhancements monthly', 'Large modules billed separately', 'External software/service excluded']
    }
  ],
  minorRequests: [
    { title: 'Text & Content', desc: 'Changing labels, descriptions, or general text content across the system.' },
    { title: 'UI Adjustments', desc: 'Small visual tweaks, adjusting forms, and layout refinements.' },
    { title: 'Field Additions', desc: 'Adding simple fields to existing forms or data displays.' },
    { title: 'Reports & Data', desc: 'Small report modifications and dashboard improvements.' },
    { title: 'Pricing & Values', desc: 'Updating product pricing, system variables, or config values.' },
    { title: 'Speed Adjustments', desc: 'Simple automation tweaks and performance micro-optimizations.' },
  ],
  notIncluded: [
    'Entire new modules', 'Mobile applications', 'AI integrations', 'Payroll systems',
    'Accounting systems', 'Multi-company architecture', 'Large database restructuring',
    'Third-party API integrations', 'Advanced analytics', 'Major redesigns'
  ],
  addons: [
    { service: 'Additional Minor Request', price: '₱500/request' },
    { service: 'Emergency Same-Day Support', price: '₱1,500+' },
    { service: 'Additional Monthly Backup', price: '₱500/month' },
    { service: 'Server/Hosting Management', price: '₱1,000+/month' },
    { service: 'Feature Development', price: 'Subject for Quotation' },
  ],
  supportHours: 'Available 24/7\nDedicated support team always ready.',
  paymentTerms: 'Monthly payments due as agreed. Non-refundable once service month begins.'
};

export default function AdminMaintenance() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'maintenanceSettings', 'config'));
        if (snap.exists()) {
          setConfig(snap.data());
        } else {
          setConfig(DEFAULT_CONFIG);
        }
      } catch (e) { 
        console.error(e);
        setConfig(DEFAULT_CONFIG); // Use defaults if read fails (e.g. permissions)
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      await setDoc(doc(db, 'maintenanceSettings', 'config'), {
        ...config,
        updatedAt: serverTimestamp()
      });
      setStatus({ type: 'success', msg: 'Settings saved successfully!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', msg: 'Failed to save settings.' });
    }
    setSaving(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><RefreshCw size={24} className="spin" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Maintenance Plans Management</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0' }}>Modify the pricing, features, and content of the maintenance plans page.</p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{ ...S.btn, background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)', color: '#fff', padding: '10px 24px', fontWeight: 600 }}>
          {saving ? <RefreshCw size={16} className="spin" /> : <Save size={16} />} Save Changes
        </button>
      </div>

      {status && (
        <div style={{ padding: '12px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, background: status.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${status.type === 'success' ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`, color: status.type === 'success' ? '#34d399' : '#f87171' }}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {status.msg}
        </div>
      )}

      {/* Plans Section */}
      <div>
        <h3 style={S.sectionTtl}>1. Pricing Tiers</h3>
        <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
          {config.plans.map((plan, pIdx) => (
            <div key={pIdx} style={S.card}>
              <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <input style={{ ...S.inp, width: 'auto', fontWeight: 700, fontSize: 16, background: 'none', border: 'none', padding: 0 }} value={plan.name} onChange={e => {
                  const newPlans = [...config.plans];
                  newPlans[pIdx].name = e.target.value;
                  setConfig({ ...config, plans: newPlans });
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Color</label>
                  <input type="color" value={plan.color} onChange={e => {
                    const newPlans = [...config.plans];
                    newPlans[pIdx].color = e.target.value;
                    setConfig({ ...config, plans: newPlans });
                  }} style={{ background: 'none', border: 'none', width: 24, height: 24, padding: 0, cursor: 'pointer' }} />
                </div>
              </div>

              <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={S.lbl}>Price</label>
                  <input style={S.inp} value={plan.price} onChange={e => {
                    const newPlans = [...config.plans];
                    newPlans[pIdx].price = e.target.value;
                    setConfig({ ...config, plans: newPlans });
                  }} />
                </div>
                <div>
                  <label style={S.lbl}>Period</label>
                  <input style={S.inp} value={plan.period} onChange={e => {
                    const newPlans = [...config.plans];
                    newPlans[pIdx].period = e.target.value;
                    setConfig({ ...config, plans: newPlans });
                  }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.lbl}>Description</label>
                <textarea style={{ ...S.inp, minHeight: 60, resize: 'vertical' }} value={plan.desc} onChange={e => {
                  const newPlans = [...config.plans];
                  newPlans[pIdx].desc = e.target.value;
                  setConfig({ ...config, plans: newPlans });
                }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={S.lbl}>Inclusions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.includes.map((inc, iIdx) => (
                    <div key={iIdx} style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...S.inp, fontSize: 13 }} value={inc} onChange={e => {
                        const newPlans = [...config.plans];
                        newPlans[pIdx].includes[iIdx] = e.target.value;
                        setConfig({ ...config, plans: newPlans });
                      }} />
                      <button onClick={() => {
                        const newPlans = [...config.plans];
                        newPlans[pIdx].includes = newPlans[pIdx].includes.filter((_, i) => i !== iIdx);
                        setConfig({ ...config, plans: newPlans });
                      }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => {
                    const newPlans = [...config.plans];
                    newPlans[pIdx].includes.push('');
                    setConfig({ ...config, plans: newPlans });
                  }} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: '#60a5fa', fontSize: 11, padding: '4px 8px', marginTop: 4 }}><Plus size={12} /> Add Inclusion</button>
                </div>
              </div>

              <div>
                <label style={S.lbl}>Limitations</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.limitations.map((lim, lIdx) => (
                    <div key={lIdx} style={{ display: 'flex', gap: 8 }}>
                      <input style={{ ...S.inp, fontSize: 13 }} value={lim} onChange={e => {
                        const newPlans = [...config.plans];
                        newPlans[pIdx].limitations[lIdx] = e.target.value;
                        setConfig({ ...config, plans: newPlans });
                      }} />
                      <button onClick={() => {
                        const newPlans = [...config.plans];
                        newPlans[pIdx].limitations = newPlans[pIdx].limitations.filter((_, i) => i !== lIdx);
                        setConfig({ ...config, plans: newPlans });
                      }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => {
                    const newPlans = [...config.plans];
                    newPlans[pIdx].limitations.push('');
                    setConfig({ ...config, plans: newPlans });
                  }} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: '#60a5fa', fontSize: 11, padding: '4px 8px', marginTop: 4 }}><Plus size={12} /> Add Limitation</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Minor Requests */}
        <div style={S.card}>
          <h3 style={S.sectionTtl}>2. Minor Requests Definitions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {config.minorRequests.map((req, rIdx) => (
              <div key={rIdx} style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <input style={{ ...S.inp, fontWeight: 700 }} value={req.title} onChange={e => {
                    const newReqs = [...config.minorRequests];
                    newReqs[rIdx].title = e.target.value;
                    setConfig({ ...config, minorRequests: newReqs });
                  }} placeholder="Title" />
                  <button onClick={() => {
                    const newReqs = config.minorRequests.filter((_, i) => i !== rIdx);
                    setConfig({ ...config, minorRequests: newReqs });
                  }} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
                <textarea style={{ ...S.inp, fontSize: 13, minHeight: 60 }} value={req.desc} onChange={e => {
                  const newReqs = [...config.minorRequests];
                  newReqs[rIdx].desc = e.target.value;
                  setConfig({ ...config, minorRequests: newReqs });
                }} placeholder="Description" />
              </div>
            ))}
            <button onClick={() => setConfig({ ...config, minorRequests: [...config.minorRequests, { title: '', desc: '' }] })} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: '#60a5fa' }}><Plus size={14} /> Add Definition</button>
          </div>
        </div>

        {/* Not Included & Others */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={S.card}>
            <h3 style={S.sectionTtl}>3. Not Included List</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {config.notIncluded.map((item, iIdx) => (
                <div key={iIdx} style={{ display: 'flex', gap: 8 }}>
                  <input style={S.inp} value={item} onChange={e => {
                    const newList = [...config.notIncluded];
                    newList[iIdx] = e.target.value;
                    setConfig({ ...config, notIncluded: newList });
                  }} />
                  <button onClick={() => setConfig({ ...config, notIncluded: config.notIncluded.filter((_, i) => i !== iIdx) })} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              ))}
              <button onClick={() => setConfig({ ...config, notIncluded: [...config.notIncluded, ''] })} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: '#60a5fa' }}><Plus size={14} /> Add Item</button>
            </div>
          </div>

          <div style={S.card}>
            <h3 style={S.sectionTtl}>4. Support & Terms</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>Support Hours Text</label>
              <textarea style={{ ...S.inp, minHeight: 80 }} value={config.supportHours} onChange={e => setConfig({ ...config, supportHours: e.target.value })} />
            </div>
            <div>
              <label style={S.lbl}>Payment Terms Text</label>
              <textarea style={{ ...S.inp, minHeight: 80 }} value={config.paymentTerms} onChange={e => setConfig({ ...config, paymentTerms: e.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={S.sectionTtl}>5. Optional Add-ons</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {config.addons.map((addon, aIdx) => (
            <div key={aIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'center' }}>
              <input style={S.inp} value={addon.service} onChange={e => {
                const newAddons = [...config.addons];
                newAddons[aIdx].service = e.target.value;
                setConfig({ ...config, addons: newAddons });
              }} placeholder="Service Name" />
              <input style={S.inp} value={addon.price} onChange={e => {
                const newAddons = [...config.addons];
                newAddons[aIdx].price = e.target.value;
                setConfig({ ...config, addons: newAddons });
              }} placeholder="Price" />
              <button onClick={() => setConfig({ ...config, addons: config.addons.filter((_, i) => i !== aIdx) })} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={() => setConfig({ ...config, addons: [...config.addons, { service: '', price: '' }] })} style={{ ...S.btn, background: 'rgba(255,255,255,0.05)', color: '#60a5fa', width: 'fit-content' }}><Plus size={14} /> Add Add-on</button>
        </div>
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
