/**
 * UIModule — shared DOM utilities
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// Must escape quotes, not just &<>: callers interpolate into attribute
// positions (e.g. aria-label="..."), where an unescaped quote allows
// attribute injection.
export function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

export function showToast(type: 'info' | 'success' | 'error' | 'warning', message: string): void {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const msg = document.createElement('span');
  msg.className = 'toast__msg';
  msg.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast__close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '✕';

  toast.appendChild(msg);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  const dismiss = () => {
    if (toast.classList.contains('toast--out')) return;
    toast.classList.add('toast--out');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', dismiss);
  setTimeout(dismiss, 4500);
}
