// D1 + R2 persistence. `db` is a D1 binding (prepare/bind/first/all/run/batch); `files` is an R2 binding.
import {
  LIMITS, MAILBOX_IDS, bareMessageId, participantKey, parseMessageIds, safeContentType, safeFilename,
  snippetOf, subjectKey, hasReplyPrefix, normalizeEmail, mailboxAddress,
} from './mail.js';

export const newId = () => crypto.randomUUID().replace(/-/g, '');
const json = value => JSON.stringify(value || []);
const addressList = list => (list || []).flatMap(a => a?.group ? a.group : [a]).filter(a => a?.address)
  .map(a => (a.name ? { email: normalizeEmail(a.address), name: a.name } : { email: normalizeEmail(a.address) }));
const toBytes = content => content instanceof Uint8Array ? content : typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
const fromBase64 = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const likeTerm = q => `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;
const SIXTY_DAYS = 60 * 86400000;

async function threadFor(db, { mailbox, ids, subject, counterpart, now }) {
  if (ids.length) {
    const marks = ids.map(() => '?').join(',');
    const hit = await db.prepare(`SELECT thread_id FROM email_messages WHERE mailbox = ? AND message_id_header IN (${marks}) ORDER BY sent_at DESC LIMIT 1`).bind(mailbox, ...ids).first();
    if (hit) return hit.thread_id;
  }
  // Mailjet assigns our outgoing Message-IDs, so replies to them are matched by subject and correspondent.
  const key = subjectKey(subject);
  if (key && counterpart && (hasReplyPrefix(subject) || ids.length)) {
    const hit = await db.prepare(`SELECT id FROM email_threads WHERE mailbox = ? AND subject_key = ? AND participants LIKE ? ESCAPE '\\' AND last_message_at > ? ORDER BY last_message_at DESC LIMIT 1`)
      .bind(mailbox, key, likeTerm(` ${counterpart} `), now - SIXTY_DAYS).first();
    if (hit) return hit.id;
  }
  return null;
}

async function upsertThread(db, { threadId, mailbox, subject, emails, counterpart, snippet, direction, hasAttachments, now }) {
  const existing = threadId ? await db.prepare('SELECT * FROM email_threads WHERE id = ?').bind(threadId).first() : null;
  if (!existing) {
    const id = threadId || newId();
    return { id, statement: db.prepare(`INSERT INTO email_threads (id, mailbox, subject, subject_key, participants, counterpart_email, counterpart_name, snippet, message_count, unread_count, has_inbound, has_outbound, has_attachments, archived, last_message_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 0, ?, ?)`).bind(id, mailbox, subject, subjectKey(subject), participantKey(emails), counterpart.email, counterpart.name || '', snippet,
      direction === 'in' ? 1 : 0, direction === 'in' ? 1 : 0, direction === 'out' ? 1 : 0, hasAttachments ? 1 : 0, now, now) };
  }
  const participants = participantKey([...existing.participants.trim().split(' '), ...emails]);
  return { id: existing.id, statement: db.prepare(`UPDATE email_threads SET participants = ?, snippet = ?, message_count = message_count + 1,
      unread_count = unread_count + ?, has_inbound = MAX(has_inbound, ?), has_outbound = MAX(has_outbound, ?), has_attachments = MAX(has_attachments, ?),
      archived = CASE WHEN ? = 'in' THEN 0 ELSE archived END, last_message_at = MAX(last_message_at, ?),
      counterpart_email = CASE WHEN counterpart_email = '' THEN ? ELSE counterpart_email END,
      counterpart_name = CASE WHEN counterpart_name = '' THEN ? ELSE counterpart_name END WHERE id = ?`)
    .bind(participants, snippet, direction === 'in' ? 1 : 0, direction === 'in' ? 1 : 0, direction === 'out' ? 1 : 0, hasAttachments ? 1 : 0, direction, now, counterpart.email, counterpart.name || '', existing.id) };
}

/** Store a parsed inbound message. Returns { duplicate } or { threadId, messageId }. */
export async function saveInbound(db, files, { mailbox, parsed, raw, envelopeFrom, now = Date.now() }) {
  const messageIdHeader = bareMessageId(parsed.messageId);
  if (messageIdHeader) {
    const dupe = await db.prepare('SELECT id FROM email_messages WHERE mailbox = ? AND message_id_header = ?').bind(mailbox, messageIdHeader).first();
    if (dupe) return { duplicate: true, messageId: dupe.id };
  }
  const from = addressList(parsed.from ? [parsed.from] : [])[0] || { email: normalizeEmail(envelopeFrom), name: '' };
  const to = addressList(parsed.to), cc = addressList(parsed.cc), replyTo = addressList(parsed.replyTo);
  const subject = String(parsed.subject || '(no subject)').slice(0, LIMITS.subject);
  const ids = parseMessageIds(parsed.inReplyTo, parsed.references);
  const counterpart = replyTo[0] || from;
  const text = String(parsed.text || '').slice(0, LIMITS.storedText);
  const html = String(parsed.html || '').slice(0, LIMITS.storedHtml);
  const snippet = snippetOf(text, html);
  const messageId = newId();
  // Ordered by arrival time; a sender's Date header can be wrong or forged.
  const rawKey = `raw/${mailbox}/${messageId}.eml`;
  await files.put(rawKey, raw, { httpMetadata: { contentType: 'message/rfc822' } });
  const attachmentRows = [];
  for (const attachment of parsed.attachments || []) {
    const id = newId();
    const bytes = toBytes(attachment.content);
    const r2Key = `att/${mailbox}/${messageId}/${id}`;
    const contentType = safeContentType(attachment.mimeType);
    await files.put(r2Key, bytes, { httpMetadata: { contentType } });
    attachmentRows.push({ id, filename: safeFilename(attachment.filename), contentType, size: bytes.byteLength, contentId: attachment.contentId ? String(attachment.contentId).slice(0, 200) : null, inline: attachment.disposition === 'inline' || attachment.related ? 1 : 0, r2Key });
  }
  const threadId = await threadFor(db, { mailbox, ids, subject, counterpart: counterpart.email, now });
  const thread = await upsertThread(db, { threadId, mailbox, subject, emails: [from.email, ...to.map(a => a.email), ...cc.map(a => a.email), ...replyTo.map(a => a.email)], counterpart, snippet, direction: 'in', hasAttachments: attachmentRows.some(a => !a.inline), now });
  await db.batch([
    thread.statement,
    db.prepare(`INSERT INTO email_messages (id, thread_id, mailbox, direction, message_id_header, in_reply_to, references_header, from_email, from_name, to_json, cc_json, reply_to_json, subject, text_body, html_body, snippet, envelope_from, raw_key, size, read, status, sent_at, created_at)
      VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'received', ?, ?)`)
      .bind(messageId, thread.id, mailbox, messageIdHeader, bareMessageId(parsed.inReplyTo), ids.length ? ids.map(i => `<${i}>`).join(' ') : null, from.email, from.name || '', json(to), json(cc), json(replyTo), subject, text, html, snippet, normalizeEmail(envelopeFrom), rawKey, raw.byteLength ?? raw.length ?? 0, now, now),
    ...attachmentRows.map(a => db.prepare('INSERT INTO email_attachments (id, message_id, mailbox, filename, content_type, size, content_id, inline, r2_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(a.id, messageId, mailbox, a.filename, a.contentType, a.size, a.contentId, a.inline, a.r2Key)),
  ]);
  return { threadId: thread.id, messageId };
}

/** Headers that make an outgoing reply thread correctly in the recipient's mail app. */
export async function replyHeaders(db, threadId) {
  const last = await db.prepare('SELECT message_id_header, references_header FROM email_messages WHERE thread_id = ? AND message_id_header IS NOT NULL ORDER BY sent_at DESC LIMIT 1').bind(threadId).first();
  if (!last) return { inReplyTo: null, references: [] };
  const references = [...parseMessageIds(last.references_header).filter(id => id !== last.message_id_header), last.message_id_header].slice(-10);
  return { inReplyTo: last.message_id_header, references };
}

export async function saveOutbound(db, files, { draft, domain, fromName, sender, providerId, inReplyTo, references, now = Date.now() }) {
  const messageId = newId();
  const attachmentRows = [];
  for (const file of draft.attachments) {
    const id = newId();
    const r2Key = `att/${draft.mailbox}/${messageId}/${id}`;
    await files.put(r2Key, fromBase64(file.base64), { httpMetadata: { contentType: file.contentType } });
    attachmentRows.push({ id, filename: file.filename, contentType: file.contentType, size: file.size, r2Key });
  }
  const snippet = snippetOf(draft.text, '');
  const thread = await upsertThread(db, { threadId: draft.threadId, mailbox: draft.mailbox, subject: draft.subject, emails: [...draft.to, ...draft.cc].map(a => a.email), counterpart: draft.to[0], snippet, direction: 'out', hasAttachments: attachmentRows.length > 0, now });
  await db.batch([
    thread.statement,
    db.prepare(`INSERT INTO email_messages (id, thread_id, mailbox, direction, in_reply_to, references_header, from_email, from_name, to_json, cc_json, bcc_json, subject, text_body, html_body, snippet, size, read, status, provider_id, sent_by_uid, sent_by_email, sent_at, created_at)
      VALUES (?, ?, ?, 'out', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'sent', ?, ?, ?, ?, ?)`)
      .bind(messageId, thread.id, draft.mailbox, inReplyTo || null, references?.length ? references.map(i => `<${i}>`).join(' ') : null, mailboxAddress(draft.mailbox, domain), fromName,
        json(draft.to), json(draft.cc), json(draft.bcc), draft.subject, draft.text, draft.html, snippet, draft.attachments.reduce((n, a) => n + a.size, 0), providerId || null, sender.uid, sender.email || null, now, now),
    ...attachmentRows.map(a => db.prepare('INSERT INTO email_attachments (id, message_id, mailbox, filename, content_type, size, content_id, inline, r2_key) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)')
      .bind(a.id, messageId, draft.mailbox, a.filename, a.contentType, a.size, a.r2Key)),
  ]);
  return { threadId: thread.id, messageId };
}

export const FOLDERS = ['inbox', 'sent', 'archived'];
const threadRow = t => ({
  id: t.id, mailbox: t.mailbox, subject: t.subject, snippet: t.snippet, counterpartEmail: t.counterpart_email, counterpartName: t.counterpart_name,
  messageCount: t.message_count, unreadCount: t.unread_count, hasAttachments: !!t.has_attachments, archived: !!t.archived, lastMessageAt: t.last_message_at,
});

export async function listThreads(db, { mailboxes, folder = 'inbox', q = '', before = null, limit = 30 }) {
  const scope = mailboxes.filter(m => MAILBOX_IDS.includes(m));
  if (!scope.length) return { threads: [], nextBefore: null };
  const where = [`mailbox IN (${scope.map(() => '?').join(',')})`];
  const args = [...scope];
  if (folder === 'sent') where.push('has_outbound = 1');
  else if (folder === 'archived') where.push('archived = 1');
  else where.push('archived = 0', 'has_inbound = 1');
  const term = String(q || '').trim().toLowerCase().slice(0, 100);
  if (term) {
    where.push(`(LOWER(subject) LIKE ? ESCAPE '\\' OR participants LIKE ? ESCAPE '\\' OR LOWER(snippet) LIKE ? ESCAPE '\\' OR LOWER(counterpart_name) LIKE ? ESCAPE '\\')`);
    args.push(...Array(4).fill(likeTerm(term)));
  }
  if (Number.isFinite(before)) { where.push('last_message_at < ?'); args.push(before); }
  const { results } = await db.prepare(`SELECT * FROM email_threads WHERE ${where.join(' AND ')} ORDER BY last_message_at DESC LIMIT ?`).bind(...args, limit + 1).all();
  const page = results.slice(0, limit);
  return { threads: page.map(threadRow), nextBefore: results.length > limit ? page[page.length - 1].last_message_at : null };
}

export async function unreadCounts(db, mailboxes) {
  if (!mailboxes.length) return {};
  const { results } = await db.prepare(`SELECT mailbox, SUM(unread_count) AS unread FROM email_threads WHERE archived = 0 AND mailbox IN (${mailboxes.map(() => '?').join(',')}) GROUP BY mailbox`).bind(...mailboxes).all();
  return Object.fromEntries(results.map(r => [r.mailbox, Number(r.unread) || 0]));
}

export const threadMailbox = async (db, id) => (await db.prepare('SELECT mailbox FROM email_threads WHERE id = ?').bind(id).first())?.mailbox || null;

export async function getThread(db, id) {
  const thread = await db.prepare('SELECT * FROM email_threads WHERE id = ?').bind(id).first();
  if (!thread) return null;
  const { results: messages } = await db.prepare('SELECT * FROM email_messages WHERE thread_id = ? ORDER BY sent_at ASC, created_at ASC').bind(id).all();
  const { results: attachments } = await db.prepare(`SELECT a.* FROM email_attachments a JOIN email_messages m ON m.id = a.message_id WHERE m.thread_id = ?`).bind(id).all();
  return {
    thread: threadRow(thread),
    messages: messages.map(m => ({
      id: m.id, direction: m.direction, fromEmail: m.from_email, fromName: m.from_name, to: JSON.parse(m.to_json), cc: JSON.parse(m.cc_json),
      bcc: m.direction === 'out' ? JSON.parse(m.bcc_json) : [], replyTo: JSON.parse(m.reply_to_json), subject: m.subject, text: m.text_body, html: m.html_body,
      read: !!m.read, status: m.status, sentAt: m.sent_at, sentByEmail: m.sent_by_email,
      attachments: attachments.filter(a => a.message_id === m.id).map(a => ({ id: a.id, filename: a.filename, contentType: a.content_type, size: a.size, inline: !!a.inline, contentId: a.content_id })),
    })),
  };
}

export async function updateThread(db, id, { read, archived }) {
  const statements = [];
  if (read === true) statements.push(db.prepare('UPDATE email_messages SET read = 1 WHERE thread_id = ?').bind(id), db.prepare('UPDATE email_threads SET unread_count = 0 WHERE id = ?').bind(id));
  if (read === false) {
    statements.push(
      db.prepare(`UPDATE email_messages SET read = 0 WHERE id = (SELECT id FROM email_messages WHERE thread_id = ? AND direction = 'in' ORDER BY sent_at DESC LIMIT 1)`).bind(id),
      db.prepare(`UPDATE email_threads SET unread_count = MAX(unread_count, 1) WHERE id = ? AND has_inbound = 1`).bind(id));
  }
  if (typeof archived === 'boolean') statements.push(db.prepare('UPDATE email_threads SET archived = ? WHERE id = ?').bind(archived ? 1 : 0, id));
  if (statements.length) await db.batch(statements);
}

export const getAttachment = (db, id) => db.prepare('SELECT * FROM email_attachments WHERE id = ?').bind(id).first();
