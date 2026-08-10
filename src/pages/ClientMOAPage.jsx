import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { ShieldCheck, Printer, CheckCircle2, ChevronRight, FileText, Globe, Award, Sparkles, RefreshCw, PenTool, Clock } from 'lucide-react';
import CustomModal from '../components/ui/CustomModal';

const CO = {
  address: '3409 Pearl Corner Jade St. Casals Village, Mabolo, Cebu City',
  email: 'odysseyphitsolutions@gmail.com',
  phone: '09930050994 / 09099855322',
  serviceProviderName: 'Johnjosfir B. Roca',
  serviceProviderBusiness: 'OdysseyPH IT Solutions',
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
    maxWidth: '850px',
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
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#ff9a4a',
    margin: '28px 0 12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: '8px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  bodyText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: '14px',
    lineHeight: '1.7',
    marginBottom: '16px',
    textAlign: 'justify',
  },
  partyBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  signaturePad: {
    border: '1px dashed rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.01)',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
    marginTop: '32px',
  },
  cursivePreview: {
    fontFamily: "'Great Vibes', cursive",
    fontSize: '44px',
    color: '#ff9a4a',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '12px 0',
    letterSpacing: '1px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    marginTop: '6px',
    transition: 'all 0.2s',
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

const getSigFontSize = (name) => {
  const len = (name || '').length;
  if (len > 25) return '15px';
  if (len > 20) return '18px';
  if (len > 15) return '22px';
  return '30px';
};

const getSigFontSizePrint = (name) => {
  const len = (name || '').length;
  if (len > 25) return '16px';
  if (len > 20) return '20px';
  if (len > 15) return '24px';
  return '32px';
};

export default function ClientMOAPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [moa, setMoa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Client signature form
  const [signeeName, setSigneeName] = useState('');
  const [signeeTitle, setSigneeTitle] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [clientIp, setClientIp] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', icon: 'info' });

  const showAlert = (title, message, icon = 'info') => {
    setModal({ isOpen: true, title, message, type: 'alert', icon });
  };

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

    const fetchMoa = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'moas', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.clientSigned === true) {
            setError('This link has expired as the Memorandum of Agreement has already been signed and executed.');
          } else {
            setMoa({ id: docSnap.id, ...data });
          }
        } else {
          setError('Memorandum of Agreement not found. Please verify the link.');
        }
      } catch (err) {
        console.error('Error fetching MOA:', err);
        if (err.code === 'permission-denied') {
          setError('This link has expired as the Memorandum of Agreement has already been signed and executed.');
        } else {
          setError('Failed to retrieve MOA details.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMoa();
  }, [id]);

  const handleSignMoa = async (e) => {
    e.preventDefault();
    if (!agreementChecked) {
      showAlert('Consent Required', 'Please check the consent box to sign.', 'warning');
      return;
    }
    if (!signeeName.trim()) {
      showAlert('Name Required', 'Please type your name to sign.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const docRef = doc(db, 'moas', id);
      const updateData = {
        clientSigned: true,
        clientSigneeName: signeeName.trim(),
        clientSigneeTitle: signeeTitle.trim() || 'Authorized Representative',
        clientSignedAt: serverTimestamp(),
        clientIp: clientIp,
        clientUserAgent: navigator.userAgent,
      };
      await updateDoc(docRef, updateData);

      // Local state update
      setMoa(prev => ({
        ...prev,
        ...updateData,
        clientSignedAt: { toDate: () => new Date() }
      }));
    } catch (err) {
      console.error('Error signing MOA:', err);
      showAlert('Signing Error', 'An error occurred while signing. Please try again.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  // Re-use printMOA locally in client view
  const triggerPrint = () => {
    // We import printMOA from AdminMOA or we redefine it
    // REDEFINE locally to ensure self-contained zero-import errors
    const logoUrl = window.location.origin + '/images/odcclearlogo.png';
    const formattedItems = (moa.scope || []).map(group => `
      <div class="scope-group">
        <h4>${group.title}</h4>
        <ul>
          ${(group.items || []).map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    const formattedPaymentTerms = (moa.paymentTerms || []).map(term => `<li>${term}</li>`).join('');
    const formattedWarranty = (moa.warranty || []).map(term => `<li>${term}</li>`).join('');
    const formattedLiability = (moa.liability || []).map(term => `<li>${term}</li>`).join('');
    const formattedGeneral = (moa.generalTerms || []).map(term => `<li>${term}</li>`).join('');

    const clientSig = moa.clientSigned ? `
      <div style="font-weight: bold; margin-bottom: 8px;">PARTY A (CLIENT):</div>
      <div style="font-family: 'Great Vibes', cursive; font-size: ${getSigFontSizePrint(moa.clientSigneeName)}; color: #111; margin: 10px 0; min-height: 38px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${moa.clientSigneeName}</div>
      <div class="sig-name" style="text-align: center; border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">${moa.clientSigneeName}</div>
      <div class="sig-title" style="text-align: center; font-size: 11px; margin-top: 2px;">${moa.clientSigneeTitle || 'Authorized Representative'}</div>
      <div style="font-size: 8px; color: #64748b; line-height: 1.3; font-family: sans-serif; text-align: center; margin-top: 10px; border-top: 1px dotted #ccc; padding-top: 5px;">
        DIGITALLY SIGNED VIA ODC PORTAL<br>
        Date: ${fmtDateTimeLong(moa.clientSignedAt)} | IP: ${moa.clientIp || 'Not Recorded'}
      </div>
    ` : `
      <div style="font-weight: bold; margin-bottom: 50px;">PARTY A (CLIENT):</div>
      <div class="sig-name" style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">${moa.clientName || '__________________________'}</div>
      <div class="sig-title" style="font-size: 11px; margin-top: 2px;">Signature: __________________________</div>
      <div class="sig-date" style="margin-top: 15px;">Date: __________________________</div>
    `;

    const providerSig = moa.providerSigned ? `
      <div style="font-weight: bold; margin-bottom: 8px;">PARTY B (SERVICE PROVIDER):</div>
      <div style="font-family: 'Great Vibes', cursive; font-size: ${getSigFontSizePrint(moa.providerSigneeName)}; color: #111; margin: 10px 0; min-height: 38px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${moa.providerSigneeName}</div>
      <div class="sig-name" style="text-align: center; border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">${moa.providerSigneeName}</div>
      <div class="sig-title" style="text-align: center; font-size: 11px; margin-top: 2px;">${moa.providerSigneeTitle || 'Owner, OdysseyPH IT Solutions'}</div>
      <div style="font-size: 8px; color: #64748b; line-height: 1.3; font-family: sans-serif; text-align: center; margin-top: 10px; border-top: 1px dotted #ccc; padding-top: 5px;">
        DIGITALLY APPROVED & SIGNED<br>
        Date: ${fmtDateTimeLong(moa.providerSignedAt)}
      </div>
    ` : `
      <div style="font-weight: bold; margin-bottom: 50px;">PARTY B (SERVICE PROVIDER):</div>
      <div class="sig-name" style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold;">${moa.providerName || CO.serviceProviderName}</div>
      <div class="sig-title" style="font-size: 11px; margin-top: 2px;">${moa.providerBusiness || CO.serviceProviderBusiness}</div>
      <div class="sig-title" style="font-size: 11px; margin-top: 2px;">Signature: __________________________</div>
      <div class="sig-date" style="margin-top: 15px;">Date: ${fmtDateLong(moa.date || today())}</div>
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MOA - ${moa.clientName || 'Generated'}</title>
    <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
    <style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Times New Roman', Times, serif; font-size: 14px; color: #000; background: #fff; line-height: 1.6; }
.pg { width: 794px; padding: 60px 80px; margin: 0 auto; position: relative; }
.pg-break { page-break-after: always; }
.hd { text-align: center; margin-bottom: 40px; }
.logo img { height: 80px; width: auto; display: block; margin: 0 auto 10px; }
.ci { text-align: center; line-height: 1.4; color: #333; font-size: 12px; }
.ci strong { font-size: 14px; }
.ttl { text-align: center; font-size: 20px; font-weight: bold; padding: 20px 0 30px; letter-spacing: 1px; }
.intro { margin-bottom: 30px; }
.party-block { margin-bottom: 25px; }
.party-block div { margin-bottom: 4px; }
h3 { font-size: 16px; font-weight: bold; margin: 30px 0 15px; }
ul { margin-left: 30px; margin-bottom: 15px; }
li { margin-bottom: 5px; }
.scope-group h4 { font-size: 14px; font-weight: bold; margin: 15px 0 5px; }
.scope-limit { margin-bottom: 20px; }
.cost { font-size: 15px; font-weight: bold; margin-bottom: 20px; }
.timeline-text, .maint-text { font-weight: bold; margin-bottom: 15px; display: block; }
.sig-section { margin-top: 60px; }
.sig-intro { margin-bottom: 40px; text-transform: uppercase; }
.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.sig-block { margin-top: 20px; border: 1px solid #eee; padding: 15px; border-radius: 6px; background: #fafafa; }
.sig-name { border-top: 1px solid #000; padding-top: 5px; margin-top: 40px; font-weight: bold; }
.sig-title { font-size: 12px; margin-top: 2px; }
.sig-date { margin-top: 15px; }
.freeform-body { margin-bottom: 40px; white-space: pre-wrap; font-family: 'Times New Roman', Times, serif; }

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg { padding: 40px 60px; width: 100%; margin: 0; box-shadow: none; }
  .no-break { page-break-inside: avoid; }
  .sig-block { background: #fff !important; border: 1px solid #ddd !important; }
}
</style></head><body>

<div class="pg">
  <div class="hd">
    <div class="logo"><img src="${logoUrl}" alt="ODC" /></div>
    <div class="ci">
      <strong>${CO.serviceProviderBusiness.split(' (')[0]}</strong><br>
      ${CO.address}<br>
      Email: ${CO.email}<br>
      Contact: ${CO.phone}
    </div>
  </div>

  ${moa.isFreeform ? `
    <div class="ttl">MEMORANDUM OF AGREEMENT</div>
    <div class="freeform-body">${moa.freeformContent}</div>
    
    ${!moa.hideFooter ? `
    <div class="sig-section no-break">
      <div class="sig-grid">
        <div class="sig-block">
          ${clientSig}
        </div>

        <div class="sig-block">
          ${providerSig}
        </div>
      </div>
    </div>
    ` : ''}
  ` : `
  <div class="ttl">MEMORANDUM OF AGREEMENT</div>

  <div class="intro">
    This Memorandum of Agreement ("Agreement") is entered into by and between:
  </div>

  <div class="party-block">
    <div>PARTY A (CLIENT):</div>
    <div>Name: ${moa.clientName}</div>
    <div>Business Name: ${moa.clientBusiness}</div>
    <div>Address: ${moa.clientAddress}</div>
  </div>

  <div style="margin-bottom: 25px;">and</div>

  <div class="party-block">
    <div>PARTY B (SERVICE PROVIDER):</div>
    <div>Name: ${moa.providerName || CO.serviceProviderName}</div>
    <div>Business Name: ${moa.providerBusiness || CO.serviceProviderBusiness}</div>
    <div>Address: ${CO.address}</div>
  </div>

  <div style="margin-bottom: 30px;">
    Party A and Party B shall hereinafter be referred to individually as a "Party" and collectively as the "Parties."
  </div>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>1. PURPOSE OF THE AGREEMENT</h3>
  <p>${moa.purpose}</p>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>2. SCOPE OF WORK</h3>
  <p>Party B agrees to develop and deliver <strong>ONLY</strong> the following features:</p>
  ${formattedItems}

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">
  
  <h3>3. SCOPE LIMITATION</h3>
  <div class="scope-limit">
    <p style="margin-bottom: 15px;">This Agreement strictly covers <strong>ONLY</strong> the features listed in Section 2.</p>
    <p>Any additional requests, enhancements, modifications, or features <strong>not explicitly stated above</strong> shall be considered <strong>outside the scope</strong> and will be subject to a separate quotation and agreement.</p>
  </div>

</div><div class="pg-break"></div><div class="pg">
  
  <div class="hd">
    <div class="logo"><img src="${logoUrl}" alt="ODC" /></div>
    <div class="ci">
      <strong>${CO.serviceProviderBusiness.split(' (')[0]}</strong><br>
      ${CO.address}<br>
      Email: ${CO.email}<br>
      Contact: ${CO.phone}
    </div>
  </div>

  <h3>4. PROJECT COST</h3>
  <p style="margin-bottom: 15px;">The total project cost for the above scope of work is:</p>
  <div class="cost">₱${fmt(moa.projectCost)}</div>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>5. PAYMENT TERMS</h3>
  <ul>${formattedPaymentTerms}</ul>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>6. DEVELOPMENT TIMELINE</h3>
  <p style="margin-bottom: 15px;">The project shall be completed within:</p>
  <span class="timeline-text">${moa.timeline}</span>
  <p>Starting from the official commencement date agreed upon by both parties.</p>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>7. FREE MAINTENANCE</h3>
  <p style="margin-bottom: 15px;">Party B agrees to provide free maintenance for a period of <strong>${moa.maintenancePeriod}</strong> after project completion.</p>
  
  <div class="no-break">
    <p style="font-weight: bold; margin-bottom: 5px;">Maintenance Coverage:</p>
    <ul>
      <li>Bug fixes related to the developed features</li>
      <li>Minor corrections due to system errors</li>
    </ul>
    
    <p style="font-weight: bold; margin-bottom: 5px; margin-top: 15px;">Important Limitation:</p>
    <ul>
      <li>Maintenance is strictly limited to <strong>bug fixing only</strong></li>
      <li>Any new features, enhancements, or modifications are <strong>NOT included</strong></li>
      <li>Any requests beyond bug fixes shall be treated as <strong>Change Requests</strong> and will be billed separately</li>
    </ul>
  </div>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>8. WARRANTY & ACCEPTANCE</h3>
  <ul>${formattedWarranty}</ul>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  <h3>9. LIABILITY LIMITATION</h3>
  <p style="margin-bottom: 10px;">Party B shall not be held liable for:</p>
  <ul>${formattedLiability}</ul>

</div><div class="pg-break"></div><div class="pg">

  <div class="hd">
    <div class="logo"><img src="${logoUrl}" alt="ODC" /></div>
    <div class="ci">
      <strong>${CO.serviceProviderBusiness.split(' (')[0]}</strong><br>
      ${CO.address}<br>
      Email: ${CO.email}<br>
      Contact: ${CO.phone}
    </div>
  </div>

  <h3>10. GENERAL TERMS</h3>
  <ul>${formattedGeneral}</ul>

  <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

  ${!moa.hideFooter ? `
  <div class="sig-section no-break">
    <h3>11. SIGNATURES</h3>
    <div class="sig-intro">
      IN WITNESS WHEREOF, the parties have hereunto affixed their signatures on the date indicated below.
    </div>
    
    <hr style="border: 0; border-top: 1px solid #ccc; margin: 30px 0;">

    <div class="sig-grid">
      <div class="sig-block">
        ${clientSig}
      </div>

      <div class="sig-block">
        ${providerSig}
      </div>
    </div>
  </div>
  ` : ''}
  `}

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

  // eslint-disable-next-line no-unused-vars
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>Loading agreement details…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !moa) {
    return (
      <div style={S.container}>
        <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '400px' }}>
          <PenTool size={48} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: 12 }}>Document Error</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: 24 }}>{error || 'Invalid MOA Link'}</p>
          <button onClick={() => navigate('/')} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>Return to Home</button>
        </div>
      </div>
    );
  }

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
        <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '0.5px' }}>Odysseyph IT Solutions</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={S.card}
      >
        <h1 style={S.heading}>Memorandum of Agreement</h1>
        <p style={S.subheading}>ODC Document Portal Verification</p>

        {moa.isFreeform ? (
          <div style={{
            background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)',
            whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.85)', fontSize: '14px', lineHeight: '1.7', marginBottom: '28px', fontFamily: 'monospace'
          }}>
            {moa.freeformContent}
          </div>
        ) : (
          <div>
            <div style={S.partyBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#ff9a4a', fontWeight: 700 }}>PARTY A (CLIENT)</span></div>
              <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.8)', lineBreak: 'anywhere' }}>
                <strong>Business Name:</strong> {moa.clientBusiness}<br />
                <strong>Representative Name:</strong> {moa.clientName}<br />
                <strong>Address:</strong> {moa.clientAddress}
              </div>
            </div>

            <div style={S.partyBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#60a5fa', fontWeight: 700 }}>PARTY B (SERVICE PROVIDER)</span></div>
              <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.8)' }}>
                <strong>Business Name:</strong> {moa.providerBusiness || CO.serviceProviderBusiness}<br />
                <strong>Representative Name:</strong> {moa.providerName || CO.serviceProviderName}<br />
                <strong>Address:</strong> {CO.address}
              </div>
            </div>

            <h3 style={S.sectionTitle}>1. Purpose of Agreement</h3>
            <p style={S.bodyText}>{moa.purpose}</p>

            <h3 style={S.sectionTitle}>2. Scope of Work & Completed Deliverables</h3>
            <div style={{ paddingLeft: '16px', marginBottom: '20px' }}>
              {(moa.scope || []).map((group, idx) => (
                <div key={group.id || idx} style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: '#a5b4fc', fontSize: '13.5px', fontWeight: 600, margin: '0 0 6px 0' }}>{group.title}</h4>
                  <ul style={{ margin: 0, paddingLeft: '18px', color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: '1.6' }}>
                    {(group.items || []).map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <h3 style={S.sectionTitle}>3. Project Cost</h3>
            <p style={S.bodyText}>The total project cost for the development scope is **₱{fmt(moa.projectCost)}**.</p>

            <h3 style={S.sectionTitle}>4. Development Timeline</h3>
            <p style={S.bodyText}>The project development schedule is **{moa.timeline}**.</p>
          </div>
        )}

        {/* Double Signature Auditing */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '40px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '28px' }}>
          {/* Provider Signature Display */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '20px', borderRadius: '16px', position: 'relative' }}>
            {moa.providerSigned ? (
              <>
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: '8px', color: '#34d399', border: '1px solid #34d399', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>SIGNED</div>
                <div style={{ fontFamily: "'Great Vibes', cursive", fontSize: getSigFontSize(moa.providerSigneeName), color: '#ff9a4a', textAlign: 'center', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{moa.providerSigneeName}</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>{moa.providerSigneeName}</div>
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '2px' }}>{moa.providerSigneeTitle}</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '10px', borderTop: '1px dotted rgba(255,255,255,0.06)', paddingTop: '8px' }}>Approved: {fmtDateTimeLong(moa.providerSignedAt)}</div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                <Clock size={20} style={{ marginBottom: 8 }} />
                <span>Pending Provider Signature</span>
              </div>
            )}
          </div>

          {/* Client Signature Display/Form */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '20px', borderRadius: '16px', position: 'relative' }}>
            {moa.clientSigned ? (
              <>
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: '8px', color: '#34d399', border: '1px solid #34d399', borderRadius: '4px', padding: '2px 6px', fontWeight: 700 }}>SIGNED</div>
                <div style={{ fontFamily: "'Great Vibes', cursive", fontSize: getSigFontSize(moa.clientSigneeName), color: '#ff9a4a', textAlign: 'center', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px 0', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{moa.clientSigneeName}</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fff', textAlign: 'center' }}>{moa.clientSigneeName}</div>
                <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: '2px' }}>{moa.clientSigneeTitle}</div>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: '10px', borderTop: '1px dotted rgba(255,255,255,0.06)', paddingTop: '8px' }}>Signed: {fmtDateTimeLong(moa.clientSignedAt)}<br />IP: {moa.clientIp}</div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                <Clock size={20} style={{ marginBottom: 8 }} />
                <span>Pending Client Signature</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic client signing box */}
        {!moa.clientSigned && (
          <form onSubmit={handleSignMoa} style={S.signaturePad}>
            <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>Authorized Client Representative Sign-off</h4>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 20px 0' }}>Type your full name and title to digitally sign this Memorandum of Agreement.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600 }}>Your Full Name</label>
                <input
                  style={S.input}
                  value={signeeName}
                  onChange={e => setSigneeName(e.target.value)}
                  placeholder="e.g. Kharyl Simolde"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 600 }}>Title / Designation</label>
                <input
                  style={S.input}
                  value={signeeTitle}
                  onChange={e => setSigneeTitle(e.target.value)}
                  placeholder="e.g. Director / CEO"
                  required
                />
              </div>
            </div>

            {signeeName.trim() && (
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Cursive Signature Signature Preview</span>
                <div style={S.cursivePreview}>{signeeName}</div>
              </div>
            )}

            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '20px 0', cursor: 'pointer', textAlign: 'left' }}>
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={e => setAgreementChecked(e.target.checked)}
                style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px', cursor: 'pointer' }}
                required
              />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11.5px', lineHeight: 1.5 }}>
                I hereby declare that I am authorized to represent <strong>{moa.clientBusiness}</strong> and I formalize my acceptance and execution of the terms of this Memorandum of Agreement.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting || !signeeName.trim()}
              style={{
                ...S.btn,
                background: (submitting || !signeeName.trim())
                  ? 'rgba(255,106,26,0.3)'
                  : 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
                color: '#fff',
                cursor: (submitting || !signeeName.trim()) ? 'not-allowed' : 'pointer',
                boxShadow: (submitting || !signeeName.trim()) ? 'none' : '0 6px 20px rgba(255,106,26,0.3)',
              }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting Signature…
                </>
              ) : (
                <>
                  Sign & Execute Agreement <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>
        )}

        {/* Print controls if fully signed */}
        {moa.clientSigned && (
          <div style={{ marginTop: '32px' }}>
            <button
              onClick={triggerPrint}
              style={{
                ...S.btn,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              }}
            >
              <Printer size={16} /> Print Official Double-Signed Agreement
            </button>
          </div>
        )}
      </motion.div>

      <footer style={{ marginTop: '40px', zIndex: 1, display: 'flex', gap: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
        <span>Secure Electronic Contract Portal</span>
        <span>&bull;</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Globe size={12} /> IP: {clientIp || 'Detecting...'}
        </span>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <CustomModal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        icon={modal.icon}
        confirmText="OK"
      />
    </div>
  );
}
