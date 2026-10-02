/**
 * Normalizes any login identifier (username, custom handle, or standard email)
 * into a valid Firebase Auth email format.
 * 
 * Examples:
 * - "john" -> "john@odc.internal"
 * - "staff_01" -> "staff_01@odc.internal"
 * - "mark@company" -> "mark@company.internal"
 * - "admin@odc.com" -> "admin@odc.com"
 */
export function normalizeAuthIdentifier(input) {
  if (!input) return '';
  const trimmed = String(input).trim().toLowerCase();
  
  // If plain username without @: convert to @odc.internal
  if (!trimmed.includes('@')) {
    const cleanUser = trimmed.replace(/[^a-z0-9._-]/g, '') || 'staff';
    return `${cleanUser}@odc.internal`;
  }
  
  // If it has @ but missing a domain TLD (e.g. user@odc)
  const parts = trimmed.split('@');
  const user = parts[0].replace(/[^a-z0-9._-]/g, '') || 'staff';
  const domain = parts[1] || 'odc.internal';
  
  if (!domain.includes('.')) {
    return `${user}@${domain}.internal`;
  }
  
  return `${user}@${domain}`;
}

/**
 * Returns a human-friendly display version of an identifier.
 * If it's an internal username (ends with @odc.internal), returns just the username.
 */
export function formatDisplayIdentifier(email) {
  if (!email) return '';
  const str = String(email).trim();
  if (str.toLowerCase().endsWith('@odc.internal')) {
    return str.slice(0, -'@odc.internal'.length);
  }
  return str;
}
