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
    const closeConfirm = (result) => {
      closeModalAnimated('modal-confirm', () => { _resolve?.(result); _resolve = null; });
    };
    document.getElementById('confirm-ok').addEventListener('click', () => closeConfirm(true));
    document.getElementById('confirm-cancel').addEventListener('click', () => closeConfirm(false));
    document.getElementById('modal-confirm').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeConfirm(false);
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

  // --- Count-up animation for stat values ---
  function countUp(el, target, duration = 600) {
    if (!el) return;
    const start = performance.now();
    const from  = parseFloat(el.textContent) || 0;
    const to    = parseFloat(target) || 0;
    if (from === to) { el.textContent = to; return; }
    const step = ts => {
      const progress = Math.min((ts - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // --- Field validation helpers ---
  function fieldError(inputEl, msg = '') {
    if (!inputEl) return;
    inputEl.classList.remove('field-success');
    inputEl.classList.add('field-error');
    // force reflow to re-trigger shake animation
    void inputEl.offsetWidth;
    let errEl = inputEl.parentElement.querySelector('.field-error-msg');
    if (!errEl) {
      errEl = document.createElement('span');
      errEl.className = 'field-error-msg';
      inputEl.parentElement.appendChild(errEl);
    }
    errEl.textContent = msg;
    inputEl.focus();
  }
  function fieldClear(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('field-error', 'field-success');
    const errEl = inputEl.parentElement?.querySelector('.field-error-msg');
    if (errEl) errEl.remove();
  }

  // --- Button loading state ---
  const _btnOrigText = new WeakMap();
  function btnLoading(btn, on) {
    if (!btn) return;
    if (on) {
      _btnOrigText.set(btn, btn.innerHTML);
      btn.classList.add('btn-loading');
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner"></span>${btn.dataset.loadingText || ''}`;
    } else {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
      if (_btnOrigText.has(btn)) { btn.innerHTML = _btnOrigText.get(btn); _btnOrigText.delete(btn); }
    }
  }

  return { toast, confirm, pagination, debounce, countUp, fieldError, fieldClear, btnLoading };
})();

// --- Modal close animation helper (global) ---
function closeModalAnimated(overlayId, afterFn) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) { afterFn?.(); return; }
  overlay.classList.add('modal-closing');
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    overlay.classList.remove('modal-closing');
    overlay.classList.add('hidden');
    afterFn?.();
  };
  const modal = overlay.querySelector('.modal');
  const target = modal || overlay;
  const onEnd = () => { target.removeEventListener('animationend', onEnd); done(); };
  target.addEventListener('animationend', onEnd);
  // Fallback in case animation doesn't fire (e.g. reduced-motion)
  setTimeout(done, 200);
}

// --- Empty state helper (global) ---
function emptyStateHTML(msg, btnLabel, btnAction) {
  const btn = btnLabel
    ? `<button class="btn btn-primary" onclick="${btnAction}">${btnLabel}</button>`
    : '';
  return `
    <tr class="empty-row"><td colspan="99">
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        <span class="empty-state-msg">${msg}</span>
        ${btn}
      </div>
    </td></tr>`;
}

// ===== App Bootstrap =====
document.addEventListener('DOMContentLoaded', async () => {

  const loadingEl    = document.getElementById('app-loading');
  const loginScreen  = document.getElementById('login-screen');

  // --- Init storage (Supabase o fallback localStorage) ---
  const { needsAuth } = await Storage.init();

  if (needsAuth) {
    if (loadingEl) loadingEl.classList.add('hidden');
    loginScreen?.classList.remove('hidden');

    document.getElementById('login-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const submitBtn = document.getElementById('login-submit');
      const errorEl   = document.getElementById('login-error');
      const card      = document.querySelector('.login-card');
      ui.btnLoading(submitBtn, true);
      errorEl.classList.add('hidden');
      try {
        await Storage.login(
          document.getElementById('login-email').value.trim(),
          document.getElementById('login-password').value
        );
        loginScreen.classList.add('hidden');
        _initApp();
      } catch (_) {
        ui.btnLoading(submitBtn, false);
        errorEl.classList.remove('hidden');
        if (card) {
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          card.addEventListener('animationend', () => card.classList.remove('shake'), { once: true });
        }
      }
    });

    // Toggle password visibility
    document.getElementById('toggle-password')?.addEventListener('click', () => {
      const pwd = document.getElementById('login-password');
      const btn = document.getElementById('toggle-password');
      if (!pwd) return;
      const show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      btn.innerHTML = show
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
    return; // esperar login
  }

  if (loadingEl) loadingEl.classList.add('hidden');
  _initApp();

  function _initApp() {

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

  // --- Module routing ---
  const pageTitle = document.getElementById('page-title');
  const moduleTitles = { home: 'Inicio', livestock: 'Ganadería', agricultura: 'Agricultura', fields: 'Potreros', finance: 'Finanzas', reports: 'Reportes' };
  const moduleButtons = {
    livestock:   document.getElementById('btn-new-animal'),
    agricultura: [document.getElementById('btn-new-cultivo'), document.getElementById('btn-new-forraje')],
    fields:      document.getElementById('btn-new-field'),
    finance:     [document.getElementById('btn-new-transaction'), document.getElementById('btn-new-vencimiento')],
  };

  function renderHomeStats() {
    const bar = document.getElementById('home-stats-bar');
    if (!bar) return;
    const animals  = (Storage.get('ag_animals') || []).filter(a => a.estado === 'activo');
    const fields   = (Storage.get('ag_fields') || []).filter(f => f.estado === 'activo');
    const parts = [];
    if (animals.length) parts.push(`<strong>${animals.length}</strong> animales activos`);
    if (fields.length)  parts.push(`<strong>${fields.length}</strong> potreros`);
    bar.innerHTML = parts.length
      ? parts.join(' <span class="hs-dot">·</span> ')
      : 'Sin datos registrados aún.';
  }

  function navigateTo(mod) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    document.querySelector(`.nav-item[data-module="${mod}"]`)?.classList.add('active');
    const moduleEl = document.getElementById(`module-${mod}`);
    if (moduleEl) {
      // Re-trigger animation by removing and re-adding active
      moduleEl.classList.remove('active');
      void moduleEl.offsetWidth;
      moduleEl.classList.add('active');
    }

    if (pageTitle && moduleTitles[mod]) pageTitle.textContent = moduleTitles[mod];

    if (mod === 'agricultura') Agricultura.refresh();
    if (mod === 'fields')      Fields.refresh();
    if (mod === 'reports')     Reports.refresh();
    if (mod === 'home')        renderHomeStats();

    Object.entries(moduleButtons).forEach(([key, val]) => {
      const btns = Array.isArray(val) ? val : [val];
      btns.forEach(btn => { if (btn) btn.classList.toggle('hidden', key !== mod); });
    });
  }

  document.querySelectorAll('.nav-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(item.dataset.module);
    });
  });

  // --- Home card buttons ---
  document.querySelectorAll('.home-card[data-navigate]').forEach(card => {
    card.addEventListener('click', () => navigateTo(card.dataset.navigate));
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

  // --- Usuario en topbar ---
  const user = Storage.getUser();
  if (user) {
    const userEl = document.getElementById('topbar-user');
    if (userEl) userEl.textContent = user.email;
  }

  // --- Logout ---
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await Storage.logout();
    location.reload();
  });

  // --- Init modules ---
  Livestock.init();
  Finance.init();
  Fields.init();
  Agricultura.init();
  Reports.init();

  // --- Render home stats on initial load ---
  renderHomeStats();

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
  } // fin _initApp
});

// ===== Service Worker (PWA) =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}
