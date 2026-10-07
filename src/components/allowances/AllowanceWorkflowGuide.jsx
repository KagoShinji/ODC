import { useState } from 'react';
import { ArrowRight, MapPin } from '@phosphor-icons/react';
import { peso } from '../../utils/allowanceDocuments';

const sectionLabels = {
  overview: 'Overview',
  meetings: 'Meetings',
  liquidations: 'Liquidations',
  requisitions: 'Requisitions',
  history: 'History',
  settings: 'Settings',
};

export default function AllowanceWorkflowGuide({ access, enabled, policy, capabilities = {}, onNavigate, onOpenStaff, onClose }) {
  const actions = access?.actions || [];
  const manager = actions.includes('allowances:manage');
  const [requestedTopic, setRequestedTopic] = useState('workflow');
  const target = peso(policy?.targetCentavos ?? 200000);
  const meetingCap = peso(policy?.meetingCapCentavos ?? 100000);
  const singleFuel = peso(policy?.singleFuelCentavos ?? 20000);
  const dailyFuel = peso(policy?.dailyFuelCentavos ?? 40000);
  const threshold = policy?.thresholdPercent ?? 70;
  const meetingWindow = policy?.impendingDays ?? 7;

  const topics = [
    {
      id: 'workflow', label: 'Full workflow', title: 'From allowance setup to replenishment', section: 'overview', action: 'Open overview',
      steps: [
        ['Administrator', 'Set the policy and permissions', `Configure the target float, expense limits, fuel treatment, ${threshold}% depletion threshold, and the upcoming-meeting window. Assign each person only the actions required for their role.`, { section: 'settings', modal: 'policy', capability: 'policy', label: 'Configure policy', fallback: 'Open settings' }],
        ['Administrator', 'Create the staff allowance account', 'Create an account for an active staff member who already has Allowances & Requisitions access. Set the scheduled replenishment date. A new account starts pending setup with zero cash.', { section: 'settings', modal: 'account', capability: 'createAccount', label: 'Create account', fallback: 'Open settings' }],
        ['Finance', 'Record the initial release', `Record the money actually handed over or transferred, including the payment date, method, and acknowledgment or reference number. This funds and activates the account; the normal target is ${target}.`, { section: 'overview', modal: 'release', capability: 'initialRelease', label: 'Record initial release', fallback: 'Open overview' }],
        ['Staff', 'Record every client meeting', 'Create the meeting before or after it occurs, identify the client and purpose, and keep the status accurate: planned, held, or cancelled. A liquidation can be submitted only for a held meeting.', { section: 'meetings', modal: 'meeting', capability: 'newMeeting', label: 'Record meeting', fallback: 'Open meetings' }],
        ['Staff', 'Submit the liquidation', 'After the meeting, enter each expense, attach or register the receipts and vouchers, declare the money left on hand, and submit. Submit a no-expense liquidation when nothing was spent.', { section: 'meetings', label: 'Find held meeting' }],
        ['Operations', 'Review the liquidation', 'A different authorized person checks the evidence, allocations, totals, limits, and declared cash. Operations approves a valid slip or returns it with a reason for correction.', { section: 'liquidations', filter: 'submitted', label: 'Open submitted slips' }],
        ['Staff', 'Request replenishment when eligible', `Use Scheduled when the account's replenishment date has arrived. Use Early only after at least ${threshold}% depletion and link a planned meeting within ${meetingWindow} days. Request only the top-up required to restore the float.`, { section: 'requisitions', modal: 'requisition', capability: 'newRequisition', label: 'New requisition', fallback: 'Open requisitions' }],
        ['Finance', 'Approve and release separately', 'Finance approves, returns, or rejects the requisition. Approval records the decision but does not move money. After payment, Finance records the exact actual release and the next scheduled replenishment date.', { section: 'requisitions', filter: 'submitted', label: 'Review requisitions' }],
        ['Finance / Administrator', 'Close exceptions and audit the ledger', 'Resolve cash discrepancies before replenishment, record cash returns, correct approved expenses only after recovering the difference, and use History for the immutable ledger and action trail.', { section: 'history', label: 'Open history' }],
      ],
    },
    {
      id: 'setup', label: 'Admin setup', title: 'Prepare the module and each allowance account', section: 'settings', action: 'Open settings',
      steps: [
        ['Administrator', 'Configure and enable the policy', `Review the ${target} target float, ${meetingCap} per-meeting cap, ${singleFuel} standalone fuel allocation, ${dailyFuel} daily fuel allocation for multiple meetings, depletion threshold, and meeting window. Confirm and enable the policy.`, { section: 'settings', modal: 'policy', capability: 'policy', label: 'Configure policy', fallback: 'Open settings' }],
        ['Administrator', 'Assign module access', 'In Staff Management, edit the staff record and enable Allowances & Requisitions. Staff normally receives Record Meetings, Submit Liquidation, and Request Replenishment. Operations receives Review Liquidations. Finance receives approval, release, reporting, and correction actions.', { staff: true, label: 'Open Staff Management' }],
        ['Administrator', 'Create an allowance account', 'Return to Settings and choose Create allowance account. Select an active, permitted staff member and set the scheduled replenishment date. One account is tied to one staff login.', { section: 'settings', modal: 'account', capability: 'createAccount', label: 'Create account', fallback: 'Open settings' }],
        ['Finance', 'Fund the account', 'Open the account in Overview and select Record initial release. Enter the amount actually provided, payment method, payment date, and the supporting cash acknowledgment, voucher, or bank reference.', { section: 'overview', modal: 'release', capability: 'initialRelease', label: 'Record initial release', fallback: 'Open overview' }],
        ['Administrator', 'Check the active state', 'The account must be funded and active before staff can record expenses or submit a replenishment request. Use Manage account to suspend or close it when required; closing also requires a settled balance and no open slips.', { section: 'overview', modal: 'account', capability: 'manageAccount', withAccount: true, label: 'Manage account', fallback: 'Open overview' }],
      ],
    },
    {
      id: 'staff', label: 'Staff process', title: 'Record meetings and account for spending', section: 'meetings', action: 'Open meetings',
      steps: [
        ['Staff', 'Record the meeting', 'Open Meetings and choose New meeting. Select or enter the client, meeting date, purpose, and current status. Use Planned for an upcoming meeting and Held once it has happened.', { section: 'meetings', modal: 'meeting', capability: 'newMeeting', label: 'New meeting', fallback: 'Open meetings' }],
        ['Staff', 'Keep each meeting separate', `The total claimed for one meeting cannot exceed ${meetingCap}, including its fuel share. If several meetings share one fuel purchase, register the full receipt once and allocate only each meeting's permitted share.`, { section: 'meetings', label: 'View meetings' }],
        ['Staff', 'Open the liquidation', 'For a held meeting, select Liquidate or Submit liquidation. Add each expense description, category, and amount. Attach or register the receipt or voucher allowed by the current backend.', { section: 'meetings', label: 'Find held meeting' }],
        ['Staff', 'Declare physical cash', 'Count the actual money left after the meeting and enter it exactly. The system compares this amount with the ledger. A mismatch creates a reconciliation hold for Operations.', { section: 'meetings', label: 'Open meetings' }],
        ['Staff', 'Submit or save a draft', 'Save a draft when evidence or figures are incomplete. Submit only when the slip is ready for independent review. If Operations returns it, open Revise, address the review note, and submit it again.', { section: 'liquidations', filter: 'returned', label: 'Check returned slips' }],
      ],
    },
    {
      id: 'liquidation', label: 'Operations review', title: 'Review liquidations and handle discrepancies', section: 'liquidations', action: 'Open liquidations',
      steps: [
        ['Operations', 'Find submitted slips', 'Open Liquidations and filter by Submitted. The reviewer cannot approve their own liquidation, so assign review permission to a separate Operations account.', { section: 'liquidations', filter: 'submitted', label: 'Open submitted slips' }],
        ['Operations', 'Check the meeting and evidence', 'Open View evidence. Confirm the meeting occurred, every line has appropriate support, shared fuel allocations use the correct receipt, and the same purchase has not been over-allocated.', { section: 'liquidations', filter: 'submitted', label: 'View submitted evidence' }],
        ['Operations', 'Check policy limits and cash', `Verify the full meeting total is within ${meetingCap}. Confirm the fuel portion follows the configured ${singleFuel} standalone or ${dailyFuel} multiple-meeting daily treatment, and compare declared cash with the calculated balance.`, { section: 'liquidations', filter: 'submitted', label: 'Review submitted slips' }],
        ['Operations', 'Approve or return', 'Approve only after confirming evidence, totals, and declared cash. Return an incomplete or incorrect slip with a specific reason so staff knows what to revise. Approval posts spending to the reviewed balance and ledger.', { section: 'liquidations', filter: 'submitted', label: 'Open review queue' }],
        ['Operations / Administrator', 'Reconcile a cash mismatch', 'If the system shows Cash discrepancy requires reconciliation, first resolve all pending liquidations. Verify physical cash against the ledger and document the reason. Replenishment stays blocked until the hold is cleared.', { section: 'overview', modal: 'reconcile', capability: 'reconcile', withAccount: true, label: 'Verify cash', fallback: 'Open overview' }],
      ],
    },
    {
      id: 'replenishment', label: 'Replenishment', title: 'Request, approve, and release a top-up', section: 'requisitions', action: 'Open requisitions',
      steps: [
        ['Staff', 'Choose the correct request type', `Choose Scheduled when the stored replenishment date has arrived. Choose Early only when at least ${threshold}% of the reviewed float is depleted and a planned client meeting falls within ${meetingWindow} days.`, { section: 'requisitions', modal: 'requisition', capability: 'newRequisition', label: 'New requisition', fallback: 'Open requisitions' }],
        ['Staff', 'Complete the requisition slip', 'Link the upcoming meeting when requesting early replenishment. Enter the reason, requested amount, and money left on hand. The requested amount cannot exceed the top-up needed to restore the target float.', { section: 'requisitions', modal: 'requisition', capability: 'newRequisition', label: 'Complete requisition', fallback: 'Open requisitions' }],
        ['Staff', 'Submit or retain a draft', 'A draft remains editable and does not enter the approval queue. Submission verifies eligibility, cash, and open-request rules. Only one active replenishment request can exist for an account.', { section: 'requisitions', filter: 'draft', label: 'View drafts' }],
        ['Finance', 'Review the request', 'A different authorized Finance user checks the reason, balance snapshot, eligibility, and amount. Approve a valid request, return it for revision, or reject it with a clear reason.', { section: 'requisitions', filter: 'submitted', label: 'Open approval queue' }],
        ['Finance', 'Record the actual release', 'Approval alone does not add funds. After the money is actually handed over or transferred, select Record release and enter the required reference and next scheduled replenishment date. Release the exact approved amount.', { section: 'requisitions', filter: 'approved', label: 'Find approved requests' }],
        ['Everyone', 'Confirm completion', 'The request becomes Released, the reviewed balance increases, the active request closes, and the ledger records the replenishment. The new scheduled date controls the next Scheduled request.', { section: 'history', label: 'Confirm in history' }],
      ],
    },
    {
      id: 'controls', label: 'Controls & history', title: 'Correct records without erasing the audit trail', section: 'history', action: 'Open history',
      steps: [
        ['Finance', 'Record cash returned', 'Use Record cash return only after money is physically returned to Finance. Resolve pending slips and active requests first, then document the amount and acknowledgment.', { section: 'overview', modal: 'return', capability: 'cashReturn', withAccount: true, label: 'Record cash return', fallback: 'Open overview' }],
        ['Finance', 'Correct an approved expense', 'Use Correct on an approved liquidation when an audited amount must be reduced. Recover the difference first, enter the corrected expense and fuel portions, and confirm physical recovery. The original slip remains preserved.', { section: 'liquidations', filter: 'approved', label: 'Find approved slips' }],
        ['Administrator / Operations', 'Clear a reconciliation hold', 'Resolve all pending liquidations, compare physical cash with the reviewed ledger balance, correct or return funds where needed, then use Verify cash with a written reconciliation note.', { section: 'overview', modal: 'reconcile', capability: 'reconcile', withAccount: true, label: 'Verify cash', fallback: 'Open overview' }],
        ['Administrator', 'Suspend or close an account', 'Suspend an account to stop new activity while retaining its records. Close it only after the balance is settled, open slips and requests are resolved, and no unresolved items remain.', { section: 'overview', modal: 'account', capability: 'manageAccount', withAccount: true, label: 'Manage account', fallback: 'Open overview' }],
        ['Finance / Auditor', 'Use the ledger and action history', 'History shows funding, approved spending, replenishments, returns, and corrections. Export the loaded ledger for reconciliation, and use action history to see who changed each record and why.', { section: 'history', label: 'Open ledger and history' }],
      ],
    },
    {
      id: 'permissions', label: 'Roles & access', title: 'Assign the right actions to each role', section: null,
      steps: [
        ['Staff', 'Participant actions', 'Record Meetings, Submit Liquidation, and Request Replenishment let an allowance holder document meetings, account for spending, and request a top-up for their own account.', { staff: true, label: 'Set staff access' }],
        ['Operations', 'Independent review', 'Review Liquidations allows Operations to check another staff member’s receipts, totals, and cash declaration, then approve or return the slip.', { staff: true, label: 'Set Operations access' }],
        ['Finance', 'Approval and custody actions', 'Approve Requisitions controls the approval decision. Record Releases controls the actual movement of money. Allowance Reports exposes ledgers, while Correct Expenses records audited reductions and recovery.', { staff: true, label: 'Set Finance access' }],
        ['Administrator', 'Configuration authority', 'Manage Allowances controls policy, staff grants, and allowance accounts. Keep this permission limited because it can configure who participates in the workflow.', { staff: true, label: 'Set administrator access' }],
        ['Administrator', 'Account prerequisites', 'The staff record, portal login, module grant, and allowance account must all refer to the same active person. A checked legacy page permission alone cannot replace the trusted module grant.', { section: 'settings', label: 'Check allowance accounts' }],
      ],
    },
  ];

  const topic = topics.find(item => item.id === requestedTopic) || topics[0];
  const active = access?.active === true;
  const canOpenSection = section => active && section && (section !== 'settings' || manager);
  const resolveAction = destination => {
    if (!destination) return null;
    if (destination.staff) return onOpenStaff ? destination : null;
    if (!canOpenSection(destination.section)) return null;
    if (destination.modal && destination.capability && !capabilities[destination.capability]) {
      return { section: destination.section, filter: destination.filter, label: destination.fallback || `Open ${sectionLabels[destination.section]}` };
    }
    return destination;
  };
  const runAction = destination => {
    const resolved = resolveAction(destination);
    if (!resolved) return;
    if (resolved.staff) onOpenStaff();
    else onNavigate(resolved);
  };
  const quickLinks = [
    { section: 'overview', label: 'Overview' },
    { section: 'meetings', label: 'Meetings' },
    { section: 'liquidations', label: 'Liquidations' },
    { section: 'requisitions', label: 'Requisitions' },
    { section: 'history', label: 'History' },
    ...(manager ? [{ section: 'settings', label: 'Settings' }] : []),
  ];
  const topicDestination = topic.section && canOpenSection(topic.section) ? { section: topic.section, label: topic.action } : null;

  return <div>
    <p className="max-w-[68ch] text-[13px] leading-[1.65] text-[#aaa]">Use this guide as the operating procedure for staff allowance accounts. Amounts shown below follow the currently loaded policy and may differ between account policy versions.</p>
    <div className="my-[18px] flex flex-wrap gap-2 max-[520px]:grid max-[520px]:grid-cols-1" role="note">
      <span className="rounded-full border border-white/9 px-2.5 py-1.5 text-[10px] text-[#999] max-[520px]:rounded-[7px]">Module <strong className="font-semibold text-[#ddd]">{enabled ? 'enabled' : 'paused'}</strong></span>
      <span className="rounded-full border border-white/9 px-2.5 py-1.5 text-[10px] text-[#999] max-[520px]:rounded-[7px]">Target float <strong className="font-semibold text-[#ddd]">{target}</strong></span>
      <span className="rounded-full border border-white/9 px-2.5 py-1.5 text-[10px] text-[#999] max-[520px]:rounded-[7px]">Early request <strong className="font-semibold text-[#ddd]">{threshold}% depleted</strong></span>
    </div>
    <div className="mt-[18px] grid grid-cols-[34px_minmax(0,1fr)] items-start gap-[11px] rounded-[9px] border border-[#d9a66a]/22 bg-[#d9a66a]/4 px-[14px] py-[13px] text-[#d9a66a] max-[520px]:grid-cols-[28px_minmax(0,1fr)] max-[520px]:p-3" role="note">
      <MapPin className="mt-px" size={18} aria-hidden="true" />
      <div><strong className="block text-xs text-[#e8d0b4]">This guide can take you there</strong><p className="mt-[3px] text-[11px] leading-[1.55] text-[#a9a099]">Use a step action or jump to a workspace below. The guide will close and open the correct section, filter, or form.</p></div>
    </div>
    <nav className="mt-3 mb-5 flex flex-wrap items-center gap-1.5 border-b border-white/9 pb-4 max-[520px]:items-stretch" aria-label="Go directly to an allowance workspace">
      <span className="mr-[3px] text-[9px] font-semibold uppercase tracking-[0.1em] text-[#777] max-[520px]:mb-0.5 max-[520px]:w-full">Go to</span>
      {quickLinks.map(item => <button type="button" key={item.section} className="!min-h-[30px] !border-white/7 !bg-transparent !px-[9px] !py-1.5 !text-[10px] !text-[#aaa] hover:!border-[#d9a66a]/20 hover:!bg-[#d9a66a]/4 hover:!text-[#e4c39d] max-[520px]:flex-1" onClick={() => onNavigate(item)}>{item.label}<ArrowRight className="opacity-70" size={12} /></button>)}
    </nav>
    <nav className="my-5 flex gap-[7px] overflow-x-auto border-y border-white/9 py-[14px]" aria-label="Allowance workflow guide topics">
      {topics.map(item => <button type="button" key={item.id} className={`min-h-[38px] shrink-0 whitespace-nowrap ${topic.id === item.id ? '!border-[#d9a66a]/27 !bg-[#d9a66a]/6 !text-[#d9a66a]' : ''}`} aria-pressed={topic.id === item.id} onClick={() => setRequestedTopic(item.id)}>{item.label}</button>)}
    </nav>
    <section aria-labelledby="allowance-guide-topic-title">
      <h3 id="allowance-guide-topic-title" className="mt-[26px] mb-3 text-lg">{topic.title}</h3>
      <ol className="mt-[18px] mb-[30px] grid list-none gap-0 p-0" role="list">
        {topic.steps.map(([role, title, description, destination], index) => {
          const stepAction = resolveAction(destination);
          return <li key={`${role}-${title}`} className="grid grid-cols-[32px_minmax(0,1fr)] gap-[14px] border-b border-white/7 py-[18px] max-[520px]:grid-cols-[28px_minmax(0,1fr)] max-[520px]:gap-2.5">
            <span className="grid size-[30px] place-items-center rounded-full border border-[#d9a66a]/26 text-[11px] font-semibold text-[#d9a66a] max-[520px]:size-[26px]" aria-hidden="true">{index + 1}</span>
            <div className="min-w-0">
              <span className="mb-[5px] inline-flex text-[9px] font-semibold uppercase tracking-[0.09em] text-[#d9a66a]">{role}</span><h4 className="mt-0 mb-[5px] text-sm">{title}</h4><p className="m-0 [overflow-wrap:anywhere] text-[13px] leading-[1.65] text-[#aaa]">{description}</p>
              {stepAction && <button type="button" className="mt-[11px] !border-[#d9a66a]/18 !bg-[#d9a66a]/4 !px-[9px] !py-1.5 !text-[10px] !font-semibold !text-[#dcb17f] hover:!border-[#d9a66a]/35 hover:!bg-[#d9a66a]/7 hover:!text-[#f0d0aa] max-[520px]:w-full [&>svg]:transition-transform [&>svg]:duration-150 hover:[&>svg]:translate-x-0.5" onClick={() => runAction(destination)}>{stepAction.label}<ArrowRight size={13} /></button>}
            </div>
          </li>;
        })}
      </ol>
    </section>
    <section className="border-t border-white/11 pt-1" aria-labelledby="allowance-guide-help-title">
      <h4 id="allowance-guide-help-title" className="mt-[26px] mb-3 text-sm">Common blockers</h4>
      <details className="border-b border-white/7 py-[13px]"><summary className="cursor-pointer text-[13px] font-medium leading-normal marker:text-[#d9a66a] focus-visible:rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a66a]">Why can’t staff submit a liquidation?</summary><p className="max-w-[75ch] text-xs leading-[1.65] text-[#aaa]">The account must be active, the meeting must be marked Held, and the staff member needs Submit Liquidation permission. A draft or returned slip can be revised; an approved slip cannot be resubmitted.</p></details>
      <details className="border-b border-white/7 py-[13px]"><summary className="cursor-pointer text-[13px] font-medium leading-normal marker:text-[#d9a66a] focus-visible:rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a66a]">Why are Approve or Return actions missing?</summary><p className="max-w-[75ch] text-xs leading-[1.65] text-[#aaa]">The liquidation must be Submitted, and the reviewer needs Review Liquidations permission. The system prevents staff from reviewing their own slip. Requisition approval separately requires Approve Requisitions.</p></details>
      <details className="border-b border-white/7 py-[13px]"><summary className="cursor-pointer text-[13px] font-medium leading-normal marker:text-[#d9a66a] focus-visible:rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a66a]">Why is replenishment blocked?</summary><p className="max-w-[75ch] text-xs leading-[1.65] text-[#aaa]">Check the request type, scheduled date, depletion threshold, upcoming planned meeting, open request, declared cash, pending liquidations, and reconciliation hold. Approval also does not release funds; Finance must record the actual release.</p></details>
      <details className="border-b border-white/7 py-[13px]"><summary className="cursor-pointer text-[13px] font-medium leading-normal marker:text-[#d9a66a] focus-visible:rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a66a]">What does “Cash discrepancy requires reconciliation” mean?</summary><p className="max-w-[75ch] text-xs leading-[1.65] text-[#aaa]">The cash declared by staff did not match the ledger’s estimated cash. Resolve pending slips, verify the physical cash, record any return or approved correction, and then clear the hold with Verify cash.</p></details>
    </section>
    <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/11 pt-[18px] max-md:flex-col max-md:items-stretch">
      <div className="m-0 flex flex-wrap items-center gap-2">
        {topicDestination && <button type="button" onClick={() => runAction(topicDestination)}>{topicDestination.label}</button>}
        {topic.id === 'permissions' && onOpenStaff && <button type="button" onClick={onOpenStaff}>Open Staff Management</button>}
      </div>
      <button type="button" className="allowance-primary max-md:w-full" onClick={onClose}>Close guide</button>
    </div>
  </div>;
}
