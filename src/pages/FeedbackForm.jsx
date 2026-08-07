import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Star, MessageSquare, ShieldCheck, RefreshCw, Send, CheckCircle2, ChevronRight } from 'lucide-react';

const S = {
  container: {
    minHeight: '100vh',
    background: '#0a0d14',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: '32px 40px',
    width: '100%',
    maxWidth: 580,
    boxSizing: 'border-box',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
    zIndex: 10,
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255, 106, 26, 0.15) 0%, rgba(255, 106, 26, 0) 70%)',
    top: '10%',
    left: '10%',
    zIndex: 1,
  },
  glow2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(96, 165, 250, 0.12) 0%, rgba(96, 165, 250, 0) 70%)',
    bottom: '10%',
    right: '10%',
    zIndex: 1,
  },
  lbl: {
    display: 'block',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  inp: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  btn: {
    width: '100%',
    cursor: 'pointer',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#fff',
    background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
    boxShadow: '0 4px 15px rgba(255, 106, 26, 0.3)',
    transition: 'all 0.3s',
  },
};

function StarRating({ label, rating, onChange }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={S.lbl}>{label}</label>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || rating);
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                outline: 'none',
                transition: 'transform 0.15s ease',
                transform: hoverRating === star ? 'scale(1.2)' : 'none',
              }}
            >
              <Star
                size={28}
                fill={isFilled ? '#ff9a4a' : 'none'}
                color={isFilled ? '#ff9a4a' : 'rgba(255,255,255,0.2)'}
                style={{ transition: 'all 0.2s' }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FeedbackForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientId = id || searchParams.get('client') || searchParams.get('id');

  const [loadingClient, setLoadingClient] = useState(!!clientId);
  const [clientData, setClientData] = useState(null);

  // Form State
  const [form, setForm] = useState({
    clientName: '',
    businessName: '',
    ratingOverall: 0,
    ratingCommunication: 0,
    ratingTimeliness: 0,
    testimonial: '',
    whatWentWell: '',
    whatToImprove: '',
    allowReference: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch Client Profile for prefilling
  useEffect(() => {
    if (!clientId) return;
    const fetchClient = async () => {
      try {
        const docRef = doc(db, 'clients', clientId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setClientData(data);
          setForm((prev) => ({
            ...prev,
            clientName: data.name || '',
            businessName: data.business || '',
          }));
        } else {
          console.warn('No client record found for ID:', clientId);
        }
      } catch (err) {
        console.error('Error fetching client details:', err);
      } finally {
        setLoadingClient(false);
      }
    };
    fetchClient();
  }, [clientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.clientName.trim() || !form.businessName.trim()) {
      setErrorMsg('Please specify your name and project name.');
      return;
    }
    if (form.ratingOverall === 0 || form.ratingCommunication === 0 || form.ratingTimeliness === 0) {
      setErrorMsg('Please provide ratings for all categories.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        clientId: clientId || null,
        clientName: form.clientName.trim(),
        businessName: form.businessName.trim(),
        ratingOverall: Number(form.ratingOverall),
        ratingCommunication: Number(form.ratingCommunication),
        ratingTimeliness: Number(form.ratingTimeliness),
        testimonial: form.testimonial.trim(),
        whatWentWell: form.whatWentWell.trim(),
        whatToImprove: form.whatToImprove.trim(),
        allowReference: !!form.allowReference,
        submittedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'clientFeedback'), payload);
      setSuccess(true);
    } catch (err) {
      console.error('Error saving feedback:', err);
      setErrorMsg('An error occurred while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={S.container}>
      <div style={S.glow} />
      <div style={S.glow2} />

      <div style={S.card}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #ff6a1a, #ff9a4a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Odyssey Tech Solutions</h2>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Project Feedback Form</p>
          </div>
        </div>

        {loadingClient ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            <p>Loading project details…</p>
          </div>
        ) : success ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle2 size={36} color="#34d399" />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px 0' }}>Thank you!</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px 0' }}>
              Your feedback was recorded successfully. We appreciate your valuable time and input, which helps us continuously refine our products and services.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ ...S.btn, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', boxShadow: 'none' }}
            >
              Go to Website
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5, margin: '0 0 10px 0' }}>
              We value your partnership. Please let us know how your project went so we can improve our delivery.
            </p>

            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                {errorMsg}
              </div>
            )}

            {/* Read-only if client ID provided, else input */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.lbl}>Your Name *</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  style={{
                    ...S.inp,
                    background: clientData ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    borderColor: clientData ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                  }}
                  disabled={!!clientData}
                  required
                />
              </div>
              <div>
                <label style={S.lbl}>Company / Project *</label>
                <input
                  type="text"
                  placeholder="e.g. Acme App"
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  style={{
                    ...S.inp,
                    background: clientData ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                    borderColor: clientData ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                  }}
                  disabled={!!clientData}
                  required
                />
              </div>
            </div>

            {/* Ratings Section */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 16, padding: '18px 20px', marginTop: 6 }}>
              <StarRating
                label="Overall Project Quality *"
                rating={form.ratingOverall}
                onChange={(v) => setForm({ ...form, ratingOverall: v })}
              />
              <StarRating
                label="Communication & Responsiveness *"
                rating={form.ratingCommunication}
                onChange={(v) => setForm({ ...form, ratingCommunication: v })}
              />
              <StarRating
                label="Timeliness & Schedule *"
                rating={form.ratingTimeliness}
                onChange={(v) => setForm({ ...form, ratingTimeliness: v })}
              />
            </div>

            {/* Testimonial Quote */}
            <div>
              <label style={S.lbl}>Testimonial Quote / Overall Review</label>
              <textarea
                placeholder="How would you describe your overall experience working with Odyssey? E.g., 'The team delivered on time and our users love the design!'"
                value={form.testimonial}
                onChange={(e) => setForm({ ...form, testimonial: e.target.value })}
                style={{ ...S.inp, height: 70, resize: 'vertical' }}
              />
            </div>

            {/* Detailed feedback */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.lbl}>What went well?</label>
                <textarea
                  placeholder="E.g., design precision, communication, technical setup..."
                  value={form.whatWentWell}
                  onChange={(e) => setForm({ ...form, whatWentWell: e.target.value })}
                  style={{ ...S.inp, height: 60, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={S.lbl}>What could be improved?</label>
                <textarea
                  placeholder="E.g., response speeds, post-launch details..."
                  value={form.whatToImprove}
                  onChange={(e) => setForm({ ...form, whatToImprove: e.target.value })}
                  style={{ ...S.inp, height: 60, resize: 'vertical' }}
                />
              </div>
            </div>

            {/* Reference Option */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0', cursor: 'pointer' }}>
              <input
                id="allowReference"
                type="checkbox"
                checked={form.allowReference}
                onChange={(e) => setForm({ ...form, allowReference: e.target.checked })}
                style={{ cursor: 'pointer', marginTop: 3 }}
              />
              <label htmlFor="allowReference" style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', lineHeight: 1.4 }}>
                We permit Odyssey to display our logo, project title, and testimonial quote as a client reference.
              </label>
            </div>

            <button type="submit" disabled={submitting} style={{ ...S.btn, marginTop: 10 }}>
              {submitting ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Submitting...
                </>
              ) : (
                <>
                  Submit Feedback <Send size={15} />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
