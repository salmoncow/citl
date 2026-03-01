/**
 * UIModule — shared DOM utilities
 */

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
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
