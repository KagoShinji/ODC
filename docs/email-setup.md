# Email (@odysseyph.com) on Cloudflare

The website, the email API and inbound mail all run in one Cloudflare Worker (`worker/src/index.js`, config `wrangler.jsonc`).

| Piece | Service |
| --- | --- |
| Receiving | Cloudflare Email Routing → catch-all → this Worker |
| Sending | Mailjet Send API v3.1 (free plan is fine) |
| Messages | Cloudflare D1 database `odc-email` |
| Attachments and raw `.eml` | Cloudflare R2 bucket `odc-email-files` |
| Sign-in and permissions | Firebase Auth + the `staff` collection (unchanged) |

## Mailboxes

| Address | Use |
| --- | --- |
| `hello@` | Main inbox. Also receives any unknown address (`jetch@`, typos) |
| `sales@` | Leads, quotations, MOAs |
| `support@` | Tickets, maintenance |
| `marketing@` | Marketing |
| `billing@` | Invoices, receipts, payments |
| `noreply@` | Send-only. Incoming mail is refused |

The superadmin UID in `EMAIL_ADMIN_UIDS` sees every mailbox. Give other staff the **Email** page plus the specific `email:<mailbox>` actions in **Staff Management → Page & Action Permissions**.

## One-time setup

Run these from the repository root and sign in to Cloudflare when asked (`npx wrangler login`).

1. Create the database and bucket:

   ```bash
   npx wrangler d1 create odc-email
   npx wrangler r2 bucket create odc-email-files
   ```

   Put the printed `database_id` into `wrangler.jsonc`.

2. Create the tables:

   ```bash
   npx wrangler d1 migrations apply odc-email --remote
   ```

3. Add the Mailjet keys (Mailjet → Account → API Key Management):

   ```bash
   npx wrangler secret put MJ_APIKEY_PUBLIC
   npx wrangler secret put MJ_APIKEY_PRIVATE
   ```

4. Deploy. The `VITE_*` values from your current `.env` must be present when the site is built:

   ```bash
   npm run deploy
   ```

   To build on Cloudflare (Workers Builds, connected to GitHub) instead, use build command `npm run build`, deploy command `npx wrangler deploy`, and add every `VITE_*` variable under the Worker's **Settings → Build → Variables**.

5. Point the website at the Worker: Worker → **Settings → Domains & Routes → Add custom domain** for `odysseyph.com` and `www.odysseyph.com`. If the domain still points at Vercel, remove those DNS records first. Then add `odysseyph.com` to Firebase Auth → Settings → **Authorized domains** if it isn't there.

6. Turn on Email Routing: Cloudflare → `odysseyph.com` → **Email → Email Routing → Enable**. Let it add its MX and TXT records. Then go to **Routing rules → Catch-all address → Send to a Worker → `odc-website`** and enable it.

7. Authorize Mailjet to send for the domain: Mailjet → **Account → Domains & senders → Add domain** `odysseyph.com`. Add the DKIM TXT record it shows (`mailjet._domainkey`) in Cloudflare DNS. Then make sure the domain has exactly **one** SPF record that includes both services:

   ```text
   v=spf1 include:_spf.mx.cloudflare.net include:spf.mailjet.com ~all
   ```

   Add DMARC: TXT `_dmarc` → `v=DMARC1; p=none; rua=mailto:hello@odysseyph.com`. Wait until Mailjet shows SPF and DKIM as valid.

8. Test: email `hello@odysseyph.com` from Gmail, open **/odc → Email**, reply, and confirm the reply lands in Gmail (check spam the first time).

## Local development

```bash
npx wrangler d1 migrations apply odc-email --local
npm run dev:worker
```

`npm run dev:worker` builds the site and serves it with the API on http://127.0.0.1:8787. `npm run dev` (Vite) proxies `/api` to that port. Put local Mailjet keys in `.dev.vars` (git-ignored). To simulate inbound mail:

```bash
curl -X POST "http://127.0.0.1:8787/cdn-cgi/handler/email?from=a@example.com&to=sales@odysseyph.com" --data-binary @message.eml
```

## Limits and notes

- Inbound messages up to 25 MB. Outgoing attachments up to 10 MB total, and 50 recipients.
- Remote images in received mail stay hidden until someone clicks **Show images**. Message HTML is shown in a sandboxed frame with scripts blocked.
- Mailjet sets the Message-ID on outgoing mail. Replies from clients are matched to their conversation by In-Reply-To headers first, and otherwise by subject plus correspondent within 60 days.
- Email Routing does not filter spam strongly. Treat attachments from unknown senders with care.
- Mailjet's free plan sends 200 emails a day (6,000 a month).
