/* UI helpers: toasts, modal, badges, formatters. */

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

const TOAST_STYLES = {
  success: 'bg-emerald-600',
  error: 'bg-rose-600',
  info: 'bg-slate-800',
  warn: 'bg-amber-500',
};

export function toast(message, type = 'info', timeout = 4200) {
  const root = document.getElementById('toast-root');
  const box = document.createElement('div');
  box.className = `${TOAST_STYLES[type] || TOAST_STYLES.info} text-white text-sm font-medium rounded-lg shadow-lg px-4 py-3 transition-opacity duration-300`;
  box.textContent = message;
  root.appendChild(box);
  setTimeout(() => {
    box.style.opacity = '0';
    setTimeout(() => box.remove(), 350);
  }, timeout);
}

let modalWrap = null;

export function openModal({ title, body = '', confirmText = null, cancelText = 'Cerrar', onConfirm = null, size = 'max-w-xl' }) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/60 p-4';
  wrap.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl w-full ${size} max-h-[92vh] flex flex-col">
      <div class="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <h3 class="font-semibold text-slate-800">${esc(title)}</h3>
        <button data-modal-close class="text-slate-400 hover:text-slate-700 text-2xl leading-none">&times;</button>
      </div>
      <div data-modal-body class="p-5 overflow-y-auto scroll-thin"></div>
      <div data-modal-footer class="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
        <button data-modal-close class="btn-secondary">${esc(cancelText)}</button>
        ${confirmText ? `<button data-modal-confirm class="btn-primary">${esc(confirmText)}</button>` : ''}
      </div>
    </div>`;
  document.getElementById('modal-root').appendChild(wrap);

  const bodyEl = wrap.querySelector('[data-modal-body]');
  if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = body;

  wrap.addEventListener('click', (event) => {
    if (event.target === wrap || event.target.closest('[data-modal-close]')) closeModal();
  });

  const confirmBtn = wrap.querySelector('[data-modal-confirm]');
  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', async () => {
      const original = confirmBtn.textContent;
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span class="spinner"></span> Procesando…';
      try {
        const result = await onConfirm(wrap);
        if (result !== false) closeModal();
      } catch (err) {
        toast(err.message || 'Error inesperado', 'error');
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = original;
      }
    });
  }

  modalWrap = wrap;
  return { root: wrap, body: bodyEl, close: closeModal };
}

export function closeModal() {
  if (modalWrap) {
    modalWrap.remove();
    modalWrap = null;
  }
}

export function confirmDialog(title, message, onConfirm, { confirmText = 'Confirmar', danger = false } = {}) {
  return openModal({
    title,
    body: `<p class="text-sm text-slate-600">${esc(message)}</p>`,
    confirmText,
    onConfirm,
    size: 'max-w-md',
  });
}

const BADGES = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-rose-100 text-rose-700',
  PENDING: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-brand-100 text-brand-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  IN_TRUCK: 'bg-slate-100 text-slate-600',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  ADMIN: 'bg-violet-100 text-violet-700',
  WAREHOUSE: 'bg-amber-100 text-amber-700',
  DRIVER: 'bg-brand-100 text-brand-700',
  MOCK_GPS: 'bg-rose-100 text-rose-700',
  SPEED_ANOMALY: 'bg-orange-100 text-orange-700',
  TIMESTAMP_SKEW: 'bg-amber-100 text-amber-700',
  STALE_SCAN: 'bg-amber-100 text-amber-700',
  PIN_LOCKOUT: 'bg-rose-100 text-rose-700',
  DEVICE_LIMIT: 'bg-rose-100 text-rose-700',
  CROSS_TENANT: 'bg-rose-100 text-rose-700',
  MANIFEST_MISMATCH: 'bg-orange-100 text-orange-700',
  DUPLICATE_SCAN: 'bg-slate-100 text-slate-600',
};

export function badge(value, extra = '') {
  const cls = BADGES[value] || 'bg-slate-100 text-slate-600';
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls} ${extra}">${esc(value || '—')}</span>`;
}

export function skeleton(cards = 3) {
  return `
    <div class="animate-pulse space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-${cards} gap-4">
        ${Array.from({ length: cards }).map(() => '<div class="doc-card h-28"></div>').join('')}
      </div>
      <div class="doc-card h-64"></div>
    </div>`;
}

export function emptyState(message, colSpan = 6) {
  return `<tr><td colspan="${colSpan}" class="text-center text-slate-400 py-10 text-sm">${esc(message)}</td></tr>`;
}
