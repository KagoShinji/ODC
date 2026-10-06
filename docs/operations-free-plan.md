# Demo Scheduling and Allowances on Firebase Spark

Both modules default to direct Firebase Auth + Firestore transactions. Cloud Functions, Firebase Storage and a Blaze subscription are not required. The implementation is local; production rules/indexes and the website build still need publishing.

## Activate in production

1. Use Node 22 and `npm ci` in the root. Keep Firebase project `odc-website-ce8bf` and the existing website hosting process.
2. Set the frontend build environment:

   ```dotenv
   VITE_OPERATIONS_BACKEND=firestore
   VITE_SUPERADMIN_EMAIL=superadmin@odc.com
   ```

   Keep the existing Firebase web configuration. Emulator settings must remain disabled in production. An App Check key is not required by this free-mode implementation.
3. Verify the superadmin's Auth UID remains `USkc70WnqpUV4Oq0ppPpdm2E4Fa2`. The UID in the rules provides operations authority; changing the frontend email setting cannot grant it. This UID is public configuration, not a credential.
4. Review and publish only Firestore rules and indexes:

   ```powershell
   npx.cmd firebase deploy --project odc-website-ce8bf --only "firestore:rules,firestore:indexes"
   ```

   This is a production deployment command. Review any index deletion prompt. The CLI account needs project deployment permissions; the application superadmin role does not grant Firebase console/IAM access. Wait for indexes to finish building.
5. Run `npm run build` and publish using the existing hosting process. Set the same backend environment value on the hosting provider. Vite embeds environment settings during the build.
6. Sign into `/odc` as `superadmin@odc.com`. Open **Demo Scheduling → Settings** and **Allowances & Requisitions → Settings**, enable each module and confirm its policy.
7. Assign actions in **Staff Management → Create/Edit Staff → Page & Action Permissions**. Newly created portal accounts are linked automatically. Older accounts are linked automatically when their saved login credential works; otherwise the staff member must sign in once before their module grants can be assigned. Inactive staff cannot use either module.

Do not deploy Functions or Storage for this activation. Previous optional Functions instructions are archived separately.

Staff permissions are edited only in Staff Management. Module Settings retains operational configuration: booking rules and the administrator's own presenter profile for demonstrations, policy activation and allowance account setup for allowances. Permission grants do not automatically publish availability or fund an allowance account.

For older accounts without a login link, Staff Management verifies the existing login automatically when its saved credential still works. If it cannot verify the login, have the staff member sign out and sign back in at `/odc`, then reopen their record and save permissions again. Their sign-in creates the UID link; it does not grant module access by itself. Duplicate login links or a changed login email require resolving the record mismatch before permissions can be assigned.

## Operation and limits

| Capability | Free Firestore mode |
| --- | --- |
| Demo bookings, rescheduling, reassignment, cancellation and outcomes | Supported; conflicts protected by atomic slot reservations |
| Presenter weekly hours, specific date windows and closed dates | Supported; changes cannot exclude confirmed meetings |
| Live in-app booking/change notifications | Supported; retained for the next sign-in |
| Background reminders/email while the app is closed | Requires the future backend and a delivery provider |
| Allowance funding, meetings, liquidation, review, requisitions and releases | Supported; transactions, immutable history and linked invoice expenses |
| Evidence | Receipt/voucher references and optional private HTTPS links; no Storage uploads |
| Expense limits | Three expense lines and three prepared references per meeting; one reference per line |

Presenters with confirmed meetings can expand weekly hours; use date overrides to reduce hours or close a date. Finish, cancel or reassign affected bookings before removing reserved times or presenter access. Superadmin can enable their own presenter profile in Settings, then publish availability.

Allowances start at zero until Finance records an actual release. Default policy is PHP 2,000 target float, PHP 1,000 total per meeting including fuel, PHP 200 single-meeting fuel allocation, PHP 400 daily fuel allocation for at least two held meetings, 70% depletion for early requests and a planned meeting within seven days. Each account keeps its setup policy version. Amounts are stored as integer centavos.

Keep original evidence in team records. External evidence links need their own access controls. Shared fuel references are limited to the same account/date and cannot be allocated beyond their full registered purchase amount. Another authorized reviewer must approve submissions. A cash discrepancy creates a reconciliation hold; correcting an expense requires confirmed physical recovery.

The three-line limit keeps the financial checks inside Firestore rule limits. Rules enforce live status/email, module actions, ownership, workflow transitions, balanced cash updates, fuel caps and protected expenses. Every command is linked to a new immutable operation and audit event. Stable command IDs prevent duplicate bookings or releases on retries. Staff document writes now require the configured root UID or Staff Management action permissions.

## Local checks

Install root dependencies and use Node 22:

```powershell
npm.cmd run lint
npm.cmd run build
```

For local browser development, use Java 21 and start the Firebase Auth and Firestore emulators:

```powershell
npx.cmd firebase emulators:start --project demo-odc --only auth,firestore
```

Set `VITE_FIREBASE_EMULATORS=true` and `VITE_FIREBASE_PROJECT_ID=demo-odc` before starting Vite for local browser development. Never include emulator settings in a production build.

See [the backend migration guide](operations-backend-migration.md) for option 2. Previous optional Functions instructions are preserved in [allowances-functions-setup.md](allowances-functions-setup.md) and [demo-scheduling-functions-setup.md](demo-scheduling-functions-setup.md).
