import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import PostalMime, { addressParser } from 'postal-mime';
import {
  mailboxForRecipient, subjectKey, parseMessageIds, validateDraft, buildMailjetMessage, readMailjetResult,
  resolveMailboxAccess, textToHtml, snippetOf, MAILBOX_IDS,
} from '../worker/src/mail.js';
import { saveInbound, saveOutbound, listThreads, getThread, updateThread, replyHeaders, unreadCounts } from '../worker/src/store.js';
import { findStaff } from '../worker/src/auth.js';

// Minimal D1 stand-in backed by node:sqlite.
function fakeD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../worker/migrations/0001_email.sql', import.meta.url), 'utf8'));
  const statement = (sql, args = []) => ({
    bind: (...next) => statement(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => sqlite.prepare(sql).run(...args),
    exec: () => sqlite.prepare(sql).run(...args),
  });
  return {
    prepare: sql => statement(sql),
    batch: async list => { sqlite.exec('BEGIN'); try { list.forEach(s => s.exec()); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; } },
  };
}
const fakeR2 = () => { const store = new Map(); return { store, put: async (key, value) => { store.set(key, value); } }; };

const rawEmail = ({ from = 'Maria Cruz <maria@client.ph>', to = 'sales@odysseyph.com', subject = 'Website quote', id = 'abc123@client.ph', inReplyTo, body = 'Hi, can we get a quote?' } = {}) => [
  `From: ${from}`, `To: ${to}`, `Subject: ${subject}`, `Message-ID: <${id}>`, inReplyTo ? `In-Reply-To: <${inReplyTo}>` : null,
  'Date: Fri, 13 Nov 2026 08:00:00 +0800', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="b1"', '',
  '--b1', 'Content-Type: text/plain; charset=utf-8', '', body, '',
  '--b1', 'Content-Type: application/pdf', 'Content-Disposition: attachment; filename="brief.pdf"', 'Content-Transfer-Encoding: base64', '', 'JVBERi0xLjQK', '--b1--', '',
].filter(line => line !== null).join('\r\n');

async function receive(db, files, options, now) {
  const raw = new TextEncoder().encode(rawEmail(options));
  return saveInbound(db, files, { mailbox: mailboxForRecipient(options?.to || 'sales@odysseyph.com', 'odysseyph.com'), parsed: await PostalMime.parse(raw), raw, envelopeFrom: 'maria@client.ph', now });
}

test('routes recipients to mailboxes with a catch-all and refuses send-only addresses', () => {
  assert.equal(mailboxForRecipient('Sales@OdysseyPH.com', 'odysseyph.com'), 'sales');
  assert.equal(mailboxForRecipient('billing+invoices@odysseyph.com', 'odysseyph.com'), 'billing');
  assert.equal(mailboxForRecipient('jetch@odysseyph.com', 'odysseyph.com'), 'hello');
  assert.equal(mailboxForRecipient('noreply@odysseyph.com', 'odysseyph.com'), null);
  assert.equal(mailboxForRecipient('sales@other.com', 'odysseyph.com'), null);
  assert.deepEqual(MAILBOX_IDS, ['hello', 'sales', 'support', 'marketing', 'billing']);
});

test('normalizes reply subjects and message id headers', () => {
  assert.equal(subjectKey('RE: Fwd: re:  Website   Quote'), 'website quote');
  assert.deepEqual(parseMessageIds('<a@x>', '<b@y> <a@x>'), ['a@x', 'b@y']);
  assert.equal(snippetOf('Thanks!\n> old quoted text', ''), 'Thanks!');
  assert.equal(textToHtml('Hi <b>\nsee https://odysseyph.com'), '<p style="margin:0 0 1em">Hi &lt;b&gt;<br>see <a href="https://odysseyph.com">https://odysseyph.com</a></p>');
});

