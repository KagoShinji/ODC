import { ACTIONS, FILE_TYPES, check, idValue, textValue, centavos, dateValue, manilaDate, normalizedPolicy, normalizeLines, estimatedCash, eligible, topUp, allowanceFundingMethod } from './domain.js';

// The repository buffers writes until every read completes, satisfying Firestore transaction ordering.
export async function executeCommand(repo, actor, command, data, commandId, now = new Date()) {
  const uid = actor.uid;
  const timestamp = now.toISOString();
  const today = manilaDate(now);
  const access = await repo.get('allowanceAccess', uid);
  if (!actor.bootstrapAdmin && access?.staffId) {
    const roster = await repo.get('staff', access.staffId);
    check(roster?.status === 'active', 'Your staff account is inactive.', 'permission-denied');
  }
  const settings = await repo.get('allowanceSettings', 'current');
  const actions = actor.bootstrapAdmin ? ACTIONS : access?.active ? access.actions || [] : [];
  check(!access?.bootstrapAdmin || actor.bootstrapAdmin, 'This administrator grant has been revoked.', 'permission-denied');
  let auditOwner = uid;
  function permit(action) { check(actions.includes(`allowances:${action}`), 'You do not have permission for this action.', 'permission-denied'); }
  async function get(collection, id) { const value = await repo.get(collection, id); check(value, 'The record no longer exists.', 'not-found'); return { ...value, id }; }
  function write(collection, id, value) { repo.set(collection, id, { ...value, updatedAt: timestamp }); }
  function audit(entityId, before, after, reason = '') { write('allowanceAuditEvents', `${uid}_${commandId}`, { ownerUid: auditOwner, accountId: data.accountId || '', command, entityId, before, after, reason, actorUid: uid, createdAt: timestamp }); }
  function owned(record) { check(record.ownerUid === uid, 'You can only submit your own records.', 'permission-denied'); }
  function other(record) { check(record.ownerUid !== uid, 'You cannot approve your own submission.', 'permission-denied'); }
  function ledger(account, kind, amount, sourceId, suffix = '', metadata = {}) { write('allowanceLedger', `${uid}_${commandId}${suffix}`, { ownerUid: account.ownerUid, accountId: account.id, staffName: account.staffName, kind, amountCentavos: amount, sourceId, actorUid: uid, date: today, createdAt: timestamp, ...metadata }); }

  if (command === 'savePolicy') {
    permit('manage');
    check(data.confirmed === true, 'Confirm the policy before saving.');
    const policy = normalizedPolicy(data.policy || {});
    const version = `${uid}_${commandId}`;
    write('allowancePolicies', version, { ...policy, version, createdAt: timestamp, createdBy: uid });
    write('allowanceSettings', 'current', { enabled: data.enabled === true, policyVersion: version, policy });
    audit('current', settings?.enabled || false, data.enabled === true);
    return { id: version };
  }
  if (command === 'grantAccess') {
    permit('manage');
    const target = textValue(data.authUid, 'Auth UID', 128);
    check(Array.isArray(data.actions) && data.actions.every(x => ACTIONS.includes(x)), 'Invalid allowance permission.', 'invalid-argument');
    const staffId = idValue(data.staffId);
    const previous = await repo.get('allowanceAccess', target);
    const account = await repo.get('allowanceAccounts', staffId);
    const staff = await get('staff', staffId);
    check(data.active !== true || staff.status === 'active', 'Activate the staff account before granting allowance access.');
    check(!account || account.ownerUid === target, 'This staff allowance belongs to a different Auth account.');
    check(!previous?.staffId || previous.staffId === staffId, 'This login is already mapped to another staff record.');
    write('allowanceAccess', target, { staffId, staffName: staff.name, active: data.active === true, actions: [...new Set(data.actions)], ownerUid: target });
    audit(target, previous?.active || false, data.active === true);
    return { id: target };
  }
  check(settings?.enabled, 'Allowances are not activated. An authorized administrator must confirm the policy first.');

  if (command === 'configureAccount') {
    permit('manage');
    const id = idValue(data.staffId);
    const staff = await get('staff', id);
    const grant = await get('allowanceAccess', data.ownerUid);
    const current = await repo.get('allowanceAccounts', id);
    check(grant.active && grant.staffId === id, 'Grant an active, verified staff login first.');
    check(!current || current.ownerUid === data.ownerUid, 'Allowance ownership cannot be changed.');
    const nextScheduledDate = dateValue(data.nextScheduledDate);
    const status = current ? data.status || current.status : 'pending_setup';
    const fundingMethod = ['bank', 'cash'].includes(data.fundingMethod) ? data.fundingMethod : allowanceFundingMethod(current);
    const bankName = fundingMethod === 'bank' ? textValue(data.bankName, 'Bank or provider', 100) : '';
    const bankAccountName = fundingMethod === 'bank' ? textValue(data.bankAccountName, 'Account holder name', 120) : '';
    const bankAccountLast4 = fundingMethod === 'bank' ? String(data.bankAccountLast4 || '') : '';
    check(fundingMethod !== 'bank' || /^\d{4}$/.test(bankAccountLast4), 'Enter only the last four account digits.', 'invalid-argument');
    check(['pending_setup', 'active', 'suspended', 'closed'].includes(status), 'Invalid account state.');
    if (current && fundingMethod !== allowanceFundingMethod(current)) check(!current.activeRequestId, 'Finish or cancel the active replenishment before changing the funding method.');
    if (current && status === 'closed') check(current.reviewedBalanceCentavos === 0 && current.unresolvedCount === 0 && !current.activeRequestId, 'Reconcile the allowance balance and open slips before closing.');
    if (current) check((status !== 'pending_setup' || !current.funded) && (status !== 'active' || current.funded), 'Record initial funding before activation.');
    const account = current ? { ...current, nextScheduledDate, status, fundingMethod, bankName, bankAccountName, bankAccountLast4 } : { id, ownerUid: data.ownerUid, staffId: id, staffName: textValue(staff.name, 'Staff name'), status, fundingMethod, bankName, bankAccountName, bankAccountLast4, funded: false, reviewedBalanceCentavos: 0, unreviewedCentavos: 0, unresolvedCount: 0, activeRequestId: '', reconciliationHold: false, nextScheduledDate, policy: settings.policy, policyVersion: settings.policyVersion, createdAt: timestamp };
    write('allowanceAccounts', id, account); audit(id, current?.status || '', status);
    return { id };
  }

  const accountId = idValue(data.accountId);
  const account = await get('allowanceAccounts', accountId);
  auditOwner = account.ownerUid;
  check(account.status !== 'closed', 'This allowance account is closed.');
  const saveAccount = () => write('allowanceAccounts', accountId, account);
  if (command === 'deleteTestRecord') {
    check(actor.bootstrapAdmin, 'Only the configured superadmin can remove allowance test records.', 'permission-denied');
    const kind = data.kind;
    check(['liquidation', 'requisition'].includes(kind), 'Choose a liquidation or requisition to remove.', 'invalid-argument');
    const id = idValue(data.id);
    const reason = textValue(data.reason || 'Test data cleanup', 'Deletion reason', 500);

    if (kind === 'liquidation') {
      const slip = await get('allowanceLiquidations', id);
      check(slip.accountId === accountId && slip.status !== 'deleted', 'This liquidation is not available for removal.');
      const wasPending = ['submitted', 'returned'].includes(slip.status);
      const pending = wasPending ? slip.totalCentavos : 0;
      const restored = slip.status === 'approved' ? slip.totalCentavos : slip.status === 'voided' ? slip.correctedTotalCentavos : 0;
      check(account.unreviewedCentavos >= pending && account.unresolvedCount >= (wasPending ? 1 : 0), 'The allowance totals no longer match this test liquidation.');
      check(account.reviewedBalanceCentavos + restored <= account.policy.targetCentavos, 'Delete newer replenishment test data first so the restored balance does not exceed the allowance float.');

      if (wasPending) {
        account.unreviewedCentavos -= pending;
        account.unresolvedCount -= 1;
      }
      if (restored) {
        account.reviewedBalanceCentavos += restored;
        ledger(account, 'test_liquidation_removed', restored, slip.id);
      }
      if (wasPending && account.unresolvedCount === 0) account.reconciliationHold = false;

      const postedFuel = slip.status === 'voided' ? slip.correctedFuelCentavos || 0 : ['submitted', 'returned', 'approved'].includes(slip.status) ? slip.fuelCentavos || 0 : 0;
      if (['submitted', 'returned', 'approved', 'voided'].includes(slip.status)) {
        const day = await get('allowanceDailyFuel', `${accountId}_${slip.date}`);
        const allocations = { ...(day.allocations || {}) };
        allocations[slip.id] = {};
        check(day.fuelCentavos >= postedFuel, 'The fuel allocation no longer matches this test liquidation.');
        write('allowanceDailyFuel', day.id, { ...day, fuelCentavos: day.fuelCentavos - postedFuel, allocations });
      }

      const meeting = await get('allowanceMeetings', slip.meetingId);
      if (meeting.liquidationId === slip.id) write('allowanceMeetings', meeting.id, { ...meeting, liquidationId: '' });
      if (slip.expenseId) repo.delete('expenses', slip.expenseId);
      saveAccount();
      write('allowanceLiquidations', slip.id, { ...slip, status: 'deleted', deletedAt: timestamp, deletedBy: uid, deletionReason: reason });
      audit(slip.id, slip.status, 'deleted', reason);
      return { id: slip.id, removedExpenseId: slip.expenseId || '' };
    }

    const req = await get('allowanceRequisitions', id);
    check(req.accountId === accountId && req.status !== 'deleted', 'This requisition is not available for removal.');
    const released = req.status === 'released' ? req.amountCentavos : 0;
    check(account.reviewedBalanceCentavos - released >= account.unreviewedCentavos, 'Delete newer spending test data first so this replenishment can be reversed safely.');
    if (released) {
      account.reviewedBalanceCentavos -= released;
      ledger(account, 'test_requisition_removed', -released, req.id);
    }
    if (account.activeRequestId === req.id) account.activeRequestId = '';
    saveAccount();
    write('allowanceRequisitions', req.id, { ...req, status: 'deleted', deletedAt: timestamp, deletedBy: uid, deletionReason: reason });
    audit(req.id, req.status, 'deleted', reason);
    return { id: req.id };
  }
  if (command === 'initialRelease') {
    permit('release');
    check(!account.funded && account.status === 'pending_setup', 'Initial funding has already been recorded.');
    const amount = centavos(data.amountCentavos);
    check(amount <= account.policy.targetCentavos, 'Initial funding exceeds the target float.');
    const payment = paymentFields(data, today);
    check(payment.paymentMethod === allowanceFundingMethod(account), 'Use the funding method configured for this allowance account.');
    check(payment.paymentMethod !== 'bank' || data.transferConfirmed === true, 'Confirm that the initial bank transfer has settled.');
    account.funded = true; account.status = 'active'; account.reviewedBalanceCentavos = amount;
    ledger(account, 'initial_release', amount, accountId);
    write('allowanceReleases', `${uid}_${commandId}`, { ownerUid: account.ownerUid, accountId, amountCentavos: amount, ...payment, kind: 'initial_release', createdAt: timestamp, actorUid: uid });
    saveAccount(); audit(accountId, 'pending_setup', 'active'); return { id: accountId };
  }
  if (command === 'reconcileCash') {
    permit('manage');
    check(account.unresolvedCount === 0, 'Resolve pending liquidation before verifying the allowance balance.');
    const declared = centavos(data.declaredCashCentavos, 'Verified balance', true);
    check(declared === account.reviewedBalanceCentavos, 'The verified balance must match the ledger. Record a return or documented correction first.');
    account.reconciliationHold = false; saveAccount(); audit(accountId, 'hold', 'reconciled', textValue(data.reason, 'Reconciliation note')); return { id: accountId };
  }
  if (command === 'cashReturn') {
    permit('release');
    check(account.unresolvedCount === 0 && !account.activeRequestId, 'Resolve pending slips and requests before returning funds.');
    const amount = centavos(data.amountCentavos);
    check(amount <= account.reviewedBalanceCentavos, 'The returned amount exceeds the remaining balance.');
    const reason = textValue(data.reason, 'Return reason');
    const payment = allowanceFundingMethod(account) === 'bank' ? paymentFields(data, today, 'bank') : {};
    account.reviewedBalanceCentavos -= amount; saveAccount(); ledger(account, 'cash_return', -amount, accountId, '', payment); audit(accountId, '', 'cash_return', reason); return { id: accountId };
  }
  check(account.status === 'active', 'This allowance is suspended or has not been funded.');

  if (command === 'saveMeeting') {
    permit('meeting'); owned(account);
    const id = idValue(data.id || commandId);
    const previous = await repo.get('allowanceMeetings', id);
    const date = dateValue(data.date);
    const status = data.status;
    check(['planned', 'held', 'cancelled'].includes(status), 'Invalid meeting state.');
    check(status !== 'held' || date <= today, 'A future meeting cannot be marked held.');
    if (previous) { owned(previous); check(previous.accountId === accountId && !previous.liquidationId, 'Meetings with a liquidation cannot be changed.'); }
    const dayId = `${accountId}_${date}`;
    const day = await repo.get('allowanceDailyFuel', dayId) || { accountId, ownerUid: uid, date, heldMeetingIds: [], fuelCentavos: 0 };
    if (previous?.date && previous.date !== date) {
      const oldId = `${accountId}_${previous.date}`;
      const old = await repo.get('allowanceDailyFuel', oldId);
      if (old) { const held = old.heldMeetingIds.filter(x => x !== id); check(old.fuelCentavos <= (held.length >= 2 ? account.policy.dailyFuelCentavos : account.policy.singleFuelCentavos), 'This change would invalidate daily fuel already submitted.'); write('allowanceDailyFuel', oldId, { ...old, heldMeetingIds: held }); }
    }
    day.heldMeetingIds = day.heldMeetingIds.filter(x => x !== id);
    if (status === 'held') day.heldMeetingIds.push(id);
    check(day.fuelCentavos <= (day.heldMeetingIds.length >= 2 ? account.policy.dailyFuelCentavos : account.policy.singleFuelCentavos), 'This change would invalidate daily fuel already submitted.');
    const meeting = { ownerUid: uid, accountId, date, status, clientId: String(data.clientId || '').slice(0, 128), clientName: textValue(data.clientName, 'Client name', 200), purpose: textValue(data.purpose, 'Meeting purpose', 500), createdAt: previous?.createdAt || timestamp };
    write('allowanceDailyFuel', dayId, day); write('allowanceMeetings', id, meeting); audit(id, previous?.status || '', status); return { id };
  }

  if (command === 'saveLiquidation') {
    permit('liquidate'); owned(account);
    const meetingId = idValue(data.meetingId);
    const meeting = await get('allowanceMeetings', meetingId); owned(meeting);
    check(meeting.accountId === accountId && meeting.status === 'held', 'Select a held meeting for this account.');
    const id = meetingId; // One cumulative slip per meeting; no split-submission cap bypass.
    const current = await repo.get('allowanceLiquidations', id);
    check(!current || ['draft', 'returned'].includes(current.status), 'Only draft or returned liquidations can be revised.');
    const ids = [...new Set((data.lines || []).flatMap(x => x.attachmentIds || []))];
    check(ids.length <= account.policy.maxAttachments, 'Too many attachments.');
    const attachments = new Map();
    for (const fileId of ids) {
      const file = await get('allowanceAttachments', idValue(fileId));
      check(file.ownerUid === uid && file.accountId === accountId && (file.liquidationId === id || file.date === meeting.date && file.purchaseCentavos > 0) && file.finalized && !file.deleting, 'Attachment does not belong to this finalized slip.'); attachments.set(fileId, file);
      write('allowanceAttachments', fileId, { ...file, cleanupCandidate: false });
    }
    check(Array.isArray(data.lines) && data.lines.length <= 30, 'Use at most 30 expense lines.', 'invalid-argument');
    const normalized = data.submit ? normalizeLines(data.lines.map(line => ({ ...line, slipId: id })), meeting.date, account.policy, attachments) : null;
    check(data.submit !== true || data.lines.length > 0 || data.noExpense === true, 'Confirm that this meeting had no expenses.');
    const declared = centavos(data.declaredCashCentavos, 'Reported remaining balance', true);
    const revision = (current?.revision || 0) + (data.submit ? 1 : 0);
    const slip = { ownerUid: uid, accountId, meetingId, clientName: meeting.clientName, date: meeting.date, staffName: account.staffName, slipNumber: `LIQ-${id.slice(0, 12).toUpperCase()}`, policyVersion: account.policyVersion, lines: normalized?.lines || data.lines || [], totalCentavos: normalized?.totalCentavos || 0, fuelCentavos: normalized?.fuelCentavos || 0, attachmentIds: normalized?.attachmentIds || ids, preparedAttachmentIds: current?.preparedAttachmentIds || [], declaredCashCentavos: declared, notes: String(data.notes || '').slice(0, 1000), revision, status: data.submit ? 'submitted' : current?.status || 'draft', createdAt: current?.createdAt || timestamp, reviewNote: current?.reviewNote || '' };
    if (data.submit) {
      for (const fileId of slip.preparedAttachmentIds) {
        const preparedFile = await repo.get('allowanceAttachments', fileId);
        if (preparedFile) write('allowanceAttachments', fileId, { ...preparedFile, uploadAllowed: false, cleanupCandidate: false });
      }
      const oldAmount = current?.status === 'returned' ? current.totalCentavos : 0;
      const fuel = await repo.get('allowanceDailyFuel', `${accountId}_${meeting.date}`);
      check(fuel, 'Meeting fuel ledger is missing.');
      const dailyFuel = fuel.fuelCentavos - (current?.status === 'returned' ? current.fuelCentavos : 0) + slip.fuelCentavos;
      check(dailyFuel <= (fuel.heldMeetingIds.length >= 2 ? account.policy.dailyFuelCentavos : account.policy.singleFuelCentavos), 'Fuel spending exceeds the daily allocation.');
      const allocations = { ...(fuel.allocations || {}) };
      delete allocations[id];
      const ownPurchases = {};
      for (const line of slip.lines.filter(x => x.category === 'Fuel')) ownPurchases[line.fuelPurchaseId] = (ownPurchases[line.fuelPurchaseId] || 0) + line.amountCentavos;
      allocations[id] = ownPurchases;
      for (const [purchaseId, amount] of Object.entries(ownPurchases)) {
        const otherAmounts = Object.values(allocations).reduce((sum, item) => sum + (item[purchaseId] || 0), 0);
        check(amount > 0 && otherAmounts <= attachments.get(purchaseId).purchaseCentavos, 'The fuel receipt has already been fully allocated.');
      }
      check(slip.totalCentavos - oldAmount <= estimatedCash(account), 'Reported spending exceeds the remaining allowance balance.');
      account.unreviewedCentavos += slip.totalCentavos - oldAmount;
      account.unresolvedCount += current?.status === 'returned' ? 0 : 1;
      if (declared !== estimatedCash(account)) account.reconciliationHold = true;
      slip.submittedAt = timestamp; slip.late = meeting.date < today;
      write('allowanceDailyFuel', `${accountId}_${meeting.date}`, { ...fuel, fuelCentavos: dailyFuel, allocations });
      write(`allowanceLiquidations/${id}/revisions`, String(revision), { ...slip, frozenAt: timestamp });
      saveAccount();
    } else if (current?.status === 'returned') {
      // Preserve the previously reported spend and evidence until corrected resubmission.
      slip.totalCentavos = current.totalCentavos; slip.fuelCentavos = current.fuelCentavos;
    }
    write('allowanceMeetings', meetingId, { ...meeting, liquidationId: id });
    write('allowanceLiquidations', id, slip); audit(id, current?.status || '', slip.status); return { id };
  }

  if (command === 'registerEvidenceReference') {
    permit('liquidate'); owned(account);
    const id = idValue(data.id || commandId);
    const slip = await get('allowanceLiquidations', idValue(data.liquidationId)); owned(slip);
    check(slip.accountId === accountId && ['draft', 'returned'].includes(slip.status), 'Only editable slips accept evidence references.');
    check(!await repo.get('allowanceAttachments', id), 'This evidence reference already exists.');
    const reference = textValue(data.reference, 'Receipt or voucher reference', 64).toUpperCase();
    check(/^[A-Z0-9_-]+$/.test(reference), 'Use letters, numbers, dashes or underscores for the receipt reference.');
    const referenceUri = String(data.referenceUri || '').trim();
    check(!referenceUri || referenceUri.length <= 1000 && /^https:\/\//.test(referenceUri), 'Use an HTTPS evidence link.');
    const purchaseCentavos = data.purchaseCentavos ? centavos(data.purchaseCentavos, 'Full fuel purchase') : 0;
    check(purchaseCentavos <= account.policy.dailyFuelCentavos, 'Fuel purchase exceeds the daily limit.');
    if (purchaseCentavos) {
      const receiptId = `${accountId}_${slip.date}_${reference}`;
      check(!await repo.get('allowanceFuelReceipts', receiptId), 'This fuel purchase is already registered. Select its existing reference.');
      write('allowanceFuelReceipts', receiptId, { accountId, ownerUid: uid, fileId: id });
    }
    const preparedAttachmentIds = [...(slip.preparedAttachmentIds || []), id];
    check(preparedAttachmentIds.length <= Math.min(account.policy.maxAttachments, actor.capabilities?.maxExpenseLines || 30), 'This slip has reached its evidence reference limit.');
    write('allowanceAttachments', id, { ownerUid: uid, accountId, liquidationId: slip.id, date: slip.date, purchaseCentavos, revision: slip.revision + 1, name: textValue(data.name || reference, 'Evidence label', 200), reference, referenceUri, kind: 'reference', finalized: true, uploadAllowed: false, cleanupCandidate: false, createdAt: timestamp });
    write('allowanceLiquidations', slip.id, { ...slip, preparedAttachmentIds });
    audit(id, '', 'reference_registered'); return { id };
  }

  if (command === 'prepareAttachment') {
    permit('liquidate'); owned(account);
    const id = idValue(data.id || commandId);
    const slip = await get('allowanceLiquidations', idValue(data.liquidationId)); owned(slip);
    check(slip.accountId === accountId && ['draft', 'returned'].includes(slip.status), 'Only editable slips accept new evidence.');
    const existing = await repo.get('allowanceAttachments', id);
    check(!existing, 'Attachment ID already exists.');
    check(FILE_TYPES.includes(data.contentType), 'Upload a JPEG, PNG, WebP, or PDF.');
    check(Number.isInteger(data.size) && data.size > 0 && data.size <= account.policy.maxFileBytes, 'Attachment exceeds the file size limit.');
    const revision = slip.revision + 1;
    const preparedAttachmentIds = [...(slip.preparedAttachmentIds || []), id];
    check(preparedAttachmentIds.length <= account.policy.maxAttachments, 'This slip has reached its attachment limit.');
    const objectPath = `allowances/${uid}/${slip.id}/${revision}/${id}`;
    const purchaseCentavos = data.purchaseCentavos ? centavos(data.purchaseCentavos, 'Full fuel purchase') : 0;
    check(purchaseCentavos <= account.policy.dailyFuelCentavos, 'Fuel purchase exceeds the daily limit.');
    write('allowanceAttachments', id, { ownerUid: uid, accountId, liquidationId: slip.id, date: slip.date, purchaseCentavos, revision, objectPath, name: textValue(data.name, 'Filename', 200), contentType: data.contentType, size: data.size, finalized: false, uploadAllowed: true, cleanupCandidate: true, createdAt: timestamp });
    write('allowanceLiquidations', slip.id, { ...slip, preparedAttachmentIds });
    return { id, objectPath };
  }
  if (command === 'finalizeAttachment') {
    permit('liquidate'); owned(account);
    const file = await get('allowanceAttachments', idValue(data.id)); owned(file);
    const slip = await get('allowanceLiquidations', file.liquidationId);
    check(file.accountId === accountId && !file.deleting && ['draft', 'returned'].includes(slip.status), 'This slip no longer accepts evidence.');
    check(actor.fileMetadata && Number(actor.fileMetadata.size) === file.size && actor.fileMetadata.contentType === file.contentType, 'The uploaded file does not match its declared metadata.');
    if (file.purchaseCentavos > 0) {
      check(actor.fileMetadata.md5Hash, 'The fuel receipt content hash is missing.');
      const receiptId = `${accountId}_${file.date}_${actor.fileMetadata.md5Hash.replace(/[^a-zA-Z0-9]/g, '')}`;
      const duplicate = await repo.get('allowanceFuelReceipts', receiptId);
      check(!duplicate || duplicate.fileId === file.id, 'This fuel receipt was already uploaded. Select its existing shared purchase instead.');
      write('allowanceFuelReceipts', receiptId, { accountId, ownerUid: uid, fileId: file.id });
    }
    write('allowanceAttachments', file.id, { ...file, finalized: true }); return { id: file.id };
  }

  if (command === 'reviewLiquidation') {
    permit('review');
    const slip = await get('allowanceLiquidations', idValue(data.id)); other(slip);
    check(slip.accountId === accountId && slip.status === 'submitted', 'This liquidation is not awaiting review.');
    check(['approve', 'return'].includes(data.decision), 'Choose approve or return.');
    const note = data.decision === 'return' ? textValue(data.reason, 'Correction reason') : String(data.reason || '').slice(0, 1000);
    const status = data.decision === 'approve' ? 'approved' : 'returned';
    if (status === 'approved') {
      check(data.verified === true, 'Verify the receipts, totals, and reported balance before approval.');
      const expenseId = `allowance_liquidation_${slip.id}`;
      check(!await repo.get('expenses', expenseId), 'This liquidation has already been posted.');
      account.reviewedBalanceCentavos -= slip.totalCentavos;
      account.unreviewedCentavos -= slip.totalCentavos; account.unresolvedCount -= 1;
      check(account.reviewedBalanceCentavos >= 0 && account.unreviewedCentavos >= 0, 'The account balance is inconsistent.');
      if (slip.totalCentavos > 0) {
        ledger(account, 'approved_expense', -slip.totalCentavos, slip.id);
        write('expenses', expenseId, { title: `Client meeting — ${slip.clientName}`, category: 'Other', amount: slip.totalCentavos / 100, date: slip.date, payee: account.staffName, referenceNumber: slip.slipNumber, status: 'paid', notes: slip.notes, isRecurring: false, source: 'allowance_liquidation', liquidationId: slip.id, allowanceAccountId: accountId, approvedLines: slip.lines, createdBy: actor.email || uid, createdAt: timestamp });
        slip.expenseId = expenseId;
      }
      saveAccount();
    }
    write('allowanceLiquidations', slip.id, { ...slip, status, preparedAttachmentIds: status === 'returned' ? [] : slip.preparedAttachmentIds || [], reviewNote: note, reviewedBy: uid, reviewedAt: timestamp }); audit(slip.id, 'submitted', status, note); return { id: slip.id };
  }

  if (command === 'saveRequisition') {
    permit('request'); owned(account);
    const id = idValue(data.id || commandId);
    const current = await repo.get('allowanceRequisitions', id);
    check(!current || ['draft', 'returned'].includes(current.status), 'This request cannot be edited.');
    if (current) check(current.accountId === accountId && current.ownerUid === uid, 'Invalid requisition owner.', 'permission-denied');
    const meeting = data.meetingId ? await get('allowanceMeetings', idValue(data.meetingId)) : null;
    const declared = centavos(data.declaredCashCentavos, 'Money left on hand', true);
    const amount = centavos(data.amountCentavos);
    check(amount <= topUp(account), 'Requested amount exceeds the top-up needed.');
    const reason = textValue(data.reason, 'Reason for request');
    const type = data.type;
    check(['early', 'scheduled'].includes(type), 'Select early or scheduled.');
    if (data.submit) {
      check(!account.activeRequestId || account.activeRequestId === id, 'Another replenishment request is already open.');
      const why = eligible(account, type, meeting, today); check(!why, why);
      check(declared === estimatedCash(account), 'The reported balance does not match the allowance ledger. Resolve the discrepancy first.');
      account.activeRequestId = id; saveAccount();
    }
    const req = { ownerUid: uid, accountId, staffName: account.staffName, slipNumber: `REQ-${id.slice(0, 12).toUpperCase()}`, type, reason, meetingId: meeting?.id || '', clientName: meeting?.clientName || '', declaredCashCentavos: declared, balanceSnapshotCentavos: account.reviewedBalanceCentavos, amountCentavos: amount, policyVersion: account.policyVersion, date: today, status: data.submit ? 'submitted' : current?.status || 'draft', createdAt: current?.createdAt || timestamp, submittedAt: data.submit ? timestamp : current?.submittedAt || '', reviewNote: current?.reviewNote || '' };
    write('allowanceRequisitions', id, req); audit(id, current?.status || '', req.status); return { id };
  }
  if (['reviewRequisition', 'releaseRequisition', 'initiateTransfer', 'settleTransfer', 'failTransfer'].includes(command)) {
    permit(command === 'reviewRequisition' ? 'approve' : 'release');
    const req = await get('allowanceRequisitions', idValue(data.id));
    check(req.accountId === accountId && account.activeRequestId === req.id, 'This request is no longer active.');
    const meeting = req.meetingId ? await get('allowanceMeetings', req.meetingId) : null;
    if (command === 'reviewRequisition') {
      other(req); check(['submitted', 'approved'].includes(req.status), 'This request is not awaiting approval.');
      check(['approve', 'return', 'reject'].includes(data.decision), 'Invalid approval decision.');
      if (data.decision === 'approve') {
        const why = eligible(account, req.type, meeting, today); check(!why, why);
        check(account.unresolvedCount === 0 && account.reviewedBalanceCentavos === req.balanceSnapshotCentavos, 'Resolve unreviewed spending or return this stale request for revision.');
      }
      const status = { approve: 'approved', return: 'returned', reject: 'rejected' }[data.decision];
      const reason = status === 'approved' ? String(data.reason || '').slice(0, 1000) : textValue(data.reason, 'Review reason');
      if (status === 'rejected') { account.activeRequestId = ''; saveAccount(); }
      write('allowanceRequisitions', req.id, { ...req, status, reviewNote: reason, approvedBy: status === 'approved' ? uid : '', reviewedAt: timestamp }); audit(req.id, req.status, status, reason); return { id: req.id };
    }
    const method = allowanceFundingMethod(account);
    if (command === 'initiateTransfer') {
      check(method === 'bank', 'This allowance is not configured for bank transfers.');
      check(['approved', 'transfer_failed'].includes(req.status), 'This transfer cannot be started from its current status.');
      const why = eligible(account, req.type, meeting, today); check(!why, why);
      check(account.unresolvedCount === 0 && account.reviewedBalanceCentavos === req.balanceSnapshotCentavos && req.amountCentavos <= topUp(account), 'The approved request is stale. Return it for revision before starting the transfer.');
      check(data.amountCentavos === req.amountCentavos, 'Transfer the exact approved amount or return the request for revision.');
      const payment = paymentFields(data, today, 'bank');
      const nextScheduledDate = dateValue(data.nextScheduledDate); check(nextScheduledDate > today, 'Choose the next scheduled replenishment date.');
      saveAccount();
      write('allowanceRequisitions', req.id, { ...req, status: 'transfer_pending', ...payment, nextScheduledDate, transferInitiatedBy: uid, transferInitiatedAt: timestamp, transferFailureReason: '' });
      audit(req.id, req.status, 'transfer_pending', payment.referenceNumber); return { id: req.id };
    }
    if (command === 'failTransfer') {
      check(method === 'bank' && req.status === 'transfer_pending', 'Only a pending bank transfer can be marked failed.');
      const reason = textValue(data.reason, 'Transfer failure reason', 500);
      saveAccount();
      write('allowanceRequisitions', req.id, { ...req, status: 'transfer_failed', transferFailureReason: reason, transferFailedBy: uid, transferFailedAt: timestamp });
      audit(req.id, 'transfer_pending', 'transfer_failed', reason); return { id: req.id };
    }
    if (command === 'settleTransfer') {
      check(method === 'bank' && req.status === 'transfer_pending', 'Only a pending bank transfer can be settled.');
      check(account.unresolvedCount === 0 && req.amountCentavos <= topUp(account), 'The allowance changed while the transfer was pending. Resolve its balance before settlement.');
      account.reviewedBalanceCentavos += req.amountCentavos; account.activeRequestId = ''; account.nextScheduledDate = dateValue(req.nextScheduledDate); saveAccount();
      ledger(account, 'replenishment', req.amountCentavos, req.id, '', { paymentMethod: 'bank', paymentDate: req.paymentDate, referenceNumber: req.referenceNumber, transferProofUri: req.transferProofUri || '' });
      write('allowanceRequisitions', req.id, { ...req, status: 'released', releasedBy: uid, releasedAt: timestamp });
      audit(req.id, 'transfer_pending', 'released', req.referenceNumber); return { id: req.id };
    }
    check(method === 'cash' && req.status === 'approved', 'Use the bank transfer workflow for this allowance account.');
    const why = eligible(account, req.type, meeting, today); check(!why, why);
    check(account.unresolvedCount === 0 && account.reviewedBalanceCentavos === req.balanceSnapshotCentavos && req.amountCentavos <= topUp(account), 'The approved request is stale. Return it for revision before release.');
    check(data.amountCentavos === req.amountCentavos, 'Release the exact approved amount or return the request for revision.');
    const payment = paymentFields(data, today, 'cash');
    const nextScheduledDate = dateValue(data.nextScheduledDate); check(nextScheduledDate > today, 'Choose the next scheduled replenishment date.');
    account.reviewedBalanceCentavos += req.amountCentavos; account.activeRequestId = ''; account.nextScheduledDate = nextScheduledDate; saveAccount();
    ledger(account, 'replenishment', req.amountCentavos, req.id, '', payment);
    write('allowanceRequisitions', req.id, { ...req, status: 'released', releasedBy: uid, releasedAt: timestamp, ...payment, nextScheduledDate }); audit(req.id, 'approved', 'released'); return { id: req.id };
  }
  if (command === 'cancelRequisition') {
    permit('request');
    const req = await get('allowanceRequisitions', idValue(data.id)); owned(req);
    check(req.accountId === accountId && ['draft', 'submitted', 'returned'].includes(req.status), 'This request cannot be cancelled.');
    if (account.activeRequestId === req.id) account.activeRequestId = '';
    saveAccount(); write('allowanceRequisitions', req.id, { ...req, status: 'cancelled' }); audit(req.id, req.status, 'cancelled', textValue(data.reason, 'Cancellation reason')); return { id: req.id };
  }
  if (command === 'correctLiquidation') {
    permit('reverse');
    const slip = await get('allowanceLiquidations', idValue(data.id)); other(slip);
    check(slip.accountId === accountId && slip.status === 'approved' && !account.activeRequestId && account.unresolvedCount === 0, 'Resolve open slips and requests before correcting an approved expense.');
    const correctedTotal = centavos(data.amountCentavos, 'Corrected total', true);
    check(correctedTotal <= slip.totalCentavos && correctedTotal !== slip.totalCentavos, 'A correction must reduce the expense. New spending requires its own evidence and review.');
    const reason = textValue(data.reason, 'Correction reason');
    check(data.cashRecovered === true, 'Confirm the difference has been recovered to the allowance account.');
    const expense = await get('expenses', slip.expenseId);
    const difference = slip.totalCentavos - correctedTotal;
    const day = await get('allowanceDailyFuel', `${accountId}_${slip.date}`);
    const correctedFuel = centavos(data.fuelCentavos, 'Corrected fuel', true);
    check(correctedFuel <= slip.fuelCentavos && correctedFuel <= correctedTotal && slip.fuelCentavos - correctedFuel <= difference, 'Invalid corrected fuel allocation.');
    account.reviewedBalanceCentavos += difference;
    check(account.reviewedBalanceCentavos <= account.policy.targetCentavos, 'Return excess allowance funds before correcting.');
    ledger(account, 'expense_reversal', slip.totalCentavos, slip.id, '_reversal');
    ledger(account, 'corrected_expense', -correctedTotal, slip.id, '_replacement');
    write('expenses', slip.expenseId, { ...expense, amount: correctedTotal / 100, correctionReason: reason, correctedAt: timestamp, correctedBy: uid });
    write('allowanceLiquidations', slip.id, { ...slip, correctedTotalCentavos: correctedTotal, correctedFuelCentavos: correctedFuel, status: 'voided', correctionReason: reason });
    // Remove recovered fuel proportionately from this slip's purchase allocations.
    const allocations = { ...(day.allocations || {}) };
    const purchases = { ...(allocations[slip.id] || {}) };
    let recoveredFuel = slip.fuelCentavos - correctedFuel;
    for (const purchase of Object.keys(purchases)) { const recovered = Math.min(recoveredFuel, purchases[purchase]); purchases[purchase] -= recovered; recoveredFuel -= recovered; }
    allocations[slip.id] = purchases;
    write('allowanceDailyFuel', day.id, { ...day, fuelCentavos: day.fuelCentavos - slip.fuelCentavos + correctedFuel, allocations });
    saveAccount(); audit(slip.id, 'approved', 'voided', reason); return { id: slip.id };
  }
  throw new Error('Unknown allowance command.');
}

function paymentFields(data, today, expectedMethod) {
  check(['cash', 'bank'].includes(data.paymentMethod), 'Select cash or bank payment.');
  check(!expectedMethod || data.paymentMethod === expectedMethod, `Use ${expectedMethod === 'bank' ? 'bank transfer' : 'cash'} for this allowance account.`);
  const paymentDate = dateValue(data.paymentDate); check(paymentDate <= today, 'Actual payment cannot be dated in the future.');
  const transferProofUri = String(data.transferProofUri || '').trim();
  check(!transferProofUri || transferProofUri.length <= 1000 && /^https:\/\//.test(transferProofUri), 'Use an HTTPS transfer proof link.');
  return { paymentMethod: data.paymentMethod, paymentDate, referenceNumber: textValue(data.referenceNumber, data.paymentMethod === 'cash' ? 'Cash acknowledgment' : 'Bank reference', 200), transferProofUri: data.paymentMethod === 'bank' ? transferProofUri : '' };
}
