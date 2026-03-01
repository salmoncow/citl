/**
 * UIModule — shared DOM utilities
 */

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

export function showToast(type: 'info' | 'success' | 'error' | 'warning', message: string): void {
  const prefix = { info: '[INFO]', success: '[OK]', error: '[ERROR]', warning: '[WARN]' }[type] ?? '[INFO]';
  console.log(`${prefix} ${message}`);
}
