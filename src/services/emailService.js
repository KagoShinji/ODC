// Client for the Cloudflare Worker email API (/api/email). Every call carries the Firebase ID token.
import { auth } from '../lib/firebase';

async function call(path, { method = 'GET', body } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in again to use email.');
  const token = await user.getIdToken();
  const response = await fetch(`/api/email${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let message = '';
    try { message = (await response.json()).error?.message || ''; } catch { /* non-JSON error page */ }
    const error = new Error(message || (response.status === 404 ? 'The email service is not available on this deployment.' : `Email request failed (${response.status}).`));
    error.status = response.status;
    throw error;
  }
  return response;
}

export const getEmailContext = async () => (await call('/context')).json();

export async function listThreads({ mailbox = 'all', folder = 'inbox', q = '', before } = {}) {
  const params = new URLSearchParams({ mailbox, folder });
  if (q.trim()) params.set('q', q.trim());
  if (before) params.set('before', String(before));
  return (await call(`/threads?${params}`)).json();
}

export const getThread = async id => (await call(`/threads/${id}`)).json();
export const updateThread = async (id, changes) => (await call(`/threads/${id}`, { method: 'PATCH', body: changes })).json();
export const sendEmail = async draft => (await call('/send', { method: 'POST', body: draft })).json();

export async function downloadAttachment({ id, filename }) {
  const blob = await (await call(`/attachments/${id}`)).blob();
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, contentType: file.type || 'application/octet-stream', base64: String(reader.result).split(',')[1] || '', size: file.size });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
