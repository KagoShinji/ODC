# Option 2: Cloudflare Workers migration preparation

The frontend and shared workflow logic are prepared for an HTTPS backend. A Worker has **not** been provisioned or deployed. Its Firebase authentication, transactional repository and reminder delivery remain part of the future migration.

## Ready now

- `src/services/operations/backend.js` selects `firestore` (default), `http` or the optional existing `firebase-functions` adapter.
- `remoteOperations.js` sends the user's Firebase ID token over HTTPS and preserves payloads, command IDs and error codes. Forms use the same service interfaces.
- `functions/src/commands.js`, `demoCommands.js`, `domain.js` and `demoDomain.js` provide transport-independent workflow logic with a buffered repository contract.
- Existing Firestore collections, staff UID mappings, account balances, record IDs and invoice expense IDs remain reusable. No new database or UI rewrite is needed.

## HTTPS contract

Use `POST <api-base>/<operation-name>`, `Authorization: Bearer <Firebase ID token>`, and `Content-Type: application/json`.

```json
{ "data": { "command": "book", "payload": {}, "commandId": "stable-submission-key" } }
```

Success: `{ "data": { "id": "record-id" } }`. Errors: an appropriate HTTP status and `{ "error": { "code": "permission-denied", "message": "Access revoked" } }`.

| Operation | Input inside `data` |
| --- | --- |
| `demoContext`, `allowanceContext` | `{}` |
| `demoDashboard` | `{start, end}` |
| `demoAvailableSlots` | Date, duration, presenter and optional booking ID |
| `demoBookingHistory` | `{id}` |
| `demoCommand`, `allowanceCommand` | `{command, payload, commandId}` |
| `staffModulePermissions` | `{operation: "context"}` or `{operation: "save", staffId, changes}` |

Return the existing context/dashboard shapes, grants, permission revisions and capability flags. HTTP mode currently retains reference evidence and the three-line UI limit. Add a tested capability negotiation and upload adapter before increasing limits or enabling binary uploads.

## Required Worker work

1. Verify Firebase token signatures, project issuer/audience, expiry and subject using Google's published keys. Cache keys. Resolve authority from current staff/grant data and a server root UID. Never trust client UID, bootstrap flags, frontend emails or action lists.
2. Store service-account credentials only in Worker secrets. Implement authenticated Firestore REST begin/read/commit transactions with retries. Check SDK compatibility before choosing Firebase Admin SDK for Workers. Server credentials bypass rules; all server permission and business checks remain mandatory.
3. Resolve grant targets from trusted Firebase Auth data. Preserve immutable staff identities, reject duplicate mappings, disabled accounts, changed emails and conflicting account ownership, and keep permission revisions/audits.
4. Reuse the shared commands with a buffered repository. Preserve single slot reservation, idempotency, no self-approval, balanced account updates, receipt allocation, protected invoice expenses and immutable history.
5. Normalize typed `startsAt`/`endsAt` timestamps as canonical ISO booking instants. Existing allowance dates/timestamps also need wire conversion. Preserve or deliberately convert `demoDays.claims`, `demoPresenterState`, `demoAvailability.weeklySlots`, operation tags and per-reference fuel counters.
6. Restrict CORS to the frontend origin; require tokens on every API call; bound request/query sizes. Do not log tokens or evidence URLs.
7. Implement scheduled reminders separately with booking-version checks and duplicate-delivery protection. The HTTP adapter does not send messages. Provision an email/delivery provider and check its current free limits before activation.
8. Port the emulator workflow/security suite to the Worker repository. Verify booking and approval/release races, grant revocation, returned slips, corrections and repeated command IDs.

## Cutover

Take a backup/export and verify the API against a staging project. At cutover, deploy rules disabling direct browser financial/scheduling writes while preserving authenticated reads; commands and notification updates then go through the Worker. Avoid mixing old free-mode and server writers.

Build and publish with:

```dotenv
VITE_OPERATIONS_BACKEND=http
VITE_OPERATIONS_API_URL=https://<reviewed-worker-host>/operations
```

Verify root admin, sales, presenter and reviewer flows. Rollback to `firestore` requires data that still contains the canonical free-mode identity, slot, operation and fuel-counter metadata and fits its limits. Test any conversion first; do not switch a mixed live dataset directly back to client writes.
