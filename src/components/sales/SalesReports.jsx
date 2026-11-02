import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Send } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';
import { Empty } from './SalesUi';
import { periodRange, customRange, computeKpis, followUpSummary, targetsFor, targetsSince, localDateKey, formatPeso, zonedTime } from '../../../functions/src/salesDomain.js';
import { loadPeriodData, loadFollowUps, loadSalesTasks, submitWeeklyReport, loadWeeklyReports } from '../../services/salesService';
import { errorText, pct, downloadCsv, formatWhen } from '../../utils/salesFormat';

const ROWS = [
  ['leadsGenerated', 'Leads generated (qualified)'],
  ['leadTarget', 'Lead target'],
  ['leadAchievement', 'Lead generation achievement', pct],
  ['contacted', 'Leads contacted'],
  ['responses', 'Responses received'],
  ['interested', 'Interested prospects'],
  ['consultations', 'Consultations / demos completed'],
  ['quotations', 'Quotations sent'],
  ['convertedInPeriod', 'Converted clients (confirmed in period)'],
  ['convertedFromThisCohort', '  …from leads generated in period'],
  ['convertedFromPreviousCohorts', '  …from earlier lead cohorts'],
  ['cohortConverted', 'Converted from this period\'s lead cohort (to date)'],
  ['cohortConversionRate', 'Cohort conversion rate', pct],
  ['conversionTarget', 'Conversion target'],
  ['convertedValueCentavos', 'Value closed in period', formatPeso],
  ['lost', 'Lost leads'],
  ['contactRate', 'Cohort contact rate', pct],
  ['responseRate', 'Cohort response rate', pct],
  ['pendingFollowUps', 'Pending follow-ups (due now)'],
  ['overdueTasks', 'Overdue sales tasks'],
];

/** Narrows period data to one industry and/or conversion status before KPI calculation. */
function applyFilters(data, industry, conversion) {
  if (!data) return data;
  const byIndustry = r => industry === 'all' || r.industry === industry;
  const byConversion = l => conversion === 'all' || (conversion === 'converted' ? l.stage === 'converted' : conversion === 'pending' ? l.conversionStatus === 'pending' : l.stage !== 'converted');
  const leads = data.leads.filter(l => byIndustry(l) && byConversion(l));
  const keep = new Set(leads.map(l => l.id));
  const dealOk = d => byIndustry(d) && (conversion === 'all' || conversion === 'converted' || (conversion === 'pending' ? d.status === 'pending' : d.status !== 'confirmed'));
  return {
    leads,
    activities: data.activities.filter(a => byIndustry(a) && (conversion === 'all' || keep.has(a.leadId) || conversion === 'converted')),
    periodDeals: data.periodDeals.filter(dealOk),
    cohortDeals: data.cohortDeals.filter(dealOk),
  };
}

