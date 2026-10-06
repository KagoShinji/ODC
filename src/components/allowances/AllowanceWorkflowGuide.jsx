import { useState } from 'react';
import { peso } from '../../utils/allowanceDocuments';

export default function AllowanceWorkflowGuide({ access, enabled, policy, onNavigate, onOpenStaff, onClose }) {
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
        ['Administrator', 'Set the policy and permissions', `Configure the target float, expense limits, fuel treatment, ${threshold}% depletion threshold, and the upcoming-meeting window. Assign each person only the actions required for their role.`],
        ['Administrator', 'Create the staff allowance account', 'Create an account for an active staff member who already has Allowances & Requisitions access. Set the scheduled replenishment date. A new account starts pending setup with zero cash.'],
        ['Finance', 'Record the initial release', `Record the money actually handed over or transferred, including the payment date, method, and acknowledgment or reference number. This funds and activates the account; the normal target is ${target}.`],
        ['Staff', 'Record every client meeting', 'Create the meeting before or after it occurs, identify the client and purpose, and keep the status accurate: planned, held, or cancelled. A liquidation can be submitted only for a held meeting.'],
        ['Staff', 'Submit the liquidation', 'After the meeting, enter each expense, attach or register the receipts and vouchers, declare the money left on hand, and submit. Submit a no-expense liquidation when nothing was spent.'],
        ['Operations', 'Review the liquidation', 'A different authorized person checks the evidence, allocations, totals, limits, and declared cash. Operations approves a valid slip or returns it with a reason for correction.'],
        ['Staff', 'Request replenishment when eligible', `Use Scheduled when the account's replenishment date has arrived. Use Early only after at least ${threshold}% depletion and link a planned meeting within ${meetingWindow} days. Request only the top-up required to restore the float.`],
        ['Finance', 'Approve and release separately', 'Finance approves, returns, or rejects the requisition. Approval records the decision but does not move money. After payment, Finance records the exact actual release and the next scheduled replenishment date.'],
        ['Finance / Administrator', 'Close exceptions and audit the ledger', 'Resolve cash discrepancies before replenishment, record cash returns, correct approved expenses only after recovering the difference, and use History for the immutable ledger and action trail.'],
      ],
    },
    {
      id: 'setup', label: 'Admin setup', title: 'Prepare the module and each allowance account', section: 'settings', action: 'Open settings',
      steps: [
        ['Administrator', 'Configure and enable the policy', `Review the ${target} target float, ${meetingCap} per-meeting cap, ${singleFuel} standalone fuel allocation, ${dailyFuel} daily fuel allocation for multiple meetings, depletion threshold, and meeting window. Confirm and enable the policy.`],
        ['Administrator', 'Assign module access', 'In Staff Management, edit the staff record and enable Allowances & Requisitions. Staff normally receives Record Meetings, Submit Liquidation, and Request Replenishment. Operations receives Review Liquidations. Finance receives approval, release, reporting, and correction actions.'],
        ['Administrator', 'Create an allowance account', 'Return to Settings and choose Create allowance account. Select an active, permitted staff member and set the scheduled replenishment date. One account is tied to one staff login.'],
        ['Finance', 'Fund the account', 'Open the account in Overview and select Record initial release. Enter the amount actually provided, payment method, payment date, and the supporting cash acknowledgment, voucher, or bank reference.'],
        ['Administrator', 'Check the active state', 'The account must be funded and active before staff can record expenses or submit a replenishment request. Use Manage account to suspend or close it when required; closing also requires a settled balance and no open slips.'],
      ],
    },
    {
      id: 'staff', label: 'Staff process', title: 'Record meetings and account for spending', section: 'meetings', action: 'Open meetings',
      steps: [
        ['Staff', 'Record the meeting', 'Open Meetings and choose New meeting. Select or enter the client, meeting date, purpose, and current status. Use Planned for an upcoming meeting and Held once it has happened.'],
        ['Staff', 'Keep each meeting separate', `The total claimed for one meeting cannot exceed ${meetingCap}, including its fuel share. If several meetings share one fuel purchase, register the full receipt once and allocate only each meeting's permitted share.`],
        ['Staff', 'Open the liquidation', 'For a held meeting, select Liquidate or Submit liquidation. Add each expense description, category, and amount. Attach or register the receipt or voucher allowed by the current backend.'],
        ['Staff', 'Declare physical cash', 'Count the actual money left after the meeting and enter it exactly. The system compares this amount with the ledger. A mismatch creates a reconciliation hold for Operations.'],
        ['Staff', 'Submit or save a draft', 'Save a draft when evidence or figures are incomplete. Submit only when the slip is ready for independent review. If Operations returns it, open Revise, address the review note, and submit it again.'],
      ],
    },
    {
      id: 'liquidation', label: 'Operations review', title: 'Review liquidations and handle discrepancies', section: 'liquidations', action: 'Open liquidations',
      steps: [
        ['Operations', 'Find submitted slips', 'Open Liquidations and filter by Submitted. The reviewer cannot approve their own liquidation, so assign review permission to a separate Operations account.'],
        ['Operations', 'Check the meeting and evidence', 'Open View evidence. Confirm the meeting occurred, every line has appropriate support, shared fuel allocations use the correct receipt, and the same purchase has not been over-allocated.'],
        ['Operations', 'Check policy limits and cash', `Verify the full meeting total is within ${meetingCap}. Confirm the fuel portion follows the configured ${singleFuel} standalone or ${dailyFuel} multiple-meeting daily treatment, and compare declared cash with the calculated balance.`],
        ['Operations', 'Approve or return', 'Approve only after confirming evidence, totals, and declared cash. Return an incomplete or incorrect slip with a specific reason so staff knows what to revise. Approval posts spending to the reviewed balance and ledger.'],
        ['Operations / Administrator', 'Reconcile a cash mismatch', 'If the system shows Cash discrepancy requires reconciliation, first resolve all pending liquidations. Verify physical cash against the ledger and document the reason. Replenishment stays blocked until the hold is cleared.'],
      ],
    },
    {
      id: 'replenishment', label: 'Replenishment', title: 'Request, approve, and release a top-up', section: 'requisitions', action: 'Open requisitions',
      steps: [
        ['Staff', 'Choose the correct request type', `Choose Scheduled when the stored replenishment date has arrived. Choose Early only when at least ${threshold}% of the reviewed float is depleted and a planned client meeting falls within ${meetingWindow} days.`],
        ['Staff', 'Complete the requisition slip', 'Link the upcoming meeting when requesting early replenishment. Enter the reason, requested amount, and money left on hand. The requested amount cannot exceed the top-up needed to restore the target float.'],
        ['Staff', 'Submit or retain a draft', 'A draft remains editable and does not enter the approval queue. Submission verifies eligibility, cash, and open-request rules. Only one active replenishment request can exist for an account.'],
        ['Finance', 'Review the request', 'A different authorized Finance user checks the reason, balance snapshot, eligibility, and amount. Approve a valid request, return it for revision, or reject it with a clear reason.'],
        ['Finance', 'Record the actual release', 'Approval alone does not add funds. After the money is actually handed over or transferred, select Record release and enter the required reference and next scheduled replenishment date. Release the exact approved amount.'],
        ['Everyone', 'Confirm completion', 'The request becomes Released, the reviewed balance increases, the active request closes, and the ledger records the replenishment. The new scheduled date controls the next Scheduled request.'],
      ],
    },
    {
      id: 'controls', label: 'Controls & history', title: 'Correct records without erasing the audit trail', section: 'history', action: 'Open history',
      steps: [
        ['Finance', 'Record cash returned', 'Use Record cash return only after money is physically returned to Finance. Resolve pending slips and active requests first, then document the amount and acknowledgment.'],
        ['Finance', 'Correct an approved expense', 'Use Correct on an approved liquidation when an audited amount must be reduced. Recover the difference first, enter the corrected expense and fuel portions, and confirm physical recovery. The original slip remains preserved.'],
        ['Administrator / Operations', 'Clear a reconciliation hold', 'Resolve all pending liquidations, compare physical cash with the reviewed ledger balance, correct or return funds where needed, then use Verify cash with a written reconciliation note.'],
        ['Administrator', 'Suspend or close an account', 'Suspend an account to stop new activity while retaining its records. Close it only after the balance is settled, open slips and requests are resolved, and no unresolved items remain.'],
        ['Finance / Auditor', 'Use the ledger and action history', 'History shows funding, approved spending, replenishments, returns, and corrections. Export the loaded ledger for reconciliation, and use action history to see who changed each record and why.'],
      ],
    },
    {
      id: 'permissions', label: 'Roles & access', title: 'Assign the right actions to each role', section: null,
      steps: [
        ['Staff', 'Participant actions', 'Record Meetings, Submit Liquidation, and Request Replenishment let an allowance holder document meetings, account for spending, and request a top-up for their own account.'],
        ['Operations', 'Independent review', 'Review Liquidations allows Operations to check another staff member’s receipts, totals, and cash declaration, then approve or return the slip.'],
        ['Finance', 'Approval and custody actions', 'Approve Requisitions controls the approval decision. Record Releases controls the actual movement of money. Allowance Reports exposes ledgers, while Correct Expenses records audited reductions and recovery.'],
        ['Administrator', 'Configuration authority', 'Manage Allowances controls policy, staff grants, and allowance accounts. Keep this permission limited because it can configure who participates in the workflow.'],
        ['Administrator', 'Account prerequisites', 'The staff record, portal login, module grant, and allowance account must all refer to the same active person. A checked legacy page permission alone cannot replace the trusted module grant.'],
      ],
    },
  ];

  const topic = topics.find(item => item.id === requestedTopic) || topics[0];
  const active = access?.active === true;
  const canOpenSection = active && topic.section && (topic.section !== 'settings' || manager);

  return <div className="allowance-guide">
    <p className="allowance-guide-intro">Use this guide as the operating procedure for staff allowance accounts. Amounts shown below follow the currently loaded policy and may differ between account policy versions.</p>
    <div className="allowance-guide-state" role="note">
      <span>Module <strong>{enabled ? 'enabled' : 'paused'}</strong></span>
      <span>Target float <strong>{target}</strong></span>
      <span>Early request <strong>{threshold}% depleted</strong></span>
    </div>
    <nav className="allowance-guide-nav" aria-label="Allowance workflow guide topics">
      {topics.map(item => <button type="button" key={item.id} aria-pressed={topic.id === item.id} onClick={() => setRequestedTopic(item.id)}>{item.label}</button>)}
    </nav>
    <section aria-labelledby="allowance-guide-topic-title">
      <h3 id="allowance-guide-topic-title">{topic.title}</h3>
      <ol className="allowance-guide-steps" role="list">
        {topic.steps.map(([role, title, description], index) => <li key={`${role}-${title}`}>
          <span className="allowance-guide-number" aria-hidden="true">{index + 1}</span>
          <div><span className="allowance-guide-role">{role}</span><h4>{title}</h4><p>{description}</p></div>
        </li>)}
      </ol>
    </section>
    <section className="allowance-guide-faq" aria-labelledby="allowance-guide-help-title">
      <h4 id="allowance-guide-help-title">Common blockers</h4>
      <details><summary>Why can’t staff submit a liquidation?</summary><p>The account must be active, the meeting must be marked Held, and the staff member needs Submit Liquidation permission. A draft or returned slip can be revised; an approved slip cannot be resubmitted.</p></details>
      <details><summary>Why are Approve or Return actions missing?</summary><p>The liquidation must be Submitted, and the reviewer needs Review Liquidations permission. The system prevents staff from reviewing their own slip. Requisition approval separately requires Approve Requisitions.</p></details>
      <details><summary>Why is replenishment blocked?</summary><p>Check the request type, scheduled date, depletion threshold, upcoming planned meeting, open request, declared cash, pending liquidations, and reconciliation hold. Approval also does not release funds; Finance must record the actual release.</p></details>
      <details><summary>What does “Cash discrepancy requires reconciliation” mean?</summary><p>The cash declared by staff did not match the ledger’s estimated cash. Resolve pending slips, verify the physical cash, record any return or approved correction, and then clear the hold with Verify cash.</p></details>
    </section>
    <div className="allowance-guide-footer">
      <div className="allowance-controls">
        {canOpenSection && <button type="button" onClick={() => onNavigate(topic.section)}>{topic.action}</button>}
        {topic.id === 'permissions' && onOpenStaff && <button type="button" onClick={onOpenStaff}>Open Staff Management</button>}
      </div>
      <button type="button" className="allowance-primary" onClick={onClose}>Close guide</button>
    </div>
  </div>;
}
