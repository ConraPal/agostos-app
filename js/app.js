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

  // --- UUID (evita colisiones de IDs con Date.now en ms) ---
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  // --- HTML escape (previene XSS en innerHTML con datos de usuario) ---
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

  return { toast, confirm, pagination, debounce, countUp, fieldError, fieldClear, btnLoading, escapeHtml, uid };
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

// ===== Loader de partials =====
async function loadPartials() {
  const NAMES = ['home', 'livestock', 'agricultura', 'fields', 'finance', 'insumos', 'reports'];
  await Promise.all(NAMES.map(async name => {
    try {
      const res = await fetch(`partials/module-${name}.html`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const el = document.getElementById(`partial-module-${name}`);
      if (el) el.outerHTML = html;
    } catch (err) {
      console.warn(`No se pudo cargar partial module-${name}:`, err.message);
    }
  }));
}

// ===== App Bootstrap =====
document.addEventListener('DOMContentLoaded', async () => {

  const loadingEl    = document.getElementById('app-loading');
  const loginScreen  = document.getElementById('login-screen');

  // --- Cargar partials de módulos ---
  await loadPartials();

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

    // Modo demo
    document.getElementById('btn-demo')?.addEventListener('click', () => {
      _loadDemoData();
      localStorage.setItem('ag_demo_mode', 'true');
      loginScreen.classList.add('hidden');
      _initApp();
      document.getElementById('demo-banner')?.classList.remove('hidden');
      document.getElementById('btn-create-account')?.classList.remove('hidden');
    });

    document.getElementById('btn-create-account')?.addEventListener('click', () => {
      document.getElementById('modal-signup')?.classList.remove('hidden');
    });

    // Signup modal
    document.getElementById('link-signup')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('modal-signup')?.classList.remove('hidden');
    });
    document.getElementById('modal-signup-close')?.addEventListener('click', () => document.getElementById('modal-signup').classList.add('hidden'));
    document.getElementById('btn-cancel-signup')?.addEventListener('click', () => document.getElementById('modal-signup').classList.add('hidden'));
    document.getElementById('form-signup')?.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('su-email').value.trim();
      const pw    = document.getElementById('su-password').value;
      const errEl = document.getElementById('signup-error');
      const okEl  = document.getElementById('signup-success');
      const btn   = document.getElementById('btn-submit-signup');
      errEl.classList.add('hidden'); okEl.classList.add('hidden');
      ui.btnLoading(btn, true);
      try {
        await Storage.signUp(email, pw);
        okEl.textContent = 'Cuenta creada. Revisá tu email para confirmar el registro.';
        okEl.classList.remove('hidden');
        ui.btnLoading(btn, false);
      } catch (err) {
        errEl.textContent = err.message || 'Error al crear cuenta.';
        errEl.classList.remove('hidden');
        ui.btnLoading(btn, false);
      }
    });

    // Recovery modal
    document.getElementById('link-recovery')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('modal-recovery')?.classList.remove('hidden');
    });
    document.getElementById('modal-recovery-close')?.addEventListener('click', () => document.getElementById('modal-recovery').classList.add('hidden'));
    document.getElementById('btn-cancel-recovery')?.addEventListener('click', () => document.getElementById('modal-recovery').classList.add('hidden'));
    document.getElementById('form-recovery')?.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('rec-email').value.trim();
      const errEl = document.getElementById('recovery-error');
      const okEl  = document.getElementById('recovery-success');
      const btn   = document.getElementById('btn-submit-recovery');
      errEl.classList.add('hidden'); okEl.classList.add('hidden');
      ui.btnLoading(btn, true);
      try {
        await Storage.resetPassword(email, window.location.href);
        okEl.textContent = 'Email enviado. Revisá tu bandeja para el link de restablecimiento.';
        okEl.classList.remove('hidden');
        ui.btnLoading(btn, false);
      } catch (err) {
        errEl.textContent = err.message || 'Error al enviar email.';
        errEl.classList.remove('hidden');
        ui.btnLoading(btn, false);
      }
    });

    // Deeplink recovery: ?type=recovery
    if (new URLSearchParams(location.search).get('type') === 'recovery') {
      loginScreen.classList.add('hidden');
      document.getElementById('modal-new-password')?.classList.remove('hidden');
      document.getElementById('form-new-password')?.addEventListener('submit', async e => {
        e.preventDefault();
        const pw    = document.getElementById('np-password').value;
        const errEl = document.getElementById('new-pw-error');
        const btn   = document.getElementById('btn-submit-new-pw');
        errEl.classList.add('hidden');
        ui.btnLoading(btn, true);
        try {
          await Storage.updatePassword(pw);
          document.getElementById('modal-new-password').classList.add('hidden');
          ui.toast('Contraseña actualizada. Ingresá con tu nueva contraseña.');
          loginScreen.classList.remove('hidden');
        } catch (err) {
          errEl.textContent = err.message || 'Error al actualizar contraseña.';
          errEl.classList.remove('hidden');
          ui.btnLoading(btn, false);
        }
      });
    }

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
  const moduleTitles = { home: 'Inicio', livestock: 'Ganadería', agricultura: 'Agricultura', fields: 'Potreros', finance: 'Finanzas', insumos: 'Insumos', reports: 'Reportes' };
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

  const VALID_MODULES = new Set(['home', 'livestock', 'agricultura', 'fields', 'finance', 'insumos', 'reports']);

  function navigateTo(mod) {
    if (!VALID_MODULES.has(mod)) mod = 'home';
    history.replaceState(null, '', '#' + mod);

    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    document.querySelector(`.nav-item[data-module="${mod}"]`)?.classList.add('active');
    const moduleEl = document.getElementById(`module-${mod}`);
    if (moduleEl) {
      moduleEl.classList.remove('active');
      void moduleEl.offsetWidth;
      moduleEl.classList.add('active');
    }

    if (pageTitle && moduleTitles[mod]) pageTitle.textContent = moduleTitles[mod];

    if (mod === 'agricultura') Agricultura.refresh();
    if (mod === 'fields')      Fields.refresh();
    if (mod === 'insumos')     Insumos.refresh();
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
    if (localStorage.getItem('ag_demo_mode') === 'true') {
      const DEMO_KEYS = ['ag_animals','ag_movements','ag_history','ag_reproduction','ag_sanidad',
        'ag_transactions','ag_fields','ag_plan_sanitario','ag_pesadas','ag_insumos','ag_insumos_movs','ag_demo_mode'];
      DEMO_KEYS.forEach(k => localStorage.removeItem(k));
    } else {
      await Storage.logout();
    }
    location.reload();
  });

  // --- Init modules ---
  Livestock.init();
  Finance.init();
  Fields.init();
  Agricultura.init();
  Insumos.init();
  Reports.init();

  // --- Hash routing: leer hash inicial y escuchar cambios ---
  const initialMod = location.hash.slice(1);
  if (VALID_MODULES.has(initialMod)) {
    navigateTo(initialMod);
  } else {
    navigateTo('home');
  }
  window.addEventListener('hashchange', () => {
    const mod = location.hash.slice(1);
    if (VALID_MODULES.has(mod)) navigateTo(mod);
  });

  // --- Render home stats on initial load ---
  renderHomeStats();

  // --- Alertas / Recordatorios ---
  const ALERTA_KEY = 'ag_alertas';

  function getTodayStr() { return new Date().toISOString().slice(0, 10); }

  // Días hábiles transcurridos desde una fecha ISO hasta hoy
  function diasHabilesDesde(fechaISO) {
    if (!fechaISO) return 0;
    let count = 0;
    const end = new Date(); end.setHours(0, 0, 0, 0);
    let cur = new Date(fechaISO + 'T00:00:00');
    while (cur < end) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  // Animales con RFID no declarado y >= 7 días hábiles desde aplicación
  function getSenasaUrgentes() {
    return (Storage.get('ag_animals') || [])
      .filter(a => a.rfid && !a.rfid_declarado_senasa && diasHabilesDesde(a.rfid_fecha_aplicacion) >= 7)
      .sort((a, b) => (a.rfid_fecha_aplicacion || '').localeCompare(b.rfid_fecha_aplicacion || ''));
  }

  function getInsumosAlerts() {
    const today = getTodayStr();
    const limit30 = new Date(); limit30.setDate(limit30.getDate() + 30);
    const l30 = limit30.toISOString().slice(0, 10);
    const insumos = Storage.get('ag_insumos') || [];
    const bajo    = insumos.filter(i => i.stock_minimo != null && i.stock_actual <= i.stock_minimo);
    const vencer  = insumos.filter(i => i.vencimiento && i.vencimiento <= l30);
    return { bajo, vencer };
  }

  function getPlanSanitarioAlerts() {
    const limit30 = new Date(); limit30.setDate(limit30.getDate() + 30);
    const limitStr = limit30.toISOString().slice(0, 10);
    return (Storage.get('ag_plan_sanitario') || [])
      .filter(p => p.proximo_vencimiento && p.proximo_vencimiento <= limitStr)
      .sort((a, b) => a.proximo_vencimiento.localeCompare(b.proximo_vencimiento));
  }

  function refreshAlertBadge() {
    const today = getTodayStr();
    const userCount   = (Storage.get(ALERTA_KEY) || []).filter(a => !a.completado && a.fecha <= today).length;
    const senasaCount = getSenasaUrgentes().length;
    const planCount   = getPlanSanitarioAlerts().length;
    const ins         = getInsumosAlerts();
    const insCount    = ins.bajo.length + ins.vencer.filter(i => i.vencimiento < today).length;
    const badge = document.getElementById('bell-badge');
    if (!badge) return;
    const total = userCount + senasaCount + planCount + insCount;
    badge.textContent = total || '';
    badge.style.display = total ? 'flex' : 'none';
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
          <span class="alert-item-title">${ui.escapeHtml(a.titulo)}</span>
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

    // Sección SENASA — animales con RFID a punto de vencer o vencidos
    const urgentes = getSenasaUrgentes();
    const senasaHTML = urgentes.length ? `
      <div class="alert-section-title alert-section-senasa">🔴 SENASA — RFID sin declarar</div>
      ${urgentes.map(a => {
        const dias = diasHabilesDesde(a.rfid_fecha_aplicacion);
        const restantes = Math.max(0, 10 - dias);
        return `<div class="alert-item alert-item-overdue alert-item-senasa">
          <div class="alert-item-info">
            <span class="alert-item-title">${ui.escapeHtml(a.caravana)}${a.nombre ? ' — ' + ui.escapeHtml(a.nombre) : ''}</span>
            <span class="alert-item-date">${dias} d.h. — ${restantes > 0 ? restantes + ' d.h. restantes' : '¡VENCIDO!'}</span>
          </div>
          <div class="alert-item-actions">
            <button class="alert-btn-senasa-goto" title="Ver en SENASA" aria-label="Ir al tab SENASA" onclick="navigateTo('reports');document.querySelector('[data-tab=rpt-senasa]')?.click()">→</button>
          </div>
        </div>`;
      }).join('')}
    ` : '';

    // Sección Plan Sanitario
    const planAlertas = getPlanSanitarioAlerts();
    const planHTML = planAlertas.length ? `
      <div class="alert-section-title alert-section-senasa">💉 Plan Sanitario — vencimientos</div>
      ${planAlertas.map(p => {
        const venc = p.proximo_vencimiento;
        const overdue = venc < today;
        return `<div class="alert-item alert-item-${overdue ? 'overdue' : 'upcoming'}">
          <div class="alert-item-info">
            <span class="alert-item-title">${ui.escapeHtml(p.nombre)} <small style="font-weight:400;color:var(--color-muted)">(${ui.escapeHtml(p.aplica_a)})</small></span>
            <span class="alert-item-date">${fmtD(venc)}${overdue ? ' — VENCIDO' : ''}</span>
          </div>
          <div class="alert-item-actions">
            <button class="alert-btn-senasa-goto" title="Ir a Plan Sanitario" onclick="navigateTo('livestock');document.querySelector('[data-tab=plan-sanitario]')?.click()">→</button>
          </div>
        </div>`;
      }).join('')}
    ` : '';

    // Sección Insumos
    const insAlerts = getInsumosAlerts();
    const insItems  = [...insAlerts.bajo.map(i => ({ tipo: 'bajo', ...i })), ...insAlerts.vencer.map(i => ({ tipo: 'vencer', ...i }))];
    const insHTML = insItems.length ? `
      <div class="alert-section-title alert-section-senasa">📦 Insumos — stock / vencimientos</div>
      ${insItems.map(i => `<div class="alert-item alert-item-${i.tipo === 'bajo' || (i.vencimiento && i.vencimiento < today) ? 'overdue' : 'upcoming'}">
        <div class="alert-item-info">
          <span class="alert-item-title">${ui.escapeHtml(i.nombre)}</span>
          <span class="alert-item-date">${i.tipo === 'bajo' ? `Stock bajo (${i.stock_actual} / mín. ${i.stock_minimo})` : `Vence: ${fmtD(i.vencimiento)}`}</span>
        </div>
        <div class="alert-item-actions">
          <button class="alert-btn-senasa-goto" title="Ir a Insumos" onclick="navigateTo('insumos')">→</button>
        </div>
      </div>`).join('')}
    ` : '';

    const listEl = document.getElementById('alerts-list');
    const userContent = section('Vencidos', overdue, 'overdue') +
                        section('Hoy', dueToday, 'today') +
                        section('Próximos 30 días', upcoming, 'upcoming');
    const allContent = senasaHTML + planHTML + insHTML + userContent;
    listEl.innerHTML = allContent || '<p class="alerts-empty">Sin recordatorios pendientes.</p>';

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
    data.push({ id: ui.uid(), titulo, fecha, completado: false });
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

  // ===== Onboarding Wizard =====
  const Onboarding = (function () {
    const _obState = { step: 1, fields: [], counts: {}, actividad: 'mixto' };
    const TIPOS = ['vaca', 'toro', 'ternero', 'novillo', 'vaquillona'];
    const TIPO_LABELS = { vaca: 'Vacas', toro: 'Toros', ternero: 'Terneros', novillo: 'Novillos', vaquillona: 'Vaquillonas' };
    const STEP_TITLES = { 1: 'Tus potreros', 2: 'Tu hacienda', 3: '¡Listo para empezar!' };

    function checkAndStart() {
      const animals = Storage.get('ag_animals') || [];
      const fields  = Storage.get('ag_fields')  || [];
      if (!Storage.get('ag_onboarded') && animals.length === 0 && fields.length === 0) {
        _openWizard();
      }
    }

    function _openWizard() {
      _obState.step = 1;
      _obState.fields = [];
      _obState.counts = {};
      _obState.actividad = 'mixto';
      document.getElementById('ob-fields-list').innerHTML = '';
      _obAddFieldRow();
      _obGoToStep(1);
      document.getElementById('modal-onboarding').classList.remove('hidden');
    }

    function _obGoToStep(n) {
      _obState.step = n;
      document.getElementById('ob-title').textContent = STEP_TITLES[n];
      document.getElementById('ob-step-label').textContent = 'Paso ' + n + ' de 3';
      document.querySelectorAll('.ob-dot').forEach(d => d.classList.toggle('ob-dot-active', Number(d.dataset.step) === n));
      document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('ob-step-active'));
      document.getElementById('ob-step-' + n).classList.add('ob-step-active');
      if (n === 2) _obBuildHaciendaTable();
      if (n === 3) _obBuildSummary();
    }

    function _obAddFieldRow() {
      const row = document.createElement('div');
      row.className = 'ob-field-row';
      row.innerHTML =
        '<input type="text" data-col="nombre" placeholder="Nombre del potrero">' +
        '<input type="number" data-col="hectareas" placeholder="Ha" min="0" step="0.1">' +
        '<select data-col="pastura">' +
          '<option value="Natural">Natural</option>' +
          '<option value="Mejorada">Mejorada</option>' +
          '<option value="Verdeo">Verdeo</option>' +
          '<option value="Otro">Otro</option>' +
        '</select>' +
        '<button type="button" class="ob-remove-row" aria-label="Eliminar fila">&times;</button>';
      row.querySelector('.ob-remove-row').addEventListener('click', function () {
        row.remove();
        _obUpdateRemoveButtons();
      });
      document.getElementById('ob-fields-list').appendChild(row);
      _obUpdateRemoveButtons();
    }

    function _obUpdateRemoveButtons() {
      const rows = document.querySelectorAll('#ob-fields-list .ob-field-row');
      rows.forEach(function (r) { r.querySelector('.ob-remove-row').disabled = rows.length === 1; });
    }

    function _obSyncFieldsFromDOM() {
      _obState.fields = [];
      document.querySelectorAll('#ob-fields-list .ob-field-row').forEach(function (row) {
        const nombre = row.querySelector('[data-col="nombre"]').value.trim();
        const ha     = parseFloat(row.querySelector('[data-col="hectareas"]').value) || null;
        const past   = row.querySelector('[data-col="pastura"]').value;
        if (nombre) _obState.fields.push({ nombre: nombre, hectareas: ha, pastura: past });
      });
    }

    function _obBuildHaciendaTable() {
      const tbody = document.getElementById('ob-hacienda-tbody');
      const potreros = _obState.fields.map(function (f) { return f.nombre; });
      const allRows = potreros.concat(['Sin potrero']);
      tbody.innerHTML = '';
      allRows.forEach(function (nombre) {
        const tr = document.createElement('tr');
        tr.dataset.potrero = nombre;
        let cells = '<td>' + (nombre || 'Sin potrero') + '</td>';
        TIPOS.forEach(function (tipo) {
          const saved = (_obState.counts[nombre] || {})[tipo] || 0;
          cells += '<td><input class="ob-count-input" type="number" min="0" value="' + saved + '" data-tipo="' + tipo + '"></td>';
        });
        tr.innerHTML = cells;
        tbody.appendChild(tr);
      });
    }

    function _obSyncCountsFromDOM() {
      _obState.counts = {};
      document.querySelectorAll('#ob-hacienda-tbody tr').forEach(function (tr) {
        const potrero = tr.dataset.potrero;
        _obState.counts[potrero] = {};
        tr.querySelectorAll('.ob-count-input').forEach(function (inp) {
          _obState.counts[potrero][inp.dataset.tipo] = parseInt(inp.value) || 0;
        });
      });
    }

    function _obBuildSummary() {
      let total = 0;
      Object.keys(_obState.counts).forEach(function (p) {
        TIPOS.forEach(function (t) { total += (_obState.counts[p][t] || 0); });
      });
      const ACTIVIDAD_LABEL = { cria: 'Cría', invernada: 'Invernada', mixto: 'Mixto', tambo: 'Tambo' };
      const act = ACTIVIDAD_LABEL[_obState.actividad] || 'Mixto';
      document.getElementById('ob-done-summary').textContent =
        'Actividad: ' + act + '. Registramos ' + _obState.fields.length + ' potreros y ' + total + ' animales como punto de partida.';
    }

    function _obSaveAndClose() {
      // Guardar potreros
      const existingFields = Storage.get('ag_fields') || [];
      const newFields = _obState.fields.map(function (f) {
        return { id: ui.uid(), nombre: f.nombre, hectareas: f.hectareas, pastura: f.pastura || 'Natural', estado: 'activo', fecha_implantacion: null, observaciones: '' };
      });
      Storage.set('ag_fields', existingFields.concat(newFields));

      // Guardar animales
      const existingAnimals = Storage.get('ag_animals') || [];
      let counter = existingAnimals.length + 1;
      const newAnimals = [];
      const potreroKeys = _obState.fields.map(function (f) { return f.nombre; }).concat(['Sin potrero']);
      potreroKeys.forEach(function (potreroNombre) {
        const counts = _obState.counts[potreroNombre] || {};
        TIPOS.forEach(function (tipo) {
          const qty = parseInt(counts[tipo]) || 0;
          for (var i = 0; i < qty; i++) {
            const padded = String(counter).padStart(4, '0');
            newAnimals.push({
              id: ui.uid(),
              caravana: '#OB-' + padded,
              tipo: tipo,
              nombre: '',
              raza: '',
              nacimiento: '',
              potrero: potreroNombre === 'Sin potrero' ? '' : potreroNombre,
              estado: 'activo',
              peso: null,
              observaciones: 'Ingresado en configuración inicial.',
              castracion_fecha: null
            });
            counter++;
          }
        });
      });
      Storage.set('ag_animals', existingAnimals.concat(newAnimals));
      Storage.set('ag_onboarded', true);
      Storage.set('ag_actividad', _obState.actividad);

      closeModalAnimated('modal-onboarding', function () {
        ui.toast('¡Listo! Ahora cargá tus animales en Ganadería.');
        navigateTo('livestock');
      });
      renderHomeStats();
      if (typeof Livestock !== 'undefined') Livestock.refresh();
      if (typeof Fields !== 'undefined') Fields.refresh();
    }

    function _obSkip() {
      Storage.set('ag_onboarded', true);
      closeModalAnimated('modal-onboarding', null);
    }

    function _bindEvents() {
      document.getElementById('ob-skip').addEventListener('click', _obSkip);
      document.getElementById('ob-add-field').addEventListener('click', _obAddFieldRow);

      document.getElementById('ob-next-1').addEventListener('click', function () {
        _obState.actividad = document.getElementById('ob-actividad').value || 'mixto';
        _obSyncFieldsFromDOM();
        _obGoToStep(2);
      });
      document.getElementById('ob-prev-2').addEventListener('click', function () {
        _obSyncCountsFromDOM();
        _obGoToStep(1);
      });
      document.getElementById('ob-next-2').addEventListener('click', function () {
        _obSyncCountsFromDOM();
        _obGoToStep(3);
      });
      document.getElementById('ob-finish').addEventListener('click', _obSaveAndClose);

      document.getElementById('modal-onboarding').addEventListener('click', function (e) {
        if (e.target === e.currentTarget) _obSkip();
      });
    }

    _bindEvents();
    return { checkAndStart: checkAndStart };
  })();

  Onboarding.checkAndStart();
  } // fin _initApp
});

