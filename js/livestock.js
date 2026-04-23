// ===== Livestock Module =====
const Livestock = (() => {

  const KEYS = { animals: 'ag_animals', movements: 'ag_movements', history: 'ag_history', reproduction: 'ag_reproduction', sanidad: 'ag_sanidad' };

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
  let sanidadPage = 1;

  // --- Sort and filter state ---
  let animalsSort = { by: null, dir: 'asc' };
  let reproYear = '';

  // --- Render helpers ---
  const formatDate = iso => iso ? new Date(iso).toLocaleDateString('es-AR') : '—';

  const badge = estado => `<span class="badge badge-${estado}">${estado}</span>`;

  const EVENT_BADGE = {
    'Alta':          'badge-evento-alta',
    'Baja':          'badge-evento-baja',
    'Actualización': 'badge-evento-edicion',
    'Movimiento':    'badge-evento-movimiento',
    'Sanidad':       'badge-evento-sanidad',
  };

  const SANIDAD_BADGE = {
    'vacunación':      'badge-sanidad-vacunacion',
    'desparasitación': 'badge-sanidad-desparasitacion',
    'veterinario':     'badge-sanidad-veterinario',
    'raspaje':         'badge-sanidad-raspaje',
    'accidente':       'badge-sanidad-accidente',
    'otro':            'badge-sanidad-otro',
  };
  const sanidadBadge = tipo => {
    const cls = SANIDAD_BADGE[tipo] || 'badge-sanidad-otro';
    return `<span class="badge ${cls}" style="text-transform:capitalize">${tipo}</span>`;
  };
  const eventBadge = evento => {
    const cls = EVENT_BADGE[evento] || 'badge-evento-default';
    return `<span class="badge ${cls}">${evento}</span>`;
  };

  // --- Stats ---
  const renderStats = () => {
    const animals = getData(KEYS.animals).filter(a => a.estado === 'activo');
    ui.countUp(document.getElementById('stat-total'),       animals.length);
    ui.countUp(document.getElementById('stat-cows'),        animals.filter(a => a.tipo === 'vaca').length);
    ui.countUp(document.getElementById('stat-bulls'),       animals.filter(a => a.tipo === 'toro').length);
    ui.countUp(document.getElementById('stat-calves'),      animals.filter(a => a.tipo === 'ternero').length);
    ui.countUp(document.getElementById('stat-novillos'),    animals.filter(a => a.tipo === 'novillo').length);
    ui.countUp(document.getElementById('stat-vaquillonas'), animals.filter(a => a.tipo === 'vaquillona').length);
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

    // Sort
    if (animalsSort.by === 'tipo') {
      animals.sort((a, b) => {
        const r = (a.tipo || '').localeCompare(b.tipo || '', 'es');
        return animalsSort.dir === 'asc' ? r : -r;
      });
    } else if (animalsSort.by === 'peso') {
      animals.sort((a, b) => {
        const r = (Number(a.peso) || 0) - (Number(b.peso) || 0);
        return animalsSort.dir === 'asc' ? r : -r;
      });
    }

    // Update sort arrows in headers
    document.querySelectorAll('#animals-table .sortable-th').forEach(th => {
      const arrow = th.querySelector('.sort-arrow');
      if (!arrow) return;
      if (th.dataset.sort === animalsSort.by) {
        arrow.textContent = animalsSort.dir === 'asc' ? '▲' : '▼';
      } else {
        arrow.textContent = '⇅';
      }
    });

    const tbody = document.getElementById('animals-tbody');
    if (!animals.length) {
      tbody.innerHTML = emptyStateHTML(
        search || typeFilter ? 'No hay animales que coincidan con la búsqueda.' : 'Aún no registraste animales.',
        search || typeFilter ? '' : '+ Nuevo animal',
        "document.getElementById('btn-new-animal').click()"
      );
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
        <td>${a.peso ? a.peso + ' kg' : '—'}</td>
        <td>${badge(a.estado)}</td>
        <td>
          <button class="action-btn" onclick="Livestock.edit('${a.id}')" title="Editar" aria-label="Editar animal ${a.caravana}">✏️</button>
          <button class="action-btn danger" onclick="Livestock.remove('${a.id}')" title="Eliminar" aria-label="Eliminar animal ${a.caravana}">🗑️</button>
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
      tbody.innerHTML = emptyStateHTML('No hay movimientos registrados.', '', '');
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
      tbody.innerHTML = emptyStateHTML('El historial está vacío.', '', '');
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

  // --- Render sanidad ---
  const renderSanidad = () => {
    const search     = document.getElementById('search-sanidad').value.toLowerCase();
    const tipoFilter = document.getElementById('filter-sanidad-tipo').value;
    let data = [...getData(KEYS.sanidad)].sort((a, b) => b.fecha.localeCompare(a.fecha));

    if (search) data = data.filter(s =>
      (s.caravana || '').toLowerCase().includes(search) ||
      (s.animalNombre || '').toLowerCase().includes(search) ||
      (s.descripcion || '').toLowerCase().includes(search) ||
      (s.producto || '').toLowerCase().includes(search)
    );
    if (tipoFilter) data = data.filter(s => s.tipo === tipoFilter);

    // Stats (siempre sobre todos los datos sin filtros)
    const all = getData(KEYS.sanidad);
    const now = new Date();
    const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    ui.countUp(document.getElementById('stat-sanidad-mes'),
      all.filter(s => s.fecha && s.fecha.startsWith(mesActual)).length);
    ui.countUp(document.getElementById('stat-sanidad-vacunacion'),
      all.filter(s => s.tipo === 'vacunación').length);
    ui.countUp(document.getElementById('stat-sanidad-desparasitacion'),
      all.filter(s => s.tipo === 'desparasitación').length);
    ui.countUp(document.getElementById('stat-sanidad-veterinario'),
      all.filter(s => s.tipo === 'veterinario').length);

    const tbody = document.getElementById('sanidad-tbody');
    if (!data.length) {
      tbody.innerHTML = emptyStateHTML(
        tipoFilter || search ? 'No hay eventos de sanidad que coincidan.' : 'Aún no registraste eventos sanitarios.',
        tipoFilter || search ? '' : '+ Nuevo evento',
        "document.getElementById('btn-new-sanidad').click()"
      );
      ui.pagination('sanidad-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const paged = data.slice((sanidadPage - 1) * PAGE_SIZE, sanidadPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(s => `
      <tr>
        <td>${formatDate(s.fecha)}</td>
        <td>
          ${s.caravana ? `<strong>${s.caravana}</strong>` : '<span class="cell-sub">Rodeo completo</span>'}
          ${s.animalNombre ? `<br><span class="cell-sub">${s.animalNombre}</span>` : ''}
        </td>
        <td>${sanidadBadge(s.tipo)}</td>
        <td>${s.descripcion || '—'}</td>
        <td>${s.producto || '—'}</td>
        <td>${s.observaciones || '—'}</td>
        <td>
          <button class="action-btn" onclick="Livestock.editSanidad('${s.id}')" title="Editar" aria-label="Editar evento sanitario">✏️</button>
          <button class="action-btn danger" onclick="Livestock.removeSanidad('${s.id}')" title="Eliminar" aria-label="Eliminar evento sanitario">🗑️</button>
        </td>
      </tr>
    `).join('');
    ui.pagination('sanidad-pagination', data.length, sanidadPage, PAGE_SIZE, p => { sanidadPage = p; renderSanidad(); });
  };

  // --- Sanidad Modal ---
  let editingSanidadId = null;
  let selectedSanidadAnimalId = null;

  const buildSanidadDropdown = query => {
    const dropdown = document.getElementById('sanidad-animal-dropdown');
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
          data-nombre="${a.nombre || ''}" data-tipo="${a.tipo || ''}">
        <span class="di-caravana">${a.caravana}</span>
        ${a.nombre ? `<span class="di-nombre">${a.nombre}</span>` : ''}
        ${a.tipo ? `<span class="di-potrero" style="text-transform:capitalize">${a.tipo}</span>` : ''}
      </li>
    `).join('');
    dropdown.classList.remove('hidden');
  };

  const updateRaspajeOption = (isToro) => {
    const sel = document.getElementById('fs-tipo');
    let opt = sel.querySelector('option[value="raspaje"]');
    if (isToro) {
      if (!opt) {
        opt = document.createElement('option');
        opt.value = 'raspaje';
        opt.textContent = 'Raspaje';
        // Insert before "otro"
        const otro = sel.querySelector('option[value="otro"]');
        sel.insertBefore(opt, otro || null);
      }
    } else {
      if (opt) {
        if (sel.value === 'raspaje') sel.value = '';
        opt.remove();
      }
    }
  };

  let selectedSanidadAnimalTipo = null;

  const selectSanidadAnimal = li => {
    selectedSanidadAnimalId = li.dataset.id;
    selectedSanidadAnimalTipo = li.dataset.tipo || null;
    document.getElementById('fs-animal').value = li.dataset.caravana + (li.dataset.nombre ? ` — ${li.dataset.nombre}` : '');
    document.getElementById('sanidad-animal-dropdown').classList.add('hidden');
    updateRaspajeOption(selectedSanidadAnimalTipo === 'toro');
  };

  const openModalSanidad = (id = null) => {
    editingSanidadId = id;
    selectedSanidadAnimalId = null;
    selectedSanidadAnimalTipo = null;
    const form = document.getElementById('form-sanidad');
    form.reset();
    document.getElementById('modal-sanidad-title').textContent = id ? 'Editar evento sanitario' : 'Nuevo evento sanitario';
    form.fecha.value = new Date().toISOString().slice(0, 10);
    updateRaspajeOption(false);

    if (id) {
      const s = getData(KEYS.sanidad).find(x => x.id === id);
      if (!s) return;
      form.fecha.value         = s.fecha || '';
      form.descripcion.value   = s.descripcion || '';
      form.producto.value      = s.producto || '';
      form.observaciones.value = s.observaciones || '';
      if (s.animalId) {
        selectedSanidadAnimalId = s.animalId;
        const animal = getData(KEYS.animals).find(a => a.id === s.animalId);
        selectedSanidadAnimalTipo = animal ? animal.tipo : null;
        updateRaspajeOption(selectedSanidadAnimalTipo === 'toro');
        form.animal.value = s.caravana + (s.animalNombre ? ` — ${s.animalNombre}` : '');
      }
      form.tipo.value = s.tipo || '';
    }

    document.getElementById('modal-sanidad').classList.remove('hidden');
    document.getElementById('fs-descripcion').focus();
  };

  const closeModalSanidad = () => {
    closeModalAnimated('modal-sanidad', () => {
      document.getElementById('sanidad-animal-dropdown').classList.add('hidden');
      editingSanidadId = null;
      selectedSanidadAnimalId = null;
      selectedSanidadAnimalTipo = null;
    });
  };

  const saveSanidad = e => {
    e.preventDefault();
    const form = e.target;

    // Resolver animal
    let animalId = null, caravana = '', animalNombre = '';
    if (selectedSanidadAnimalId) {
      const animal = getData(KEYS.animals).find(a => a.id === selectedSanidadAnimalId);
      if (animal) { animalId = animal.id; caravana = animal.caravana; animalNombre = animal.nombre || ''; }
    }

    const entry = {
      fecha:         form.fecha.value,
      animalId,
      caravana,
      animalNombre,
      tipo:          form.tipo.value,
      descripcion:   form.descripcion.value.trim(),
      producto:      form.producto.value.trim(),
      observaciones: form.observaciones.value.trim()
    };

    const data = getData(KEYS.sanidad);
    const wasEditing = !!editingSanidadId;
    if (editingSanidadId) {
      const idx = data.findIndex(s => s.id === editingSanidadId);
      data[idx] = { ...data[idx], ...entry };
      if (caravana) logHistory(caravana, 'Actualización', `Sanidad: ${entry.tipo}: ${entry.descripcion}`, animalNombre);
    } else {
      data.unshift({ id: String(Date.now()), ...entry });
      if (caravana) logHistory(caravana, 'Sanidad', `${entry.tipo}: ${entry.descripcion}`, animalNombre);
    }

    saveData(KEYS.sanidad, data);
    closeModalSanidad();
    sanidadPage = 1;
    renderSanidad();
    ui.toast(wasEditing ? 'Evento actualizado.' : 'Evento sanitario registrado.');
  };

  const editSanidad = id => openModalSanidad(id);

  const removeSanidad = id => {
    ui.confirm('¿Eliminar este evento sanitario?').then(ok => {
      if (!ok) return;
      const ev = getData(KEYS.sanidad).find(s => s.id === id);
      saveData(KEYS.sanidad, getData(KEYS.sanidad).filter(s => s.id !== id));
      if (ev && ev.caravana) logHistory(ev.caravana, 'Baja', `Sanidad eliminada: ${ev.tipo}: ${ev.descripcion}`, ev.animalNombre);
      renderSanidad();
      ui.toast('Evento eliminado.');
    });
  };

  // --- Full render ---
  const render = () => {
    renderStats();
    renderAnimals();
    renderMovements();
    renderHistory();
    renderReproduccion();
    renderSanidad();
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
    closeModalAnimated('modal-animal', () => { editingId = null; });
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

    if (!data.caravana) {
      ui.fieldError(form.caravana, 'La caravana es obligatoria.');
      return;
    }
    if (!data.tipo) {
      ui.fieldError(form.tipo, 'Seleccioná un tipo.');
      return;
    }

    if (editingId) {
      const idx = animals.findIndex(a => a.id === editingId);
      animals[idx] = { ...animals[idx], ...data };
      logHistory(data.caravana, 'Actualización', 'Datos editados', data.nombre);
    } else {
      // Check duplicate caravana
      if (animals.some(a => a.caravana === data.caravana)) {
        ui.fieldError(form.caravana, `Ya existe un animal con la caravana ${data.caravana}.`);
        return;
      }
      animals.unshift({ id: String(Date.now()), ...data });
      logHistory(data.caravana, 'Alta', `Tipo: ${data.tipo}`, data.nombre);
    }

    saveData(KEYS.animals, animals);
    const wasEditing = !!editingId;
    closeModal();
    render();
    ui.toast(wasEditing ? 'Animal actualizado.' : 'Animal registrado.');
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
    closeModalAnimated('modal-movement', () => {
      document.getElementById('animal-dropdown').classList.add('hidden');
      selectedAnimalId = null;
    });
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
    const allData = [...getData(KEYS.reproduction)].sort((a, b) => b.año - a.año);

    // Populate year filter
    const years = [...new Set(allData.map(r => r.año))].sort((a, b) => b - a);
    const yrSel = document.getElementById('repro-year-filter');
    if (yrSel) {
      const cur = yrSel.value;
      yrSel.innerHTML = '<option value="">Todos los años</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join('');
      if (cur) yrSel.value = cur;
    }

    // Stats: último ciclo sin filtro
    const last = allData[0];
    document.getElementById('stat-repro-prenez').textContent     = last ? (last.prenez_pct != null ? last.prenez_pct.toFixed(1) + '%' : '—') : '—';
    document.getElementById('stat-repro-destete').textContent    = last ? (last.indice_destete != null ? last.indice_destete.toFixed(1) + '%' : '—') : '—';
    document.getElementById('stat-repro-positivas').textContent  = last ? (last.vacas_positivas ?? '—') : '—';
    document.getElementById('stat-repro-mortalidad').textContent = last ? (last.mortalidad_total ?? '—') : '—';

    // Apply year filter to table
    const data = reproYear ? allData.filter(r => String(r.año) === reproYear) : allData;

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
          <button class="action-btn" onclick="Livestock.editRepro('${r.id}')" title="Editar" aria-label="Editar ciclo ${r.año}">✏️</button>
          <button class="action-btn danger" onclick="Livestock.removeRepro('${r.id}')" title="Eliminar" aria-label="Eliminar ciclo ${r.año}">🗑️</button>
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
      form.muertes_gestacion.value      = r.muertes_gestacion ?? '';
      form.ia_realizada.checked         = !!r.ia_realizada;
      form.ia_fecha.value               = r.ia_fecha || '';
      form.ia_toro.value                = r.ia_toro || '';
      form.ia_prenez_pct.value          = r.ia_prenez_pct ?? '';
      form.paricion_inicio.value        = r.paricion_inicio || '';
      form.paricion_fin.value           = r.paricion_fin || '';
      form.partos.value                    = r.partos ?? '';
      form.muertes_paricion.value          = r.muertes_paricion ?? '';
      form.nacidos_machos.value            = r.nacidos_machos ?? '';
      form.nacidos_hembras.value           = r.nacidos_hembras ?? '';
      document.getElementById('fr-total-aparicion').value = r.total_aparicion ?? '';
      form.muertes_terneros.value          = r.muertes_terneros ?? '';
      form.destete_fecha.value             = r.destete_fecha || '';
      form.terneros_machos_destete.value   = r.terneros_machos_destete ?? '';
      form.terneras_hembras_destete.value  = r.terneras_hembras_destete ?? '';
      form.muertes_destete.value           = r.muertes_destete ?? '';
      form.observaciones.value             = r.observaciones || '';
      if (r.ia_realizada) document.getElementById('ia-section').style.display = '';
    }

    document.getElementById('modal-reproduction').classList.remove('hidden');
  };

  const closeModalRepro = () => {
    closeModalAnimated('modal-reproduction', () => { editingReproId = null; });
  };

  const saveRepro = e => {
    e.preventDefault();
    const form = e.target;
    const toInt = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };
    const vacas_total              = toInt(form.vacas_total.value);
    const vacas_positivas          = toInt(form.vacas_positivas.value);
    const muertes_gestacion        = toInt(form.muertes_gestacion.value);
    const vacas_negativas          = (vacas_total != null && vacas_positivas != null) ? vacas_total - vacas_positivas : null;
    const prenez_pct               = (vacas_total != null && vacas_total > 0 && vacas_positivas != null) ? (vacas_positivas / vacas_total * 100) : null;
    const ia_realizada             = form.ia_realizada.checked;
    const partos                   = toInt(form.partos.value);
    const muertes_paricion         = toInt(form.muertes_paricion.value);
    const nacidos_machos           = toInt(form.nacidos_machos.value);
    const nacidos_hembras          = toInt(form.nacidos_hembras.value);
    const total_aparicion          = (nacidos_machos != null || nacidos_hembras != null) ? ((nacidos_machos ?? 0) + (nacidos_hembras ?? 0)) : null;
    const muertes_terneros         = toInt(form.muertes_terneros.value);
    const terneros_machos_destete  = toInt(form.terneros_machos_destete.value);
    const terneras_hembras_destete = toInt(form.terneras_hembras_destete.value);
    const muertes_destete          = toInt(form.muertes_destete.value);

    // % destete = (nacidos vivos - muertes terneros) / vacas entoradas × 100
    const nacidos_vivos = total_aparicion ?? ((terneros_machos_destete ?? 0) + (terneras_hembras_destete ?? 0));
    const indice_destete = (vacas_total != null && vacas_total > 0)
      ? ((nacidos_vivos - (muertes_terneros ?? 0)) / vacas_total * 100)
      : null;
    const mortalidad_total = (muertes_paricion != null || muertes_terneros != null || muertes_destete != null)
      ? ((muertes_paricion ?? 0) + (muertes_terneros ?? 0) + (muertes_destete ?? 0))
      : null;

    const entry = {
      año:                       parseInt(form.año.value, 10),
      fecha_entrada_toros:       form.fecha_entrada_toros.value || null,
      fecha_salida_toros:        form.fecha_salida_toros.value || null,
      tacto_fecha:               form.tacto_fecha.value || null,
      vacas_total,
      vacas_positivas,
      muertes_gestacion,
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
      nacidos_machos,
      nacidos_hembras,
      total_aparicion,
      muertes_terneros,
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
    const wasEditingRepro = !!editingReproId;
    closeModalRepro();
    renderReproduccion();
    ui.toast(wasEditingRepro ? 'Ciclo actualizado.' : 'Ciclo registrado.');
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

  // --- Import CSV ---
  const importCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      if (lines.length < 2) { ui.toast('El archivo no tiene datos.', 'error'); return; }
      const TIPOS_VALIDOS  = new Set(['vaca', 'toro', 'ternero', 'vaquillona', 'novillo']);
      const ESTADOS_VALIDOS = new Set(['activo', 'vendido', 'muerto']);
      const ISO_DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;

      const animals = getData(KEYS.animals);
      const existing = new Set(animals.map(a => a.caravana));
      let added = 0, skipped = 0, invalid = 0;
      // Espera header: ID, Caravana, Nombre, Tipo, Raza, Nacimiento, Potrero, Estado, Peso, Observaciones
      lines.slice(1).forEach(line => {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const caravana = (cols[1] || '').toUpperCase();
        if (!caravana) { invalid++; return; }
        if (existing.has(caravana)) { skipped++; return; }
        const tipo   = (cols[3] || '').toLowerCase();
        const estado = (cols[7] || 'activo').toLowerCase();
        const nacimiento = cols[5] || '';
        if (!TIPOS_VALIDOS.has(tipo)) { invalid++; return; }
        if (!ESTADOS_VALIDOS.has(estado)) { invalid++; return; }
        if (nacimiento && !ISO_DATE_RE.test(nacimiento)) { invalid++; return; }
        animals.unshift({
          id: String(Date.now() + added),
          caravana,
          nombre:       cols[2] || '',
          tipo,
          raza:         cols[4] || '',
          nacimiento,
          potrero:      cols[6] || '',
          estado,
          peso:         cols[8] ? Number(cols[8]) : null,
          observaciones: cols[9] || '',
          castracion_fecha: null,
        });
        existing.add(caravana);
        added++;
      });
      saveData(KEYS.animals, animals);
      render();
      const parts = [`Importados: ${added}`];
      if (skipped)  parts.push(`duplicados omitidos: ${skipped}`);
      if (invalid)  parts.push(`filas inválidas: ${invalid}`);
      ui.toast(parts.join(' · ') + '.');
    };
    reader.readAsText(file);
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

  // --- Lote modal ---
  const openModalLote = () => {
    document.getElementById('form-lote').reset();
    document.getElementById('lote-caravana-preview').textContent = '';
    populateFieldOptions('lote-potrero-options');
    document.getElementById('modal-lote').classList.remove('hidden');
  };

  const closeModalLote = () => {
    closeModalAnimated('modal-lote', () => {});
  };

  const updateLotePreview = () => {
    const prefijo   = document.getElementById('fl-caravana-prefijo').value.trim();
    const desde     = parseInt(document.getElementById('fl-caravana-desde').value, 10);
    const cantidad  = parseInt(document.getElementById('fl-cantidad').value, 10);
    const preview   = document.getElementById('lote-caravana-preview');
    if (!prefijo || !desde || !cantidad || cantidad < 2) { preview.textContent = ''; return; }
    const pad = n => String(n).padStart(3, '0');
    const last = desde + cantidad - 1;
    preview.textContent = `Ej: ${prefijo}${pad(desde)} … ${prefijo}${pad(last)}`;
  };

  const saveAnimalLote = async e => {
    e.preventDefault();
    const form     = e.target;
    const tipo     = form.tipo.value;
    const raza     = form.raza.value.trim();
    const cantidad = parseInt(form.cantidad.value, 10);
    const prefijo  = form.caravana_prefijo.value.trim().toUpperCase();
    const desde    = parseInt(form.caravana_desde.value, 10);
    const potrero  = form.potrero.value.trim();
    const peso     = form.peso.value ? Number(form.peso.value) : null;
    const nacimiento = form.nacimiento.value;
    const estado   = form.estado.value;
    const observaciones = form.observaciones.value.trim();

    if (!tipo)           { ui.fieldError(form.tipo, 'Seleccioná un tipo.'); return; }
    if (!cantidad || cantidad < 2) { ui.fieldError(form.cantidad, 'Ingresá al menos 2 animales.'); return; }

    const animals  = getData(KEYS.animals);
    const existing = new Set(animals.map(a => a.caravana));
    const nuevos   = [];
    const skipped  = [];
    const now      = Date.now();
    const pad      = n => String(n).padStart(3, '0');

    for (let i = 0; i < cantidad; i++) {
      let caravana;
      if (prefijo && desde) {
        caravana = `${prefijo}${pad(desde + i)}`;
      } else if (prefijo) {
        caravana = `${prefijo}${pad(i + 1)}`;
      } else {
        caravana = `LOTE-${tipo.toUpperCase()}-${pad(i + 1)}`;
      }
      if (existing.has(caravana)) { skipped.push(caravana); continue; }
      nuevos.push({
        id: String(now + i),
        caravana,
        nombre: '',
        tipo,
        raza,
        nacimiento,
        potrero,
        estado,
        peso,
        castracion_fecha: null,
        observaciones
      });
    }

    if (!nuevos.length) {
      ui.toast('Todas las caravanas generadas ya existen.', 'error');
      return;
    }

    nuevos.forEach(a => {
      animals.unshift(a);
      logHistory(a.caravana, 'Alta', `Tipo: ${a.tipo} (lote)`);
    });
    saveData(KEYS.animals, animals);
    closeModalLote();
    render();
    const msg = skipped.length
      ? `${nuevos.length} animales registrados. ${skipped.length} omitidos por caravana duplicada.`
      : `${nuevos.length} animales registrados.`;
    ui.toast(msg);
  };

  // --- CTA Dropdown ---
  const closeCTADropdown = () => {
    document.getElementById('animal-cta-dropdown')?.classList.add('hidden');
  };

  // --- Init ---
  const init = () => {
    // CTA dropdown
    document.getElementById('btn-animal-cta').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('animal-cta-dropdown').classList.toggle('hidden');
    });
    document.getElementById('cta-individual').addEventListener('click', () => {
      closeCTADropdown();
      openModal();
    });
    document.getElementById('cta-lote').addEventListener('click', () => {
      closeCTADropdown();
      openModalLote();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#animal-cta-wrapper')) closeCTADropdown();
    });

    // Lote modal
    document.getElementById('modal-lote-close').addEventListener('click', closeModalLote);
    document.getElementById('btn-cancel-lote').addEventListener('click', closeModalLote);
    document.getElementById('modal-lote').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalLote();
    });
    document.getElementById('form-lote').addEventListener('submit', saveAnimalLote);
    document.getElementById('fl-caravana-prefijo').addEventListener('input', updateLotePreview);
    document.getElementById('fl-caravana-desde').addEventListener('input', updateLotePreview);
    document.getElementById('fl-cantidad').addEventListener('input', updateLotePreview);

    // Modal open/close
    document.getElementById('btn-new-animal').addEventListener('click', () => openModal());
    document.getElementById('modal-animal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-animal').addEventListener('click', closeModal);
    document.getElementById('modal-animal').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    // Form submit
    document.getElementById('form-animal').addEventListener('submit', saveAnimal);

    // Filters (debounced search)
    document.getElementById('search-animals').addEventListener('input', ui.debounce(() => { animalsPage = 1; renderAnimals(); }, 300));
    document.getElementById('filter-type').addEventListener('change', () => { animalsPage = 1; renderAnimals(); });

    // Sort headers
    document.querySelectorAll('#animals-table .sortable-th').forEach(th => {
      th.addEventListener('click', () => {
        if (animalsSort.by === th.dataset.sort) {
          animalsSort.dir = animalsSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          animalsSort.by = th.dataset.sort;
          animalsSort.dir = 'asc';
        }
        animalsPage = 1;
        renderAnimals();
      });
    });

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

    // Reactive total aparición
    const updateTotalAparicion = () => {
      const machos  = parseInt(document.getElementById('fr-nacidos-machos').value, 10) || 0;
      const hembras = parseInt(document.getElementById('fr-nacidos-hembras').value, 10) || 0;
      const total   = document.getElementById('fr-nacidos-machos').value || document.getElementById('fr-nacidos-hembras').value
        ? machos + hembras : '';
      document.getElementById('fr-total-aparicion').value = total;
    };
    document.getElementById('fr-nacidos-machos').addEventListener('input', updateTotalAparicion);
    document.getElementById('fr-nacidos-hembras').addEventListener('input', updateTotalAparicion);

    // Reproducción year filter
    document.getElementById('repro-year-filter')?.addEventListener('change', e => {
      reproYear = e.target.value;
      renderReproduccion();
    });

    // Import CSV
    document.getElementById('import-csv-input')?.addEventListener('change', e => {
      importCSV(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-import-csv')?.addEventListener('click', () => {
      document.getElementById('import-csv-input')?.click();
    });

    // Sanidad
    document.getElementById('btn-new-sanidad').addEventListener('click', () => openModalSanidad());
    document.getElementById('modal-sanidad-close').addEventListener('click', closeModalSanidad);
    document.getElementById('btn-cancel-sanidad').addEventListener('click', closeModalSanidad);
    document.getElementById('modal-sanidad').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalSanidad();
    });
    document.getElementById('form-sanidad').addEventListener('submit', saveSanidad);

    document.getElementById('search-sanidad').addEventListener('input', ui.debounce(() => { sanidadPage = 1; renderSanidad(); }, 300));
    document.getElementById('filter-sanidad-tipo').addEventListener('change', () => { sanidadPage = 1; renderSanidad(); });

    // Animal search dropdown para sanidad
    document.getElementById('fs-animal').addEventListener('input', e => {
      selectedSanidadAnimalId = null;
      selectedSanidadAnimalTipo = null;
      if (!e.target.value.trim()) updateRaspajeOption(false);
      buildSanidadDropdown(e.target.value);
    });
    document.getElementById('fs-animal').addEventListener('keydown', e => {
      const dropdown = document.getElementById('sanidad-animal-dropdown');
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
        selectSanidadAnimal(active);
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
      }
    });
    document.getElementById('sanidad-animal-dropdown').addEventListener('mousedown', e => {
      const li = e.target.closest('.dropdown-item');
      if (li) selectSanidadAnimal(li);
    });

    render();
  };

  return { init, edit, remove, editRepro, removeRepro, editSanidad, removeSanidad };
})();
