// ===== Livestock Module =====
const Livestock = (() => {

  const KEYS = { animals: 'ag_animals', movements: 'ag_movements', history: 'ag_history', reproduction: 'ag_reproduction' };

  // --- Data helpers ---
  const getData = key => Storage.get(key, []);
  const saveData = (key, data) => Storage.set(key, data);

  const logHistory = (caravana, evento, detalle, nombre = '') => {
    const history = getData(KEYS.history);
    history.unshift({
      id:     Date.now(),
      fecha:  new Date().toISOString(),
      caravana,
      nombre,
      evento,
      detalle
    });
    saveData(KEYS.history, history);
  };

  // --- Pagination state ---
  const PAGE_SIZE = 20;
  let animalsPage = 1;
  let movementsPage = 1;
  let historyPage = 1;

  // --- Render helpers ---
  const formatDate = iso => iso ? new Date(iso).toLocaleDateString('es-AR') : '—';

  const badge = estado => `<span class="badge badge-${estado}">${estado}</span>`;

  const EVENT_BADGE = {
    'Alta':          'badge-evento-alta',
    'Baja':          'badge-evento-baja',
    'Actualización': 'badge-evento-edicion',
    'Movimiento':    'badge-evento-movimiento',
  };
  const eventBadge = evento => {
    const cls = EVENT_BADGE[evento] || 'badge-evento-default';
    return `<span class="badge ${cls}">${evento}</span>`;
  };

  // --- Stats ---
  const renderStats = () => {
    const animals = getData(KEYS.animals).filter(a => a.estado === 'activo');
    document.getElementById('stat-total').textContent  = animals.length;
    document.getElementById('stat-cows').textContent   = animals.filter(a => a.tipo === 'vaca').length;
    document.getElementById('stat-bulls').textContent  = animals.filter(a => a.tipo === 'toro').length;
    document.getElementById('stat-calves').textContent = animals.filter(a => a.tipo === 'ternero').length;
  };

  // --- Render animals table ---
  const renderAnimals = () => {
    const search  = document.getElementById('search-animals').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    let animals   = getData(KEYS.animals);

    if (search)     animals = animals.filter(a =>
      a.caravana.toLowerCase().includes(search) ||
      (a.nombre || '').toLowerCase().includes(search)
    );
    if (typeFilter) animals = animals.filter(a => a.tipo === typeFilter);

    const tbody = document.getElementById('animals-tbody');
    if (!animals.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No hay animales que coincidan.</td></tr>`;
      ui.pagination('animals-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const paged = animals.slice((animalsPage - 1) * PAGE_SIZE, animalsPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(a => `
      <tr data-id="${a.id}">
        <td><strong>${a.caravana}</strong></td>
        <td>${a.nombre || '—'}</td>
        <td style="text-transform:capitalize">${a.tipo}${a.castracion_fecha ? '<br><span class="cell-sub">Castrado</span>' : ''}</td>
        <td>${a.raza || '—'}</td>
        <td>${formatDate(a.nacimiento)}</td>
        <td>${a.potrero || '—'}</td>
        <td>${badge(a.estado)}</td>
        <td>
          <button class="action-btn" onclick="Livestock.edit('${a.id}')" title="Editar">✏️</button>
          <button class="action-btn danger" onclick="Livestock.remove('${a.id}')" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
    ui.pagination('animals-pagination', animals.length, animalsPage, PAGE_SIZE, p => { animalsPage = p; renderAnimals(); });
  };

  // --- Render movements table ---
  const renderMovements = () => {
    const movements = [...getData(KEYS.movements)].sort((a, b) => {
      if (b.fecha !== a.fecha) return b.fecha.localeCompare(a.fecha);
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });
    const tbody = document.getElementById('movements-tbody');
    if (!movements.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No hay movimientos registrados.</td></tr>`;
      ui.pagination('movements-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }
    const paged = movements.slice((movementsPage - 1) * PAGE_SIZE, movementsPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(m => `
      <tr>
        <td>${formatDate(m.fecha)}</td>
        <td><strong>${m.caravana}</strong>${m.animalNombre ? `<br><span class="cell-sub">${m.animalNombre}</span>` : ''}</td>
        <td style="text-transform:capitalize">${m.tipo}</td>
        <td>${m.origen || '—'}</td>
        <td>${m.destino || '—'}</td>
        <td>${m.observaciones || '—'}</td>
      </tr>
    `).join('');
    ui.pagination('movements-pagination', movements.length, movementsPage, PAGE_SIZE, p => { movementsPage = p; renderMovements(); });
  };

  // --- Render history table ---
  const renderHistory = () => {
    const history = [...getData(KEYS.history)].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const tbody = document.getElementById('history-tbody');
    if (!history.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No hay registros en el historial.</td></tr>`;
      ui.pagination('history-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }
    const paged = history.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(h => `
      <tr>
        <td>${formatDate(h.fecha)}</td>
        <td>
          <strong>${h.caravana}</strong>
          ${h.nombre ? `<br><span class="cell-sub">${h.nombre}</span>` : ''}
        </td>
        <td>${eventBadge(h.evento)}</td>
        <td>${h.detalle}</td>
        <td>—</td>
      </tr>
    `).join('');
    ui.pagination('history-pagination', history.length, historyPage, PAGE_SIZE, p => { historyPage = p; renderHistory(); });
  };

  // --- Full render ---
  const render = () => {
    renderStats();
    renderAnimals();
    renderMovements();
    renderHistory();
    renderReproduccion();
  };

  // --- Potrero datalist ---
  const populateFieldOptions = datalistId => {
    const fields = Storage.get('ag_fields') || [];
    const dl = document.getElementById(datalistId);
    if (!dl) return;
    dl.innerHTML = fields
      .filter(f => f.estado === 'activo')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(f => `<option value="${f.nombre}">`)
      .join('');
  };

  // --- Modal ---
  let editingId = null;

  const toggleCastracion = tipo => {
    document.getElementById('row-castracion').style.display = tipo === 'ternero' ? '' : 'none';
    if (tipo !== 'ternero') document.getElementById('f-castracion').value = '';
  };

  const openModal = (animal = null) => {
    editingId = animal ? animal.id : null;
    const form = document.getElementById('form-animal');
    form.reset();
    document.getElementById('modal-animal-title').textContent = animal ? 'Editar animal' : 'Nuevo animal';
    if (animal) {
      form.caravana.value        = animal.caravana;
      form.nombre.value          = animal.nombre || '';
      form.tipo.value            = animal.tipo;
      form.raza.value            = animal.raza || '';
      form.nacimiento.value      = animal.nacimiento || '';
      form.potrero.value         = animal.potrero || '';
      form.estado.value          = animal.estado;
      form.peso.value            = animal.peso || '';
      form.observaciones.value   = animal.observaciones || '';
      form.castracion_fecha.value = animal.castracion_fecha || '';
    }
    toggleCastracion(animal ? animal.tipo : '');
    populateFieldOptions('potrero-options');
    document.getElementById('modal-animal').classList.remove('hidden');
  };

  const closeModal = () => {
    document.getElementById('modal-animal').classList.add('hidden');
    editingId = null;
  };

  // --- Save animal ---
  const saveAnimal = e => {
    e.preventDefault();
    const form = e.target;
    const animals = getData(KEYS.animals);

    const data = {
      caravana:         form.caravana.value.trim().toUpperCase(),
      nombre:           form.nombre.value.trim(),
      tipo:             form.tipo.value,
      raza:             form.raza.value.trim(),
      nacimiento:       form.nacimiento.value,
      potrero:          form.potrero.value.trim(),
      estado:           form.estado.value,
      peso:             form.peso.value ? Number(form.peso.value) : null,
      observaciones:    form.observaciones.value.trim(),
      castracion_fecha: form.tipo.value === 'ternero' ? (form.castracion_fecha.value || null) : null
    };

    if (editingId) {
      const idx = animals.findIndex(a => a.id === editingId);
      animals[idx] = { ...animals[idx], ...data };
      logHistory(data.caravana, 'Actualización', 'Datos editados', data.nombre);
    } else {
      // Check duplicate caravana
      if (animals.some(a => a.caravana === data.caravana)) {
        ui.toast(`Ya existe un animal con la caravana ${data.caravana}`, 'error');
        return;
      }
      animals.unshift({ id: String(Date.now()), ...data });
      logHistory(data.caravana, 'Alta', `Tipo: ${data.tipo}`, data.nombre);
    }

    saveData(KEYS.animals, animals);
    closeModal();
    render();
    ui.toast(editingId ? 'Animal actualizado.' : 'Animal registrado.');
  };

  // --- Movement Modal ---
  let selectedAnimalId = null;

  const openMovementModal = () => {
    selectedAnimalId = null;
    const form = document.getElementById('form-movement');
    form.reset();
    form.fecha.value = new Date().toISOString().slice(0, 10);
    document.getElementById('animal-dropdown').classList.add('hidden');
    populateFieldOptions('destino-options');
    document.getElementById('modal-movement').classList.remove('hidden');
    document.getElementById('fm-animal').focus();
  };

  const closeMovementModal = () => {
    document.getElementById('modal-movement').classList.add('hidden');
    document.getElementById('animal-dropdown').classList.add('hidden');
    selectedAnimalId = null;
  };

  // Animal search dropdown
  const buildDropdown = query => {
    const dropdown = document.getElementById('animal-dropdown');
    const q = query.toLowerCase().trim();
    if (!q) { dropdown.classList.add('hidden'); return; }

    const matches = getData(KEYS.animals)
      .filter(a => a.estado === 'activo' &&
        (a.caravana.toLowerCase().includes(q) || (a.nombre || '').toLowerCase().includes(q))
      )
      .slice(0, 8);

    if (!matches.length) { dropdown.classList.add('hidden'); return; }

    dropdown.innerHTML = matches.map(a => `
      <li class="dropdown-item" data-id="${a.id}" data-caravana="${a.caravana}"
          data-nombre="${a.nombre || ''}" data-potrero="${a.potrero || ''}">
        <span class="di-caravana">${a.caravana}</span>
        ${a.nombre ? `<span class="di-nombre">${a.nombre}</span>` : ''}
        ${a.potrero ? `<span class="di-potrero">${a.potrero}</span>` : ''}
      </li>
    `).join('');
    dropdown.classList.remove('hidden');
  };

  const selectAnimal = li => {
    selectedAnimalId = li.dataset.id;
    document.getElementById('fm-animal').value = li.dataset.caravana;
    document.getElementById('fm-origen').value  = li.dataset.potrero;
    document.getElementById('animal-dropdown').classList.add('hidden');
  };

  const saveMovement = e => {
    e.preventDefault();
    const form = e.target;

    // Resolve animal — allow manual caravana entry if no dropdown selection
    let animal = null;
    if (selectedAnimalId) {
      animal = getData(KEYS.animals).find(a => a.id === selectedAnimalId);
    } else {
      const caravana = form.animal.value.trim().toUpperCase();
      animal = getData(KEYS.animals).find(a => a.caravana === caravana);
    }

    if (!animal) {
      ui.toast('No se encontró el animal. Seleccioná uno de la lista.', 'error');
      document.getElementById('fm-animal').focus();
      return;
    }

    const origen  = form.origen.value.trim();
    const destino = form.destino.value.trim();

    const movement = {
      id:            String(Date.now()),
      timestamp:     new Date().toISOString(),
      fecha:         form.fecha.value,
      animalId:      animal.id,
      caravana:      animal.caravana,
      animalNombre:  animal.nombre || '',
      tipo:          form.tipo.value,
      origen,
      destino,
      observaciones: form.observaciones.value.trim()
    };

    const movements = getData(KEYS.movements);
    movements.unshift(movement);
    saveData(KEYS.movements, movements);

    // Update animal potrero when destino is provided
    if (destino) {
      const animals = getData(KEYS.animals);
      const idx = animals.findIndex(a => a.id === animal.id);
      animals[idx] = { ...animals[idx], potrero: destino };
      saveData(KEYS.animals, animals);
    }

    const detalle = [form.tipo.value, origen ? `de ${origen}` : '', destino ? `a ${destino}` : '']
      .filter(Boolean).join(' ');
    logHistory(animal.caravana, 'Movimiento', detalle, animal.nombre);

    closeMovementModal();
    render();
    ui.toast('Movimiento registrado.');

    // Ofrecer registrar el potrero destino si no existe
    if (destino) {
      const fields = Storage.get('ag_fields') || [];
      if (!fields.some(f => f.nombre === destino)) {
        ui.confirm(`El potrero "${destino}" no está registrado. ¿Registrarlo ahora?`, 'Registrar').then(ok => {
          if (!ok) return;
          fields.push({ id: String(Date.now()), nombre: destino, hectareas: null, pastura: '', estado: 'activo', observaciones: '' });
          Storage.set('ag_fields', fields);
          ui.toast(`Potrero "${destino}" registrado.`);
        });
      }
    }
  };

  // --- Reproducción ---
  let editingReproId = null;

  const renderReproduccion = () => {
    const data = [...getData(KEYS.reproduction)].sort((a, b) => b.año - a.año);

    // Stats: último ciclo
    const last = data[0];
    document.getElementById('stat-repro-prenez').textContent     = last ? (last.prenez_pct != null ? last.prenez_pct.toFixed(1) + '%' : '—') : '—';
    document.getElementById('stat-repro-destete').textContent    = last ? (last.indice_destete != null ? last.indice_destete.toFixed(1) + '%' : '—') : '—';
    document.getElementById('stat-repro-positivas').textContent  = last ? (last.vacas_positivas ?? '—') : '—';
    document.getElementById('stat-repro-mortalidad').textContent = last ? (last.mortalidad_total ?? '—') : '—';

    const tbody = document.getElementById('repro-tbody');
    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay ciclos reproductivos registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong>${r.año}</strong></td>
        <td>${r.vacas_total ?? '—'}</td>
        <td>${r.prenez_pct != null ? r.prenez_pct.toFixed(1) + '%' : '—'}</td>
        <td>${r.partos ?? '—'}</td>
        <td>${r.indice_destete != null ? r.indice_destete.toFixed(1) + '%' : '—'}</td>
        <td>${r.mortalidad_total ?? '—'}</td>
        <td>${r.ia_realizada ? '<span class="badge badge-evento-alta">Sí</span>' : '<span class="badge badge-evento-baja">No</span>'}</td>
        <td>
          <button class="action-btn" onclick="Livestock.editRepro('${r.id}')" title="Editar">✏️</button>
          <button class="action-btn danger" onclick="Livestock.removeRepro('${r.id}')" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
  };

  const openModalRepro = (id = null) => {
    editingReproId = id;
    const form = document.getElementById('form-reproduction');
    form.reset();
    document.getElementById('modal-repro-title').textContent = id ? 'Editar ciclo reproductivo' : 'Nuevo ciclo reproductivo';
    document.getElementById('ia-section').style.display = 'none';

    if (id) {
      const r = getData(KEYS.reproduction).find(x => x.id === id);
      if (!r) return;
      form.año.value                    = r.año;
      form.fecha_entrada_toros.value    = r.fecha_entrada_toros || '';
      form.fecha_salida_toros.value     = r.fecha_salida_toros || '';
      form.tacto_fecha.value            = r.tacto_fecha || '';
      form.vacas_total.value            = r.vacas_total ?? '';
      form.vacas_positivas.value        = r.vacas_positivas ?? '';
      form.ia_realizada.checked         = !!r.ia_realizada;
      form.ia_fecha.value               = r.ia_fecha || '';
      form.ia_toro.value                = r.ia_toro || '';
      form.ia_prenez_pct.value          = r.ia_prenez_pct ?? '';
      form.paricion_inicio.value        = r.paricion_inicio || '';
      form.paricion_fin.value           = r.paricion_fin || '';
      form.partos.value                 = r.partos ?? '';
      form.muertes_paricion.value       = r.muertes_paricion ?? '';
      form.destete_fecha.value          = r.destete_fecha || '';
      form.terneros_machos_destete.value = r.terneros_machos_destete ?? '';
      form.terneras_hembras_destete.value = r.terneras_hembras_destete ?? '';
      form.muertes_destete.value        = r.muertes_destete ?? '';
      form.observaciones.value          = r.observaciones || '';
      if (r.ia_realizada) document.getElementById('ia-section').style.display = '';
    }

    document.getElementById('modal-reproduction').classList.remove('hidden');
  };

  const closeModalRepro = () => {
    document.getElementById('modal-reproduction').classList.add('hidden');
    editingReproId = null;
  };

  const saveRepro = e => {
    e.preventDefault();
    const form = e.target;
    const vacas_total              = parseInt(form.vacas_total.value, 10) || null;
    const vacas_positivas          = parseInt(form.vacas_positivas.value, 10) || null;
    const vacas_negativas          = (vacas_total != null && vacas_positivas != null) ? vacas_total - vacas_positivas : null;
    const prenez_pct               = (vacas_total && vacas_positivas != null) ? (vacas_positivas / vacas_total * 100) : null;
    const ia_realizada             = form.ia_realizada.checked;
    const partos                   = parseInt(form.partos.value, 10) || null;
    const muertes_paricion         = parseInt(form.muertes_paricion.value, 10) || null;
    const terneros_machos_destete  = parseInt(form.terneros_machos_destete.value, 10) || null;
    const terneras_hembras_destete = parseInt(form.terneras_hembras_destete.value, 10) || null;
    const muertes_destete          = parseInt(form.muertes_destete.value, 10) || null;

    const terneros_destete = (terneros_machos_destete ?? 0) + (terneras_hembras_destete ?? 0);
    const indice_destete   = (partos && terneros_destete != null) ? (terneros_destete / partos * 100) : null;
    const mortalidad_total = ((muertes_paricion ?? 0) + (muertes_destete ?? 0)) || null;

    const entry = {
      año:                       parseInt(form.año.value, 10),
      fecha_entrada_toros:       form.fecha_entrada_toros.value || null,
      fecha_salida_toros:        form.fecha_salida_toros.value || null,
      tacto_fecha:               form.tacto_fecha.value || null,
      vacas_total,
      vacas_positivas,
      vacas_negativas,
      prenez_pct,
      ia_realizada,
      ia_fecha:                  ia_realizada ? (form.ia_fecha.value || null) : null,
      ia_toro:                   ia_realizada ? form.ia_toro.value.trim() : '',
      ia_prenez_pct:             ia_realizada ? (parseFloat(form.ia_prenez_pct.value) || null) : null,
      paricion_inicio:           form.paricion_inicio.value || null,
      paricion_fin:              form.paricion_fin.value || null,
      partos,
      muertes_paricion,
      destete_fecha:             form.destete_fecha.value || null,
      terneros_machos_destete,
      terneras_hembras_destete,
      muertes_destete,
      indice_destete,
      mortalidad_total,
      observaciones:             form.observaciones.value.trim()
    };

    const data = getData(KEYS.reproduction);
    if (editingReproId) {
      const idx = data.findIndex(r => r.id === editingReproId);
      data[idx] = { ...data[idx], ...entry };
    } else {
      data.unshift({ id: String(Date.now()), ...entry });
    }
    saveData(KEYS.reproduction, data);
    closeModalRepro();
    renderReproduccion();
    ui.toast(editingReproId ? 'Ciclo actualizado.' : 'Ciclo registrado.');
  };

  const editRepro = id => openModalRepro(id);

  const removeRepro = id => {
    ui.confirm('¿Eliminar este ciclo reproductivo?').then(ok => {
      if (!ok) return;
      saveData(KEYS.reproduction, getData(KEYS.reproduction).filter(r => r.id !== id));
      renderReproduccion();
      ui.toast('Ciclo eliminado.');
    });
  };

  // --- Edit ---
  const edit = id => {
    const animal = getData(KEYS.animals).find(a => a.id === id);
    if (animal) openModal(animal);
  };

  // --- Remove ---
  const remove = id => {
    const animals = getData(KEYS.animals);
    const animal  = animals.find(a => a.id === id);
    if (!animal) return;
    ui.confirm(`¿Eliminar el animal ${animal.caravana}? Esta acción no se puede deshacer.`).then(ok => {
      if (!ok) return;
      saveData(KEYS.animals, animals.filter(a => a.id !== id));
      logHistory(animal.caravana, 'Baja', 'Eliminado del registro', animal.nombre);
      render();
      ui.toast(`Animal ${animal.caravana} eliminado.`);
    });
  };

  // --- Init ---
  const init = () => {
    // Modal open/close
    document.getElementById('btn-new-animal').addEventListener('click', () => openModal());
    document.getElementById('modal-animal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-animal').addEventListener('click', closeModal);
    document.getElementById('modal-animal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Form submit
    document.getElementById('form-animal').addEventListener('submit', saveAnimal);

    // Filters
    document.getElementById('search-animals').addEventListener('input', () => { animalsPage = 1; renderAnimals(); });
    document.getElementById('filter-type').addEventListener('change', () => { animalsPage = 1; renderAnimals(); });

    // Movement modal open/close
    document.getElementById('btn-new-movement').addEventListener('click', openMovementModal);
    document.getElementById('modal-movement-close').addEventListener('click', closeMovementModal);
    document.getElementById('btn-cancel-movement').addEventListener('click', closeMovementModal);
    document.getElementById('modal-movement').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeMovementModal();
    });

    // Animal search input
    document.getElementById('fm-animal').addEventListener('input', e => {
      selectedAnimalId = null;
      buildDropdown(e.target.value);
    });

    document.getElementById('fm-animal').addEventListener('keydown', e => {
      const dropdown = document.getElementById('animal-dropdown');
      if (dropdown.classList.contains('hidden')) return;
      const items = dropdown.querySelectorAll('.dropdown-item');
      const active = dropdown.querySelector('.dropdown-item.active');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active ? active.nextElementSibling : items[0];
        if (next) { active?.classList.remove('active'); next.classList.add('active'); }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active ? active.previousElementSibling : items[items.length - 1];
        if (prev) { active?.classList.remove('active'); prev.classList.add('active'); }
      } else if (e.key === 'Enter' && active) {
        e.preventDefault();
        selectAnimal(active);
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });

    document.getElementById('animal-dropdown').addEventListener('mousedown', e => {
      const li = e.target.closest('.dropdown-item');
      if (li) selectAnimal(li);
    });

    // Movement form submit
    document.getElementById('form-movement').addEventListener('submit', saveMovement);

    // Castración toggle
    document.getElementById('f-tipo').addEventListener('change', e => toggleCastracion(e.target.value));

    // Reproducción
    document.getElementById('btn-new-repro').addEventListener('click', () => openModalRepro());
    document.getElementById('modal-repro-close').addEventListener('click', closeModalRepro);
    document.getElementById('btn-cancel-repro').addEventListener('click', closeModalRepro);
    document.getElementById('modal-reproduction').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalRepro();
    });
    document.getElementById('fr-ia').addEventListener('change', e => {
      document.getElementById('ia-section').style.display = e.target.checked ? '' : 'none';
    });
    document.getElementById('form-reproduction').addEventListener('submit', saveRepro);

    render();
  };

  return { init, edit, remove, editRepro, removeRepro };
})();
