import { operationsBackend } from './operations/backend';

export const getDemoContext = () => operationsBackend().demoContext();
export const getDemoDashboard = (start, end) => operationsBackend().demoDashboard(start, end);
export const getDemoSlots = payload => operationsBackend().demoAvailableSlots(payload);
export const getDemoHistory = id => operationsBackend().demoBookingHistory(id);
export const runDemoCommand = (command, payload, commandId) => operationsBackend().demoCommand(command, payload, commandId);
export const newDemoId = () => crypto.randomUUID().replaceAll('-', '_');
export function demoError(error) {
  if (error?.code === 'failed-precondition' && /index/i.test(error.message || '')) {
    return /currently building/i.test(error.message)
      ? 'The scheduling index is still building in Firebase. Wait a few minutes, then retry.'
      : 'A scheduling index is missing. Ask the project administrator to deploy the Firestore indexes, then retry.';
  }
  if (error?.code === 'permission-denied') return 'Your scheduling access could not be verified. Ask an administrator to check your permissions and the deployed Firestore rules.';
  if (['functions/not-found', 'functions/unavailable', 'functions/internal'].includes(error?.code)) return 'The demo scheduling service is unavailable. Confirm that its Firebase functions and indexes are deployed, then retry.';
  if (error?.code === 'functions/unauthenticated') return 'Sign in again. If you are signed in, check the Firebase App Check configuration.';
  return error?.message || 'The operation could not be completed. Please retry.';
}
