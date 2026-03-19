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
document.addEventListener('DOMContentLoaded', async () => {

  // --- Init storage (Supabase o fallback localStorage) ---
  const loadingEl = document.getElementById('app-loading');
  await Storage.init();
  if (loadingEl) loadingEl.classList.add('hidden');

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

  // --- Alertas / Recordatorios ---
  const ALERTA_KEY = 'ag_alertas';

  function getTodayStr() { return new Date().toISOString().slice(0, 10); }

  function refreshAlertBadge() {
    const today = getTodayStr();
    const count = (Storage.get(ALERTA_KEY) || [])
      .filter(a => !a.completado && a.fecha <= today).length;
    const badge = document.getElementById('bell-badge');
    if (!badge) return;
    badge.textContent = count || '';
    badge.style.display = count ? 'flex' : 'none';
  }

  function renderAlertsList() {
    const today  = getTodayStr();
    const limit  = new Date(); limit.setDate(limit.getDate() + 30);
    const limitStr = limit.toISOString().slice(0, 10);

    const all = (Storage.get(ALERTA_KEY) || []).filter(a => !a.completado);
    const overdue   = all.filter(a => a.fecha < today).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const dueToday  = all.filter(a => a.fecha === today);
    const upcoming  = all.filter(a => a.fecha > today && a.fecha <= limitStr).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const fmtD = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

    const itemHTML = (a, cls) => `
      <div class="alert-item alert-item-${cls}" data-id="${a.id}">
        <div class="alert-item-info">
          <span class="alert-item-title">${a.titulo}</span>
          <span class="alert-item-date">${fmtD(a.fecha)}</span>
        </div>
        <div class="alert-item-actions">
          <button class="alert-btn-ok" data-id="${a.id}" title="Completar" aria-label="Marcar como completado">✓</button>
          <button class="alert-btn-del" data-id="${a.id}" title="Eliminar" aria-label="Eliminar recordatorio">×</button>
        </div>
      </div>`;

    const section = (title, items, cls) => items.length
      ? `<div class="alert-section-title">${title}</div>${items.map(a => itemHTML(a, cls)).join('')}`
      : '';

    const listEl = document.getElementById('alerts-list');
    const content = section('Vencidos', overdue, 'overdue') +
                    section('Hoy', dueToday, 'today') +
                    section('Próximos 30 días', upcoming, 'upcoming');
    listEl.innerHTML = content || '<p class="alerts-empty">Sin recordatorios pendientes.</p>';

    // Set default date for the add form
    document.getElementById('alerta-fecha').value = today;
  }

  function toggleAlertsPanel() {
    const panel = document.getElementById('alerts-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    if (!isHidden) return;
    renderAlertsList();
  }

  // Bell button
  document.getElementById('btn-alertas')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleAlertsPanel();
  });

  // Close panel
  document.getElementById('alerts-panel-close')?.addEventListener('click', () => {
    document.getElementById('alerts-panel')?.classList.add('hidden');
  });

  // Close on outside click
  document.addEventListener('click', e => {
    const panel = document.getElementById('alerts-panel');
    const bell  = document.getElementById('btn-alertas');
    if (panel && !panel.classList.contains('hidden') && !panel.contains(e.target) && e.target !== bell && !bell?.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  // Add new alerta
  document.getElementById('form-alerta')?.addEventListener('submit', e => {
    e.preventDefault();
    const titulo = document.getElementById('alerta-titulo').value.trim();
    const fecha  = document.getElementById('alerta-fecha').value;
    if (!titulo || !fecha) return;
    const data = Storage.get(ALERTA_KEY) || [];
    data.push({ id: String(Date.now()), titulo, fecha, completado: false });
    Storage.set(ALERTA_KEY, data);
    document.getElementById('alerta-titulo').value = '';
    renderAlertsList();
    refreshAlertBadge();
  });

  // Complete / delete via event delegation
  document.getElementById('alerts-list')?.addEventListener('click', e => {
    const okBtn  = e.target.closest('.alert-btn-ok');
    const delBtn = e.target.closest('.alert-btn-del');
    if (okBtn) {
      const id = okBtn.dataset.id;
      const data = Storage.get(ALERTA_KEY) || [];
      const idx = data.findIndex(a => a.id === id);
      if (idx !== -1) { data[idx].completado = true; Storage.set(ALERTA_KEY, data); }
      renderAlertsList();
      refreshAlertBadge();
    }
    if (delBtn) {
      const id = delBtn.dataset.id;
      Storage.set(ALERTA_KEY, (Storage.get(ALERTA_KEY) || []).filter(a => a.id !== id));
      renderAlertsList();
      refreshAlertBadge();
    }
  });

  refreshAlertBadge();
});
