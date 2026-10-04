export function getNextMonthDueDate(currentDueDate, billingDay) {
  const current = new Date(`${currentDueDate}T00:00:00`);
  if (Number.isNaN(current.getTime())) throw new Error('Invalid billing due date.');
  const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  const maxDays = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  const day = Math.max(1, Math.min(Number(billingDay) || current.getDate(), maxDays));
  const result = new Date(next.getFullYear(), next.getMonth(), day);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}
