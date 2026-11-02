import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarPlus, CheckCheck, Target, AlertTriangle, Clock } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';
import { Progress, Metric, Empty } from './SalesUi';
import { periodRange, computeKpis, targetsFor, deriveReminders, localDateKey, formatPeso, zonedTime, targetsSince } from '../../../functions/src/salesDomain.js';
import { loadPeriodData, loadLeads, loadSalesTasks, subscribeDeals, subscribeNotifications, markNotificationRead, generateWeeklySchedule, loadWeeklyReports } from '../../services/salesService';
import { errorText, formatWhen, pct, toMillis } from '../../utils/salesFormat';

/** Loads KPI inputs for a range; associates only receive their own attributed records. */
function usePeriodData(range, owner, refreshKey) {
  const key = `${range.key}|${owner}|${refreshKey}`;
  const [state, setState] = useState({ key: null, data: null, error: '' });
  useEffect(() => {
    let live = true;
    loadPeriodData(range, owner)
      .then(data => live && setState({ key, data, error: '' }))
      .catch(err => live && setState({ key, data: null, error: errorText(err) }));
    return () => { live = false; };
  }, [range, owner, key]);
  return { ...state, loading: state.key !== key };
}

function KpiGrid({ k, period }) {
  return (
    <div className="task-stats sales-stats">
      <Metric label={`Leads generated (${period})`} value={k.leadsGenerated} hint={`${pct(k.leadAchievement)} of ${k.leadTarget} target${k.excludedLeads ? ` · ${k.excludedLeads} excluded` : ''}`} />
      <Metric label="Leads contacted" value={k.contacted} hint={`Cohort contact rate ${pct(k.contactRate)}`} />
      <Metric label="Responses received" value={k.responses} hint={`Cohort response rate ${pct(k.responseRate)}`} />
      <Metric label="Interested prospects" value={k.interested} />
      <Metric label="Consultations / demos" value={k.consultations} />
      <Metric label="Quotations sent" value={k.quotations} />
      <Metric label="Converted clients" value={k.convertedInPeriod} tone="done" hint={`${k.convertedFromThisCohort} from this ${period}'s leads · ${k.convertedFromPreviousCohorts} from earlier leads`} />
      <Metric label="Cohort conversion rate" value={pct(k.cohortConversionRate)} tone={k.meetsConversionMinimum === false ? 'overdue' : k.meetsConversionMinimum ? 'done' : undefined} hint={`${k.cohortConverted} of ${k.leadsGenerated} leads · minimum ${k.minConversionPercent}%`} />
    </div>
  );
}

function AssociateCard({ name, week, month }) {
  return (
    <article className="sales-associate">
      <header><h3>{name}</h3>{month && <span className="task-muted">This month: {month.leadsGenerated}/{month.leadTarget} leads · {month.convertedInPeriod} converted</span>}</header>
      {week && (
        <>
          <Progress label="Weekly leads generated" value={week.leadsGenerated} target={week.leadTarget} />
          <Progress label="Weekly converted clients" value={week.convertedInPeriod} target={week.conversionTarget} />
          <dl className="sales-mini">
            <div><dt>Contacted</dt><dd>{week.contacted}</dd></div>
            <div><dt>Interested</dt><dd>{week.interested}</dd></div>
            <div><dt>Consultations</dt><dd>{week.consultations}</dd></div>
            <div><dt>Quotations</dt><dd>{week.quotations}</dd></div>
            <div><dt>Conversion rate</dt><dd className={week.meetsConversionMinimum === false ? 'sales-overdue' : ''}>{pct(week.cohortConversionRate)}</dd></div>
          </dl>
        </>
      )}
      {month && (
        <div className="sales-card-month">
          <Progress label="Monthly leads" value={month.leadsGenerated} target={month.leadTarget} />
          <p className="task-muted">Monthly conversion rate {pct(month.cohortConversionRate)} · {formatPeso(month.convertedValueCentavos)} closed this month</p>
        </div>
      )}
    </article>
  );
}

