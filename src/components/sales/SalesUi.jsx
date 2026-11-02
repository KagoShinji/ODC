import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { stageLabel } from '../../../functions/src/salesDomain.js';

export function SalesDialog({ title, busy, onClose, wide = false, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current; const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector('[data-autofocus]')?.focus();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={ref} className={`task-dialog sales-dialog${wide ? ' sales-dialog-wide' : ''}`} aria-labelledby="sales-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
      <header>
        <h3 id="sales-dialog-title">{title}</h3>
        <button type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} /></button>
      </header>
      {children}
    </dialog>
  );
}

export function StagePill({ stage }) {
  return <span className={`task-pill sales-stage sales-stage-${stage}`}>{stageLabel(stage)}</span>;
}

export function Progress({ value, target, label }) {
  const percent = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="sales-progress">
      <div className="sales-progress-head"><span>{label}</span><strong>{value}<small> / {target}</small></strong></div>
      <div className="sales-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={target} aria-valuenow={value}>
        <span style={{ width: `${percent}%` }} className={percent >= 100 ? 'is-met' : ''} />
      </div>
    </div>
  );
}

export function Metric({ label, value, hint, tone }) {
  return (
    <div className={`task-stat ${tone ? `task-stat-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small className="task-muted">{hint}</small>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="task-empty">
      {Icon && <Icon size={32} aria-hidden="true" />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
