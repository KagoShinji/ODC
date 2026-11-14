// Pure mail helpers shared by the Worker routes and Node tests. No Worker-only APIs here.

export const MAILBOXES = [
  { id: 'hello', label: 'Hello', description: 'Main inbox · website, social and general inquiries' },
  { id: 'sales', label: 'Sales', description: 'Leads, quotations and MOAs' },
  { id: 'support', label: 'Support', description: 'Client tickets and maintenance' },
  { id: 'marketing', label: 'Marketing', description: 'Campaigns, partners and media' },
  { id: 'billing', label: 'Billing', description: 'Invoices, receipts and payments' },
];
export const MAILBOX_IDS = MAILBOXES.map(m => m.id);
export const DEFAULT_MAILBOX = 'hello';
// Send-only identities. Mail sent to them is refused instead of filling an inbox nobody reads.
export const SEND_ONLY_LOCAL_PARTS = ['noreply', 'no-reply'];

export const LIMITS = {
  inboundBytes: 25 * 1024 * 1024,
  outboundAttachmentBytes: 10 * 1024 * 1024,
  outboundAttachments: 10,
  recipients: 50,
  subject: 300,
  body: 200_000,
  storedHtml: 400_000,
  storedText: 200_000,
};

export class MailError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const normalizeEmail = value => String(value || '').trim().toLowerCase();
const EMAIL_PATTERN = /^[^\s@<>(),;:"[\]]+@[^\s@<>(),;:"[\]]+\.[^\s@<>(),;:"[\]]+$/;
export const isEmail = value => EMAIL_PATTERN.test(value) && value.length <= 254;

export function splitAddress(address) {
  const email = normalizeEmail(address);
  const at = email.lastIndexOf('@');
  return at < 0 ? { local: email, domain: '' } : { local: email.slice(0, at), domain: email.slice(at + 1) };
}

/** Which inbox receives mail for an envelope recipient. `null` means refuse it. */
export function mailboxForRecipient(recipient, domain) {
  const { local, domain: recipientDomain } = splitAddress(recipient);
  if (!local || recipientDomain !== normalizeEmail(domain)) return null;
  const base = local.split('+')[0];
  if (SEND_ONLY_LOCAL_PARTS.includes(base)) return null;
  return MAILBOX_IDS.includes(base) ? base : DEFAULT_MAILBOX; // catch-all lands in the main inbox
}

export const mailboxAddress = (mailbox, domain) => `${mailbox}@${normalizeEmail(domain)}`;

const REPLY_PREFIX = /^\s*((re|fw|fwd|aw|sv|antw)\s*(\[\d+\])?\s*:\s*)+/i;
export const hasReplyPrefix = subject => REPLY_PREFIX.test(String(subject || ''));
export function subjectKey(subject) {
  return String(subject || '').replace(REPLY_PREFIX, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 300);
}

/** Message-ID tokens from In-Reply-To / References headers, newest last. */
export function parseMessageIds(...headers) {
  const ids = [];
  for (const header of headers) {
    for (const match of String(header || '').matchAll(/<([^<>\s]+)>/g)) if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}
export const bareMessageId = value => parseMessageIds(value)[0] || String(value || '').trim().replace(/^<|>$/g, '') || null;

export function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export function snippetOf(text, html) {
  const source = text?.trim() ? text : htmlToText(html);
  // Drop quoted history so the list shows what is new in the message.
  const fresh = source.split('\n').filter(line => !line.trim().startsWith('>')).join(' ');
  return fresh.replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Plain text compose body → simple, safe HTML (paragraphs, line breaks, links, quoted blocks). */
export function textToHtml(text) {
  const linkify = line => escapeHtml(line).replace(/\bhttps?:\/\/[^\s<]+/g, url => `<a href="${url}">${url}</a>`);
  const blocks = String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks.map(block => {
    const lines = block.split('\n');
    if (lines.every(line => line.startsWith('>'))) {
      const inner = lines.map(line => line.replace(/^>\s?/, '')).join('\n');
      return `<blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex;color:#555">${textToHtml(inner)}</blockquote>`;
    }
    return `<p style="margin:0 0 1em">${lines.map(linkify).join('<br>')}</p>`;
  }).join('\n');
}

export function quoteForReply({ text, html, fromName, fromEmail, sentAt }) {
  const who = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const when = sentAt ? new Date(sentAt).toUTCString() : 'earlier';
  const body = (text?.trim() ? text : htmlToText(html)).trim();
  return `\n\nOn ${when}, ${who} wrote:\n${body.split('\n').map(line => `> ${line}`).join('\n')}`;
}

/** Accepts arrays of strings / {email,name} or a comma-separated string. Uses an injected parser for "Name <a@b>" forms. */
export function cleanRecipients(input, parse) {
  const raw = Array.isArray(input) ? input : String(input || '').trim() ? parse(String(input)) : [];
  const seen = new Set();
  const out = [];
  for (const item of raw.flatMap(entry => entry?.group ? entry.group : [entry])) {
    const email = normalizeEmail(typeof item === 'string' ? item : item?.address || item?.email);
    const name = typeof item === 'string' ? '' : String(item?.name || '').replace(/[\r\n"]/g, '').trim().slice(0, 120);
    if (!email) {
      if (name) throw new MailError(`"${name}" is not a valid email address.`);
      continue;
    }
    if (!isEmail(email)) throw new MailError(`"${email}" is not a valid email address.`);
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(name ? { email, name } : { email });
  }
  return out;
}

const base64Bytes = b64 => Math.floor(String(b64).replace(/=+$/, '').length * 3 / 4);
const SAFE_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;
// Strips control and bidi-override characters an attacker could use to disguise a filename.
// eslint-disable-next-line no-control-regex
export const safeFilename = name => String(name || 'attachment').replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩/\\]/g, '_').trim().slice(0, 180) || 'attachment';
export const safeContentType = type => SAFE_TYPE.test(String(type || '').toLowerCase()) ? String(type).toLowerCase() : 'application/octet-stream';

/** Validate a compose request against the caller's mailboxes. Returns a normalized draft. */
export function validateDraft(input, allowedMailboxes, parse) {
  if (!input || typeof input !== 'object') throw new MailError('Invalid email.');
  const mailbox = String(input.mailbox || '');
  if (!MAILBOX_IDS.includes(mailbox)) throw new MailError('Choose a mailbox to send from.');
  if (!allowedMailboxes.includes(mailbox)) throw new MailError('You cannot send from this mailbox.', 403);
  const to = cleanRecipients(input.to, parse);
  const cc = cleanRecipients(input.cc, parse);
  const bcc = cleanRecipients(input.bcc, parse);
  if (!to.length) throw new MailError('Add at least one recipient.');
  if (to.length + cc.length + bcc.length > LIMITS.recipients) throw new MailError(`Send to at most ${LIMITS.recipients} recipients at once.`);
  const subject = String(input.subject || '').replace(/[\r\n]+/g, ' ').trim();
  if (!subject) throw new MailError('Add a subject.');
  if (subject.length > LIMITS.subject) throw new MailError('The subject is too long.');
  const text = String(input.text || '');
  if (!text.trim()) throw new MailError('Write a message.');
  if (text.length > LIMITS.body) throw new MailError('The message is too long.');
  const attachments = Array.isArray(input.attachments) ? input.attachments : [];
  if (attachments.length > LIMITS.outboundAttachments) throw new MailError(`Attach at most ${LIMITS.outboundAttachments} files.`);
  let total = 0;
  const files = attachments.map(file => {
    const base64 = String(file?.base64 || '');
    if (!base64 || !/^[A-Za-z0-9+/]+=*$/.test(base64)) throw new MailError('An attachment could not be read.');
    const size = base64Bytes(base64);
    total += size;
    return { filename: safeFilename(file.filename), contentType: safeContentType(file.contentType), base64, size };
  });
  if (total > LIMITS.outboundAttachmentBytes) throw new MailError('Attachments must total 10 MB or less.');
  const threadId = input.threadId ? String(input.threadId) : null;
  if (threadId && !/^[a-zA-Z0-9_-]{6,64}$/.test(threadId)) throw new MailError('Invalid conversation.');
  return { mailbox, to, cc, bcc, subject, text, html: textToHtml(text), attachments: files, threadId };
}

const mjAddress = ({ email, name }) => (name ? { Email: email, Name: name } : { Email: email });
export function buildMailjetMessage(draft, { domain, fromName, inReplyTo, references, customId }) {
  const message = {
    From: { Email: mailboxAddress(draft.mailbox, domain), Name: fromName },
    To: draft.to.map(mjAddress),
    Subject: draft.subject,
    TextPart: draft.text,
    HTMLPart: draft.html,
    CustomID: customId,
  };
  if (draft.cc.length) message.Cc = draft.cc.map(mjAddress);
  if (draft.bcc.length) message.Bcc = draft.bcc.map(mjAddress);
  const headers = {};
  if (inReplyTo) headers['In-Reply-To'] = `<${inReplyTo}>`;
  if (references?.length) headers.References = references.map(id => `<${id}>`).join(' ');
  if (Object.keys(headers).length) message.Headers = headers;
  if (draft.attachments.length) message.Attachments = draft.attachments.map(a => ({ ContentType: a.contentType, Filename: a.filename, Base64Content: a.base64 }));
  return message;
}

/** Turn a Mailjet v3.1 response body into either message IDs or a readable error. */
export function readMailjetResult(status, body) {
  const result = body?.Messages?.[0];
  if (status >= 200 && status < 300 && result?.Status === 'success') {
    const first = result.To?.[0] || {};
    return { ok: true, messageId: first.MessageID ? String(first.MessageID) : null, messageUuid: first.MessageUUID || null };
  }
  const detail = result?.Errors?.map(e => e.ErrorMessage).filter(Boolean).join(' ') || body?.ErrorMessage || `Mailjet returned HTTP ${status}.`;
  return { ok: false, error: detail };
}

/** Mailbox access from server-trusted data. Admin UIDs get every mailbox. */
export function resolveMailboxAccess({ uid, adminUids, staff }) {
  if (adminUids.includes(uid)) return { mailboxes: [...MAILBOX_IDS], admin: true };
  if (!staff || staff.status !== 'active') return { mailboxes: [], admin: false };
  const tabs = Array.isArray(staff.allowedTabs) ? staff.allowedTabs : [];
  if (!tabs.includes('email')) return { mailboxes: [], admin: false };
  // Mirrors the dashboard: a staff record without an explicit action list gets every action of its tabs.
  const actions = Array.isArray(staff.allowedActions) ? staff.allowedActions : MAILBOX_IDS.map(id => `email:${id}`);
  return { mailboxes: MAILBOX_IDS.filter(id => actions.includes(`email:${id}`)), admin: false };
}

/** Lowercased, space-delimited participant list for LIKE matching in SQL. */
export function participantKey(emails) {
  const unique = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  return ` ${unique.join(' ')} `;
}
