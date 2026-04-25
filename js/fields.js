const Fields = (() => {
  const KEY = 'ag_fields';
  const ANIMALS_KEY = 'ag_animals';

  const PASTURAS = ['Natural', 'Mejorada', 'Pastura', 'Verdeo', 'Otro'];
  const ESTADOS = { activo: 'Activo', descanso: 'Descanso', clausurado: 'Clausurado' };

  let editingId = null;

  const formatDate = iso => iso ? new Date(iso).toLocaleDateString('es-AR') : '—';

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

    ui.countUp(document.getElementById('stat-fields-total'),  total);
    ui.countUp(document.getElementById('stat-fields-ha'),     totalHa % 1 === 0 ? totalHa : parseFloat(totalHa.toFixed(1)));
    ui.countUp(document.getElementById('stat-fields-en-uso'), enUso);
    ui.countUp(document.getElementById('stat-fields-libres'), libres);
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

    // Build animal count map
    const animalCount = {};
    getActiveAnimals().forEach(a => {
      if (!a.potrero) return;
      animalCount[a.potrero] = (animalCount[a.potrero] || 0) + 1;
    });

    const tbody = document.getElementById('fields-tbody');
    if (data.length === 0) {
      tbody.innerHTML = emptyStateHTML(
        search ? 'No hay potreros que coincidan.' : 'Aún no registraste potreros.',
        search ? '' : '+ Nuevo potrero',
        "document.getElementById('btn-new-field-inline').click()"
      );
      return;
    }

    tbody.innerHTML = data.map(f => {
      const count = animalCount[f.nombre] || 0;
      const carga = (f.hectareas && count > 0)
        ? (count / f.hectareas).toFixed(2) + '\u00a0cab/ha'
        : (count > 0 ? count + '\u00a0cab' : '—');
      const en = ui.escapeHtml(f.nombre);
      return `
      <tr>
        <td>${en}</td>
        <td>${f.hectareas ? f.hectareas + '\u00a0ha' : '—'}</td>
        <td>${f.pastura || '—'}</td>
        <td>${f.fecha_implantacion ? formatDate(f.fecha_implantacion) : '—'}</td>
        <td>${carga}</td>
        <td><span class="badge badge-field-${f.estado}">${ESTADOS[f.estado] || f.estado}</span></td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${f.id}" title="Editar" aria-label="Editar potrero ${en}">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${f.id}" title="Eliminar" aria-label="Eliminar potrero ${en}">🗑️</button>
        </td>
      </tr>`;
    }).join('');
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
      tbody.innerHTML = emptyStateHTML('Sin animales activos en ningún potrero.', '', '');
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const count    = r.list.length;
      const preview  = r.list.slice(0, 4).map(a => ui.escapeHtml(a.caravana)).join(', ') + (r.list.length > 4 ? ` +${r.list.length - 4}` : '');
      const en       = ui.escapeHtml(r.nombre);
      const nameCell = r.registrado
        ? en
        : `${en} <span class="badge-no-reg">sin registrar</span>`;
      const carga = (r.hectareas && count > 0)
        ? (count / r.hectareas).toFixed(2) + '\u00a0cab/ha'
        : '—';
      return `
        <tr>
          <td>${nameCell}</td>
          <td>${r.hectareas ? r.hectareas + '\u00a0ha' : '—'}</td>
          <td>${count > 0 ? `<strong>${count}</strong>` : '<span class="text-muted">0</span>'}</td>
          <td>${carga}</td>
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
      document.getElementById('ff-nombre').value        = f.nombre;
      document.getElementById('ff-hectareas').value     = f.hectareas || '';
      document.getElementById('ff-pastura').value       = f.pastura || '';
      document.getElementById('ff-estado').value        = f.estado;
      document.getElementById('ff-implantacion').value  = f.fecha_implantacion || '';
      document.getElementById('ff-obs').value           = f.observaciones || '';
    } else {
      document.getElementById('modal-field-title').textContent = 'Nuevo potrero';
    }

    document.getElementById('modal-field').classList.remove('hidden');
  }

  function closeModal() {
    closeModalAnimated('modal-field', () => { editingId = null; });
  }

  // --- Save ---
  function saveField(e) {
    e.preventDefault();
    const nombre            = document.getElementById('ff-nombre').value.trim();
    const hectareas         = parseFloat(document.getElementById('ff-hectareas').value) || null;
    const pastura           = document.getElementById('ff-pastura').value;
    const estado            = document.getElementById('ff-estado').value;
    const fecha_implantacion = document.getElementById('ff-implantacion').value || null;
    const observaciones     = document.getElementById('ff-obs').value.trim();

    if (!nombre) {
      ui.fieldError(document.getElementById('ff-nombre'), 'El nombre es obligatorio.');
      return;
    }

    const data = getAll();

    if (editingId) {
      if (data.some(f => f.id !== editingId && f.nombre.toLowerCase() === nombre.toLowerCase())) {
        ui.fieldError(document.getElementById('ff-nombre'), `Ya existe otro potrero llamado "${nombre}".`);
        return;
      }
      const idx = data.findIndex(f => f.id === editingId);
      if (idx !== -1) data[idx] = { ...data[idx], nombre, hectareas, pastura, estado, fecha_implantacion, observaciones };
    } else {
      if (data.some(f => f.nombre.toLowerCase() === nombre.toLowerCase())) {
        ui.fieldError(document.getElementById('ff-nombre'), `Ya existe un potrero llamado "${nombre}".`);
        return;
      }
      data.push({ id: ui.uid(), nombre, hectareas, pastura, estado, fecha_implantacion, observaciones });
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

  // --- Refresh (llamado desde app.js al activar el módulo) ---
  function refresh() {
    renderStats();
    renderTable();
    renderStock();
  }

  // --- Init ---
  function init() {
    document.getElementById('btn-new-field').addEventListener('click', () => openModal());
    document.getElementById('btn-new-field-inline').addEventListener('click', () => openModal());
    document.getElementById('modal-field-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-field').addEventListener('click', closeModal);
    document.getElementById('modal-field').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('form-field').addEventListener('submit', saveField);
    document.getElementById('search-fields').addEventListener('input', ui.debounce(renderTable, 300));

    document.getElementById('fields-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit') openModal(id);
      if (action === 'delete') remove(id);
    });

    refresh();
  }

  return { init, refresh };
})();
