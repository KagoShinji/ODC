# Demo Scheduling: free-plan setup

Demo Scheduling now defaults to Firebase Auth and direct Firestore transactions. Cloud Functions, Cloud Scheduler and a paid Firebase subscription are not required. Follow [the shared activation guide](operations-free-plan.md) to publish the rules, indexes and frontend.

Sign into /odc as superadmin@odc.com, open **Demo Scheduling → Settings**, and enable booking. Assign sales/presenter actions in **Staff Management → Create/Edit Staff → Page & Action Permissions**. New portal accounts link automatically. Older accounts are linked automatically when their saved login credential works; otherwise the staff member signs in once before assignment. Enable **Available for sales bookings** for presenters, then have each presenter publish hours in **My availability**. Superadmin can enable their own presenter profile in Settings.

Sales staff choose an available presenter/date/time and record the client's contact details and meeting link/location. The salesperson and presenter receive live in-app notifications. Authorized staff can reschedule, reassign, cancel and record outcomes. Sales see their own bookings unless granted team-calendar access. Dates/times use Asia/Manila.

Staff Management is the only staff permission editor. Demo Scheduling Settings contains booking rules and the administrator's own presenter profile, with a shortcut to Staff Management. Presenters publish their own hours in My availability.

Confirmed reservations cannot be removed by an availability closure. Weekly hours may expand while meetings are confirmed; use date overrides for reductions and closed dates. Finish, cancel or reassign affected meetings before removing presenter access. Background reminders/email are not included in free mode.

See [option 2 migration preparation](operations-backend-migration.md). Previous optional Functions deployment instructions are archived in [demo-scheduling-functions-setup.md](demo-scheduling-functions-setup.md), and do not apply to free-plan activation.
