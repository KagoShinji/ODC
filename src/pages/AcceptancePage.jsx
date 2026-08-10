import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { ShieldCheck, Printer, CheckCircle2, ChevronRight, FileText, Globe, Award, Sparkles, RefreshCw } from 'lucide-react';
import { printCertificate } from './AdminAcceptance';
import CustomModal from '../components/ui/CustomModal';

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
    overflowHidden: 'hidden',
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
    maxWidth: '750px',
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
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
    fontSize: '15px',
    color: '#fff',
    fontWeight: 600,
  },
  scopeBox: {
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '32px',
  },
  scopeTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#ff9a4a',
    margin: '0 0 12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  scopeList: {
    paddingLeft: '20px',
    margin: 0,
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13.5px',
    lineHeight: '1.8',
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

const getSigFontSizePreview = (name) => {
  const len = (name || '').length;
  if (len > 25) return '20px';
  if (len > 20) return '26px';
  if (len > 15) return '34px';
  return '44px';
};

export default function AcceptancePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [coa, setCoa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Signature Form State
  const [signeeName, setSigneeName] = useState('');
  const [signeeTitle, setSigneeTitle] = useState('');
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [clientIp, setClientIp] = useState('');
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', icon: 'info' });

  const showAlert = (title, message, icon = 'info') => {
    setModal({ isOpen: true, title, message, type: 'alert', icon });
  };

  // Fetch Certificate & Load Cursive Font
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
      .catch(() => setClientIp('127.0.0.1')); // Fallback

    const fetchCoa = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'certificates', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'Accepted') {
            setError('This turnover link has expired as the Certificate of Acceptance has already been signed and executed.');
          } else {
            setCoa({ id: docSnap.id, ...data });
          }
        } else {
          setError('Turnover certificate not found. Please contact support.');
        }
      } catch (err) {
        console.error('Error fetching certificate:', err);
        if (err.code === 'permission-denied') {
          setError('This turnover link has expired as the Certificate of Acceptance has already been signed and executed.');
        } else {
          setError('Failed to retrieve turnover certificate details.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCoa();
  }, [id]);

  const handleAccept = async (e) => {
    e.preventDefault();
    if (!agreementChecked) {
      showAlert('Consent Required', 'Please check the confirmation box to proceed.', 'warning');
      return;
    }
    if (!signeeName.trim()) {
      showAlert('Name Required', 'Please enter your full name to sign.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const docRef = doc(db, 'certificates', id);
      const updateData = {
        status: 'Accepted',
        signeeName: signeeName.trim(),
        signeeTitle: signeeTitle.trim() || 'Authorized Representative',
        acceptedAt: serverTimestamp(),
        ipAddress: clientIp,
        userAgent: navigator.userAgent,
      };
      await updateDoc(docRef, updateData);

      // Update local state
      setCoa(prev => ({
        ...prev,
        ...updateData,
        acceptedAt: { toDate: () => new Date() } // temporary mock for local display
      }));
    } catch (err) {
      console.error('Error signing certificate:', err);
      showAlert('Submission Error', 'An error occurred during submission. Please try again.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={S.container}>
        <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '15px' }}>Loading Turnover details…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !coa) {
    return (
      <div style={S.container}>
        <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '400px' }}>
          <Award size={48} color="#f87171" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', color: '#fff', marginBottom: 12 }}>Document Error</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.6, marginBottom: 24 }}>{error || 'Invalid Certificate Link'}</p>
          <button onClick={() => navigate('/')} style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', color: '#fff' }}>Return to ODC Home</button>
        </div>
      </div>
    );
  }

  const isAccepted = coa.status === 'Accepted';
  const hasScope = coa.scope && coa.scope.length > 0;

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
        transition={{ duration: 0.5 }}
        style={S.card}
      >
        {isAccepted && (
          <div style={{
            position: 'absolute', top: 24, right: 24,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: '24px', padding: '6px 16px', color: '#34d399', fontSize: '12px', fontWeight: 700
          }}>
            <Sparkles size={13} /> COMPLETED TURNOVER
          </div>
        )}

        <h1 style={S.heading}>Certificate of Acceptance</h1>
        <p style={S.subheading}>Project turnover and sign-off verification</p>

        {/* Certificate description text */}
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '14.5px',
          lineHeight: '1.65',
          textAlign: 'justify',
          marginBottom: '28px',
        }}>
          {coa.customText || `This Certificate of Completion and Acceptance is issued to certify that ${coa.providerBusiness} has successfully completed and delivered the project specified below. The Client representative confirms that all system deliverables have been inspected, tested, and verified as fully functional according to specifications.`}
        </p>

        {/* Info Grid */}
        <div style={S.infoGrid}>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Project / System</span>
            <span style={S.infoValue}>{coa.projectName}</span>
          </div>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Client Business</span>
            <span style={S.infoValue}>{coa.clientBusiness}</span>
          </div>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Client Representative</span>
            <span style={S.infoValue}>{coa.clientName}</span>
          </div>
          <div style={S.infoItem}>
            <span style={S.infoLabel}>Turnover Date</span>
            <span style={S.infoValue}>{fmtDateLong(coa.turnoverDate)}</span>
          </div>
        </div>

        {/* Scope details */}
        <div style={S.scopeBox}>
          <h3 style={S.scopeTitle}>
            <FileText size={16} /> Deliverables Turnover Scope
          </h3>
          {hasScope ? (
            <ul style={S.scopeList}>
              {coa.scope.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
              The project has been completed and turned over as a whole system, covering all modules, files, database configurations, and deployment setups corresponding to the agreed system functionality.
            </p>
          )}
        </div>

        {/* Signature Panel */}
        {!isAccepted ? (
          <form onSubmit={handleAccept}>
            <div style={S.signaturePad}>
              <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0' }}>Authorized Digital Signature</h4>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 20px 0' }}>Type your full name below to generate your electronic signature.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'left' }}>
                <div>
                  <label style={{ ...S.infoLabel, color: 'rgba(255,255,255,0.6)' }}>Your Full Name</label>
                  <input
                    style={S.input}
                    value={signeeName}
                    onChange={e => setSigneeName(e.target.value)}
                    placeholder="e.g. Kharyl Simolde"
                    required
                  />
                </div>
                <div>
                  <label style={{ ...S.infoLabel, color: 'rgba(255,255,255,0.6)' }}>Title / Designation</label>
                  <input
                    style={S.input}
                    value={signeeTitle}
                    onChange={e => setSigneeTitle(e.target.value)}
                    placeholder="e.g. CEO / Project Lead"
                    required
                  />
                </div>
              </div>

              {/* Signature Preview Canvas */}
              {signeeName.trim() && (
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                  <span style={S.infoLabel}>Digital Signature Preview</span>
                  <div style={{ ...S.cursivePreview, fontSize: getSigFontSizePreview(signeeName), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{signeeName}</div>
                </div>
              )}
            </div>

            {/* Checkbox agreement */}
            <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '24px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={e => setAgreementChecked(e.target.checked)}
                style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px', cursor: 'pointer' }}
                required
              />
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', lineHeight: 1.5 }}>
                I hereby verify and confirm that I am an authorized representative of <strong>{coa.clientBusiness}</strong>. Clicking accept establishes my formal agreement that the project deliverables are complete, functional, and fully accepted.
              </span>
            </label>

            {/* Submit Button */}
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
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting Acceptance…
                </>
              ) : (
                <>
                  Accept & Turnover System <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Accepted Success State */
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(52,211,153,0.02) 100%)',
              border: '1px solid rgba(52,211,153,0.2)',
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              marginTop: '32px',
            }}
          >
            <CheckCircle2 size={48} color="#34d399" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: '0 0 8px 0' }}>Turnover Accepted & Completed</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', lineHeight: 1.6, maxWidth: '500px', margin: '0 auto 24px' }}>
              This system turnover has been formally signed off by <strong>{coa.signeeName}</strong> ({coa.signeeTitle}) representing <strong>{coa.clientBusiness}</strong>. The audit logs, digital signature, and IP record have been recorded below.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              textAlign: 'left',
              background: 'rgba(0,0,0,0.2)',
              padding: '16px',
              borderRadius: '12px',
              fontSize: '11.5px',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '28px',
              border: '1px solid rgba(255,255,255,0.03)'
            }}>
              <div>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Accepted By:</strong> {coa.signeeName} ({coa.signeeTitle})
              </div>
              <div>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Timestamp:</strong> {coa.acceptedAt ? fmtDateTimeLong(coa.acceptedAt) : ''}
              </div>
              <div>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>IP Address:</strong> {coa.ipAddress || 'Not recorded'}
              </div>
              <div>
                <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Certificate Number:</strong> {coa.certificateNumber}
              </div>
            </div>

            <button
              onClick={() => printCertificate(coa)}
              style={{
                ...S.btn,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
              }}
            >
              <Printer size={16} /> Print Official PDF Certificate
            </button>
          </motion.div>
        )}
      </motion.div>

      <footer style={{ marginTop: '40px', zIndex: 1, display: 'flex', gap: '20px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
        <span>Secure Electronic Turnover Portal</span>
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
