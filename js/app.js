// ===== UI Utilities =====
const ui = (() => {
  // --- Toast ---
  let toastTimer = null;
  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast toast-${type} toast-show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('toast-show'), 2800);
  }

  // --- Confirm modal ---
  let _resolve = null;
  function confirm(msg, okLabel = 'Eliminar') {
    document.getElementById('confirm-message').textContent = msg;
    document.getElementById('confirm-ok').textContent = okLabel;
    document.getElementById('modal-confirm').classList.remove('hidden');
    return new Promise(resolve => { _resolve = resolve; });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('confirm-ok').addEventListener('click', () => {
      document.getElementById('modal-confirm').classList.add('hidden');
      _resolve?.(true); _resolve = null;
    });
    document.getElementById('confirm-cancel').addEventListener('click', () => {
      document.getElementById('modal-confirm').classList.add('hidden');
      _resolve?.(false); _resolve = null;
    });
    document.getElementById('modal-confirm').addEventListener('click', e => {
      if (e.target === e.currentTarget) {
        document.getElementById('modal-confirm').classList.add('hidden');
        _resolve?.(false); _resolve = null;
      }
    });
  });

  // --- Pagination ---
  function pagination(containerId, total, page, pageSize, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    container.innerHTML = `
      <div class="pagination">
        <button class="pg-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">&#8249; Anterior</button>
        <span class="pg-info">Página ${page} de ${totalPages} <span class="pg-total">(${total} registros)</span></span>
        <button class="pg-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Siguiente &#8250;</button>
      </div>
    `;
    container.querySelectorAll('.pg-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => onPageChange(Number(btn.dataset.page)));
    });
  }

  // --- Debounce ---
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  return { toast, confirm, pagination, debounce };
})();

// ===== App Bootstrap =====
document.addEventListener('DOMContentLoaded', () => {

  // --- Tabs (scoped to parent module) ---
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      const module = tab.closest('.module');
      module.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      module.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      module.querySelector(`#tab-${target}`)?.classList.add('active');
    });
  });

  // --- Module routing (sidebar) ---
  const pageTitle = document.getElementById('page-title');
  const moduleTitles = { livestock: 'Hacienda', fields: 'Potreros', finance: 'Finanzas', reports: 'Reportes' };
  const moduleButtons = {
    livestock: document.getElementById('btn-new-animal'),
    fields:    document.getElementById('btn-new-field'),
    finance:   document.getElementById('btn-new-transaction'),
  };

  document.querySelectorAll('.nav-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const mod = item.dataset.module;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`module-${mod}`)?.classList.add('active');

      if (pageTitle && moduleTitles[mod]) pageTitle.textContent = moduleTitles[mod];

      if (mod === 'fields')   Fields.refresh();
      if (mod === 'reports')  Reports.refresh();

      Object.entries(moduleButtons).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('hidden', key !== mod);
      });
    });
  });

  // --- Sidebar toggle (mobile) ---
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  function closeSidebar() { document.body.classList.remove('sidebar-open'); }
  sidebarToggle?.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  sidebarOverlay?.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', closeSidebar);
  });

  // --- Dark mode ---
  const darkBtn = document.getElementById('btn-dark-toggle');
  function applyDark(on) {
    document.body.classList.toggle('dark', on);
    if (darkBtn) darkBtn.textContent = on ? '☀️' : '🌙';
  }
  applyDark(!!Storage.get('ag_dark_mode'));
  darkBtn?.addEventListener('click', () => {
    const next = !document.body.classList.contains('dark');
    Storage.set('ag_dark_mode', next);
    applyDark(next);
  });

  // --- Init modules ---
  Livestock.init();
  Finance.init();
  Fields.init();
  Reports.init();
});
