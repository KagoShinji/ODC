import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { AlertTriangle, Check, CircleAlert, Info, X } from 'lucide-react';
import { SystemModalContext } from './SystemModalContext';
import './SystemModal.css';

const ICONS = {
  success: Check,
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
};

function normalizeOptions(options, defaults) {
  const supplied = typeof options === 'string' ? { message: options } : options;
  return { ...defaults, ...(supplied || {}) };
}

export function SystemModal({
  open,
  mode = 'alert',
  variant = 'info',
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const Icon = ICONS[variant] || Info;
  const isConfirm = mode === 'confirm';

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      (isConfirm ? cancelRef.current : confirmRef.current)?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll('button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isConfirm, onClose, open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <Motion.div
          className="system-modal-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            if (!isConfirm && event.target === event.currentTarget) onClose();
          }}
        >
          <Motion.section
            ref={dialogRef}
            className={`system-modal system-modal--${variant}`}
            role={variant === 'error' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={message ? descriptionId : undefined}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <button className="system-modal__close" type="button" onClick={onClose} aria-label="Close dialog">
              <X size={18} aria-hidden="true" />
            </button>

            <div className="system-modal__mark" aria-hidden="true">
              <Icon size={23} strokeWidth={2.15} />
            </div>

            <div className="system-modal__copy">
              <p className="system-modal__eyebrow">
                {isConfirm ? 'Confirmation required' : variant === 'success' ? 'Completed' : variant === 'error' ? 'Action failed' : 'Notice'}
              </p>
              <h2 id={titleId}>{title}</h2>
              {message && <p id={descriptionId}>{message}</p>}
            </div>

            <div className="system-modal__actions">
              {isConfirm && (
                <button ref={cancelRef} className="system-modal__button system-modal__button--secondary" type="button" onClick={onClose}>
                  {cancelLabel}
                </button>
              )}
              <button ref={confirmRef} className="system-modal__button system-modal__button--primary" type="button" onClick={onConfirm}>
                {confirmLabel || (isConfirm ? 'Confirm' : 'Close')}
              </button>
            </div>
          </Motion.section>
        </Motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function SystemModalProvider({ children }) {
  const [requests, setRequests] = useState([]);
  const active = requests[0] || null;

  const show = useCallback((options) => new Promise((resolve) => {
    setRequests((current) => [...current, { ...options, id: crypto.randomUUID(), resolve }]);
  }), []);

  const settle = useCallback((result) => {
    setRequests((current) => {
      if (!current.length) return current;
      current[0].resolve(result);
      return current.slice(1);
    });
  }, []);

  const confirm = useCallback((options) => show(normalizeOptions(options, {
    mode: 'confirm',
    variant: 'warning',
    title: 'Confirm this action',
    confirmLabel: 'Confirm',
  })), [show]);

  const success = useCallback((options) => show(normalizeOptions(options, {
    mode: 'alert',
    variant: 'success',
    title: 'Changes saved',
  })), [show]);

  const error = useCallback((options) => show(normalizeOptions(options, {
    mode: 'alert',
    variant: 'error',
    title: 'We could not complete that action',
  })), [show]);

  const info = useCallback((options) => show(normalizeOptions(options, {
    mode: 'alert',
    variant: 'info',
    title: 'Information',
  })), [show]);

  return (
    <SystemModalContext.Provider value={{ confirm, success, error, info }}>
      {children}
      <SystemModal
        open={Boolean(active)}
        mode={active?.mode}
        variant={active?.variant}
        title={active?.title}
        message={active?.message}
        confirmLabel={active?.confirmLabel}
        cancelLabel={active?.cancelLabel}
        onConfirm={() => settle(true)}
        onClose={() => settle(false)}
      />
    </SystemModalContext.Provider>
  );
}