export default function SalesReports({ ctx, refreshKey }) {
  const { role, settings, targets, staff, user } = ctx;
  const [type, setType] = useState('week');
  const [anchor, setAnchor] = useState(() => localDateKey(new Date(), settings.timezone));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [employee, setEmployee] = useState('all');
  const [industry, setIndustry] = useState('all');
  const [conversion, setConversion] = useState('all');
  const [loaded, setState] = useState({ key: null, data: null, followUps: [], tasks: [], reports: [], error: '', loadedAt: 0 });
  const [reportNotes, setReportNotes] = useState('');
  const [submit, setSubmit] = useState({ busy: false, message: '' });

  const range = useMemo(() => {
    if (type === 'custom') return from && to && from <= to ? customRange(from, to, settings) : null;
    return periodRange(type, zonedTime(anchor, settings.timezone, 12), settings);
  }, [type, anchor, from, to, settings]);
  const owner = role.viewAll ? null : ctx.myEmail;
  const loadKey = `${range?.key}|${owner}|${refreshKey}`;
  const state = { ...loaded, loading: loaded.key !== loadKey };

  useEffect(() => {
    if (!range) return undefined;
    let live = true;
    Promise.all([loadPeriodData(range, owner), loadFollowUps(owner), loadSalesTasks(owner), range.type === 'week' ? loadWeeklyReports(range.startKey, owner) : Promise.resolve([])])
      .then(([data, followUps, tasks, reports]) => live && setState({ key: loadKey, data, followUps, tasks, reports, error: '', loadedAt: Date.now() }))
      .catch(err => live && setState(s => ({ ...s, key: loadKey, error: errorText(err) })));
    return () => { live = false; };
  }, [range, owner, loadKey]);

  const associateCount = Math.max(1, staff.associates.length);
  const t = range ? targetsFor(targets, range.startKey) : null;
  const data = applyFilters(state.data, industry, conversion);
  const people = role.viewAll
    ? [...new Map([...staff.associates.map(a => [a.email, a.name]), ...(state.data?.leads || []).map(l => [l.attributedEmail, l.attributedName || l.attributedEmail])])]
    : [[ctx.myEmail, ctx.myName]];
  const columns = [
    ...people.filter(([email]) => employee === 'all' || employee === email).map(([email, name]) => ({ email, name })),
    ...(role.viewAll && employee === 'all' ? [{ email: null, name: 'Combined' }] : []),
  ];
  const now = state.loadedAt;
  const reportFor = email => data && range && {
    ...computeKpis({ ...data, range, targets: t, owner: email, associateCount }),
    ...followUpSummary({ leads: state.followUps.filter(l => industry === 'all' || l.industry === industry), tasks: state.tasks, owner: email, now }),
  };
  const reports = data && range ? columns.map(c => ({ ...c, k: reportFor(c.email) })) : [];

  const exportCsv = () => downloadCsv(`odc-sales-report-${range.key}.csv`, ['Metric', ...reports.map(r => r.name)],
    ROWS.map(([key, label, fmt]) => [label.trim(), ...reports.map(r => (fmt ? fmt(r.k[key]) : r.k[key]))]));

  const mine = reports.find(r => r.email === ctx.myEmail)?.k || (!role.viewAll ? reports[0]?.k : null);
  const submitted = state.reports.find(r => r.email === ctx.myEmail);
  const sendReport = async () => {
    setSubmit({ busy: true, message: '' });
    try {
      const snapshot = Object.fromEntries(ROWS.map(([key]) => [key, mine[key] ?? null]));
      await submitWeeklyReport(user, range.startKey, snapshot, reportNotes);
      setSubmit({ busy: false, message: 'Weekly report submitted to management.' });
      setState(s => ({ ...s, reports: [...s.reports.filter(r => r.email !== ctx.myEmail), { email: ctx.myEmail, name: ctx.myName, notes: reportNotes, submittedAt: new Date() }] }));
    } catch (err) { setSubmit({ busy: false, message: errorText(err) }); }
  };

  return (
    <div>
      <div className="task-toolbar">
        <label className="task-filter"><span>Report</span>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="week">Weekly</option><option value="month">Monthly</option><option value="custom">Custom range</option>
          </select>
        </label>
        {type === 'custom' ? (
          <>
            <label className="task-filter"><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label className="task-filter"><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
          </>
        ) : (
          <label className="task-filter"><span>{type === 'week' ? 'Week containing' : 'Month containing'}</span><input type="date" value={anchor} onChange={e => e.target.value && setAnchor(e.target.value)} /></label>
        )}
        {role.viewAll && (
          <label className="task-filter"><span>Employee</span>
            <select value={employee} onChange={e => setEmployee(e.target.value)}>
              <option value="all">All associates + combined</option>
              {people.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
            </select>
          </label>
        )}
        <label className="task-filter"><span>Lead industry</span>
          <select value={industry} onChange={e => setIndustry(e.target.value)}>
            <option value="all">All</option>
            {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="task-filter"><span>Conversion status</span>
          <select value={conversion} onChange={e => setConversion(e.target.value)}>
            <option value="all">All</option><option value="converted">Converted</option><option value="pending">Awaiting confirmation</option><option value="not_converted">Not converted</option>
          </select>
        </label>
        <button type="button" className="sales-push" onClick={exportCsv} disabled={!range || state.loading || !reports.length}><Download size={14} /> Export CSV</button>
      </div>
      {state.error && <p className="task-error" role="alert">{state.error}</p>}
      {!range ? <Empty icon={FileText} title="Choose a date range">Pick both dates to build the report.</Empty> : state.loading ? <div className="task-skeleton" role="status" aria-label="Loading report" /> : !reports.length ? null : (
        <>
          <p className="task-muted">{range.label} · {targetsSince(t)}. Lead metrics use the lead's creation date; converted clients use the confirmation date. Pending follow-ups and overdue tasks are as of now.</p>
          <div className="sales-table-wrap">
            <table className="sales-table sales-report">
              <thead><tr><th scope="col">Metric</th>{reports.map(r => <th scope="col" key={r.email || 'all'}>{r.name}</th>)}</tr></thead>
              <tbody>
                {ROWS.map(([key, label, fmt]) => (
                  <tr key={key} className={label.startsWith('  ') ? 'sales-report-sub' : ''}>
                    <th scope="row">{label.trim()}</th>
                    {reports.map(r => <td key={r.email || 'all'}>{fmt ? fmt(r.k[key]) : r.k[key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {range.type === 'week' && role.isAssociate && mine && (
            <section className="sales-panel" aria-labelledby="sales-submit">
              <h3 id="sales-submit"><Send size={15} aria-hidden="true" /> Weekly sales performance report</h3>
              {submitted && <p className="task-muted">Submitted {formatWhen(submitted.submittedAt, settings.timezone)}. You can resubmit to update your notes.</p>}
              <label className="task-field"><span>Highlights, blockers and plan for next week</span><textarea maxLength={3000} value={reportNotes} onChange={e => setReportNotes(e.target.value)} /></label>
              <LoadingButton type="button" className="task-primary" loading={submit.busy} loadingLabel="Submitting…" onClick={sendReport}>Submit report for {range.label.toLowerCase()}</LoadingButton>
              {submit.message && <p className="task-muted" role="status">{submit.message}</p>}
              <p className="task-muted">Your figures above are attached as a snapshot. Official KPIs are always recalculated from the records.</p>
            </section>
          )}
          {range.type === 'week' && role.viewAll && (
            <section className="sales-panel" aria-labelledby="sales-submitted">
              <h3 id="sales-submitted"><FileText size={15} aria-hidden="true" /> Submitted weekly reports</h3>
              {state.reports.length === 0 ? <p className="task-muted">No associate has submitted a report for this week yet.</p> : (
                <ul className="sales-reports-list">
                  {state.reports.map(r => <li key={r.email}><strong>{r.name}</strong> <small>{formatWhen(r.submittedAt, settings.timezone)}</small>{r.notes && <p>{r.notes}</p>}</li>)}
                </ul>
              )}
              {staff.associates.filter(a => !state.reports.some(r => r.email === a.email)).length > 0 && (
                <p className="task-muted">Not submitted: {staff.associates.filter(a => !state.reports.some(r => r.email === a.email)).map(a => a.name).join(', ')}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
