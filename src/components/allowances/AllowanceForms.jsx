import { useState, useId, cloneElement } from 'react';
import { Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { DEFAULT_POLICY, toCentavos, estimatedCash, topUp, eligible, manilaDate, allowanceBalanceTerms, allowanceFundingMethod } from '../../../functions/src/domain.js';
import { newAllowanceId, uploadAllowanceEvidence, openAllowanceEvidence, registerAllowanceReference, allowanceCapabilities } from '../../services/allowanceService';
import { peso } from '../../utils/allowanceDocuments';
import LoadingButton from '../ui/LoadingButton';

export function Field({ label, children, hint }) {
  const id = useId();
  return <div className="allowance-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function MoneyInput(props) { return <input type="number" min="0" step="0.01" required {...props} />; }
function Controls({ busy, draft, submitLabel = 'Save' }) {
  return <div className="allowance-controls">{draft && <button type="button" disabled={busy} onClick={draft}>Save draft</button>}<LoadingButton className="allowance-primary" loading={busy} loadingLabel="Saving…" type="submit">{submitLabel}</LoadingButton></div>;
}

export function MeetingForm({ account, meeting, clients, busy, onSave }) {
  const [form, setForm] = useState({ date: manilaDate(), status: 'planned', clientId: '', clientName: '', purpose: '', ...meeting });
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  return <form onSubmit={e => { e.preventDefault(); onSave('saveMeeting', { ...form, accountId: account.id }); }}>
    <div className="allowance-form-grid"><Field label="Meeting date"><input type="date" required value={form.date} onChange={e => set('date', e.target.value)} /></Field><Field label="Status"><select value={form.status} onChange={e => set('status', e.target.value)}><option value="planned">Planned</option><option value="held">Held</option><option value="cancelled">Cancelled</option></select></Field></div>
    <Field label="Existing client (optional)"><select value={form.clientId} onChange={e => { const client = clients.find(x => x.id === e.target.value); setForm(f => ({ ...f, clientId: client?.id || '', clientName: client?.company || client?.name || client?.clientName || '' })); }}><option value="">Prospective client / enter a name</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company || c.name || c.clientName || c.id}</option>)}</select></Field>
    <Field label="Client name"><input required maxLength={200} value={form.clientName} onChange={e => set('clientName', e.target.value)} /></Field>
    <Field label="Demo / meeting purpose"><textarea required maxLength={500} value={form.purpose} onChange={e => set('purpose', e.target.value)} /></Field>
    <Controls busy={busy} submitLabel="Save meeting" />
  </form>;
}