function Reminders({ ctx, refreshKey, onOpenLead, weekKey }) {
  const { settings, role } = ctx;
  const [items, setItems] = useState({ leads: [], tasks: [], deals: [], reported: true, team: null });
  const [notes, setNotes] = useState([]);
  const [now] = useState(() => Date.now());
  useEffect(() => subscribeNotifications(ctx.myEmail, setNotes, () => setNotes([])), [ctx.myEmail]);
  useEffect(() => subscribeDeals({ owner: ctx.myEmail }, deals => setItems(s => ({ ...s, deals })), () => {}), [ctx.myEmail]);
  useEffect(() => {
    let live = true;
    Promise.all([
      loadLeads({ owner: ctx.myEmail, max: 500 }),
      loadSalesTasks(ctx.myEmail),
      role.isAssociate ? loadWeeklyReports(weekKey, ctx.myEmail) : Promise.resolve([{}]),
      role.isManager ? Promise.all([loadLeads({ max: 1500 }), loadSalesTasks()]) : Promise.resolve(null),
    ]).then(([leads, tasks, reports, team]) => live && setItems(s => ({ ...s, leads, tasks, reported: reports.length > 0, team })))
      .catch(err => console.error('Could not load sales reminders:', err));
    return () => { live = false; };
  }, [ctx.myEmail, role.isAssociate, role.isManager, weekKey, refreshKey]);

  const reminders = deriveReminders({ ...items, email: ctx.myEmail, now, settings, reportSubmitted: items.reported, isAssociate: role.isAssociate });
  const unread = notes.filter(n => !n.read);
  const teamOverdue = items.team ? {
    followUps: items.team[0].filter(l => !['converted', 'lost'].includes(l.stage) && toMillis(l.nextFollowUpAt) != null && toMillis(l.nextFollowUpAt) < now).length,
    tasks: items.team[1].filter(t => t.status !== 'done' && toMillis(t.dueAt) < now).length,
    duplicates: items.team[0].filter(l => l.duplicateStatus === 'pending_review').length,
  } : null;

  return (
    <section className="sales-panel" aria-labelledby="sales-reminders">
      <h3 id="sales-reminders"><Bell size={15} aria-hidden="true" /> Reminders & notifications {unread.length > 0 && <span className="task-count">{unread.length} new</span>}</h3>
      {teamOverdue && (
        <p className="task-muted">Team: <strong>{teamOverdue.followUps}</strong> overdue follow-ups · <strong>{teamOverdue.tasks}</strong> overdue sales tasks · <strong>{teamOverdue.duplicates}</strong> possible duplicates to review</p>
      )}
      {reminders.length === 0 && unread.length === 0 ? <p className="task-muted">Nothing needs your attention right now.</p> : (
        <ul className="sales-reminders">
          {reminders.map(r => (
            <li key={r.id} className={`sales-reminder-${r.tone}`}>
              {r.tone === 'overdue' ? <AlertTriangle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
              {r.leadId ? <button type="button" className="sales-link" onClick={() => onOpenLead(r.leadId)}>{r.title}</button> : <span>{r.title}</span>}
            </li>
          ))}
          {unread.map(n => (
            <li key={n.id} className="sales-reminder-note">
              <Bell size={14} aria-hidden="true" />
              <span>
                {n.leadId ? <button type="button" className="sales-link" onClick={() => { onOpenLead(n.leadId); markNotificationRead(n.id).catch(() => {}); }}>{n.title}</button> : n.title}
                {n.body && <small>{n.body}</small>}
                <small>{formatWhen(n.createdAt, settings.timezone)}</small>
              </span>
              <button type="button" aria-label={`Mark “${n.title}” as read`} onClick={() => markNotificationRead(n.id).catch(() => {})}><CheckCheck size={13} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SalesDashboard({ ctx, refreshKey, onOpenLead, onOpenReports }) {
  const { role, settings, targets, staff, user } = ctx;
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(() => localDateKey(new Date(), settings.timezone));
  const [schedule, setSchedule] = useState({ busy: false, message: '' });
  const anchorDate = useMemo(() => zonedTime(anchor, settings.timezone, 12), [anchor, settings.timezone]);
  const week = useMemo(() => periodRange('week', anchorDate, settings), [anchorDate, settings]);
  const month = useMemo(() => periodRange('month', anchorDate, settings), [anchorDate, settings]);
  const owner = role.viewAll ? null : ctx.myEmail;
  const weekData = usePeriodData(week, owner, refreshKey);
  const monthData = usePeriodData(month, owner, refreshKey);
  const associateCount = Math.max(1, staff.associates.length);
  const weekTargets = targetsFor(targets, week.startKey);
  const monthTargets = targetsFor(targets, month.startKey);

  const kpi = (state, range, t, email) => state.data && computeKpis({ ...state.data, range, targets: t, owner: email, associateCount });
  const people = useMemo(() => {
    const map = new Map(staff.associates.map(a => [a.email, a.name]));
    for (const lead of weekData.data?.leads || []) if (!map.has(lead.attributedEmail)) map.set(lead.attributedEmail, lead.attributedName || lead.attributedEmail);
    if (!role.viewAll) return [[ctx.myEmail, ctx.myName]];
    return [...map];
  }, [staff.associates, weekData.data, role.viewAll, ctx.myEmail, ctx.myName]);

  const selected = view === 'week' ? weekData : monthData;
  const team = kpi(selected, view === 'week' ? week : month, view === 'week' ? weekTargets : monthTargets, owner);
  const loading = selected.loading && !selected.data;

  const createSchedule = async () => {
    setSchedule({ busy: true, message: '' });
    try {
      const associates = role.isManager ? staff.associates : [{ email: ctx.myEmail, name: ctx.myName }];
      const created = await generateWeeklySchedule(user, week.startKey, associates, settings, weekTargets);
      setSchedule({ busy: false, message: created ? `${created} schedule task${created === 1 ? '' : 's'} added to the task board for ${week.label}.` : `The schedule for ${week.label} is already on the task board.` });
    } catch (err) { setSchedule({ busy: false, message: errorText(err) }); }
  };

  return (
    <div className="sales-dashboard">
      <div className="task-toolbar">
        <div className="task-segmented" role="group" aria-label="Reporting period">
          <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>Weekly</button>
          <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>Monthly</button>
        </div>
        <label className="task-filter"><span>Period containing</span><input type="date" value={anchor} onChange={e => e.target.value && setAnchor(e.target.value)} /></label>
        <p className="task-muted sales-push">{view === 'week' ? week.label : month.label} · {settings.timezone}</p>
      </div>
      {selected.error && <p className="task-error" role="alert">{selected.error}</p>}

      <div className="sales-dashboard-grid">
        <div>
          {loading ? <div className="task-skeleton" role="status" aria-label="Loading performance" /> : team ? (
            <>
              <section className="sales-panel" aria-labelledby="sales-team">
                <h3 id="sales-team"><Target size={15} aria-hidden="true" /> {role.viewAll ? 'Combined sales performance' : 'My performance'}</h3>
                <div className="sales-progress-row">
                  <Progress label={`${view === 'week' ? 'Weekly' : 'Monthly'} lead target`} value={team.leadsGenerated} target={team.leadTarget} />
                  <Progress label={`${view === 'week' ? 'Weekly' : 'Monthly'} converted clients target`} value={team.convertedInPeriod} target={team.conversionTarget} />
                </div>
                <KpiGrid k={team} period={view} />
                <p className="task-muted">Conversion rate counts confirmed conversions from leads generated in this {view}, whenever they convert. Converted clients counts conversions confirmed during this {view}. Using {targetsSince(view === 'week' ? weekTargets : monthTargets)}.</p>
              </section>
              <h3 className="sales-subhead">{role.viewAll ? 'Sales associates' : 'Weekly and monthly progress'}</h3>
              {people.length === 0 ? (
                <Empty icon={Target} title="No sales associates yet">Grant the “Sales Associate” action in Staff Management to track individual targets.</Empty>
              ) : (
                <div className="sales-associates">
                  {people.map(([email, name]) => (
                    <AssociateCard key={email} name={name}
                      week={kpi(weekData, week, weekTargets, email)}
                      month={kpi(monthData, month, monthTargets, email)} />
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
        <aside>
          <Reminders ctx={ctx} refreshKey={refreshKey} onOpenLead={onOpenLead} weekKey={week.startKey} />
          {(role.isAssociate || role.isManager) && (
            <section className="sales-panel" aria-labelledby="sales-schedule">
              <h3 id="sales-schedule"><CalendarPlus size={15} aria-hidden="true" /> Weekly work schedule</h3>
              <p className="task-muted">Mon lead generation · Tue–Wed outreach · Thu follow-ups & consultations · Fri quotations & closing · Sat follow-ups & reporting · Sun rest.</p>
              <LoadingButton type="button" loading={schedule.busy} loadingLabel="Creating…" onClick={createSchedule}>
                Post {week.label.toLowerCase()} schedule to the task board{role.isManager ? ' (all associates)' : ''}
              </LoadingButton>
              {schedule.message && <p className="task-muted" role="status">{schedule.message}</p>}
              {role.isAssociate && <button type="button" className="sales-link" onClick={onOpenReports}>Submit this week's report</button>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
