/* Shared UI helpers: formatting, badges, toasts, dialogs, states. */

const ui = {

  /* ---------- formatting ---------- */

  esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  },

  money(n) {
    const v = Number(n ?? 0);
    return 'Rs. ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  date(iso) {
    if (!iso) return '—';
    const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  todayInput() {
    // Local date (YYYY-MM-DD) — matches how the backend stores LocalDate.
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  },

  /* ---------- badges ---------- */

  statusClass(status) {
    return String(status || '').toLowerCase().replaceAll('_', '-');
  },

  badge(status) {
    const cls = ui.statusClass(status);
    return `<span class="badge badge-${cls}">${ui.esc(String(status || '').replaceAll('_', ' '))}</span>`;
  },

  /* ---------- loading / empty states ---------- */

  loading(text = 'Loading...') {
    return `<div class="loading-state"><span class="spinner"></span><span>${ui.esc(text)}</span></div>`;
  },

  empty(icon, title, text, actionHtml = '') {
    return `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>${ui.esc(title)}</h3>
        <p>${ui.esc(text)}</p>
        ${actionHtml}
      </div>`;
  },

  /* ---------- toasts ---------- */

  toast(message, type = 'success', timeout = 3800) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span>${ui.esc(message)}</span>
      <button class="toast-close" aria-label="Dismiss">&times;</button>`;
    el.querySelector('.toast-close').addEventListener('click', () => dismiss());
    container.appendChild(el);

    const dismiss = () => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 260);
    };
    setTimeout(dismiss, timeout);
  },

  /* ---------- modal ---------- */

  closeModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
  },

  /** Opens a centered modal. Returns the element so callers can bind events. */
  openModal({ title, bodyHtml, footerHtml = '' }) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${ui.esc(title)}">
          <div class="modal-head">
            <h3 class="modal-title">${ui.esc(title)}</h3>
            <button class="modal-close" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-actions">${footerHtml}</div>` : ''}
        </div>
      </div>`;
    const overlay = root.querySelector('.modal-overlay');
    const modalEl = root.querySelector('.modal');
    root.querySelector('.modal-close').addEventListener('click', () => ui.closeModal());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) ui.closeModal(); });
    return modalEl;
  },

  /** Promise-based confirmation dialog. */
  confirm({ title, message, confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const modalEl = ui.openModal({
        title,
        bodyHtml: `<p style="margin:0;color:var(--text-2);font-size:.92rem;">${ui.esc(message)}</p>`,
        footerHtml: `
          <button class="btn btn-secondary" data-modal-cancel>Cancel</button>
          <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-modal-ok>${ui.esc(confirmText)}</button>`,
      });
      modalEl.querySelector('[data-modal-cancel]').addEventListener('click', () => { ui.closeModal(); resolve(false); });
      modalEl.querySelector('[data-modal-ok]').addEventListener('click', () => { ui.closeModal(); resolve(true); });
    });
  },

  /* ---------- misc ---------- */

  debounce(fn, ms = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  },
};
