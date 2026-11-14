-- Shared inboxes for @odysseyph.com. Times are epoch milliseconds.
CREATE TABLE IF NOT EXISTS email_threads (
  id TEXT PRIMARY KEY,
  mailbox TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  subject_key TEXT NOT NULL DEFAULT '',
  participants TEXT NOT NULL DEFAULT ' ',
  counterpart_email TEXT NOT NULL DEFAULT '',
  counterpart_name TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  unread_count INTEGER NOT NULL DEFAULT 0,
  has_inbound INTEGER NOT NULL DEFAULT 0,
  has_outbound INTEGER NOT NULL DEFAULT 0,
  has_attachments INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  last_message_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS email_threads_inbox ON email_threads (mailbox, archived, has_inbound, last_message_at DESC);
CREATE INDEX IF NOT EXISTS email_threads_sent ON email_threads (mailbox, has_outbound, last_message_at DESC);
CREATE INDEX IF NOT EXISTS email_threads_subject ON email_threads (mailbox, subject_key, last_message_at DESC);

CREATE TABLE IF NOT EXISTS email_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES email_threads(id),
  mailbox TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  message_id_header TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  reply_to_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  envelope_from TEXT,
  raw_key TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  read INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  provider_id TEXT,
  sent_by_uid TEXT,
  sent_by_email TEXT,
  sent_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS email_messages_thread ON email_messages (thread_id, sent_at);
-- Email Routing may redeliver; the same Message-ID is stored once per mailbox.
CREATE UNIQUE INDEX IF NOT EXISTS email_messages_dedupe ON email_messages (mailbox, message_id_header) WHERE message_id_header IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES email_messages(id),
  mailbox TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_id TEXT,
  inline INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS email_attachments_message ON email_attachments (message_id);
