const Fields = (() => {
  const KEY = 'ag_fields';
  const ANIMALS_KEY = 'ag_animals';
  const CULTIVOS_KEY = 'ag_crop_history';
  const FORRAJE_KEY = 'ag_forraje';

  const PASTURAS = ['Natural', 'Mejorada', 'Verdeo', 'Otro'];
  const ESTADOS = { activo: 'Activo', descanso: 'Descanso', clausurado: 'Clausurado' };

  let editingId = null;

  // --- Helpers ---
  function getAll() { return Storage.get(KEY) || []; }
  function saveAll(data) { Storage.set(KEY, data); }
  function getActiveAnimals() { return (Storage.get(ANIMALS_KEY) || []).filter(a => a.estado === 'activo'); }

  // --- Stats ---
  function renderStats() {
    const fields = getAll();
    const animals = getActiveAnimals();

    const animalCount = {};
    animals.forEach(a => {
      if (!a.potrero) return;
      animalCount[a.potrero] = (animalCount[a.potrero] || 0) + 1;
    });

    const total  = fields.length;
    const totalHa = fields.reduce((s, f) => s + (Number(f.hectareas) || 0), 0);
    const enUso  = fields.filter(f => (animalCount[f.nombre] || 0) > 0).length;
    const libres = total - enUso;

    document.getElementById('stat-fields-total').textContent  = total;
    document.getElementById('stat-fields-ha').textContent     = totalHa % 1 === 0 ? totalHa : totalHa.toFixed(1);
    document.getElementById('stat-fields-en-uso').textContent = enUso;
    document.getElementById('stat-fields-libres').textContent = libres;
  }

  // --- Tab: Potreros ---
  function renderTable() {
    const search = document.getElementById('search-fields').value.toLowerCase();
    let data = getAll();
    if (search) data = data.filter(f =>
      f.nombre?.toLowerCase().includes(search) ||
      f.pastura?.toLowerCase().includes(search)
    );
    data.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const tbody = document.getElementById('fields-tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay potreros registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(f => `
      <tr>
        <td>${f.nombre}</td>
        <td>${f.hectareas ? f.hectareas + '\u00a0ha' : '—'}</td>
        <td>${f.pastura || '—'}</td>
        <td><span class="badge badge-field-${f.estado}">${ESTADOS[f.estado] || f.estado}</span></td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${f.id}" title="Editar">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${f.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  // --- Tab: Stock ---
  function renderStock() {
    const fields   = getAll();
    const animals  = getActiveAnimals();

    const grouped = {};
    animals.forEach(a => {
      if (!a.potrero) return;
      if (!grouped[a.potrero]) grouped[a.potrero] = [];
      grouped[a.potrero].push(a);
    });

    const rows = [];

    [...fields].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).forEach(f => {
      const list = grouped[f.nombre] || [];
      rows.push({ nombre: f.nombre, hectareas: f.hectareas, list, registrado: true });
      delete grouped[f.nombre];
    });

    // Potreros con animales pero no registrados
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b, 'es')).forEach(([nombre, list]) => {
      rows.push({ nombre, hectareas: null, list, registrado: false });
    });

    const tbody = document.getElementById('stock-tbody');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Sin datos de stock.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const count    = r.list.length;
      const preview  = r.list.slice(0, 4).map(a => a.caravana).join(', ') + (r.list.length > 4 ? ` +${r.list.length - 4}` : '');
      const nameCell = r.registrado
        ? r.nombre
        : `${r.nombre} <span class="badge-no-reg">sin registrar</span>`;
      return `
        <tr>
          <td>${nameCell}</td>
          <td>${r.hectareas ? r.hectareas + '\u00a0ha' : '—'}</td>
          <td>${count > 0 ? `<strong>${count}</strong>` : '<span class="text-muted">0</span>'}</td>
          <td class="caravanas-cell">${count > 0 ? preview : '—'}</td>
        </tr>`;
    }).join('');
  }

  // --- Modal ---
  function openModal(id = null) {
    editingId = id;
    document.getElementById('form-field').reset();

    if (id) {
      const f = getAll().find(f => f.id === id);
      if (!f) return;
      document.getElementById('modal-field-title').textContent = 'Editar potrero';
      document.getElementById('ff-nombre').value    = f.nombre;
      document.getElementById('ff-hectareas').value = f.hectareas || '';
      document.getElementById('ff-pastura').value   = f.pastura || '';
      document.getElementById('ff-estado').value    = f.estado;
      document.getElementById('ff-obs').value       = f.observaciones || '';
    } else {
      document.getElementById('modal-field-title').textContent = 'Nuevo potrero';
    }

    document.getElementById('modal-field').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-field').classList.add('hidden');
    editingId = null;
  }

  // --- Save ---
  function saveField(e) {
    e.preventDefault();
    const nombre       = document.getElementById('ff-nombre').value.trim();
    const hectareas    = parseFloat(document.getElementById('ff-hectareas').value) || null;
    const pastura      = document.getElementById('ff-pastura').value;
    const estado       = document.getElementById('ff-estado').value;
    const observaciones = document.getElementById('ff-obs').value.trim();

    const data = getAll();

    if (editingId) {
      const idx = data.findIndex(f => f.id === editingId);
      if (idx !== -1) data[idx] = { ...data[idx], nombre, hectareas, pastura, estado, observaciones };
    } else {
      data.push({ id: String(Date.now()), nombre, hectareas, pastura, estado, observaciones });
    }

    const isNew = !editingId;
    saveAll(data);
    closeModal();
    refresh();
    ui.toast(isNew ? 'Potrero registrado.' : 'Potrero actualizado.');
  }

  // --- Delete ---
  function remove(id) {
    const f = getAll().find(f => f.id === id);
    if (!f) return;
    ui.confirm(`¿Eliminar el potrero "${f.nombre}"?`).then(ok => {
      if (!ok) return;
      saveAll(getAll().filter(f => f.id !== id));
      refresh();
      ui.toast(`Potrero "${f.nombre}" eliminado.`);
    });
  }

  // --- Helpers: populate potrero selects ---
  function populatePotreroSelect(selectId, includeAll = false) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const fields = getAll().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const allOpt = includeAll ? '<option value="">Todos los potreros</option>' : '';
    sel.innerHTML = allOpt + fields.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('');
  }

  // --- Tab: Cultivos ---
  let editingCultivoId = null;

  function renderCultivos() {
    const filter = document.getElementById('cultivos-potrero-filter').value;
    let data = Storage.get(CULTIVOS_KEY) || [];
    if (filter) data = data.filter(c => c.potrero_id === filter);
    data.sort((a, b) => b.año - a.año || a.potrero.localeCompare(b.potrero, 'es'));

    // Repopulate filter
    populatePotreroSelect('cultivos-potrero-filter', true);
    if (filter) document.getElementById('cultivos-potrero-filter').value = filter;

    const tbody = document.getElementById('cultivos-tbody');
    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No hay cultivos registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${c.potrero}</td>
        <td>${c.año}</td>
        <td><span class="badge badge-cultivo-${c.tipo}">${c.tipo === 'cultivo' ? 'Cultivo' : 'Pastura'}</span></td>
        <td>${c.detalle}</td>
        <td>${c.notas || '—'}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit-cultivo" data-id="${c.id}" title="Editar">✏️</button>
          <button class="action-btn danger" data-action="delete-cultivo" data-id="${c.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  function openModalCultivo(id = null) {
    editingCultivoId = id;
    document.getElementById('form-cultivo').reset();
    document.getElementById('modal-cultivo-title').textContent = id ? 'Editar cultivo' : 'Agregar cultivo';
    populatePotreroSelect('fc-potrero');

    if (id) {
      const c = (Storage.get(CULTIVOS_KEY) || []).find(x => x.id === id);
      if (!c) return;
      document.getElementById('fc-potrero').value = c.potrero_id;
      document.getElementById('fc-año').value     = c.año;
      document.getElementById('fc-tipo').value    = c.tipo;
      document.getElementById('fc-detalle').value = c.detalle;
      document.getElementById('fc-notas').value   = c.notas || '';
    } else {
      document.getElementById('fc-año').value = new Date().getFullYear();
    }
    document.getElementById('modal-cultivo').classList.remove('hidden');
  }

  function closeModalCultivo() {
    document.getElementById('modal-cultivo').classList.add('hidden');
    editingCultivoId = null;
  }

  function saveCultivo(e) {
    e.preventDefault();
    const sel    = document.getElementById('fc-potrero');
    const potId  = sel.value;
    const potNom = sel.options[sel.selectedIndex]?.text || '';
    const año    = parseInt(document.getElementById('fc-año').value);
    const tipo   = document.getElementById('fc-tipo').value;
    const detalle = document.getElementById('fc-detalle').value.trim();
    const notas  = document.getElementById('fc-notas').value.trim();

    const data = Storage.get(CULTIVOS_KEY) || [];
    if (editingCultivoId) {
      const idx = data.findIndex(c => c.id === editingCultivoId);
      if (idx !== -1) data[idx] = { ...data[idx], potrero_id: potId, potrero: potNom, año, tipo, detalle, notas };
    } else {
      data.push({ id: String(Date.now()), potrero_id: potId, potrero: potNom, año, tipo, detalle, notas });
    }
    Storage.set(CULTIVOS_KEY, data);
    closeModalCultivo();
    renderCultivos();
    ui.toast(editingCultivoId ? 'Cultivo actualizado.' : 'Cultivo registrado.');
  }

  function removeCultivo(id) {
    ui.confirm('¿Eliminar este cultivo?').then(ok => {
      if (!ok) return;
      Storage.set(CULTIVOS_KEY, (Storage.get(CULTIVOS_KEY) || []).filter(c => c.id !== id));
      renderCultivos();
      ui.toast('Cultivo eliminado.');
    });
  }

  // --- Tab: Forraje ---
  let editingForrajeId = null;

  function renderForraje() {
    const filter = document.getElementById('forraje-potrero-filter').value;
    let data = Storage.get(FORRAJE_KEY) || [];
    if (filter) data = data.filter(f => f.potrero_id === filter);
    data.sort((a, b) => b.año - a.año || a.potrero.localeCompare(b.potrero, 'es'));

    // Repopulate filter
    populatePotreroSelect('forraje-potrero-filter', true);
    if (filter) document.getElementById('forraje-potrero-filter').value = filter;

    const tbody = document.getElementById('forraje-tbody');
    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay datos de forraje registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(f => `
      <tr>
        <td>${f.potrero}</td>
        <td>${f.año}</td>
        <td><span class="badge badge-forraje-${f.tipo}">${f.tipo === 'rollo' ? 'Rollo' : 'Fardo'}</span></td>
        <td>${f.cantidad}</td>
        <td>${f.cortes ?? '—'}</td>
        <td>${f.observaciones || '—'}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit-forraje" data-id="${f.id}" title="Editar">✏️</button>
          <button class="action-btn danger" data-action="delete-forraje" data-id="${f.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
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
    document.getElementById('modal-forraje').classList.add('hidden');
    editingForrajeId = null;
  }

  function saveForraje(e) {
    e.preventDefault();
    const sel    = document.getElementById('ffo-potrero');
    const potId  = sel.value;
    const potNom = sel.options[sel.selectedIndex]?.text || '';
    const año    = parseInt(document.getElementById('ffo-año').value);
    const tipo   = document.getElementById('ffo-tipo').value;
    const cantidad = parseInt(document.getElementById('ffo-cantidad').value);
    const cortes = parseInt(document.getElementById('ffo-cortes').value) || null;
    const observaciones = document.getElementById('ffo-obs').value.trim();

    const data = Storage.get(FORRAJE_KEY) || [];
    if (editingForrajeId) {
      const idx = data.findIndex(f => f.id === editingForrajeId);
      if (idx !== -1) data[idx] = { ...data[idx], potrero_id: potId, potrero: potNom, año, tipo, cantidad, cortes, observaciones };
    } else {
      data.push({ id: String(Date.now()), potrero_id: potId, potrero: potNom, año, tipo, cantidad, cortes, observaciones });
    }
    Storage.set(FORRAJE_KEY, data);
    closeModalForraje();
    renderForraje();
    ui.toast(editingForrajeId ? 'Forraje actualizado.' : 'Forraje registrado.');
  }

  function removeForraje(id) {
    ui.confirm('¿Eliminar este registro de forraje?').then(ok => {
      if (!ok) return;
      Storage.set(FORRAJE_KEY, (Storage.get(FORRAJE_KEY) || []).filter(f => f.id !== id));
      renderForraje();
      ui.toast('Registro eliminado.');
    });
  }

  // --- Refresh (llamado desde app.js al activar el módulo) ---
  function refresh() {
    renderStats();
    renderTable();
    renderStock();
    renderCultivos();
    renderForraje();
  }

  // --- Init ---
  function init() {
    document.getElementById('btn-new-field').addEventListener('click', () => openModal());
    document.getElementById('modal-field-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-field').addEventListener('click', closeModal);
    document.getElementById('modal-field').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('form-field').addEventListener('submit', saveField);
    document.getElementById('search-fields').addEventListener('input', renderTable);

    document.getElementById('fields-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit') openModal(id);
      if (action === 'delete') remove(id);
    });

    // Cultivos
    document.getElementById('btn-new-cultivo').addEventListener('click', () => openModalCultivo());
    document.getElementById('modal-cultivo-close').addEventListener('click', closeModalCultivo);
    document.getElementById('btn-cancel-cultivo').addEventListener('click', closeModalCultivo);
    document.getElementById('modal-cultivo').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalCultivo();
    });
    document.getElementById('form-cultivo').addEventListener('submit', saveCultivo);
    document.getElementById('cultivos-potrero-filter').addEventListener('change', renderCultivos);
    document.getElementById('cultivos-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit-cultivo') openModalCultivo(btn.dataset.id);
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
    document.getElementById('forraje-potrero-filter').addEventListener('change', renderForraje);
    document.getElementById('forraje-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit-forraje') openModalForraje(btn.dataset.id);
      if (btn.dataset.action === 'delete-forraje') removeForraje(btn.dataset.id);
    });

    refresh();
  }

  return { init, refresh };
})();
