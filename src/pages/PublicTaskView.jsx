import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircle2, Circle, CalendarClock, AlertTriangle, 
  ArrowLeft, Share2, Copy, Check, ExternalLink, ShieldCheck,
  ListChecks, User, Clock, Sparkles
} from 'lucide-react';
import { getTask } from '../services/taskService';
import {
  statusLabel, priorityLabel, formatDue, formatStamp, dueState, initials
} from '../utils/taskTracker';
import './PublicTaskView.css';

export default function PublicTaskView() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let isMounted = true;
    async function loadTask() {
      try {
        setLoading(true);
        setError('');
        const data = await getTask(id);
        if (!isMounted) return;
        if (!data) {
          setError('Task not found. It may have been completed or removed.');
        } else {
          setTask(data);
          // Set dynamic page title
          document.title = `${data.title} | ODC Task`;
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load task:', err);
        setError('Unable to load this task. Please try again later.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      loadTask();
    } else {
      setError('Invalid task link.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
      document.title = 'ODC - OdysseyPH IT Solutions';
    };
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareTitle = task ? `Task: ${task.title}` : 'ODC Task';
    const assigneesText = task?.assignees?.length 
      ? `Assigned to: ${task.assignees.map(a => a.name).join(', ')}` 
      : 'ODC Team Workspace';
    const shareText = task 
      ? `Task assigned on ODC: "${task.title}". ${assigneesText}. Due: ${formatDue(task.dueAt, now)}`
      : 'View task on ODC';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Navigator share error:', err);
        }
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // In case writeText fails
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  const checklist = task?.checklist || [];
  const doneCount = checklist.filter(i => i.done).length;
  const progressPercent = checklist.length > 0 ? Math.round((doneCount / checklist.length) * 100) : 0;
  const state = task ? dueState(task, now) : 'normal';

  return (
    <div className="ptv-page">
      {/* Background Ambience */}
      <div className="ptv-glow-top" aria-hidden="true" />
      <div className="ptv-glow-bottom" aria-hidden="true" />

      <header className="ptv-header">
        <div className="ptv-header-inner">
          <Link to="/" className="ptv-brand">
            <span className="ptv-logo-badge">ODC</span>
            <div className="ptv-brand-text">
              <span className="ptv-brand-name">OdysseyPH</span>
              <span className="ptv-brand-sub">Team Workspace</span>
            </div>
          </Link>

          <div className="ptv-header-actions">
            <button
              type="button"
              className="ptv-btn-secondary ptv-share-btn"
              onClick={handleShare}
              title="Share task link to social media or copy link"
            >
              {copied ? <Check size={15} className="ptv-text-success" /> : <Share2 size={15} />}
              <span>{copied ? 'Link Copied!' : 'Share Task'}</span>
            </button>
            <Link to="/odc" className="ptv-btn-primary">
              <span>Admin Console</span>
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="ptv-main">
        {loading ? (
          <div className="ptv-card ptv-loading-state" role="status">
            <div className="ptv-spinner" />
            <p>Loading task details…</p>
          </div>
        ) : error ? (
          <div className="ptv-card ptv-error-state" role="alert">
            <AlertTriangle size={42} className="ptv-icon-warning" />
            <h2>Task Unavailable</h2>
            <p>{error}</p>
            <Link to="/" className="ptv-btn-secondary">
              <ArrowLeft size={16} /> Return to Homepage
            </Link>
          </div>
        ) : task ? (
          <article className="ptv-card">
            {/* Top Status & Priority Bar */}
            <div className="ptv-card-topbar">
              <div className="ptv-badge-group">
                <span className={`ptv-pill ptv-priority-${task.priority}`}>
                  {priorityLabel(task.priority)} Priority
                </span>
                <span className={`ptv-pill ptv-status-${task.status}`}>
                  {statusLabel(task.status)}
                </span>
              </div>

              <div className={`ptv-due-badge ptv-due-${state}`}>
                {state === 'overdue' ? (
                  <AlertTriangle size={14} aria-hidden="true" />
                ) : (
                  <CalendarClock size={14} aria-hidden="true" />
                )}
                <span>{formatDue(task.dueAt, now)}</span>
              </div>
            </div>

            {/* Task Title */}
            <h1 className="ptv-title">{task.title}</h1>

            {/* Meta: Posted By & Assignees */}
            <div className="ptv-meta-grid">
              <div className="ptv-meta-card">
                <span className="ptv-meta-label">
                  <User size={13} /> Assigned To
                </span>
                <div className="ptv-assignees">
                  {task.assignees?.length ? (
                    <div className="ptv-assignee-list">
                      {task.assignees.map(person => (
                        <span key={person.email} className="ptv-assignee-item">
                          <span className="ptv-avatar" aria-hidden="true">
                            {initials(person.name)}
                          </span>
                          <span className="ptv-assignee-name">{person.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="ptv-unassigned">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="ptv-meta-card">
                <span className="ptv-meta-label">
                  <Clock size={13} /> Created By
                </span>
                <div className="ptv-creator-info">
                  <strong className="ptv-creator-name">{task.createdByName || 'Team Manager'}</strong>
                  <span className="ptv-creator-date">{formatStamp(task.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Task Description */}
            {task.description ? (
              <section className="ptv-section">
                <h3 className="ptv-section-title">Description & Details</h3>
                <div className="ptv-description-box">
                  <p>{task.description}</p>
                </div>
              </section>
            ) : null}

            {/* Checklist */}
            {checklist.length > 0 && (
              <section className="ptv-section">
                <div className="ptv-section-header">
                  <h3 className="ptv-section-title">
                    <ListChecks size={16} /> Checklist & Deliverables
                  </h3>
                  <span className="ptv-progress-counter">
                    {doneCount} of {checklist.length} completed ({progressPercent}%)
                  </span>
                </div>

                <div className="ptv-progress-track">
                  <div
                    className="ptv-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={progressPercent}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  />
                </div>

                <ul className="ptv-checklist">
                  {checklist.map(item => (
                    <li key={item.id} className={`ptv-checklist-item ${item.done ? 'is-done' : ''}`}>
                      <span className="ptv-check-icon">
                        {item.done ? (
                          <CheckCircle2 size={16} className="ptv-text-success" />
                        ) : (
                          <Circle size={16} className="ptv-text-muted" />
                        )}
                      </span>
                      <span className="ptv-check-text">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Social Share Callout */}
            <section className="ptv-share-callout">
              <div className="ptv-share-callout-text">
                <strong>Share this task with assignees or team members</strong>
                <p>Send via Facebook, Messenger, WhatsApp, or copy the direct link.</p>
              </div>
              <div className="ptv-share-callout-buttons">
                <button
                  type="button"
                  className="ptv-btn-secondary"
                  onClick={handleCopyLink}
                >
                  {copied ? <Check size={14} className="ptv-text-success" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  className="ptv-btn-primary"
                  onClick={handleShare}
                >
                  <Share2 size={14} />
                  <span>Share</span>
                </button>
              </div>
            </section>

            {/* Footer with security note & admin link */}
            <footer className="ptv-card-footer">
              <div className="ptv-security-badge">
                <ShieldCheck size={15} />
                <span>Verified ODC Team Workspace Record</span>
              </div>
              <Link to="/odc" className="ptv-link-admin">
                Log in to edit or update status &rarr;
              </Link>
            </footer>
          </article>
        ) : null}
      </main>
    </div>
  );
}
