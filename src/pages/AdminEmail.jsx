import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Inbox, Mail, MailOpen, Paperclip, PenSquare, RefreshCw, Reply, ReplyAll, Search, Send, X } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { downloadAttachment, fileToAttachment, getEmailContext, getThread, listThreads, sendEmail, updateThread } from '../services/emailService';
import { hasReplyPrefix, quoteForReply } from '../../worker/src/mail.js';
import './AdminEmail.css';

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: <Inbox size={14} aria-hidden="true" /> },
  { id: 'sent', label: 'Sent', icon: <Send size={14} aria-hidden="true" /> },
  { id: 'archived', label: 'Archived', icon: <Archive size={14} aria-hidden="true" /> },
];
const POLL_MS = 30000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const formatWhen = ms => {
  const date = new Date(ms);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
};
const formatFull = ms => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const formatSize = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
const person = (email, name) => name ? `${name} <${email}>` : email;
const listPeople = list => (list || []).map(a => a.name || a.email).join(', ');

/** Sender HTML is untrusted: no scripts, same-origin only so we can size the frame, remote images opt-in. */
function MessageHtml({ html, allowImages }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(120);
  const srcDoc = useMemo(() => `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: ${allowImages ? 'https:' : ''}">
<base target="_blank"><style>html,body{margin:0;padding:12px 14px;background:#fff;color:#1f2430;font:14px/1.5 -apple-system,'Segoe UI',sans-serif;word-wrap:break-word}img{max-width:100%;height:auto}blockquote{margin-left:.5em}</style>
</head><body>${html}</body></html>`, [html, allowImages]);
  const fit = () => {
    const doc = ref.current?.contentDocument;
    if (doc) setHeight(Math.min(Math.max(doc.documentElement.scrollHeight, 60), 4000));
  };
  return <iframe ref={ref} className="email-frame" title="Message content" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={srcDoc} style={{ height }} onLoad={fit} />;
}

