# Allowances & Requisitions: free-plan setup

Allowances now default to Firebase Auth and direct Firestore transactions. Cloud Functions, Firebase Storage and a paid Firebase subscription are not required. Follow [the shared activation guide](operations-free-plan.md) to publish the rules, indexes and frontend.

Sign into /odc as superadmin@odc.com, open **Allowances & Requisitions → Settings**, confirm the policy and enable the module. Assign actions in **Staff Management → Create/Edit Staff → Page & Action Permissions**. New portal accounts link automatically. Older accounts are linked automatically when their saved login credential works; otherwise the staff member signs in once before assignment.

Create the staff allowance account with a deliberate replenishment date. It starts at zero; Finance records the actual initial release and payment reference separately. Staff record held client meetings, save a draft, register receipt/voucher references and submit liquidation slips. The free version supports three expense lines and three prepared references per meeting, one reference per line. Optional private HTTPS links point to evidence already held by the team; this mode does not upload files to Firebase Storage.

Staff Management is the only staff permission editor. Allowance Settings contains policy activation and allowance account setup, with a shortcut to Staff Management. Granting access does not create or fund an allowance account.

A different reviewer approves or returns slips. Approval posts one protected invoice expense and updates the cash ledger. Returned slips can be revised. Staff submit eligible scheduled/early requisitions; another approver reviews them and Finance records the exact approved release once. Cash discrepancies create a reconciliation hold. Corrections require physically recovered cash and preserve ledger/audit history.

Default policy and receipt/fuel limits, local verification and deployment commands are in [the shared guide](operations-free-plan.md). See [option 2 migration preparation](operations-backend-migration.md). Previous optional Functions instructions are preserved in [allowances-functions-setup.md](allowances-functions-setup.md); they do not apply to this free-plan activation.
