import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Download, Users } from 'lucide-react';
import { StagePill, Empty } from './SalesUi';
import { SALES_STAGES, localDateKey, eligibleLead } from '../../../functions/src/salesDomain.js';
import { loadLeads } from '../../services/salesService';
import { errorText, formatDay, downloadCsv, toMillis, rangeFor } from '../../utils/salesFormat';

const PERIODS = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: '90', label: 'Last 90 days' },
  { id: 'all', label: 'All (latest 1,500)' },
  { id: 'custom', label: 'Custom range' },
];

export default function SalesLeads({ ctx, refreshKey, onOpenLead, onAddLead }) {
  const { role, settings, staff } = ctx;
  const [leads, setLeads] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState('all');
  const [industry, setIndustry] = useState('all');
  const [stage, setStage] = useState('all');
  const [review, setReview] = useState('all');

  const range = useMemo(() => rangeFor(period, settings, from, to), [period, settings, from, to]);
  const waitingForRange = period === 'custom' && !range;
  const loadKey = `${range?.key}|${role.viewAll}|${refreshKey}`;
  const [loadedKey, setLoadedKey] = useState(null);
  const loading = !waitingForRange && loadedKey !== loadKey;

  useEffect(() => {
    if (waitingForRange) return undefined;
    let live = true;
    loadLeads({ owner: role.viewAll ? null : ctx.myEmail, range })
      .then(list => { if (live) { setLeads(list); setNow(Date.now()); setError(''); } })
      .catch(err => { if (live) setError(errorText(err)); })
      .finally(() => { if (live) setLoadedKey(loadKey); });
    return () => { live = false; };
  }, [range, role.viewAll, ctx.myEmail, loadKey, waitingForRange]);

  const owners = useMemo(() => {
    const map = new Map(staff.sales.map(s => [s.email, s.name]));
    leads.forEach(l => map.set(l.ownerEmail, l.ownerName || l.ownerEmail));
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads, staff.sales]);

  const visible = leads.filter(l => {
    const text = `${l.businessName} ${l.contactName} ${l.contactNumber} ${l.email} ${l.location} ${l.facebookUrl} ${l.websiteUrl}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase()))
      && (owner === 'all' || l.ownerEmail === owner)
      && (industry === 'all' || l.industry === industry)
      && (stage === 'all' || l.stage === stage)
      && (review === 'all' || (review === 'duplicates' ? l.duplicateStatus === 'pending_review' : review === 'excluded' ? !eligibleLead(l) : review === 'overdue' ? toMillis(l.nextFollowUpAt) != null && toMillis(l.nextFollowUpAt) < now && !['converted', 'lost'].includes(l.stage) : true));
  });

  const exportCsv = () => downloadCsv(`odc-sales-leads-${localDateKey(new Date(), settings.timezone)}.csv`,
    ['Business name', 'Industry', 'Location', 'Contact person', 'Contact number', 'Email', 'Facebook', 'Website', 'Source', 'Stage', 'Lost reason', 'Assigned to', 'KPI credit', 'Date added', 'Next follow-up', 'Duplicate review', 'Qualified', 'Notes'],
    visible.map(l => [l.businessName, l.industry, l.location, l.contactName, l.contactNumber, l.email, l.facebookUrl, l.websiteUrl, l.source,
      SALES_STAGES.find(s => s.id === l.stage)?.label, l.lostReason, l.ownerName, l.attributedName, formatDay(l.createdAt, settings.timezone),
      l.nextFollowUpAt ? formatDay(l.nextFollowUpAt, settings.timezone) : '', l.duplicateStatus, l.qualified === false ? 'No' : 'Yes', l.notes]));

  return (
    <div>
      <div className="task-toolbar">
        <label className="task-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search business, contact, phone, link…" aria-label="Search leads" />
        </label>
        <label className="task-filter"><span>Date added</span>
          <select value={period} onChange={e => setPeriod(e.target.value)}>{PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </label>
        {period === 'custom' && (
          <>
            <label className="task-filter"><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label className="task-filter"><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          </>
        )}
        {role.viewAll && (
          <label className="task-filter"><span>Associate</span>
            <select value={owner} onChange={e => setOwner(e.target.value)}>
              <option value="all">Everyone</option>
              {owners.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
            </select>
          </label>
        )}
        <label className="task-filter"><span>Industry</span>
          <select value={industry} onChange={e => setIndustry(e.target.value)}>
            <option value="all">All</option>
            {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="task-filter"><span>Status</span>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            <option value="all">All</option>
            {SALES_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="task-filter"><span>Review</span>
          <select value={review} onChange={e => setReview(e.target.value)}>
            <option value="all">All</option>
            <option value="overdue">Overdue follow-up</option>
            <option value="duplicates">Possible duplicates</option>
            <option value="excluded">Excluded from KPIs</option>
          </select>
        </label>
      </div>
      <div className="sales-table-actions">
        <span className="task-muted" role="status">{loading ? 'Loading leads…' : `${visible.length} of ${leads.length} leads${range ? ` · ${range.label}` : ''}`}</span>
        <span className="task-inline">
          <button type="button" onClick={exportCsv} disabled={!visible.length}><Download size={14} /> Export CSV</button>
          {role.canAddLeads && <button type="button" className="task-primary" onClick={onAddLead}><Plus size={14} /> Add lead</button>}
        </span>
      </div>
      {error && <p className="task-error" role="alert">{error}</p>}
      {loading ? <div className="task-skeleton" role="status" aria-label="Loading leads" /> : waitingForRange ? (
        <Empty icon={Search} title="Choose a date range">Pick both dates to load leads added in that period.</Empty>
      ) : visible.length === 0 ? (
        <Empty icon={Users} title={leads.length ? 'No leads match these filters' : 'No leads in this period'}>
          {leads.length ? 'Clear a filter or widen the date range.' : role.canAddLeads ? 'Use “Add lead” to record a qualified prospect.' : 'Leads added by the sales team will appear here.'}
        </Empty>
      ) : (
        <div className="sales-table-wrap">
          <table className="sales-table">
            <thead>
              <tr><th scope="col">Business</th><th scope="col">Industry</th><th scope="col">Status</th>{role.viewAll && <th scope="col">Assigned to</th>}<th scope="col">Next follow-up</th><th scope="col">Added</th></tr>
            </thead>
            <tbody>
              {visible.map(l => {
                const due = toMillis(l.nextFollowUpAt);
                const overdue = due != null && due < now && !['converted', 'lost'].includes(l.stage);
                return (
                  <tr key={l.id}>
                    <th scope="row">
                      <button type="button" className="sales-link" onClick={() => onOpenLead(l.id)}>{l.businessName}</button>
                      {l.duplicateStatus === 'pending_review' && <span className="task-pill sales-flag">Duplicate?</span>}
                      {!eligibleLead(l) && <span className="task-pill sales-flag">Excluded</span>}
                      <small>{l.contactName || l.contactNumber || l.email || l.location}</small>
                    </th>
                    <td>{l.industry}</td>
                    <td><StagePill stage={l.stage} /></td>
                    {role.viewAll && <td>{l.ownerName}</td>}
                    <td className={overdue ? 'sales-overdue' : ''}>{due ? formatDay(due, settings.timezone) : '—'}</td>
                    <td>{formatDay(l.createdAt, settings.timezone)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
