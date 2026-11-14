// Firebase ID token verification and staff lookup for the email API.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { MailError, normalizeEmail, resolveMailboxAccess } from './mail.js';

const FIREBASE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export async function verifyFirebaseToken(request, projectId) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new MailError('Sign in to use email.', 401);
  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, algorithms: ['RS256'] });
    if (!payload.sub || (payload.auth_time && payload.auth_time * 1000 > Date.now() + 60000)) throw new Error('bad subject');
    return { uid: payload.sub, email: normalizeEmail(payload.email), token };
  } catch {
    throw new MailError('Your session expired. Sign in again.', 401);
  }
}

const fieldValue = value => {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fieldValue);
  return undefined;
};

/** Read the caller's staff record through Firestore REST with their own token, so Firestore rules still apply. */
export async function findStaff(user, projectId, fetcher = fetch) {
  if (!user.email) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'staff' }], where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: user.email } } }, limit: 2 } }),
  });
  if (!response.ok) throw new MailError('Could not check your staff permissions. Retry shortly.', 503);
  const rows = (await response.json()).filter(row => row.document);
  if (rows.length !== 1) return null; // missing or ambiguous records never grant access
  const fields = rows[0].document.fields || {};
  return { status: fieldValue(fields.status), allowedTabs: fieldValue(fields.allowedTabs), allowedActions: fieldValue(fields.allowedActions) };
}

export async function authorize(request, env, fetcher = fetch) {
  const user = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID);
  const adminUids = String(env.EMAIL_ADMIN_UIDS || '').split(',').map(v => v.trim()).filter(Boolean);
  const staff = adminUids.includes(user.uid) ? null : await findStaff(user, env.FIREBASE_PROJECT_ID, fetcher);
  const access = resolveMailboxAccess({ uid: user.uid, adminUids, staff });
  if (!access.mailboxes.length) throw new MailError('You do not have access to any mailbox.', 403);
  return { ...user, ...access };
}