test('resolves mailbox access from trusted staff data', () => {
  const adminUids = ['root'];
  assert.equal(resolveMailboxAccess({ uid: 'root', adminUids, staff: null }).mailboxes.length, 5);
  assert.deepEqual(resolveMailboxAccess({ uid: 'u1', adminUids, staff: { status: 'active', allowedTabs: ['email'], allowedActions: ['email:marketing'] } }).mailboxes, ['marketing']);
  assert.deepEqual(resolveMailboxAccess({ uid: 'u1', adminUids, staff: { status: 'inactive', allowedTabs: ['email'], allowedActions: ['email:marketing'] } }).mailboxes, []);
  assert.deepEqual(resolveMailboxAccess({ uid: 'u1', adminUids, staff: { status: 'active', allowedTabs: ['sales'], allowedActions: ['email:sales'] } }).mailboxes, []);
  assert.equal(resolveMailboxAccess({ uid: 'u1', adminUids, staff: { status: 'active', allowedTabs: ['email'] } }).mailboxes.length, 5);
});

test('staff lookup refuses missing or duplicate records', async () => {
  const user = { uid: 'u1', email: 'mia@odc.com', token: 't' };
  const doc = { document: { fields: { status: { stringValue: 'active' }, allowedTabs: { arrayValue: { values: [{ stringValue: 'email' }] } }, allowedActions: { arrayValue: { values: [{ stringValue: 'email:marketing' }] } } } } };
  const respond = rows => async () => ({ ok: true, json: async () => rows });
  assert.deepEqual(await findStaff(user, 'p', respond([doc])), { status: 'active', allowedTabs: ['email'], allowedActions: ['email:marketing'] });
  assert.equal(await findStaff(user, 'p', respond([doc, doc])), null);
  assert.equal(await findStaff(user, 'p', respond([{ readTime: 'x' }])), null);
});

test('validates drafts against allowed mailboxes and builds the Mailjet payload', () => {
  assert.throws(() => validateDraft({ mailbox: 'sales', to: 'a@b.com', subject: 's', text: 't' }, ['marketing'], addressParser), /cannot send/);
  assert.throws(() => validateDraft({ mailbox: 'sales', to: 'not-an-email', subject: 's', text: 't' }, ['sales'], addressParser), /not a valid/);
  const draft = validateDraft({ mailbox: 'sales', to: 'Maria Cruz <Maria@Client.ph>, maria@client.ph', cc: '', subject: 'Re: Quote\r\nBcc: evil@x.com', text: 'Hello', attachments: [{ filename: '../q.pdf', contentType: 'application/pdf', base64: 'JVBERi0xLjQK' }] }, ['sales'], addressParser);
  assert.deepEqual(draft.to, [{ email: 'maria@client.ph', name: 'Maria Cruz' }]);
  assert.equal(draft.subject, 'Re: Quote Bcc: evil@x.com');
  assert.equal(draft.attachments[0].filename, '.._q.pdf');
  const message = buildMailjetMessage(draft, { domain: 'odysseyph.com', fromName: 'OdysseyPH', inReplyTo: 'abc@client.ph', references: ['abc@client.ph'], customId: 'c1' });
  assert.deepEqual(message.From, { Email: 'sales@odysseyph.com', Name: 'OdysseyPH' });
  assert.equal(message.Headers['In-Reply-To'], '<abc@client.ph>');
  assert.equal(message.Attachments[0].Base64Content, 'JVBERi0xLjQK');
  assert.equal(message.Cc, undefined);
});

test('reads Mailjet success and error responses', () => {
  assert.deepEqual(readMailjetResult(200, { Messages: [{ Status: 'success', To: [{ MessageID: 123, MessageUUID: 'u' }] }] }), { ok: true, messageId: '123', messageUuid: 'u' });
  assert.equal(readMailjetResult(400, { Messages: [{ Status: 'error', Errors: [{ ErrorMessage: 'Sender not validated' }] }] }).error, 'Sender not validated');
  assert.equal(readMailjetResult(401, { ErrorMessage: 'API key authentication/authorization failure' }).ok, false);
});

