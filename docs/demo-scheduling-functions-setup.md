# Demo scheduling

The `/odc` portal now includes **Demo Scheduling** with a sales booking flow, day/week calendar, presenter availability, date overrides, meeting details, rescheduling/reassignment, cancellation, outcomes, change history, live in-app notifications, and durable reminders.

## Activation in the existing Firebase project

Local implementation and testing do not activate the production backend. Keep the existing frontend hosting workflow. The scheduling functions share the existing `allowances` Functions codebase; do not rename it or delete its existing functions.

1. Use Node 22 and install the locked dependencies with `npm ci` and `npm ci --prefix functions`.
2. Configure the server parameter `DEMO_ADMIN_UIDS` with the Firebase Auth UIDs of scheduling administrators. At least one must be able to sign into the existing admin portal. `VITE_SUPERADMIN_EMAIL` controls legacy navigation only; it does not grant scheduling authority. Set the parameter through the Firebase deployment prompt or the existing ignored `functions/.env.<project-id>` configuration.
3. Configure Firebase App Check for the existing web application and set `VITE_FIREBASE_APPCHECK_SITE_KEY`. Callable functions enforce Auth and App Check in production. `VITE_FIREBASE_FUNCTIONS_REGION` defaults to `asia-southeast1` and must match deployment.
4. Ensure the selected Firebase project supports Cloud Functions and scheduled functions, including the Cloud Scheduler API. Deploy the reviewed rules, indexes, and functions to that project:

   ```text
   npx firebase deploy --project <existing-project-id> --only firestore:rules,firestore:indexes,functions:allowances
   ```

   This is a production deployment command. Do not deploy to `demo-odc`. Wait for all indexes to finish building. Frontend deployment alone cannot activate scheduling.
5. Deploy the frontend using the existing hosting workflow. Open **Demo Scheduling → Settings** as a configured administrator.
6. Grant staff access in **Staff Management → Create/Edit Staff → Page & Action Permissions** or **Demo Scheduling → Settings**. Enable **Demo Scheduling**, then choose **Book Demonstrations** for sales, **Present Demonstrations** for presenters, and optionally **View Team Calendar** or **Manage Scheduling**. **Available for sales bookings** lists presenters for scheduling; they must also publish their available hours. Full Access includes both scheduling and allowance permissions; Sales and Demo Presenter presets provide narrower access. The backend resolves the login UID and rejects disabled logins and duplicate staff emails. Only trusted scheduling administrators can change scheduling grants; legacy staff permissions alone cannot authorize these changes.
7. A founder/administrator without a staff record can use **Enable my presenter profile**. Each presenter opens **My availability**, reviews the suggested hours, and clicks **Publish availability**. Suggested hours are not bookable until published.
8. Review the booking rules and enable new bookings. The initial policy allows 30, 45, 60, 90 and 120 minutes, a 15-minute buffer, two hours' notice and a 30-day booking window. Booking begins paused.

Deployed endpoints: `demoContext`, `demoDashboard`, `demoAvailableSlots`, `demoBookingHistory`, `demoCommand`, `sendDemoReminders`, `revokeSuspendedDemoAccess`, and the shared `staffModulePermissions` endpoint.

The integrated staff editor loads current grants from the backend and rejects stale permission edits. Changes to both modules commit together with a server audit event. Staff details and login creation save first; if the grant request fails, the editor remains open with a clear error and retries against the same staff record. Module permission changes require the new endpoint to be deployed. Other staff permissions remain editable if this service is unavailable. Configured bootstrap administrator access is managed through server configuration rather than these checkboxes.

