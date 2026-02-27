/**
 * UIModule — shared DOM utilities
 *
 * Phase 1: minimal helpers. Toast notifications will be expanded
 * into a proper component in Phase 2+.
 */

/**
 * Escapes a string for safe insertion into HTML text content.
 * Uses the textContent trick — no regex, no edge cases.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Shows a minimal toast-style message in the browser console (Phase 1 stub).
 * Will be replaced with a proper UI component in Phase 2+.
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {string} message
 */
export function showToast(type, message) {
  const prefix = { info: '[INFO]', success: '[OK]', error: '[ERROR]', warning: '[WARN]' }[type] || '[INFO]';
  console.log(`${prefix} ${message}`);
}
