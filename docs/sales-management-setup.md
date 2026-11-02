# Sales Management & KPI module

Sales Management extends the existing admin console (`/odc`) and the shared Task Board. It reuses the system's Firebase Auth login, the `staff` collection and Staff Management grants, the `tasks` collection, and the existing dialog and taskboard styles. Like Demo Scheduling and Allowances, it runs on the Spark plan: Firestore security rules enforce every permission and business rule.

## Activate

1. Review `firestore.rules` and `firestore.indexes.json`, then publish **only** rules and indexes. This is a production deployment, so run it deliberately:

   ```powershell
   npx.cmd firebase deploy --project odc-website-ce8bf --only "firestore:rules,firestore:indexes"
   ```

   Wait for the new indexes to finish building. Until they do, the reports may say an index is still being built.
2. Build and publish the website with the existing hosting process.
3. In **Staff Management → Edit staff → Page & Action Permissions**, enable the **Sales Management** page and grant the actions:

   | Role | Actions | Preset |
   | --- | --- | --- |
   | Sales Associate | `Sales Associate` (+ Task Board, Demo booking) | **Sales Associate** |
   | Operations Manager | `Manage Sales Team` (+ task management) | **Operations Manager** |
   | Founder / Superadmin | All four, including `Confirm Conversions` and `Sales Targets & Pipeline` | Superadmin has them automatically |

   The staff member must have signed in to `/odc` at least once so their login is linked (the same requirement as the other permission-checked modules).
4. Open **Sales Management → Sales targets**. The official defaults apply until you save your own: 100 leads per associate per week, 400 per month, 5% minimum conversion, and 10 conversions per week / 40 per month combined. Review the categories, reporting week start, timezone (default `Asia/Manila`) and task automation, then save.

## How the numbers are counted

- **Leads generated** are qualified leads created in the period. Leads that management marks as duplicates or not qualified are kept but excluded.
- Every lead is credited to the associate it was **first assigned to** (`attributedEmail`). Reassigning a lead moves the work, not the credit.
- **Contacted / responses / interested / consultations / quotations / lost** count distinct leads with a matching activity recorded in the period. Nothing is counted unless an employee logged it.
- **Converted clients** are deals whose down payment management *confirmed* in the period, split into conversions from this period's leads and from earlier lead cohorts.
- **Cohort conversion rate** is the share of the period's leads that have converted so far, whenever they converted. Monthly reports show both the cohort view and the calendar-month sales view.
- Negotiation never counts as a conversion. Only a confirmed deal (`salesDeals/{leadId}`, one per lead) turns a lead into Converted, and a confirmed deal is locked.

## Taskboard integration

- Sales tasks are ordinary `tasks` with `category: "sales"`. They show a **Sales** label on the Task Board (filterable) and are not viewable through public share links.
- Per-stage automation (Sales targets → Task automation) creates or suggests the next task when a lead changes stage. An open task for the same lead and step is never duplicated. New and Contacted default to *Suggest* because about 200 leads arrive each week.
- **Dashboard → Weekly work schedule** posts the Monday–Saturday schedule tasks for the week. Re-running it never creates duplicates.
- **Endorse to developer** posts a Sales task to the chosen developer's board.

## Notifications

- In-app notifications cover lead assignment, possible duplicates, consultations scheduled, conversion requests, and conversion approval or return.
- Follow-ups due, overdue sales tasks, quotations awaiting follow-up and the Saturday report reminder are derived live on the dashboard. Managers also see team-wide overdue counts.
- On the Blaze plan, `functions/src/sales.js` adds `sendSalesReminders` (daily 08:00) and `sendSalesWeeklySummary` (Saturday 18:00, Asia/Manila). These are not needed on Spark; deploy them only if the project moves to Blaze.