export function LiquidationForm({ account, meeting, slip, evidence, busy, onSave, onCommand }) {
  const terms = allowanceBalanceTerms(account);
  const [lines, setLines] = useState(slip?.lines?.length ? slip.lines.map(x => ({ ...x, amount: (x.amountCentavos / 100).toFixed(2) })) : []);
  const [files, setFiles] = useState(evidence);
  const [declared, setDeclared] = useState(((slip?.declaredCashCentavos ?? estimatedCash(account)) / 100).toFixed(2));
  const [notes, setNotes] = useState(slip?.notes || '');
  const [noExpense, setNoExpense] = useState(slip?.lines?.length === 0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const payload = submit => ({ accountId: account.id, meetingId: meeting.id, declaredCashCentavos: toCentavos(declared), notes, noExpense, submit, lines: lines.map(line => ({ description: line.description || '', category: line.category || 'Other', amountCentavos: toCentavos(line.amount || '0'), attachmentIds: line.attachmentIds || [], fuelPurchaseId: line.fuelPurchaseId || '' })) });
  const save = submit => { try { setError(''); onSave('saveLiquidation', payload(submit)); } catch (err) { setError(err.message); } };
  const upload = async (index, selected) => {
    if (!selected.length) return;
    setUploading(true); setError('');
    try {
      const selectedIds = new Set(lines.flatMap(line => line.attachmentIds || []));
      if (selectedIds.size + selected.length > account.policy.maxAttachments) throw new Error(`Use at most ${account.policy.maxAttachments} attachments per revision.`);
      await onCommand('saveLiquidation', payload(false));
      for (const file of selected) {
        const purchase = lines[index].category === 'Fuel' ? toCentavos(lines[index].purchaseAmount || lines[index].amount || '0') : 0;
        const evidenceFile = await uploadAllowanceEvidence(account.id, meeting.id, file, setProgress, account.policy, purchase);
        setFiles(current => [...current, evidenceFile]);
        setLines(current => current.map((line, i) => i === index ? { ...line, fuelPurchaseId: purchase > 0 ? evidenceFile.id : line.fuelPurchaseId || '', attachmentIds: [...(line.attachmentIds || []), evidenceFile.id] } : line));
      }
    } catch (err) { setError(err.message); }
    finally { setUploading(false); setProgress(0); }
  };
  const updateLine = (index, key, value) => setLines(current => current.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const registerReference = async index => {
    setUploading(true); setError('');
    try {
      const line = lines[index];
      await onCommand('saveLiquidation', payload(false));
      const purchase = line.category === 'Fuel' ? toCentavos(line.purchaseAmount || line.amount || '0') : 0;
      const file = await registerAllowanceReference(account.id, meeting.id, line.referenceInput || '', line.referenceLabel || line.referenceInput || '', line.referenceUri || '', purchase);
      setFiles(current => [...current, file]);
      setLines(current => current.map((value, i) => i === index ? { ...value, attachmentIds: [file.id], fuelPurchaseId: purchase ? file.id : '' } : value));
    } catch (error) { setError(error.message); }
    finally { setUploading(false); }
  };
  const total = lines.reduce((sum, x) => sum + Math.round(Number(x.amount || 0) * 100), 0);
  return <form onSubmit={e => { e.preventDefault(); save(true); }}>
    <p className="allowance-helper">{meeting.clientName} · {meeting.date}. Submit after the meeting. Limit {peso(account.policy.meetingCapCentavos)}, including fuel.</p>
    {slip?.reviewNote && <p className="allowance-notice">Operations: {slip.reviewNote}</p>}
    <fieldset disabled={busy || uploading}>
      {lines.map((line, index) => <div className="allowance-expense-line" key={index}>
        <div className="allowance-line-header"><strong>Expense {index + 1}</strong><button type="button" aria-label={`Remove expense ${index + 1}`} onClick={() => setLines(current => current.filter((_, i) => i !== index))}><Trash size={16} /></button></div>
        <Field label="Description"><input required maxLength={200} value={line.description} onChange={e => updateLine(index, 'description', e.target.value)} /></Field>
        <div className="allowance-form-grid"><Field label="Category"><select value={line.category} onChange={e => updateLine(index, 'category', e.target.value)}>{['Fuel', 'Meals', 'Transport', 'Other'].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Amount (PHP)"><MoneyInput value={line.amount} onChange={e => updateLine(index, 'amount', e.target.value)} /></Field></div>
        {line.category === 'Fuel' && <><Field label="Full fuel receipt amount (PHP)" hint="Enter the total purchase before registering its evidence. The expense amount above is only this meeting's share."><MoneyInput value={line.purchaseAmount || line.amount} onChange={e => updateLine(index, 'purchaseAmount', e.target.value)} /></Field><Field label="Fuel purchase receipt"><select required value={line.fuelPurchaseId || ''} onChange={e => { const id = e.target.value; setLines(current => current.map((item, i) => i === index ? { ...item, fuelPurchaseId: id, attachmentIds: allowanceCapabilities.evidenceUploads ? [...new Set([...(item.attachmentIds || []), id])].filter(Boolean) : [id].filter(Boolean) } : item)); }}><option value="">Register or select a fuel receipt</option>{files.filter(file => file.finalized && file.purchaseCentavos > 0).map(file => <option key={file.id} value={file.id}>{file.name} · Full purchase {peso(file.purchaseCentavos)}</option>)}</select></Field></>}
        {allowanceCapabilities.evidenceUploads ? <Field label="Receipts / vouchers" hint="JPEG, PNG, WebP or PDF. Select an existing receipt to allocate one shared fuel purchase across meetings; enter only this meeting's share.">
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={e => { const selected = [...e.target.files]; e.target.value = ''; upload(index, selected); }} />
        </Field> : <>
          <Field label="Receipt / voucher reference" hint="Use its existing reference number. Keep the original evidence in your team’s records."><input maxLength={64} pattern="[a-zA-Z0-9_-]+" value={line.referenceInput || ''} onChange={e => updateLine(index, 'referenceInput', e.target.value)} /></Field>
          <Field label="Evidence label (optional)"><input maxLength={200} value={line.referenceLabel || ''} onChange={e => updateLine(index, 'referenceLabel', e.target.value)} /></Field>
          <Field label="Evidence link (optional)" hint="Use an HTTPS link with access limited to your reviewers."><input type="url" value={line.referenceUri || ''} onChange={e => updateLine(index, 'referenceUri', e.target.value)} /></Field>
          <button type="button" disabled={!line.referenceInput} onClick={() => registerReference(index)}>Register reference</button>
        </>}
        <div className="allowance-evidence-list">{files.filter(file => file.finalized).map(file => <label key={file.id}><input type="checkbox" checked={line.attachmentIds?.includes(file.id) || false} onChange={e => updateLine(index, 'attachmentIds', e.target.checked ? allowanceCapabilities.evidenceUploads ? [...(line.attachmentIds || []), file.id] : [file.id] : (line.attachmentIds || []).filter(x => x !== file.id))} />{file.name}</label>)}</div>
      </div>)}
      <button type="button" disabled={lines.length >= allowanceCapabilities.maxExpenseLines} onClick={() => { setNoExpense(false); setLines(current => [...current, { description: '', category: 'Other', amount: '', attachmentIds: [] }]); }}><Plus size={16} /> Add expense</button>
      {!allowanceCapabilities.evidenceUploads && <p className="allowance-helper">Use up to three expense lines with one evidence reference per line. Combine related items on the same receipt.</p>}
      {lines.length === 0 && <label className="allowance-check"><input type="checkbox" required checked={noExpense} onChange={e => setNoExpense(e.target.checked)} />This meeting had no expenses.</label>}
      <p className="allowance-total">Total spent <strong>{peso(total)}</strong></p>
      <Field label={`${terms.declared} (PHP)`} hint={allowanceFundingMethod(account) === 'bank' ? 'Enter the remaining balance shown in the dedicated allowance bank account after this meeting.' : 'Count the physical cash after this meeting. A mismatch requires Operations reconciliation.'}><MoneyInput value={declared} onChange={e => setDeclared(e.target.value)} /></Field>
      <Field label="Notes"><textarea maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
    </fieldset>
    {uploading && <div role="status" className="allowance-upload-status"><UploadSimple size={18} /> {allowanceCapabilities.evidenceUploads ? `Uploading evidence: ${progress}%` : 'Registering evidence reference…'}</div>}
    {error && <p className="allowance-error" role="alert">{error}</p>}
    <Controls busy={busy || uploading} draft={() => save(false)} submitLabel="Submit liquidation" />
  </form>;
}

export function RequisitionForm({ account, meetings, request, busy, onSave }) {
  const terms = allowanceBalanceTerms(account);
  const [form, setForm] = useState({ id: request?.id || newAllowanceId(), type: request?.type || 'early', meetingId: request?.meetingId || '', reason: request?.reason || '', amount: ((request?.amountCentavos ?? topUp(account)) / 100).toFixed(2), cash: ((request?.declaredCashCentavos ?? estimatedCash(account)) / 100).toFixed(2) });
  const [error, setError] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const meeting = meetings.find(x => x.id === form.meetingId);
  const why = eligible(account, form.type, meeting, manilaDate());
  const save = submit => { try { setError(''); onSave('saveRequisition', { accountId: account.id, id: form.id, type: form.type, meetingId: form.meetingId, reason: form.reason, amountCentavos: toCentavos(form.amount), declaredCashCentavos: toCentavos(form.cash), submit }); } catch (err) { setError(err.message); } };
  return <form onSubmit={e => { e.preventDefault(); save(true); }}>
    <Field label="Replenishment type"><select value={form.type} onChange={e => set('type', e.target.value)}><option value="early">Early — depleted allowance and upcoming meeting</option><option value="scheduled">Scheduled — replenishment date reached</option></select></Field>
    <Field label="Upcoming client meeting"><select required={form.type === 'early'} value={form.meetingId} onChange={e => { const m = meetings.find(x => x.id === e.target.value); setForm(f => ({ ...f, meetingId: m?.id || '', reason: m ? `Meeting with "${m.clientName}"` : f.reason })); }}><option value="">Select a meeting</option>{meetings.filter(x => x.accountId === account.id && x.status === 'planned').map(m => <option key={m.id} value={m.id}>{m.date} · {m.clientName}</option>)}</select></Field>
    <Field label="Reason on request"><textarea required maxLength={1000} value={form.reason} onChange={e => set('reason', e.target.value)} /></Field>
    <div className="allowance-form-grid"><Field label="Requested amount (PHP)" hint={`Top-up needed: ${peso(topUp(account))}`}><MoneyInput value={form.amount} onChange={e => set('amount', e.target.value)} /></Field><Field label={`${terms.declared} (PHP)`}><MoneyInput value={form.cash} onChange={e => set('cash', e.target.value)} /></Field></div>
    <p className="allowance-helper">Requested by {account.staffName} · {manilaDate()}. Approval does not release funds.</p>
    {why && <p className="allowance-notice">{why} You can save a draft.</p>}
    {error && <p className="allowance-error" role="alert">{error}</p>}
    <Controls busy={busy} draft={() => save(false)} submitLabel="Submit requisition" />
  </form>;
}

export function ReviewForm({ slip, type, evidence, account, busy, onSave }) {
  const terms = allowanceBalanceTerms(account);
  const [decision, setDecision] = useState('approve');
  const [reason, setReason] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  return <form onSubmit={e => { e.preventDefault(); onSave(type === 'liquidation' ? 'reviewLiquidation' : 'reviewRequisition', { accountId: slip.accountId, id: slip.id, decision, reason, verified }); }}>
    <p><strong>{slip.staffName}</strong> · {slip.clientName || slip.reason} · {slip.date}</p>
    {type === 'liquidation' && <div className="allowance-detail-lines">{slip.lines.map((line, i) => <p key={i}>{line.description} <span>{line.category} · {peso(line.amountCentavos)}</span></p>)}</div>}
    <p className="allowance-total">{type === 'liquidation' ? 'Total spent' : 'Requested amount'} <strong>{peso(type === 'liquidation' ? slip.totalCentavos : slip.amountCentavos)}</strong></p>
    <p>{terms.declared}: {peso(slip.declaredCashCentavos)}</p>
    <div className="allowance-evidence-list">{evidence.map(file => file.kind === 'reference' && !file.referenceUri ? <p key={file.id}>{file.name} · Reference: {file.reference}</p> : <button type="button" key={file.id} onClick={() => openAllowanceEvidence(file).catch(err => setError(err.message))}>{file.name} · {file.kind === 'reference' ? `Open evidence (${file.reference})` : 'Download privately'}</button>)}</div>
    <Field label="Decision"><select value={decision} onChange={e => setDecision(e.target.value)}><option value="approve">Approve</option><option value="return">Return for correction</option>{type === 'requisition' && <option value="reject">Reject</option>}</select></Field>
    <Field label="Review comments"><textarea required={decision !== 'approve'} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    {type === 'liquidation' && decision === 'approve' && <label className="allowance-check"><input type="checkbox" required checked={verified} onChange={e => setVerified(e.target.checked)} />I checked the receipt allocations, totals, and reported balance.</label>}
    {error && <p className="allowance-error" role="alert">{error}</p>}
    <Controls busy={busy} submitLabel="Record decision" />
  </form>;
}

export function ReleaseForm({ account, request, busy, onSave }) {
  const method = allowanceFundingMethod(account);
  const settling = request?.status === 'transfer_pending';
  const [form, setForm] = useState({
    amount: ((request?.amountCentavos ?? account.policy.targetCentavos) / 100).toFixed(2),
    paymentDate: request?.paymentDate || manilaDate(),
    referenceNumber: request?.referenceNumber || '',
    transferProofUri: request?.transferProofUri || '',
    nextScheduledDate: request?.nextScheduledDate || '',
    outcome: 'settled',
    failureReason: '',
    confirmed: false,
  });
  const [error, setError] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const submit = () => {
    const common = { accountId: account.id, id: request?.id, amountCentavos: toCentavos(form.amount), nextScheduledDate: form.nextScheduledDate };
    if (settling) {
      onSave(form.outcome === 'failed' ? 'failTransfer' : 'settleTransfer', form.outcome === 'failed' ? { ...common, reason: form.failureReason } : common);
      return;
    }
    const payment = { ...common, paymentMethod: method, paymentDate: form.paymentDate, referenceNumber: form.referenceNumber, transferProofUri: form.transferProofUri };
    if (!request) onSave('initialRelease', { ...payment, transferConfirmed: method === 'cash' || form.confirmed });
    else onSave(method === 'bank' ? 'initiateTransfer' : 'releaseRequisition', payment);
  };
  return <form onSubmit={e => { e.preventDefault(); try { setError(''); submit(); } catch (err) { setError(err.message); } }}>
    {settling ? <>
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-4 text-sm leading-6 text-amber-100">
        <strong className="block text-amber-200">Transfer awaiting settlement</strong>
        Confirm the bank posted the transfer before increasing {account.staffName}&apos;s available allowance.
      </div>
      <div className="allowance-detail-lines"><p>Amount <span>{peso(request.amountCentavos)}</span></p><p>Bank reference <span>{request.referenceNumber}</span></p><p>Initiated <span>{request.paymentDate}</span></p></div>
      {request.transferProofUri && <a className="inline-flex text-sm text-sky-300 underline underline-offset-4" href={request.transferProofUri} target="_blank" rel="noreferrer">Open transfer proof</a>}
      <Field label="Transfer outcome"><select value={form.outcome} onChange={e => set('outcome', e.target.value)}><option value="settled">Settled successfully</option><option value="failed">Failed or returned</option></select></Field>
      {form.outcome === 'failed' && <Field label="Failure reason"><textarea required maxLength={500} value={form.failureReason} onChange={e => set('failureReason', e.target.value)} /></Field>}
    </> : <>
      <p className="allowance-helper">{method === 'bank' ? `Record the transfer to ${account.staffName}. The balance changes only after Finance confirms settlement.` : `Record cash actually handed over to ${account.staffName}.`}</p>
      {method === 'bank' && <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-4 text-sm leading-6 text-sky-100"><strong className="block text-sky-200">{account.bankName} ·•••• {account.bankAccountLast4}</strong><span>{account.bankAccountName}</span></div>}
      <Field label={method === 'bank' ? 'Transfer amount (PHP)' : 'Amount released (PHP)'}><MoneyInput readOnly={Boolean(request)} value={form.amount} onChange={e => set('amount', e.target.value)} /></Field>
      <Field label={method === 'bank' ? 'Transfer date' : 'Payment date'}><input type="date" required max={manilaDate()} value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} /></Field>
      <Field label={method === 'bank' ? 'Bank reference' : 'Cash acknowledgment / voucher number'}><input required maxLength={200} value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} /></Field>
      {method === 'bank' && <Field label="Transfer proof link (optional)" hint="Use an HTTPS link with access limited to Finance."><input type="url" value={form.transferProofUri} onChange={e => set('transferProofUri', e.target.value)} /></Field>}
      {request && <Field label="Next scheduled replenishment date"><input type="date" required value={form.nextScheduledDate} onChange={e => set('nextScheduledDate', e.target.value)} /></Field>}
      {!request && method === 'bank' && <label className="allowance-check"><input type="checkbox" required checked={form.confirmed} onChange={e => set('confirmed', e.target.checked)} />The initial transfer has settled in the recipient account.</label>}
    </>}
    {error && <p className="allowance-error" role="alert">{error}</p>}
    <Controls busy={busy} submitLabel={settling ? form.outcome === 'failed' ? 'Mark transfer failed' : 'Confirm settlement' : method === 'bank' && request ? 'Start bank transfer' : 'Record actual release'} />
  </form>;
}

export function PolicyForm({ policy, enabled, busy, onSave }) {
  const [form, setForm] = useState({ ...DEFAULT_POLICY, ...policy });
  const [activate, setActivate] = useState(enabled);
  const [confirmed, setConfirmed] = useState(false);
  return <form onSubmit={e => { e.preventDefault(); onSave('savePolicy', { policy: form, enabled: activate, confirmed }); }}>
    <p className="allowance-helper">Fuel is included in the meeting cap. Replenishment restores the float. Existing accounts retain their policy version.</p>
    <div className="allowance-form-grid">{[['targetCentavos', 'Allowance float'], ['meetingCapCentavos', 'Per-meeting cap'], ['singleFuelCentavos', 'Standalone meeting fuel'], ['dailyFuelCentavos', 'Multiple-meeting daily fuel']].map(([key, label]) => <Field key={key} label={`${label} (PHP)`}><MoneyInput value={form[key] / 100} onChange={e => setForm(f => ({ ...f, [key]: Math.round(Number(e.target.value) * 100) }))} /></Field>)}
      <Field label="Depletion threshold (%)"><input type="number" min={1} max={100} required value={form.thresholdPercent} onChange={e => setForm(f => ({ ...f, thresholdPercent: Number(e.target.value) }))} /></Field>
      <Field label="Upcoming meeting window (days)"><input type="number" min={0} max={90} required value={form.impendingDays} onChange={e => setForm(f => ({ ...f, impendingDays: Number(e.target.value) }))} /></Field>
      <Field label="Maximum attachments per slip"><input type="number" min={1} max={50} required value={form.maxAttachments} onChange={e => setForm(f => ({ ...f, maxAttachments: Number(e.target.value) }))} /></Field>
      <Field label="Maximum file size (MB)"><input type="number" min={1} max={10} required value={form.maxFileBytes / 1048576} onChange={e => setForm(f => ({ ...f, maxFileBytes: Number(e.target.value) * 1048576 }))} /></Field>
    </div>
    <label className="allowance-check"><input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} />Enable allowance actions for authorized staff.</label>
    <label className="allowance-check"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this policy, including fuel treatment and the upcoming meeting window.</label>
    <Controls busy={busy} submitLabel="Save policy" />
  </form>;
}

export function AccountForm({ staff, grants, account, busy, onSave }) {
  const [staffId, setStaffId] = useState(account?.staffId || '');
  const [date, setDate] = useState(account?.nextScheduledDate || '');
  const [status, setStatus] = useState(account?.status || 'pending_setup');
  const [fundingMethod, setFundingMethod] = useState(allowanceFundingMethod(account));
  const [bankName, setBankName] = useState(account?.bankName || '');
  const [bankAccountName, setBankAccountName] = useState(account?.bankAccountName || '');
  const [bankAccountLast4, setBankAccountLast4] = useState(account?.bankAccountLast4 || '');
  const grant = grants.find(x => x.staffId === staffId && x.active);
  return <form onSubmit={e => { e.preventDefault(); onSave('configureAccount', { staffId, ownerUid: grant?.id || account?.ownerUid, nextScheduledDate: date, status, fundingMethod, bankName, bankAccountName, bankAccountLast4 }); }}>
    <Field label="Eligible staff member"><select required disabled={Boolean(account)} value={staffId} onChange={e => setStaffId(e.target.value)}><option value="">Select a staff member</option>{staff.filter(s => s.id === account?.staffId || grants.some(g => g.staffId === s.id && g.active)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
    <Field label="Funding method"><select value={fundingMethod} onChange={e => setFundingMethod(e.target.value)}><option value="bank">Bank transfer</option><option value="cash">Physical cash</option></select></Field>
    {fundingMethod === 'bank' && <div className="allowance-form-grid"><Field label="Bank / provider"><input required maxLength={100} value={bankName} onChange={e => setBankName(e.target.value)} /></Field><Field label="Account holder name"><input required maxLength={120} value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} /></Field><Field label="Last four account digits" hint="Only store the final four digits."><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={bankAccountLast4} onChange={e => setBankAccountLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field></div>}
    <Field label="Scheduled replenishment date"><input type="date" required value={date} onChange={e => setDate(e.target.value)} /></Field>
    {account?.funded && <Field label="Account state"><select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></select></Field>}
    <p className="allowance-helper">An account starts at zero. Finance records the initial funding separately. Bank details are deliberately limited to a label and the last four digits.</p>
    <Controls busy={busy} submitLabel={account ? 'Update account' : 'Create allowance account'} />
  </form>;
}

export function CorrectionForm({ slip, account, mode, busy, onSave }) {
  const method = allowanceFundingMethod(account);
  const terms = allowanceBalanceTerms(account);
  const [amount, setAmount] = useState(mode === 'reconcile' ? (account.reviewedBalanceCentavos / 100).toFixed(2) : '');
  const [fuel, setFuel] = useState('0');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [paymentDate, setPaymentDate] = useState(manilaDate());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transferProofUri, setTransferProofUri] = useState('');
  const [error, setError] = useState('');
  return <form onSubmit={e => { e.preventDefault(); try {
    const payload = { accountId: account.id, reason, amountCentavos: toCentavos(amount), declaredCashCentavos: toCentavos(amount), id: slip?.id, fuelCentavos: toCentavos(fuel), cashRecovered: confirmed, paymentMethod: method, paymentDate, referenceNumber, transferProofUri };
    onSave({ reconcile: 'reconcileCash', return: 'cashReturn', correct: 'correctLiquidation' }[mode], payload);
  } catch (err) { setError(err.message); } }}>
    <p className="allowance-helper">{mode === 'correct' ? 'Reduce an approved expense only after recovering the difference. The original slip and reversal history are retained.' : mode === 'return' ? method === 'bank' ? 'Record funds transferred back to Finance.' : 'Record cash physically returned to Finance.' : method === 'bank' ? 'Compare the dedicated bank account balance with the allowance ledger before clearing the hold.' : 'Verify physical cash against the account ledger before clearing the hold.'}</p>
    <Field label={mode === 'correct' ? 'Corrected total expense (PHP)' : mode === 'return' ? method === 'bank' ? 'Funds returned (PHP)' : 'Cash returned (PHP)' : `${terms.verify} (PHP)`}><MoneyInput value={amount} onChange={e => setAmount(e.target.value)} /></Field>
    {mode === 'return' && method === 'bank' && <><Field label="Return transfer date"><input type="date" required max={manilaDate()} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></Field><Field label="Bank reference"><input required maxLength={200} value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} /></Field><Field label="Transfer proof link (optional)"><input type="url" value={transferProofUri} onChange={e => setTransferProofUri(e.target.value)} /></Field></>}
    {mode === 'correct' && <><Field label="Corrected fuel portion (PHP)"><MoneyInput value={fuel} onChange={e => setFuel(e.target.value)} /></Field><label className="allowance-check"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />The expense difference has been recovered to the allowance account.</label></>}
    <Field label="Reason / acknowledgment"><textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    {error && <p className="allowance-error" role="alert">{error}</p>}
    <Controls busy={busy} submitLabel="Record reconciliation" />
  </form>;
}