Firebase references: [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [App Check for callable functions](https://firebase.google.com/docs/app-check/cloud-functions), and [scheduled functions](https://firebase.google.com/docs/functions/schedule-functions).

## Scheduling behavior

- All dates and hours are explicitly Philippine time (`Asia/Manila`, UTC+8). Start/end instants are stored as UTC ISO timestamps.
- Weekly windows may contain up to four non-overlapping ranges per weekday, in 15-minute increments. A date override replaces that date's weekly windows. An empty override closes the whole day. To block part of a day, keep only the available ranges around the blocked hours. Remove the override to restore the weekly schedule.
- The full demonstration and its buffer must fit inside one available window. Meetings do not span midnight.
- Each booking has one presenter. **Any available presenter** shows the union of open times and assigns the eligible presenter with the fewest bookings on that date, with a stable UID tie-break. The selected presenter is shown before confirmation; a conflicting concurrent request produces a clear error and requires refreshing times.
- Reservations and bookings are written in one server transaction. Rescheduling reserves the replacement and releases the original atomically. Failed rescheduling preserves the original booking. A booking version prevents stale dialogs from changing a newer schedule. Submission keys make retries idempotent.
- Availability changes cannot invalidate a confirmed future or in-progress meeting. The error names affected meetings; use the calendar to reschedule, reassign, or cancel them before changing availability. Presenter access cannot be deliberately disabled while upcoming confirmed meetings remain assigned.
- `Confirmed`, `Completed`, `Cancelled`, and `No-show` are booking statuses. Rescheduling and reassignment increment the version and appear in change history. Only the presenter or a scheduling administrator can record outcomes, after the meeting's end.
- Sales see their own bookings and meetings assigned to them. Presenters see their assigned meetings. Full calendar visibility requires an explicit permission. Free-slot responses expose times and presenter names, not other clients' details.
- Booking and change notifications reach the salesperson and presenter. Reassignment also notifies the previous presenter. Notifications update live while signed in, and the sidebar shows unread count. The inbox shows the latest 50 updates; its unread count includes all unread updates. Calendar records refresh every 30 seconds, and access is rechecked every minute.
- Reminders are created for 24 hours and one hour before the meeting, when those times are still in the future. The worker runs every five minutes. Reminders carry a booking version, so cancelled/rescheduled meetings cannot generate obsolete messages. Deterministic notification IDs and transactions prevent duplicate delivery on worker retries. After an outage, due reminders may be caught up while the meeting is still in the future.
- Staff suspension blocks scheduling immediately through the live roster check and revokes feature access through a server trigger. Reactivation requires a fresh grant. Existing meetings stay recorded so an administrator can reassign them.
- Settings can pause new bookings and rescheduling while preserving access to existing meetings, cancellation, outcomes, and availability editing.

Email, SMS, external calendar synchronization, automatic video meeting creation, and client self-booking are not included. Online meetings require an existing HTTPS meeting link.

## Data and operational limits

Server-only collections are `demoAccess`, `demoSettings`, `demoAvailability`, `demoBookings`, `demoDays`, `demoAuditEvents`, `demoCommandResults`, and `demoReminders`. `demoNotifications` permits authenticated recipients to read their own notifications; all writes go through the server. No legacy financial collection is reused for scheduling records.

The calendar loads at most 200 meetings per selected range and reports truncation; switch to day view to narrow the range. Client selection loads the first 100 records, with manual prospect entry available. Admin settings load up to 500 staff/grant records; available presenters are limited to 200. Availability updates validate up to 500 upcoming confirmed meetings and stop with an error beyond that limit. Availability supports 120 date overrides; remove expired overrides when necessary. These are initial internal-team limits, not a public booking service's capacity guarantee.

## Local verification

```text
npm run lint
npm run build
```

For local browser development with the optional Functions backend, configure `DEMO_ADMIN_UIDS` with your local administrator's Auth UID in an ignored `functions/.env.local` file. Preserve any existing local settings. Ensure Java 21 and Node 22 are available, then start:

```text
npx firebase emulators:start --only auth,firestore,functions --project demo-odc
```

For browser development, set `VITE_FIREBASE_EMULATORS=true` and use a complete local Firebase configuration with project ID `demo-odc`. The legacy `VITE_ALLOWANCE_EMULATORS=true` flag also remains supported. Do not enable emulators against real project configuration. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

Production acceptance should include a sales account, a separate presenter, and an administrator: publish availability, book a real test meeting, receive notifications, reject a conflicting closure, reschedule/reassign, and verify reminders. No production resources were deployed or changed during local implementation.
