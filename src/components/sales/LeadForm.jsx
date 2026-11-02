import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';
import { LEAD_SOURCES, DUPLICATE_KEY_LABELS, localDateKey, validateLead } from '../../../functions/src/salesDomain.js';
import { findDuplicates, createLead, updateLead, applyAutomation, suggestedTask, ensureLeadTask } from '../../services/salesService';
import { errorText, toMillis } from '../../utils/salesFormat';

function initialForm(lead, settings) {
  const followUp = toMillis(lead?.nextFollowUpAt);
  return {
    businessName: lead?.businessName || '', industry: lead?.industry || '', location: lead?.location || '', contactName: lead?.contactName || '',
    contactNumber: lead?.contactNumber || '', facebookUrl: lead?.facebookUrl || '', websiteUrl: lead?.websiteUrl || '', email: lead?.email || '',
    source: lead?.source || '', notes: lead?.notes || '',
    nextFollowUpAt: followUp ? localDateKey(followUp, settings.timezone) : '',
    qualified: Boolean(lead),
  };
}

/** Create or edit a lead. New leads are checked against existing identifiers before saving. */
export default function LeadForm({ ctx, lead, onSaved, onCancel }) {
  const { settings, staff, role, user } = ctx;
  const [form, setForm] = useState(() => initialForm(lead, settings));
  const [ownerEmail, setOwnerEmail] = useState(lead?.ownerEmail || (role.isAssociate || !staff.associates.length ? ctx.myEmail : staff.associates[0].email));
  const rule = settings.automation?.new;
  const [createTask, setCreateTask] = useState(rule?.mode === 'auto');
  const [duplicates, setDuplicates] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => { setForm(current => ({ ...current, [key]: value })); setDuplicates(null); };

  const owners = role.viewAll
    ? [...staff.associates, ...(staff.associates.some(a => a.email === ctx.myEmail) ? [] : [{ email: ctx.myEmail, name: `${ctx.myName} (me)` }])]
    : [{ email: ctx.myEmail, name: ctx.myName }];
  const owner = owners.find(o => o.email === ownerEmail) || owners[0];

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!lead && !form.qualified) return setError('Confirm the business is relevant to ODC services before adding it.');
    setBusy(true);
    try {
      validateLead(form, settings.categories);
      if (lead) {
        await updateLead(user, lead.id, form, settings, { canReviewDuplicates: role.isManager });
        onSaved({ id: lead.id, message: 'Lead updated.' });
        return;
      }
      if (duplicates === null) {
        const found = await findDuplicates(form);
        if (found.length) { setDuplicates(found); return; }
      }
      const created = await createLead(user, form, { owner, settings, staff });
      let message = duplicates?.length ? 'Lead saved and flagged for duplicate review by management.' : 'Lead added.';
      const automation = await applyAutomation(user, created, 'new', settings);
      if (automation.status === 'created') message += ' A contact task was added to the task board.';
      else if (automation.status === 'suggested' && createTask) {
        await ensureLeadTask(user, created, suggestedTask(created, 'new', settings), { email: created.ownerEmail, name: created.ownerName });
        message += ' A contact task was added to the task board.';
      }
      onSaved({ id: created.id, message });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, { optional, ...props } = {}) => (
    <label className="task-field">
      <span>{label}{optional && <small> (optional)</small>}</span>
      <input value={form[key]} onChange={e => set(key, e.target.value)} {...props} />
    </label>
  );

  return (
    <form onSubmit={submit} noValidate>
      {error && <p className="task-error" role="alert">{error}</p>}
      {field('businessName', 'Business name', { required: true, maxLength: 200, 'data-autofocus': 'true', placeholder: 'e.g. Smash Pickleball Courts' })}
      <div className="task-form-grid sales-grid-2">
        <label className="task-field">
          <span>Industry / category</span>
          <select required value={form.industry} onChange={e => set('industry', e.target.value)}>
            <option value="">Choose…</option>
            {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="task-field">
          <span>Lead source</span>
          <select required value={form.source} onChange={e => set('source', e.target.value)}>
            <option value="">Choose…</option>
            {[...new Set([...LEAD_SOURCES, form.source].filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {field('location', 'Business location', { optional: true, maxLength: 200, placeholder: 'City / area' })}
      <fieldset className="task-field">
        <legend>Contact channels <small>(at least one)</small></legend>
        <div className="task-form-grid sales-grid-2">
          {field('contactName', "Contact person's name", { optional: true, maxLength: 120 })}
          {field('contactNumber', 'Contact number', { optional: true, maxLength: 40, inputMode: 'tel', placeholder: '09XX XXX XXXX' })}
          {field('email', 'Email address', { optional: true, type: 'email', maxLength: 200 })}
          {field('facebookUrl', 'Facebook page URL', { optional: true, maxLength: 500, placeholder: 'facebook.com/…' })}
          {field('websiteUrl', 'Website URL', { optional: true, maxLength: 500, placeholder: 'example.com' })}
          {field('nextFollowUpAt', 'Next follow-up date', { optional: true, type: 'date' })}
        </div>
      </fieldset>
      {!lead && role.viewAll && (
        <label className="task-field">
          <span>Assigned sales associate</span>
          <select value={owner?.email || ''} onChange={e => setOwnerEmail(e.target.value)}>
            {owners.map(o => <option key={o.email} value={o.email}>{o.name}</option>)}
          </select>
          <small className="task-muted">KPI credit stays with this associate even if the lead is reassigned later.</small>
        </label>
      )}
      <label className="task-field">
        <span>Notes <small>(optional)</small></span>
        <textarea maxLength={5000} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Why this business needs ODC, what you found during research…" />
      </label>
      {!lead && (
        <div className="sales-checks">
          <label className="task-assignee-option">
            <input type="checkbox" checked={form.qualified} onChange={e => set('qualified', e.target.checked)} />
            <span>Qualified prospect<small>This business is relevant to ODC's services and the contact details are real.</small></span>
          </label>
          {rule?.mode === 'suggest' && (
            <label className="task-assignee-option">
              <input type="checkbox" checked={createTask} onChange={e => setCreateTask(e.target.checked)} />
              <span>Add a “Contact {form.businessName || 'business'}” task<small>Posted to the task board under Sales for the assigned associate.</small></span>
            </label>
          )}
        </div>
      )}
      {duplicates?.length > 0 && (
        <div className="sales-warning" role="alert">
          <p><AlertTriangle size={15} aria-hidden="true" /> <strong>Possible duplicate.</strong> This business may already be in the system:</p>
          <ul>
            {duplicates.map(d => <li key={d.id}>Same {DUPLICATE_KEY_LABELS[d.type]} as <strong>{d.businessName}</strong>{d.ownerName ? ` (owned by ${d.ownerName})` : ''}</li>)}
          </ul>
          <p className="task-muted">Saving anyway keeps both records and asks management to review. Duplicates confirmed by management do not count toward targets.</p>
        </div>
      )}
      <footer className="task-form-footer">
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <LoadingButton type="submit" className="task-primary" loading={busy} loadingLabel="Saving…">
          {lead ? 'Save changes' : duplicates?.length ? 'Save anyway for review' : 'Add lead'}
        </LoadingButton>
      </footer>
    </form>
  );
}
