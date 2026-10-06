# Allowances & Requisitions — Setup and Verification

The allowance module is implemented as an addition to the existing `/odc` admin system. The public site, client portal, invoices, salaries and other admin modules retain their routes and collections.

The implementation includes account setup and actual funding, meetings, itemized liquidation, private receipts/vouchers, returned revisions, Operations review, early/scheduled requisitions, approval, actual release recording, cash return/reconciliation, audited expense reductions, print/PDF slips, CSV ledger export, and access management.

## Production activation

The code is implemented and locally tested. Production Firebase resources have **not** been deployed or modified by this implementation task. Deploying the frontend alone does not activate this feature.

1. Use the existing Firebase project associated with this system. Verify its Storage bucket and Functions availability. Keep the current Vite/Vercel hosting arrangement.
2. Install the locked packages using `npm ci` in the root and `npm ci --prefix functions`. Cloud Functions is configured for Node 22 and `asia-southeast1`.
3. Configure App Check for the web application. Set `VITE_FIREBASE_APPCHECK_SITE_KEY` to the registered reCAPTCHA v3 public site key; keep `VITE_FIREBASE_STORAGE_BUCKET` pointing at the real bucket. `VITE_FIREBASE_FUNCTIONS_REGION` defaults to `asia-southeast1`.
4. Configure the server-side `ALLOWANCE_ADMIN_UIDS` parameter with the Firebase Auth UIDs of designated allowance administrators. The deployment prompt can set this parameter; alternatively use `functions/.env.<project-id>` and keep it ignored. Never use the frontend `VITE_SUPERADMIN_EMAIL` list as backend financial authority. At least one bootstrap administrator must also be able to enter the existing admin system.
5. Review and deploy `firestore.rules`, `firestore.indexes.json`, `storage.rules`, and the `allowances` Functions codebase to the selected project:

   ```text
   npx firebase deploy --project <existing-project-id> --only firestore:rules,firestore:indexes,storage,functions:allowances
   ```

   This is a production command: do not use `demo-odc` for deployment. Wait until the composite indexes are ready. When Firebase requests permission for Storage rules to read Firestore, enable the connection. The upload rules use only the trusted access document and upload manifest, respecting the two-document limit documented in [Firebase Storage rules](https://firebase.google.com/docs/storage/security/rules-conditions).

6. Configure bucket CORS for authenticated browser downloads from the actual frontend origin. Use exact deployed origins, not a wildcard. A configurable template is at `docs/allowances-storage-cors.example.json`. For example, after substituting your actual origin and bucket:

   ```text
   gcloud storage buckets update gs://<existing-storage-bucket> --cors-file=<reviewed-cors-file.json>
   ```

   Authenticated SDK downloads require CORS; see [Firebase download documentation](https://firebase.google.com/docs/storage/web/download-files). No public download-token URL is created by this module.

7. Deploy the frontend using the existing project workflow. Open **Allowances & Requisitions → Settings**, confirm the policy, and enable the feature. It starts inactive in a new project.
8. Assign access through **Staff Management → Create/Edit Staff → Page & Action Permissions → Allowances & Requisitions**, or use **Manage staff allowance access** in the module settings. The integrated editor supports Full Access, Sales, Finance & Operations, individual actions and view-only access. Only a trusted allowance administrator can change these grants. The backend resolves and verifies the login UID and refuses duplicate email mappings. A disabled staff account cannot receive an active grant. Deploy the shared `staffModulePermissions` endpoint along with the existing backend; legacy staff document fields alone do not grant financial authority.
9. Create an allowance account with a deliberate scheduled replenishment date. Finance separately records its actual initial cash or bank release. A new account starts at zero, not an assumed PHP 2,000.
10. Pilot with a participant, another Operations reviewer, and an authorized approver/releaser. Reconcile physical opening cash before recording it. Test a private receipt download, both slip print views, the review process, and a replenishment release.

Deployed functions: `allowanceContext`, `allowanceCommand`, `cleanupAllowanceDraftUploads`, `revokeSuspendedAllowanceAccess`, and the shared `staffModulePermissions` endpoint. Production callable endpoints enforce Auth and App Check. App Check enforcement is bypassed only by the server's local Functions emulator environment.

### Superadmin sees a connection or setup error

The existing superadmin account can open the new module, but the module needs a deployed allowance backend before it can verify access. A connection error is not a permission decision. The screen now reports an unavailable service separately from a successful access check that returns no grant.

For this workspace's configured project, `odc-website-ce8bf`, the `asia-southeast1` `allowanceContext` endpoint returned HTTP 404 during the October 5, 2026 diagnostic check. The local `.env` also has no `VITE_FIREBASE_APPCHECK_SITE_KEY`. The read-only Firebase check returned HTTP 403 with two explicit reasons:

- `SERVICE_DISABLED`: the Cloud Functions API has not been enabled, or it is disabled. A project administrator must enable it in the [project's Cloud Functions API settings](https://console.developers.google.com/apis/api/cloudfunctions.googleapis.com/overview?project=odc-website-ce8bf).
- `USER_PROJECT_DENIED`: the current CLI account lacks `serviceusage.services.use` for this project. Use a Google account with the project's deployment permissions. The application superadmin role does not grant Google Cloud IAM permissions. Granting Service Usage Consumer addresses this specific service-usage error, but does not by itself provide all deployment permissions.

No production deployment was attempted. Complete production activation with an account authorized for that Firebase project; confirm the Functions region matches the frontend build.

Once the backend is reachable and App Check is configured, include the designated superadmin's **Firebase Auth UID** in the server-side `ALLOWANCE_ADMIN_UIDS` parameter. The existing frontend `VITE_SUPERADMIN_EMAIL` setting controls legacy navigation; it does not bootstrap financial authority on the server. Then refresh, configure the policy in Settings, and enable the feature. Do not remove authentication or App Check to work around a setup error.

Configured bootstrap administrators receive every allowance action and a grant with an empty `staffId`. Their administrator access is independent of an old suspended or deleted staff record. Local emulator verification covered full administrator grants, settings changes, rejection of ungranted users, and reads through the browser Firestore rules. Configure `DEMO_ADMIN_UIDS` separately when the same account also administers demonstration scheduling.

## Default policy and operation

- PHP 2,000 target float; PHP 1,000 maximum combined spending per meeting, including fuel.
- PHP 200 standalone-meeting fuel; PHP 400 maximum daily fuel when at least two meetings were actually held.
- Early replenishment requires at least 70% reviewed depletion and a planned meeting within the configured window (initial suggested value: seven days, explicitly confirmed during policy setup).
- Scheduled replenishment uses the account's explicit date. There is no automatically invented weekly/monthly schedule.
- A replenishment tops up the reviewed cash toward the target. Pending/returned spending and cash discrepancies block release.
- Submission records reported spending; approval records a company expense; approval of a requisition does not release money. Cash advances and top-ups remain outside company expense totals.
- A fuel line records its meeting allocation and selects a receipt with the full fuel purchase amount. Other meetings on that Manila date can select the same purchase. Allocations cannot exceed its total or the daily fuel cap. Duplicate identical fuel files are detected using Storage content hashes.
- Corrections reduce approved expenses only after recovering the difference. The original slip remains frozen, with reversal/replacement ledger history. Additional expenditure needs a separately reviewed meeting and evidence.
- Returning a slip does not restore spent cash. Discrepancies stay on hold until the ledger and physical cash agree.
- Suspending/deleting a legacy staff record revokes its feature grant through the server trigger. Reactivation requires a fresh explicit allowance grant. Account suspension is a separate control and preserves its records.

Policy changes apply to newly created accounts; existing accounts retain their policy snapshot. Existing invoice expense records linked to an allowance can only be corrected through the allowance workflow.

## Pre-push verification record

Before the standalone test files were removed for repository cleanup, the implementation passed 22 domain/billing/print checks, six Firestore/Storage rule checks, three callable SDK integration checks, and six browser checks. The production build was also exercised across 13 routes using Node 22. This record describes the completed verification; the test harness is not included in the repository.

For subsequent changes, run the checks that remain in the repository:

```text
npm run lint
npm run build
```

Two pre-existing defects were also fixed: monthly client billing did not return the next due date, and the admin sign-in field rejected supported usernames because it was typed as an email field.

History and review lists load 30 records at a time and expose Load more. CSV exports the loaded ledger, clearly labeled in the interface. Receipt lists are scoped to the selected slip plus shared fuel purchases on its date. The initial product has no automated bank transfers, OCR, email delivery, or receipt authenticity detection. No guarantee of production behavior is implied until the deployed services, real bucket CORS, App Check, grants, and opening balances are verified.

The missing `/grit.jpg` references and oversized application chunk notice were resolved before the final build. Compatible dependency fixes were applied; `npm audit` still reports an upstream Firebase Firestore gRPC finding, so audit output is not treated as a passing security certification.

## Disable or roll back

Use the policy setting to disable new allowance actions. Keep the backend collections, receipts, access rules and linked-expense protections. Authorized users can still read history when the feature is inactive. Restore a previous frontend build if needed; do not delete financial records or remove protective rules. Explicitly revoke an administrator's feature grant before removing its bootstrap UID from deployment configuration.
