import { useState } from 'react';
import LoadingButton from '../ui/LoadingButton';
import { OPEN_STAGES, TASK_ACTIVITIES, stageLabel, targetsFor, targetsSince, localDateKey, periodRange, addDays, formatDateKey } from '../../../functions/src/salesDomain.js';
import { saveTargets, saveSalesSettings } from '../../services/salesService';
import { errorText } from '../../utils/salesFormat';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ACTIVITY_NAMES = { contact: 'Contact', follow_up: 'Follow-up', consultation: 'Consultation', quotation: 'Quotation', quotation_follow_up: 'Quotation follow-up', negotiation_follow_up: 'Negotiation follow-up', demo_endorsement: 'Demo endorsement', weekly_schedule: 'Weekly schedule' };

function useSave(work, done) {
  const [state, setState] = useState({ busy: false, error: '', message: '' });
  const run = async (...args) => {
    setState({ busy: true, error: '', message: '' });
    try { await work(...args); setState({ busy: false, error: '', message: 'Saved.' }); done?.(); } catch (err) { setState({ busy: false, error: errorText(err), message: '' }); }
  };
  return [state, run];
}

export default function SalesTargets({ ctx, onSaved }) {
  const { settings, targets, user } = ctx;
  const today = localDateKey(new Date(), settings.timezone);
  const current = targetsFor(targets, today);
  const nextWeek = addDays(periodRange('week', new Date(), settings).startKey, 7);
  const [form, setForm] = useState({ ...current, effectiveFrom: nextWeek });
  const [config, setConfig] = useState({
    timezone: settings.timezone, weekStartsOn: settings.weekStartsOn, quotationFollowUpDays: settings.quotationFollowUpDays,
    categories: settings.categories.join('\n'), automation: Object.fromEntries(OPEN_STAGES.map(s => [s, { ...settings.automation[s] }])),
  });
  const [targetState, submitTargets] = useSave(() => saveTargets(user, form), onSaved);
  const [configState, submitConfig] = useSave(() => saveSalesSettings(user, { ...config, categories: config.categories.split('\n') }), onSaved);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setRule = (stage, k, v) => setConfig(c => ({ ...c, automation: { ...c.automation, [stage]: { ...c.automation[stage], [k]: v } } }));
  const history = [...targets].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const number = (key, label, step = 1) => (
    <label className="task-field"><span>{label}</span><input type="number" min={0} step={step} required value={form[key]} onChange={e => set(key, e.target.value === '' ? '' : Number(e.target.value))} /></label>
  );

  return (
    <div className="sales-settings">
      <section className="sales-panel" aria-labelledby="targets-heading">
        <h3 id="targets-heading">Official sales targets</h3>
        <p className="task-muted">In force today ({targetsSince(current)}): {current.weeklyLeadsPerAssociate} leads per associate per week, {current.monthlyLeadsPerAssociate} per month, minimum {current.minConversionPercent}% conversion; combined {current.weeklyConversionTarget} conversions per week and {current.monthlyConversionTarget} per month.</p>
        <form onSubmit={e => { e.preventDefault(); submitTargets(); }}>
          {targetState.error && <p className="task-error" role="alert">{targetState.error}</p>}
          <div className="task-form-grid sales-grid-3">
            {number('weeklyLeadsPerAssociate', 'Weekly leads per associate')}
            {number('monthlyLeadsPerAssociate', 'Monthly leads per associate')}
            {number('minConversionPercent', 'Minimum conversion %', 0.1)}
            {number('weeklyConversionTarget', 'Weekly conversions (combined)')}
            {number('monthlyConversionTarget', 'Monthly conversions (combined)')}
            <label className="task-field"><span>Effective from</span><input type="date" required value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)} /></label>
          </div>
          <p className="task-muted">Past periods keep the targets that applied at the time. Saving on an existing effective date replaces that entry.</p>
          <footer className="task-form-footer">
            {targetState.message && <span className="task-muted" role="status">{targetState.message}</span>}
            <LoadingButton type="submit" className="task-primary" loading={targetState.busy} loadingLabel="Saving…">Save targets</LoadingButton>
          </footer>
        </form>
        {history.length > 0 && (
          <div className="sales-table-wrap">
            <table className="sales-table">
              <thead><tr><th scope="col">Effective from</th><th scope="col">Weekly / associate</th><th scope="col">Monthly / associate</th><th scope="col">Min. conversion</th><th scope="col">Weekly conv.</th><th scope="col">Monthly conv.</th><th scope="col">Set by</th></tr></thead>
              <tbody>{history.map(h => (
                <tr key={h.id}><th scope="row">{formatDateKey(h.effectiveFrom)}</th><td>{h.weeklyLeadsPerAssociate}</td><td>{h.monthlyLeadsPerAssociate}</td><td>{h.minConversionPercent}%</td><td>{h.weeklyConversionTarget}</td><td>{h.monthlyConversionTarget}</td><td>{h.updatedByName}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sales-panel" aria-labelledby="config-heading">
        <h3 id="config-heading">Pipeline & reporting configuration</h3>
        <form onSubmit={e => { e.preventDefault(); submitConfig(); }}>
          {configState.error && <p className="task-error" role="alert">{configState.error}</p>}
          <div className="task-form-grid sales-grid-3">
            <label className="task-field"><span>Organisation timezone</span><input required value={config.timezone} onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))} placeholder="Asia/Manila" /></label>
            <label className="task-field"><span>Reporting week starts on</span>
              <select value={config.weekStartsOn} onChange={e => setConfig(c => ({ ...c, weekStartsOn: Number(e.target.value) }))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
            </label>
            <label className="task-field"><span>Quotation follow-up reminder (days)</span><input type="number" min={1} max={30} required value={config.quotationFollowUpDays} onChange={e => setConfig(c => ({ ...c, quotationFollowUpDays: Number(e.target.value) }))} /></label>
          </div>
          <label className="task-field"><span>Lead categories <small>(one per line)</small></span><textarea rows={8} value={config.categories} onChange={e => setConfig(c => ({ ...c, categories: e.target.value }))} /></label>
          <h4>Task automation by pipeline stage</h4>
          <p className="task-muted">When a lead enters a stage, <strong>Automatic</strong> posts the task to the task board, <strong>Suggest</strong> offers it to the person moving the lead, <strong>Off</strong> does nothing. An open task for the same lead and step is never duplicated. Use {'{business}'} in titles.</p>
          <div className="sales-table-wrap">
            <table className="sales-table sales-automation">
              <thead><tr><th scope="col">Stage</th><th scope="col">Mode</th><th scope="col">Task title</th><th scope="col">Step</th><th scope="col">Due in (days)</th><th scope="col">Priority</th></tr></thead>
              <tbody>{OPEN_STAGES.map(stage => {
                const rule = config.automation[stage];
                return (
                  <tr key={stage}>
                    <th scope="row">{stageLabel(stage)}</th>
                    <td><select aria-label={`${stageLabel(stage)} mode`} value={rule.mode} onChange={e => setRule(stage, 'mode', e.target.value)}><option value="auto">Automatic</option><option value="suggest">Suggest</option><option value="off">Off</option></select></td>
                    <td><input aria-label={`${stageLabel(stage)} task title`} maxLength={120} value={rule.title} onChange={e => setRule(stage, 'title', e.target.value)} /></td>
                    <td><select aria-label={`${stageLabel(stage)} step`} value={rule.activity} onChange={e => setRule(stage, 'activity', e.target.value)}>{TASK_ACTIVITIES.filter(a => !['demo_endorsement', 'weekly_schedule'].includes(a)).map(a => <option key={a} value={a}>{ACTIVITY_NAMES[a]}</option>)}</select></td>
                    <td><input aria-label={`${stageLabel(stage)} due days`} type="number" min={0} max={30} value={rule.dueInDays} onChange={e => setRule(stage, 'dueInDays', Number(e.target.value))} /></td>
                    <td><select aria-label={`${stageLabel(stage)} priority`} value={rule.priority} onChange={e => setRule(stage, 'priority', e.target.value)}>{['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <footer className="task-form-footer">
            {configState.message && <span className="task-muted" role="status">{configState.message}</span>}
            <LoadingButton type="submit" className="task-primary" loading={configState.busy} loadingLabel="Saving…">Save configuration</LoadingButton>
          </footer>
        </form>
      </section>
    </div>
  );
}
