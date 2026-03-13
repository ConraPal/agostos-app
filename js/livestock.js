// ===== Livestock Module =====
const Livestock = (() => {

  const KEYS = { animals: 'ag_animals', movements: 'ag_movements', history: 'ag_history' };

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
      return;
    }

    tbody.innerHTML = animals.map(a => `
      <tr data-id="${a.id}">
        <td><strong>${a.caravana}</strong></td>
        <td>${a.nombre || '—'}</td>
        <td style="text-transform:capitalize">${a.tipo}</td>
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
      return;
    }
    tbody.innerHTML = movements.map(m => `
      <tr>
        <td>${formatDate(m.fecha)}</td>
        <td><strong>${m.caravana}</strong>${m.animalNombre ? `<br><span class="cell-sub">${m.animalNombre}</span>` : ''}</td>
        <td style="text-transform:capitalize">${m.tipo}</td>
        <td>${m.origen || '—'}</td>
        <td>${m.destino || '—'}</td>
        <td>${m.observaciones || '—'}</td>
      </tr>
    `).join('');
  };

  // --- Render history table ---
  const renderHistory = () => {
    const history = [...getData(KEYS.history)].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const tbody = document.getElementById('history-tbody');
    if (!history.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No hay registros en el historial.</td></tr>`;
      return;
    }
    tbody.innerHTML = history.map(h => `
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
  };

  // --- Full render ---
  const render = () => {
    renderStats();
    renderAnimals();
    renderMovements();
    renderHistory();
  };

  // --- Modal ---
  let editingId = null;

  const openModal = (animal = null) => {
    editingId = animal ? animal.id : null;
    const form = document.getElementById('form-animal');
    form.reset();
    document.getElementById('modal-animal-title').textContent = animal ? 'Editar animal' : 'Nuevo animal';
    if (animal) {
      form.caravana.value      = animal.caravana;
      form.nombre.value        = animal.nombre || '';
      form.tipo.value          = animal.tipo;
      form.raza.value          = animal.raza || '';
      form.nacimiento.value    = animal.nacimiento || '';
      form.potrero.value       = animal.potrero || '';
      form.estado.value        = animal.estado;
      form.peso.value          = animal.peso || '';
      form.observaciones.value = animal.observaciones || '';
    }
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
      caravana:      form.caravana.value.trim().toUpperCase(),
      nombre:        form.nombre.value.trim(),
      tipo:          form.tipo.value,
      raza:          form.raza.value.trim(),
      nacimiento:    form.nacimiento.value,
      potrero:       form.potrero.value.trim(),
      estado:        form.estado.value,
      peso:          form.peso.value ? Number(form.peso.value) : null,
      observaciones: form.observaciones.value.trim()
    };

    if (editingId) {
      const idx = animals.findIndex(a => a.id === editingId);
      animals[idx] = { ...animals[idx], ...data };
      logHistory(data.caravana, 'Actualización', 'Datos editados', data.nombre);
    } else {
      // Check duplicate caravana
      if (animals.some(a => a.caravana === data.caravana)) {
        alert(`Ya existe un animal con la caravana ${data.caravana}`);
        return;
      }
      animals.unshift({ id: String(Date.now()), ...data });
      logHistory(data.caravana, 'Alta', `Tipo: ${data.tipo}`, data.nombre);
    }

    saveData(KEYS.animals, animals);
    closeModal();
    render();
  };

  // --- Movement Modal ---
  let selectedAnimalId = null;

  const openMovementModal = () => {
    selectedAnimalId = null;
    const form = document.getElementById('form-movement');
    form.reset();
    form.fecha.value = new Date().toISOString().slice(0, 10);
    document.getElementById('animal-dropdown').classList.add('hidden');
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
      alert(`No se encontró ningún animal con esa caravana. Seleccioná uno de la lista.`);
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
    if (!confirm(`¿Eliminar el animal ${animal.caravana}? Esta acción no se puede deshacer.`)) return;
    saveData(KEYS.animals, animals.filter(a => a.id !== id));
    logHistory(animal.caravana, 'Baja', 'Eliminado del registro', animal.nombre);
    render();
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
    document.getElementById('search-animals').addEventListener('input', renderAnimals);
    document.getElementById('filter-type').addEventListener('change', renderAnimals);

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

    render();
  };

  return { init, edit, remove };
})();
