const Agricultura = (() => {
  const FIELDS_KEY   = 'ag_fields';
  const CULTIVOS_KEY = 'ag_crop_history';
  const FORRAJE_KEY  = 'ag_forraje';

  const formatDate = iso => iso ? new Date(iso).toLocaleDateString('es-AR') : '—';

  const PAGE_SIZE = 20;
  let cultivosPage = 1;
  let forrajePage  = 1;

  let editingCultivoId = null;
  let editingForrajeId = null;

  // --- Helpers ---
  function getFields() {
    return (Storage.get(FIELDS_KEY) || []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  function populatePotreroSelect(selectId, includeAll = false) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const fields = getFields();
    const allOpt = includeAll ? '<option value="">Todos los potreros</option>' : '';
    sel.innerHTML = allOpt + fields.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('');
  }

  // --- Stats ---
  function renderStats() {
    const cultivos = Storage.get(CULTIVOS_KEY) || [];
    const forraje  = Storage.get(FORRAJE_KEY)  || [];

    const rollos  = forraje.filter(f => f.tipo === 'rollo').reduce((s, f) => s + (Number(f.cantidad) || 0), 0);
    const fardos  = forraje.filter(f => f.tipo === 'fardo').reduce((s, f) => s + (Number(f.cantidad) || 0), 0);
    const potrerosCultivo = new Set(cultivos.filter(c => c.potrero_id).map(c => c.potrero_id)).size;

    ui.countUp(document.getElementById('stat-agro-cultivos'), cultivos.length);
    ui.countUp(document.getElementById('stat-agro-rollos'),   rollos);
    ui.countUp(document.getElementById('stat-agro-fardos'),   fardos);
    ui.countUp(document.getElementById('stat-agro-potreros'), potrerosCultivo);
  }

  // Extract year from a cultivo record (supports both old año field and new fecha_siembra)
  const cultivoYear = c => c.fecha_siembra ? parseInt(c.fecha_siembra.slice(0, 4), 10) : (c.año || null);

  // --- Tab: Cultivos ---
  function renderCultivos() {
    const potreroFilter = document.getElementById('cultivos-potrero-filter').value;
    const yrEl          = document.getElementById('cultivos-year-filter');
    const yearFilter    = yrEl ? yrEl.value : '';
    const allCultivos   = Storage.get(CULTIVOS_KEY) || [];
    let data = [...allCultivos];
    if (potreroFilter) data = data.filter(c => c.potrero_id === potreroFilter);
    if (yearFilter)    data = data.filter(c => String(cultivoYear(c)) === yearFilter);
    data.sort((a, b) => {
      const ya = cultivoYear(a) || 0, yb = cultivoYear(b) || 0;
      return yb - ya || a.potrero.localeCompare(b.potrero, 'es');
    });

    // Repopulate potrero filter
    populatePotreroSelect('cultivos-potrero-filter', true);
    if (potreroFilter) document.getElementById('cultivos-potrero-filter').value = potreroFilter;

    // Populate year filter
    const allYears = [...new Set(allCultivos.map(c => cultivoYear(c)).filter(Boolean))].sort((a, b) => b - a);
    if (yrEl) {
      const cur = yrEl.value;
      yrEl.innerHTML = '<option value="">Todos los años</option>' + allYears.map(y => `<option value="${y}">${y}</option>`).join('');
      if (cur) yrEl.value = cur;
    }

    const tbody = document.getElementById('cultivos-tbody');
    if (!data.length) {
      tbody.innerHTML = emptyStateHTML(
        potreroFilter || yearFilter ? 'No hay cultivos que coincidan con el filtro.' : 'Aún no registraste cultivos.',
        potreroFilter || yearFilter ? '' : '+ Agregar cultivo',
        "document.getElementById('btn-new-cultivo').click()"
      );
      ui.pagination('cultivos-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }
    const paged = data.slice((cultivosPage - 1) * PAGE_SIZE, cultivosPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(c => {
      const rendimiento = c.rendimiento != null
        ? c.rendimiento.toFixed(0) + '\u00a0kg/ha'
        : (c.kg_cosechados && c.ha_cosechadas ? (c.kg_cosechados / c.ha_cosechadas).toFixed(0) + '\u00a0kg/ha' : '—');
      const siembra = c.fecha_siembra ? formatDate(c.fecha_siembra) : (c.año || '—');
      return `
      <tr>
        <td>${c.potrero}</td>
        <td>${siembra}</td>
        <td><span class="badge badge-cultivo-${c.tipo}">${c.tipo === 'cultivo' ? 'Cultivo' : 'Pastura'}</span></td>
        <td>${c.detalle}</td>
        <td>${rendimiento}</td>
        <td>${c.notas || '—'}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit-cultivo" data-id="${c.id}" title="Editar" aria-label="Editar cultivo ${c.potrero}">✏️</button>
          <button class="action-btn danger" data-action="delete-cultivo" data-id="${c.id}" title="Eliminar" aria-label="Eliminar cultivo ${c.potrero}">🗑️</button>
        </td>
      </tr>`;
    }).join('');
    ui.pagination('cultivos-pagination', data.length, cultivosPage, PAGE_SIZE, p => { cultivosPage = p; renderCultivos(); });
  }

  function openModalCultivo(id = null) {
    editingCultivoId = id;
    document.getElementById('form-cultivo').reset();
    document.getElementById('modal-cultivo-title').textContent = id ? 'Editar cultivo' : 'Agregar cultivo';
    document.getElementById('fc-rendimiento').value = '';
    populatePotreroSelect('fc-potrero');

    if (id) {
      const c = (Storage.get(CULTIVOS_KEY) || []).find(x => x.id === id);
      if (!c) return;
      document.getElementById('fc-potrero').value        = c.potrero_id;
      document.getElementById('fc-fecha-siembra').value  = c.fecha_siembra || '';
      document.getElementById('fc-tipo').value           = c.tipo;
      document.getElementById('fc-detalle').value        = c.detalle;
      document.getElementById('fc-kg-cosechados').value  = c.kg_cosechados ?? '';
      document.getElementById('fc-ha-cosechadas').value  = c.ha_cosechadas ?? '';
      document.getElementById('fc-rendimiento').value    = c.rendimiento != null ? c.rendimiento.toFixed(0) : '';
      document.getElementById('fc-notas').value          = c.notas || '';
    }
    document.getElementById('modal-cultivo').classList.remove('hidden');
  }

  function closeModalCultivo() {
    closeModalAnimated('modal-cultivo', () => { editingCultivoId = null; });
  }

  function saveCultivo(e) {
    e.preventDefault();
    const sel           = document.getElementById('fc-potrero');
    const potId         = sel.value;
    const potNom        = sel.options[sel.selectedIndex]?.text || '';
    const fecha_siembra = document.getElementById('fc-fecha-siembra').value || null;
    const año           = fecha_siembra ? parseInt(fecha_siembra.slice(0, 4), 10) : null;
    const tipo          = document.getElementById('fc-tipo').value;
    const detalle       = document.getElementById('fc-detalle').value.trim();
    const kg_cosechados = parseFloat(document.getElementById('fc-kg-cosechados').value) || null;
    const ha_cosechadas = parseFloat(document.getElementById('fc-ha-cosechadas').value) || null;
    const rendimiento   = (kg_cosechados && ha_cosechadas) ? kg_cosechados / ha_cosechadas : null;
    const notas         = document.getElementById('fc-notas').value.trim();

    const data = Storage.get(CULTIVOS_KEY) || [];
    const wasEditing = editingCultivoId;
    if (editingCultivoId) {
      const idx = data.findIndex(c => c.id === editingCultivoId);
      if (idx !== -1) data[idx] = { ...data[idx], potrero_id: potId, potrero: potNom, fecha_siembra, año, tipo, detalle, kg_cosechados, ha_cosechadas, rendimiento, notas };
    } else {
      data.push({ id: String(Date.now()), potrero_id: potId, potrero: potNom, fecha_siembra, año, tipo, detalle, kg_cosechados, ha_cosechadas, rendimiento, notas });
    }
    Storage.set(CULTIVOS_KEY, data);
    cultivosPage = 1;
    closeModalCultivo();
    refresh();
    ui.toast(wasEditing ? 'Cultivo actualizado.' : 'Cultivo registrado.');
  }

  function removeCultivo(id) {
    ui.confirm('¿Eliminar este cultivo?').then(ok => {
      if (!ok) return;
      Storage.set(CULTIVOS_KEY, (Storage.get(CULTIVOS_KEY) || []).filter(c => c.id !== id));
      refresh();
      ui.toast('Cultivo eliminado.');
    });
  }

  // --- Tab: Forraje ---
  function renderForraje() {
    const potreroFilter = document.getElementById('forraje-potrero-filter').value;
    const yrEl          = document.getElementById('forraje-year-filter');
    const yearFilter    = yrEl ? yrEl.value : '';
    const allForraje    = Storage.get(FORRAJE_KEY) || [];
    let data = [...allForraje];
    if (potreroFilter) data = data.filter(f => f.potrero_id === potreroFilter);
    if (yearFilter)    data = data.filter(f => String(f.año) === yearFilter);
    data.sort((a, b) => b.año - a.año || a.potrero.localeCompare(b.potrero, 'es'));

    // Repopulate potrero filter
    populatePotreroSelect('forraje-potrero-filter', true);
    if (potreroFilter) document.getElementById('forraje-potrero-filter').value = potreroFilter;

    // Populate year filter
    const allYears = [...new Set(allForraje.map(f => f.año))].sort((a, b) => b - a);
    if (yrEl) {
      const cur = yrEl.value;
      yrEl.innerHTML = '<option value="">Todos los años</option>' + allYears.map(y => `<option value="${y}">${y}</option>`).join('');
      if (cur) yrEl.value = cur;
    }

    const tbody = document.getElementById('forraje-tbody');
    if (!data.length) {
      tbody.innerHTML = emptyStateHTML(
        'Aún no registraste datos de forraje.',
        '+ Agregar forraje',
        "document.getElementById('btn-new-forraje').click()"
      );
      ui.pagination('forraje-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }
    const paged = data.slice((forrajePage - 1) * PAGE_SIZE, forrajePage * PAGE_SIZE);
    tbody.innerHTML = paged.map(f => `
      <tr>
        <td>${f.potrero}</td>
        <td>${f.año}</td>
        <td><span class="badge badge-forraje-${f.tipo}">${f.tipo === 'rollo' ? 'Rollo' : 'Fardo'}</span></td>
        <td>${f.cantidad}</td>
        <td>${f.cortes ?? '—'}</td>
        <td>${f.observaciones || '—'}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit-forraje" data-id="${f.id}" title="Editar" aria-label="Editar forraje ${f.año} ${f.potrero}">✏️</button>
          <button class="action-btn danger" data-action="delete-forraje" data-id="${f.id}" title="Eliminar" aria-label="Eliminar forraje ${f.año} ${f.potrero}">🗑️</button>
        </td>
      </tr>
    `).join('');
    ui.pagination('forraje-pagination', data.length, forrajePage, PAGE_SIZE, p => { forrajePage = p; renderForraje(); });
  }

  function openModalForraje(id = null) {
    editingForrajeId = id;
    document.getElementById('form-forraje').reset();
    document.getElementById('modal-forraje-title').textContent = id ? 'Editar forraje' : 'Agregar forraje';
    populatePotreroSelect('ffo-potrero');

    if (id) {
      const f = (Storage.get(FORRAJE_KEY) || []).find(x => x.id === id);
      if (!f) return;
      document.getElementById('ffo-potrero').value  = f.potrero_id;
      document.getElementById('ffo-año').value      = f.año;
      document.getElementById('ffo-tipo').value     = f.tipo;
      document.getElementById('ffo-cantidad').value = f.cantidad;
      document.getElementById('ffo-cortes').value   = f.cortes ?? '';
      document.getElementById('ffo-obs').value      = f.observaciones || '';
    } else {
      document.getElementById('ffo-año').value = new Date().getFullYear();
    }
    document.getElementById('modal-forraje').classList.remove('hidden');
  }

  function closeModalForraje() {
    closeModalAnimated('modal-forraje', () => { editingForrajeId = null; });
  }

  function saveForraje(e) {
    e.preventDefault();
    const sel    = document.getElementById('ffo-potrero');
    const potId  = sel.value;
    const potNom = sel.options[sel.selectedIndex]?.text || '';
    const año    = parseInt(document.getElementById('ffo-año').value, 10);
    const tipo   = document.getElementById('ffo-tipo').value;
    const cantidad = parseInt(document.getElementById('ffo-cantidad').value, 10);
    const cortes = parseInt(document.getElementById('ffo-cortes').value, 10) || null;
    const observaciones = document.getElementById('ffo-obs').value.trim();

    const data = Storage.get(FORRAJE_KEY) || [];
    const wasEditing = editingForrajeId;
    if (editingForrajeId) {
      const idx = data.findIndex(f => f.id === editingForrajeId);
      if (idx !== -1) data[idx] = { ...data[idx], potrero_id: potId, potrero: potNom, año, tipo, cantidad, cortes, observaciones };
    } else {
      data.push({ id: String(Date.now()), potrero_id: potId, potrero: potNom, año, tipo, cantidad, cortes, observaciones });
    }
    Storage.set(FORRAJE_KEY, data);
    forrajePage = 1;
    closeModalForraje();
    refresh();
    ui.toast(wasEditing ? 'Forraje actualizado.' : 'Forraje registrado.');
  }

  function removeForraje(id) {
    ui.confirm('¿Eliminar este registro de forraje?').then(ok => {
      if (!ok) return;
      Storage.set(FORRAJE_KEY, (Storage.get(FORRAJE_KEY) || []).filter(f => f.id !== id));
      refresh();
      ui.toast('Registro eliminado.');
    });
  }

  // --- Refresh ---
  function refresh() {
    renderStats();
    renderCultivos();
    renderForraje();
  }

  // --- Init ---
  function init() {
    // Cultivos
    document.getElementById('btn-new-cultivo').addEventListener('click', () => openModalCultivo());
    document.getElementById('modal-cultivo-close').addEventListener('click', closeModalCultivo);
    document.getElementById('btn-cancel-cultivo').addEventListener('click', closeModalCultivo);
    document.getElementById('modal-cultivo').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalCultivo();
    });
    document.getElementById('form-cultivo').addEventListener('submit', saveCultivo);

    // Reactive rendimiento
    const updateRendimiento = () => {
      const kg = parseFloat(document.getElementById('fc-kg-cosechados').value);
      const ha = parseFloat(document.getElementById('fc-ha-cosechadas').value);
      document.getElementById('fc-rendimiento').value = (kg && ha) ? (kg / ha).toFixed(0) : '';
    };
    document.getElementById('fc-kg-cosechados').addEventListener('input', updateRendimiento);
    document.getElementById('fc-ha-cosechadas').addEventListener('input', updateRendimiento);
    document.getElementById('cultivos-potrero-filter').addEventListener('change', () => { cultivosPage = 1; renderCultivos(); });
    document.getElementById('cultivos-year-filter')?.addEventListener('change', () => { cultivosPage = 1; renderCultivos(); });
    document.getElementById('cultivos-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit-cultivo')   openModalCultivo(btn.dataset.id);
      if (btn.dataset.action === 'delete-cultivo') removeCultivo(btn.dataset.id);
    });

    // Forraje
    document.getElementById('btn-new-forraje').addEventListener('click', () => openModalForraje());
    document.getElementById('modal-forraje-close').addEventListener('click', closeModalForraje);
    document.getElementById('btn-cancel-forraje').addEventListener('click', closeModalForraje);
    document.getElementById('modal-forraje').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalForraje();
    });
    document.getElementById('form-forraje').addEventListener('submit', saveForraje);
    document.getElementById('forraje-potrero-filter').addEventListener('change', () => { forrajePage = 1; renderForraje(); });
    document.getElementById('forraje-year-filter')?.addEventListener('change', () => { forrajePage = 1; renderForraje(); });
    document.getElementById('forraje-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit-forraje')   openModalForraje(btn.dataset.id);
      if (btn.dataset.action === 'delete-forraje') removeForraje(btn.dataset.id);
    });

    refresh();
  }

  return { init, refresh };
})();