// ===== Demo data =====
function _loadDemoData() {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

  const fields = [
    { id: uid(), nombre: 'La Loma',    hectareas: 120, pastura: 'Natural',  estado: 'activo', observaciones: '' },
    { id: uid(), nombre: 'El Bajo',    hectareas:  85, pastura: 'Mejorada', estado: 'activo', observaciones: '' },
    { id: uid(), nombre: 'San Roque',  hectareas:  60, pastura: 'Verdeo',   estado: 'activo', observaciones: '' },
  ];
  Storage.set('ag_fields', fields);

  const animals = [
    { id: uid(), caravana: 'AR-001', nombre: 'Negra',   tipo: 'vaca',       raza: 'Aberdeen Angus', nacimiento: daysAgo(1800), potrero: 'La Loma',   estado: 'activo', peso: 480, observaciones: '' },
    { id: uid(), caravana: 'AR-002', nombre: 'Blanca',  tipo: 'vaca',       raza: 'Hereford',       nacimiento: daysAgo(1600), potrero: 'La Loma',   estado: 'activo', peso: 510, observaciones: '' },
    { id: uid(), caravana: 'AR-003', nombre: 'Rubia',   tipo: 'vaca',       raza: 'Limousin',       nacimiento: daysAgo(1400), potrero: 'La Loma',   estado: 'activo', peso: 490, observaciones: '' },
    { id: uid(), caravana: 'AR-004', nombre: '',        tipo: 'vaca',       raza: 'Aberdeen Angus', nacimiento: daysAgo(1500), potrero: 'El Bajo',   estado: 'activo', peso: 460, observaciones: '' },
    { id: uid(), caravana: 'AR-005', nombre: 'Mora',    tipo: 'vaca',       raza: 'Aberdeen Angus', nacimiento: daysAgo(1700), potrero: 'El Bajo',   estado: 'activo', peso: 500, observaciones: '' },
    { id: uid(), caravana: 'AR-006', nombre: '',        tipo: 'vaca',       raza: 'Hereford',       nacimiento: daysAgo(1300), potrero: 'El Bajo',   estado: 'activo', peso: 455, observaciones: '' },
    { id: uid(), caravana: 'AR-007', nombre: '',        tipo: 'vaca',       raza: 'Hereford',       nacimiento: daysAgo(1900), potrero: 'San Roque', estado: 'activo', peso: 520, observaciones: '' },
    { id: uid(), caravana: 'AR-008', nombre: 'Fina',    tipo: 'vaca',       raza: 'Limousin',       nacimiento: daysAgo(1200), potrero: 'San Roque', estado: 'activo', peso: 475, observaciones: '' },
    { id: uid(), caravana: 'AR-009', nombre: 'Toro 1',  tipo: 'toro',       raza: 'Aberdeen Angus', nacimiento: daysAgo(1100), potrero: 'La Loma',   estado: 'activo', peso: 720, observaciones: 'Toro reproductor' },
    { id: uid(), caravana: 'AR-010', nombre: 'Toro 2',  tipo: 'toro',       raza: 'Hereford',       nacimiento: daysAgo(1050), potrero: 'El Bajo',   estado: 'activo', peso: 690, observaciones: '' },
    { id: uid(), caravana: 'AR-011', nombre: '',        tipo: 'ternero',    raza: 'Aberdeen Angus', nacimiento: daysAgo(120),  potrero: 'La Loma',   estado: 'activo', peso: 180, castracion_fecha: null, observaciones: '' },
    { id: uid(), caravana: 'AR-012', nombre: '',        tipo: 'ternero',    raza: 'Hereford',       nacimiento: daysAgo(110),  potrero: 'La Loma',   estado: 'activo', peso: 165, castracion_fecha: null, observaciones: '' },
    { id: uid(), caravana: 'AR-013', nombre: '',        tipo: 'novillo',    raza: 'Aberdeen Angus', nacimiento: daysAgo(400),  potrero: 'El Bajo',   estado: 'activo', peso: 380, observaciones: '' },
    { id: uid(), caravana: 'AR-014', nombre: '',        tipo: 'vaquillona', raza: 'Hereford',       nacimiento: daysAgo(380),  potrero: 'San Roque', estado: 'activo', peso: 340, observaciones: '' },
    { id: uid(), caravana: 'AR-015', nombre: '',        tipo: 'vaquillona', raza: 'Limousin',       nacimiento: daysAgo(360),  potrero: 'San Roque', estado: 'activo', peso: 355, observaciones: '' },
  ];
  Storage.set('ag_animals', animals);

  Storage.set('ag_transactions', [
    { id: uid(), fecha: daysAgo(60),  tipo: 'ingreso', categoria: 'Terneros machos',  monto: 450000, moneda: 'ARS', descripcion: 'Venta terneros destete', peso_kg: 1200, precio_kg: 375, observaciones: '' },
    { id: uid(), fecha: daysAgo(45),  tipo: 'ingreso', categoria: 'Novillos',         monto: 680000, moneda: 'ARS', descripcion: 'Venta novillos gordo',   peso_kg: 1700, precio_kg: 400, observaciones: '' },
    { id: uid(), fecha: daysAgo(30),  tipo: 'gasto',   categoria: 'Vacunas',          monto:  85000, moneda: 'ARS', descripcion: 'Aftosa y brucelosis',    observaciones: '' },
    { id: uid(), fecha: daysAgo(20),  tipo: 'gasto',   categoria: 'Combustibles',     monto:  42000, moneda: 'ARS', descripcion: 'Gasoil tractor',         observaciones: '' },
    { id: uid(), fecha: daysAgo(10),  tipo: 'ingreso', categoria: 'Arrendamiento',    monto: 200000, moneda: 'ARS', descripcion: 'Arrendamiento San Roque', observaciones: '' },
    { id: uid(), fecha: daysAgo(5),   tipo: 'impuesto', categoria: 'Impuesto inmobiliario', monto: 55000, moneda: 'ARS', descripcion: 'Inmobiliario rural', observaciones: '' },
  ]);

  Storage.set('ag_sanidad', [
    { id: uid(), fecha: daysAgo(30), animalId: null, caravana: '', animalNombre: '', tipo: 'vacunación', descripcion: 'Aftosa', producto: 'Aftovaxpur', dosis: '2ml', observaciones: 'Todo el rodeo' },
    { id: uid(), fecha: daysAgo(60), animalId: null, caravana: '', animalNombre: '', tipo: 'desparasitación', descripcion: 'Desparasitación general', producto: 'Ivermectina 1%', dosis: '1ml/50kg', observaciones: '' },
  ]);

  Storage.set('ag_plan_sanitario', [
    { id: uid(), nombre: 'Aftosa',     frecuencia_meses: 6,  aplica_a: 'todo el rodeo', proximo_vencimiento: daysAgo(-150) },
    { id: uid(), nombre: 'Brucelosis', frecuencia_meses: 8,  aplica_a: 'vacas',          proximo_vencimiento: daysAgo(-60)  },
    { id: uid(), nombre: 'Carbunclo',  frecuencia_meses: 12, aplica_a: 'todo el rodeo', proximo_vencimiento: daysAgo(-200) },
  ]);

  Storage.set('ag_reproduction', [
    { id: uid(), año: new Date().getFullYear() - 1, fecha_entrada_toros: daysAgo(400), fecha_salida_toros: daysAgo(310), tacto_fecha: daysAgo(280), vacas_total: 8, vacas_positivas: 7, vacas_negativas: 1, prenez_pct: 87.5, ia_realizada: false, ia_fecha: '', ia_toro: '', ia_prenez_pct: 0, paricion_inicio: daysAgo(160), paricion_fin: daysAgo(100), partos: 7, muertes_paricion: 0, destete_fecha: daysAgo(30), terneros_machos_destete: 4, terneras_hembras_destete: 3, muertes_destete: 0, indice_destete: 100, mortalidad_total: 0, observaciones: 'Buena parición' },
  ]);
}

// ===== Service Worker (PWA) =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type !== 'SW_UPDATED') return;
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerHTML = 'Nueva versión disponible. <button id="sw-reload-btn" style="margin-left:8px;padding:2px 10px;border-radius:6px;border:none;background:#fff;color:#2d6a4f;font-weight:700;cursor:pointer">Recargar</button>';
    toast.className = 'toast toast-success toast-show';
    document.getElementById('sw-reload-btn')?.addEventListener('click', () => location.reload());
  });
}
