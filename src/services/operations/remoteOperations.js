import { httpsCallable } from 'firebase/functions';

// Cloudflare can implement this same named-operation contract without changing the screens.
export function createRemoteOperations({ auth, functions, mode, baseUrl, fetcher = fetch }) {
  async function call(name, data = {}) {
    if (mode === 'firebase-functions') return (await httpsCallable(functions, name)(data)).data;
    if (!auth.currentUser) throw new Error('Sign in to use this feature.');
    if (!baseUrl) throw new Error('Configure the operations API address before switching backends.');
    const url = new URL(`${baseUrl?.replace(/\/$/, '')}/${name}`);
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('The operations API needs an HTTPS address.');
    const token = await auth.currentUser.getIdToken();
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ data }) });
    const body = await response.json();
    if (!response.ok || body.error) {
      const error = new Error(body.error?.message || 'The operations service could not complete the request.');
      error.code = body.error?.code || 'unavailable'; throw error;
    }
    return body.data;
  }
  return {
    allowanceContext: () => call('allowanceContext'),
    allowanceCommand: (command, payload, commandId) => call('allowanceCommand', { command, payload, commandId }),
    demoContext: () => call('demoContext'),
    demoDashboard: (start, end) => call('demoDashboard', { start, end }),
    demoAvailableSlots: payload => call('demoAvailableSlots', payload),
    demoBookingHistory: id => call('demoBookingHistory', { id }),
    demoCommand: (command, payload, commandId) => call('demoCommand', { command, payload, commandId }),
    staffPermissionContext: () => call('staffModulePermissions', { operation: 'context' }),
    saveStaffPermissions: (staffId, changes) => call('staffModulePermissions', { operation: 'save', staffId, changes }),
    registerStaffIdentity: async () => {},
  };
}
