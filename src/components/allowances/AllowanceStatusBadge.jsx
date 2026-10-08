const STATUS_TONES = {
  active: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  held: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  approved: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  released: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  submitted: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
  planned: 'border-violet-400/25 bg-violet-400/10 text-violet-300',
  pending_setup: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  transfer_pending: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  transfer_failed: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  returned: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  suspended: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  draft: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  cancelled: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  rejected: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  voided: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  closed: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  inactive: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  overdue: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
};

const DOT_TONES = {
  active: 'bg-emerald-300',
  held: 'bg-emerald-300',
  approved: 'bg-emerald-300',
  released: 'bg-emerald-300',
  submitted: 'bg-sky-300',
  planned: 'bg-violet-300',
  pending_setup: 'bg-amber-300',
  transfer_pending: 'bg-amber-300',
  transfer_failed: 'bg-rose-300',
  returned: 'bg-amber-300',
  suspended: 'bg-amber-300',
  draft: 'bg-slate-300',
  cancelled: 'bg-rose-300',
  rejected: 'bg-rose-300',
  voided: 'bg-rose-300',
  closed: 'bg-rose-300',
  inactive: 'bg-rose-300',
  overdue: 'bg-rose-300',
};

const allowanceStatusLabel = value => String(value || '').replaceAll('_', ' ');

export default function AllowanceStatusBadge({ status, className = '' }) {
  const key = String(status || '').toLowerCase();
  const tone = STATUS_TONES[key] || 'border-white/15 bg-white/5 text-white/60';
  const dot = DOT_TONES[key] || 'bg-white/40';

  return <span className={`inline-flex min-h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize leading-none ${tone} ${className}`}>
    <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
    {allowanceStatusLabel(status)}
  </span>;
}