function Message({ message, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const [allowImages, setAllowImages] = useState(false);
  const [error, setError] = useState('');
  const files = message.attachments.filter(a => !a.inline || !message.html);
  const remoteImages = /<img[^>]+src=["']?https?:/i.test(message.html || '');
  return (
    <article className={`email-message ${message.direction === 'out' ? 'is-outbound' : ''}`}>
      <button type="button" className="email-message-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="email-avatar" aria-hidden="true">{(message.fromName || message.fromEmail).slice(0, 1).toUpperCase()}</span>
        <span className="email-message-who">
          <strong>{message.direction === 'out' ? `${message.fromName} · ${message.fromEmail}` : person(message.fromEmail, message.fromName)}</strong>
          <small>to {listPeople(message.to)}{message.cc?.length ? `, cc ${listPeople(message.cc)}` : ''}{message.sentByEmail ? ` · sent by ${message.sentByEmail}` : ''}</small>
        </span>
        <time dateTime={new Date(message.sentAt).toISOString()}>{formatFull(message.sentAt)}</time>
      </button>
      {open && (
        <div className="email-message-body">
          {remoteImages && !allowImages && (
            <p className="email-notice">Remote images are hidden to protect your privacy. <button type="button" onClick={() => setAllowImages(true)}>Show images</button></p>
          )}
          {message.html ? <MessageHtml html={message.html} allowImages={allowImages} /> : <pre className="email-text">{message.text}</pre>}
          {files.length > 0 && (
            <ul className="email-attachments">
              {files.map(file => (
                <li key={file.id}>
                  <button type="button" onClick={() => downloadAttachment(file).catch(e => setError(e.message))}>
                    <Paperclip size={14} aria-hidden="true" /> {file.filename} <small>{formatSize(file.size)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="email-error" role="alert">{error}</p>}
        </div>
      )}
    </article>
  );
}

function Composer({ mailboxes, initial, quote, onSent, onCancel, title }) {
  const [draft, setDraft] = useState(initial);
  const [includeQuote, setIncludeQuote] = useState(Boolean(quote));
  const [files, setFiles] = useState([]);
  const [showCc, setShowCc] = useState(Boolean(initial.cc));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = key => event => setDraft(d => ({ ...d, [key]: event.target.value }));
  const totalSize = files.reduce((n, f) => n + f.size, 0);
  const isReply = Boolean(initial.threadId);

  const addFiles = async event => {
    const picked = [...event.target.files];
    event.target.value = '';
    try {
      const next = [...files, ...await Promise.all(picked.map(fileToAttachment))];
      if (next.reduce((n, f) => n + f.size, 0) > MAX_ATTACHMENT_BYTES) throw new Error('Attachments must total 10 MB or less.');
      setFiles(next);
      setError('');
    } catch (e) { setError(e.message); }
  };
  const submit = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const text = includeQuote && quote ? `${draft.text}${quote}` : draft.text;
      const result = await sendEmail({ ...draft, text, attachments: files.map(({ filename, contentType, base64 }) => ({ filename, contentType, base64 })) });
      onSent(result);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <form className="email-composer" onSubmit={submit} aria-label={title}>
      <header><h3>{title}</h3>{onCancel && <button type="button" className="email-icon" onClick={onCancel} aria-label="Discard draft" disabled={busy}><X size={16} /></button>}</header>
      {error && <p className="email-error" role="alert">{error}</p>}
      <label className="email-field"><span>From</span>
        <select value={draft.mailbox} onChange={set('mailbox')} disabled={isReply}>
          {mailboxes.map(m => <option key={m.id} value={m.id}>{m.label} · {m.address}</option>)}
        </select>
      </label>
      <label className="email-field"><span>To</span><input type="text" value={draft.to} onChange={set('to')} placeholder="name@example.com, another@example.com" required autoComplete="off" /></label>
      {showCc ? <>
        <label className="email-field"><span>Cc</span><input type="text" value={draft.cc} onChange={set('cc')} autoComplete="off" /></label>
        <label className="email-field"><span>Bcc</span><input type="text" value={draft.bcc} onChange={set('bcc')} autoComplete="off" /></label>
      </> : <button type="button" className="email-link" onClick={() => setShowCc(true)}>Add Cc / Bcc</button>}
      <label className="email-field"><span>Subject</span><input type="text" value={draft.subject} onChange={set('subject')} maxLength={300} required /></label>
      <label className="email-field email-field-body"><span className="email-visually-hidden">Message</span>
        <textarea value={draft.text} onChange={set('text')} rows={isReply ? 6 : 12} required placeholder="Write your message…" autoFocus={isReply} />
      </label>
      {quote && <label className="email-check"><input type="checkbox" checked={includeQuote} onChange={e => setIncludeQuote(e.target.checked)} /> Include previous message</label>}
      {files.length > 0 && (
        <ul className="email-attachments">
          {files.map((file, i) => (
            <li key={`${file.filename}-${i}`}><span><Paperclip size={14} aria-hidden="true" /> {file.filename} <small>{formatSize(file.size)}</small></span>
              <button type="button" className="email-icon" aria-label={`Remove ${file.filename}`} onClick={() => setFiles(f => f.filter((_, j) => j !== i))}><X size={14} /></button></li>
          ))}
        </ul>
      )}
      <footer>
        <label className="email-attach-button"><Paperclip size={15} aria-hidden="true" /> Attach<input type="file" multiple onChange={addFiles} className="email-visually-hidden" /></label>
        {totalSize > 0 && <small className="email-muted">{formatSize(totalSize)} of 10 MB</small>}
        <LoadingButton type="submit" className="email-primary" loading={busy} loadingLabel="Sending…"><Send size={15} aria-hidden="true" /> Send</LoadingButton>
      </footer>
    </form>
  );
}

function ThreadView({ id, mailboxes, domain, onBack, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [replying, setReplying] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await getThread(id)); setError(''); }
    catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { setData(null); setReplying(null); load(); }, [load]);
  useEffect(() => {
    if (!(data?.thread.unreadCount > 0)) return;
    setData(d => ({ ...d, thread: { ...d.thread, unreadCount: 0 } }));
    updateThread(id, { read: true }).then(() => onChanged({ id, unreadCount: 0 })).catch(() => {});
  }, [data, id, onChanged]);

  if (error) return <div className="email-thread"><p className="email-error" role="alert">{error}</p></div>;
  if (!data) return <div className="email-thread"><div className="email-skeleton" /></div>;
  const { thread, messages } = data;
  const mailbox = mailboxes.find(m => m.id === thread.mailbox);
  const lastInbound = [...messages].reverse().find(m => m.direction === 'in');
  const last = messages[messages.length - 1];
  const ours = address => address.endsWith(`@${domain}`);

  const startReply = all => {
    const target = lastInbound ? (lastInbound.replyTo[0] || { email: lastInbound.fromEmail, name: lastInbound.fromName }) : last.to[0];
    const others = all && lastInbound ? [...lastInbound.to, ...lastInbound.cc].filter(a => !ours(a.email) && a.email !== target.email) : [];
    setReplying({
      key: Date.now(),
      initial: { mailbox: thread.mailbox, threadId: thread.id, to: person(target.email, target.name), cc: others.map(a => a.email).join(', '), bcc: '', subject: hasReplyPrefix(thread.subject) ? thread.subject : `Re: ${thread.subject}`, text: '' },
      quote: quoteForReply(last),
    });
  };
  const toggleArchive = async () => {
    setBusy(true);
    try { await updateThread(id, { archived: !thread.archived }); onChanged({ id, archived: !thread.archived, removed: true }); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const markUnread = async () => {
    try { await updateThread(id, { read: false }); onChanged({ id, unreadCount: 1 }); onBack(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="email-thread">
      <header className="email-thread-head">
        <button type="button" className="email-icon email-back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={18} /></button>
        <div>
          <h3>{thread.subject}</h3>
          <p className="email-muted">{mailbox?.address} · {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}</p>
        </div>
        <div className="email-thread-actions">
          {lastInbound && <button type="button" onClick={markUnread}><MailOpen size={15} aria-hidden="true" /> Mark unread</button>}
          <LoadingButton type="button" onClick={toggleArchive} loading={busy} loadingLabel="Saving…">
            {thread.archived ? <><ArchiveRestore size={15} aria-hidden="true" /> Move to inbox</> : <><Archive size={15} aria-hidden="true" /> Archive</>}
          </LoadingButton>
        </div>
      </header>
      <div className="email-messages">
        {messages.map((message, i) => <Message key={message.id} message={message} defaultOpen={i === messages.length - 1 || !message.read} />)}
      </div>
      {replying ? (
        <Composer key={replying.key} title="Reply" mailboxes={mailboxes} initial={replying.initial} quote={replying.quote}
          onCancel={() => setReplying(null)} onSent={() => { setReplying(null); load(); onChanged({ id, refresh: true }); }} />
      ) : (
        <div className="email-reply-bar">
          <button type="button" className="email-primary" onClick={() => startReply(false)}><Reply size={15} aria-hidden="true" /> Reply</button>
          {lastInbound && lastInbound.to.length + lastInbound.cc.length > 1 && <button type="button" onClick={() => startReply(true)}><ReplyAll size={15} aria-hidden="true" /> Reply all</button>}
        </div>
      )}
    </div>
  );
}

export default function AdminEmail() {
  const [context, setContext] = useState(null);
  const [contextError, setContextError] = useState('');
  const [mailbox, setMailbox] = useState('all');
  const [folder, setFolder] = useState('inbox');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [list, setList] = useState({ threads: [], nextBefore: null, loading: true, error: '' });
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(null);
  const [notice, setNotice] = useState('');

  const loadContext = useCallback(async () => {
    try { setContext(await getEmailContext()); setContextError(''); }
    catch (e) { setContextError(e.message); }
  }, []);
  const loadThreads = useCallback(async ({ more = false, quiet = false } = {}) => {
    if (!quiet) setList(l => ({ ...l, loading: true, error: '' }));
    try {
      const page = await listThreads({ mailbox, folder, q: search, before: more ? list.nextBefore : undefined });
      setList(l => ({ threads: more ? [...l.threads, ...page.threads] : page.threads, nextBefore: page.nextBefore, loading: false, error: '' }));
    } catch (e) { setList(l => ({ ...l, loading: false, error: e.message })); }
  }, [mailbox, folder, search, list.nextBefore]);

  useEffect(() => { loadContext(); }, [loadContext]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the view changes, not when paging state does
  useEffect(() => { if (context) loadThreads(); }, [context?.domain, mailbox, folder, search]);
  useEffect(() => {
    if (!context) return undefined;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') { loadContext(); loadThreads({ quiet: true }); } }, POLL_MS);
    return () => clearInterval(timer);
  }, [context, loadContext, loadThreads]);

  const onThreadChanged = useCallback(change => {
    if (change.refresh) { loadThreads({ quiet: true }); loadContext(); return; }
    if (change.removed) { setSelected(null); setList(l => ({ ...l, threads: l.threads.filter(t => t.id !== change.id) })); loadContext(); return; }
    setList(l => ({ ...l, threads: l.threads.map(t => t.id === change.id ? { ...t, ...change } : t) }));
    loadContext();
  }, [loadThreads, loadContext]);

  if (contextError) {
    return (
      <section className="email-module">
        <p className="email-eyebrow">Email</p>
        <h2>Shared inboxes</h2>
        <p className="email-error" role="alert">{contextError}</p>
        <button type="button" onClick={loadContext}><RefreshCw size={15} aria-hidden="true" /> Retry</button>
      </section>
    );
  }
  if (!context) return <section className="email-module"><div className="email-skeleton" /></section>;

  const mailboxes = context.mailboxes;
  const totalUnread = mailboxes.reduce((n, m) => n + m.unread, 0);
  const startCompose = () => setComposing({ key: Date.now(), initial: { mailbox: mailbox !== 'all' ? mailbox : mailboxes[0].id, to: '', cc: '', bcc: '', subject: '', text: '' } });
  const mailboxLabel = id => mailboxes.find(m => m.id === id)?.label || id;

  return (
    <section className="email-module">
      <header className="email-heading">
        <div>
          <p className="email-eyebrow">Email · {context.domain}</p>
          <h2>Shared inboxes</h2>
        </div>
        <button type="button" className="email-primary email-heading-action" onClick={startCompose} disabled={!context.sendingEnabled} title={context.sendingEnabled ? '' : 'Mailjet keys are not configured on the Worker yet'}>
          <PenSquare size={16} aria-hidden="true" /> Compose
        </button>
      </header>
      {!context.sendingEnabled && <p className="email-notice">Sending is turned off until the Mailjet API keys are added to the Worker. Receiving still works.</p>}
      {notice && <p className="email-success" role="status">{notice} <button type="button" className="email-icon" onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></p>}

      <div className={`email-layout ${selected || composing ? 'has-detail' : ''}`}>
        <nav className="email-sidebar" aria-label="Mailboxes">
          <ul>
            <li><button type="button" aria-current={mailbox === 'all' || undefined} onClick={() => { setMailbox('all'); setSelected(null); }}>
              <Mail size={15} aria-hidden="true" /><span>All inboxes</span>{totalUnread > 0 && <b>{totalUnread}</b>}</button></li>
            {mailboxes.map(m => (
              <li key={m.id}><button type="button" aria-current={mailbox === m.id || undefined} onClick={() => { setMailbox(m.id); setSelected(null); }} title={m.description}>
                <span className="email-dot" data-mailbox={m.id} aria-hidden="true" /><span>{m.address}</span>{m.unread > 0 && <b>{m.unread}</b>}</button></li>
            ))}
          </ul>
          <div className="email-folders" role="group" aria-label="Folder">
            {FOLDERS.map(({ id, label, icon }) => (
              <button key={id} type="button" aria-pressed={folder === id} onClick={() => { setFolder(id); setSelected(null); }}>{icon} {label}</button>
            ))}
          </div>
        </nav>

        <div className="email-list">
          <form className="email-search" role="search" onSubmit={e => { e.preventDefault(); setSearch(query); }}>
            <Search size={15} aria-hidden="true" />
            <input type="search" value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setSearch(''); }} placeholder="Search subject, sender, text" aria-label="Search conversations" />
            <button type="button" className="email-icon" onClick={() => { loadThreads(); loadContext(); }} aria-label="Refresh"><RefreshCw size={15} /></button>
          </form>
          {list.error && <p className="email-error" role="alert">{list.error}</p>}
          {list.loading && !list.threads.length ? <div className="email-skeleton" /> : list.threads.length === 0 ? (
            <div className="email-empty"><Inbox size={22} aria-hidden="true" /><p>{search ? 'No conversations match your search.' : folder === 'inbox' ? 'No mail here yet.' : `Nothing in ${folder}.`}</p></div>
          ) : (
            <ul className="email-threads">
              {list.threads.map(t => (
                <li key={t.id}>
                  <button type="button" className={`${t.unreadCount ? 'is-unread' : ''}`} aria-current={selected === t.id || undefined} onClick={() => { setComposing(null); setSelected(t.id); }}>
                    <span className="email-thread-top">
                      <strong>{t.counterpartName || t.counterpartEmail}</strong>
                      <time>{formatWhen(t.lastMessageAt)}</time>
                    </span>
                    <span className="email-thread-subject">{t.unreadCount > 0 && <span className="email-unread-dot" aria-label="Unread" />}{t.subject}{t.messageCount > 1 && <small> ({t.messageCount})</small>}</span>
                    <span className="email-thread-snippet">{t.hasAttachments && <Paperclip size={12} aria-label="Has attachments" />} {t.snippet}</span>
                    {mailbox === 'all' && <span className="email-tag" data-mailbox={t.mailbox}>{mailboxLabel(t.mailbox)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {list.nextBefore && <button type="button" className="email-more" onClick={() => loadThreads({ more: true, quiet: true })}>Load older</button>}
        </div>

        <div className="email-detail">
          {composing ? (
            <Composer key={composing.key} title="New message" mailboxes={mailboxes} initial={composing.initial}
              onCancel={() => setComposing(null)}
              onSent={result => { setComposing(null); setNotice('Email sent.'); setSelected(result.threadId); loadThreads({ quiet: true }); }} />
          ) : selected ? (
            <ThreadView id={selected} mailboxes={mailboxes} domain={context.domain} onBack={() => setSelected(null)} onChanged={onThreadChanged} />
          ) : (
            <div className="email-empty email-detail-empty"><Mail size={26} aria-hidden="true" /><p>Select a conversation, or compose a new email.</p></div>
          )}
        </div>
      </div>
    </section>
  );
}