test('stores inbound mail, dedupes redelivery and threads replies', async () => {
  const db = fakeD1(), files = fakeR2();
  const first = await receive(db, files, {}, 1000);
  assert.ok(first.threadId);
  assert.equal((await receive(db, files, {}, 2000)).duplicate, true);
  assert.equal(files.store.size, 2); // raw message + one attachment; the redelivery writes nothing

  // Our reply goes out, then the client answers with a header pointing at their own message.
  const draft = validateDraft({ mailbox: 'sales', to: 'maria@client.ph', subject: 'Re: Website quote', text: 'Sure!', threadId: first.threadId }, ['sales'], addressParser);
  const headers = await replyHeaders(db, first.threadId);
  assert.deepEqual(headers, { inReplyTo: 'abc123@client.ph', references: ['abc123@client.ph'] });
  const sent = await saveOutbound(db, files, { draft, domain: 'odysseyph.com', fromName: 'OdysseyPH', sender: { uid: 'root', email: 'superadmin@odc.com' }, providerId: '9', ...headers, now: 3000 });
  assert.equal(sent.threadId, first.threadId);

  // Reply that only references Mailjet's unknown Message-ID still threads by subject + correspondent.
  const answer = await receive(db, files, { id: 'def456@client.ph', inReplyTo: 'unknown@mailjet', subject: 'RE: Website quote', body: 'Great, thanks' }, 4000);
  assert.equal(answer.threadId, first.threadId);
  // A different sender with the same subject starts a new conversation.
  const stranger = await receive(db, files, { from: 'other@spam.biz', id: 'zzz@spam.biz', subject: 'Re: Website quote' }, 5000);
  assert.notEqual(stranger.threadId, first.threadId);

  const { thread, messages } = await getThread(db, first.threadId);
  assert.equal(thread.messageCount, 3);
  assert.equal(thread.unreadCount, 2);
  assert.deepEqual(messages.map(m => m.direction), ['in', 'out', 'in']);
  assert.equal(messages[0].attachments[0].filename, 'brief.pdf');
  assert.equal(messages[0].fromName, 'Maria Cruz');

  const inbox = await listThreads(db, { mailboxes: ['sales'], folder: 'inbox' });
  assert.equal(inbox.threads.length, 2);
  assert.equal((await listThreads(db, { mailboxes: ['sales'], folder: 'sent' })).threads.length, 1);
  assert.equal((await listThreads(db, { mailboxes: ['marketing'], folder: 'inbox' })).threads.length, 0);
  assert.equal((await listThreads(db, { mailboxes: ['sales'], q: 'maria' })).threads.length, 1);
  assert.equal((await listThreads(db, { mailboxes: ['sales'], q: '100%' })).threads.length, 0);
  assert.deepEqual(await unreadCounts(db, ['sales']), { sales: 3 });

  await updateThread(db, first.threadId, { read: true, archived: true });
  assert.equal((await listThreads(db, { mailboxes: ['sales'] })).threads.length, 1);
  assert.equal((await listThreads(db, { mailboxes: ['sales'], folder: 'archived' })).threads[0].unreadCount, 0);
  // New mail on an archived conversation brings it back to the inbox.
  await receive(db, files, { id: 'ghi@client.ph', inReplyTo: 'def456@client.ph', subject: 'Re: Website quote' }, 6000);
  assert.equal((await listThreads(db, { mailboxes: ['sales'] })).threads.length, 2);
});

test('paginates threads by last message time', async () => {
  const db = fakeD1(), files = fakeR2();
  for (let i = 0; i < 5; i++) await receive(db, files, { id: `m${i}@x.ph`, subject: `Topic ${i}` }, 1000 + i);
  const page1 = await listThreads(db, { mailboxes: ['sales'], limit: 3 });
  assert.equal(page1.threads.length, 3);
  const page2 = await listThreads(db, { mailboxes: ['sales'], limit: 3, before: page1.nextBefore });
  assert.deepEqual(page2.threads.map(t => t.subject), ['Topic 1', 'Topic 0']);
  assert.equal(page2.nextBefore, null);
});
