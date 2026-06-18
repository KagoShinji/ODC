import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, HelpCircle, X, ShieldAlert } from 'lucide-react';

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 8, 16, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    background: 'rgba(15, 22, 42, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '32px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15)',
    color: '#fff',
    fontFamily: "'Inter', sans-serif",
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  iconBox: {
    width: '48px',
    height: '48px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '4px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
    color: '#fff',
  },
  message: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.65)',
    lineHeight: '1.6',
    margin: 0,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
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
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
};

export default function CustomModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'alert', // 'alert' | 'confirm' | 'prompt'
  promptFields = [], // array of { key, label, defaultValue, placeholder }
  onConfirm,
  confirmText,
  cancelText = 'Cancel',
  icon = 'info', // 'info' | 'success' | 'warning' | 'question'
}) {
  const [formData, setFormData] = useState({});

  // Reset/populate form when modal opens
  useEffect(() => {
    if (isOpen && type === 'prompt') {
      const initial = {};
      promptFields.forEach(f => {
        initial[f.key] = f.defaultValue || '';
      });
      setFormData(initial);
    }
  }, [isOpen, type, promptFields]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'prompt') {
      onConfirm(formData);
    } else {
      onConfirm();
    }
    onClose();
  };

  const getIcon = () => {
    switch (icon) {
      case 'success':
        return (
          <div style={{ ...S.iconBox, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle2 size={24} />
          </div>
        );
      case 'warning':
        return (
          <div style={{ ...S.iconBox, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <ShieldAlert size={24} />
          </div>
        );
      case 'question':
        return (
          <div style={{ ...S.iconBox, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <HelpCircle size={24} />
          </div>
        );
      default:
        return (
          <div style={{ ...S.iconBox, background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24' }}>
            <AlertCircle size={24} />
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      <div style={S.overlay} onClick={() => type === 'alert' && onClose()}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={S.modal}
          onClick={e => e.stopPropagation()}
        >
          {/* Close button for alerts */}
          {type === 'alert' && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '24px',
                right: '24px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {getIcon()}
            <h3 style={S.title}>{title}</h3>
            {message && <p style={S.message}>{message}</p>}
          </div>

          {/* Prompt inputs */}
          {type === 'prompt' && promptFields.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {promptFields.map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {f.label}
                  </label>
                  <input
                    style={S.input}
                    value={formData[f.key] || ''}
                    placeholder={f.placeholder}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                    required
                  />
                </div>
              ))}
            </div>
          )}

          {/* Action Footer */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            {type !== 'alert' && (
              <button
                onClick={onClose}
                style={{
                  ...S.btn,
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                {cancelText}
              </button>
            )}

            <button
              onClick={handleConfirm}
              style={{
                ...S.btn,
                background: type === 'confirm' && icon === 'warning'
                  ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                  : 'linear-gradient(135deg, #ff6a1a, #ff9a4a)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(255,106,26,0.25)',
              }}
            >
              {confirmText || (type === 'confirm' ? 'Confirm' : 'OK')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
