const Insumos = (() => {
  const KEYS = { insumos: 'ag_insumos', movs: 'ag_insumos_movs' };
  const getData = key => Storage.get(key) || [];
  const saveData = (key, val) => Storage.set(key, val);

  const CATEGORIAS = ['Vacunas', 'Antiparasitarios', 'Antibióticos', 'Semillas', 'Agroquímicos', 'Combustible', 'Otro'];
  const BADGE_CLS = { 'Vacunas': 'badge-ins-vacuna', 'Antiparasitarios': 'badge-ins-antiparasit', 'Antibióticos': 'badge-ins-antibiotico', 'Semillas': 'badge-ins-semilla', 'Agroquímicos': 'badge-ins-agroquimico', 'Combustible': 'badge-ins-combustible', 'Otro': 'badge-ins-otro' };

  // --- Stats ---
  const renderStats = () => {
    const insumos = getData(KEYS.insumos);
    const today = new Date().toISOString().slice(0, 10);
    const limit30 = new Date(); limit30.setDate(limit30.getDate() + 30);
    const l30 = limit30.toISOString().slice(0, 10);

    const bajoMinimo   = insumos.filter(i => i.stock_minimo != null && i.stock_actual <= i.stock_minimo).length;
    const porVencer    = insumos.filter(i => i.vencimiento && i.vencimiento <= l30 && i.vencimiento >= today).length;
    const vencidos     = insumos.filter(i => i.vencimiento && i.vencimiento < today).length;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-ins-total',   insumos.length);
    set('stat-ins-bajo',    bajoMinimo);
    set('stat-ins-vencer',  porVencer + vencidos);
  };

  // --- Tabla principal ---
  const renderInsumos = () => {
    const insumos = [...getData(KEYS.insumos)].sort((a, b) => a.nombre.localeCompare(b.nombre));
    const today   = new Date().toISOString().slice(0, 10);
    const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

    document.getElementById('insumos-tbody').innerHTML = insumos.length
      ? insumos.map(i => {
          const bajo = i.stock_minimo != null && i.stock_actual <= i.stock_minimo;
          const venc = i.vencimiento && i.vencimiento < today;
          const badgeCls = `badge ${BADGE_CLS[i.categoria] || 'badge-ins-otro'}`;
          return `<tr class="${bajo ? 'stock-bajo' : ''}">
            <td>${ui.escapeHtml(i.nombre)}${bajo ? '<span class="stock-bajo-badge">⚠ bajo</span>' : ''}</td>
            <td><span class="${badgeCls}">${ui.escapeHtml(i.categoria)}</span></td>
            <td>${ui.escapeHtml(i.unidad || '')}</td>
            <td class="stock-val">${i.stock_actual ?? '—'}</td>
            <td>${i.stock_minimo ?? '—'}</td>
            <td style="${venc ? 'color:var(--color-danger);font-weight:600' : ''}">${fmtD(i.vencimiento)}</td>
            <td>
              <button class="action-btn" onclick="Insumos.editInsumo('${i.id}')" title="Editar">✏️</button>
              <button class="action-btn" onclick="Insumos.openMovModal('${i.id}')" title="Registrar movimiento">📦</button>
              <button class="action-btn danger" onclick="Insumos.removeInsumo('${i.id}')" title="Eliminar">🗑</button>
            </td>
          </tr>`;
        }).join('')
      : '<tr class="empty-row"><td colspan="7">Sin insumos registrados.</td></tr>';

    renderStats();
  };

  // --- Modal insumo ---
  let editingId = null;

  const openModal = (id = null) => {
    editingId = id;
    const form = document.getElementById('form-insumo');
    form.reset();
    document.getElementById('modal-insumo-title').textContent = id ? 'Editar insumo' : 'Nuevo insumo';
    if (id) {
      const ins = getData(KEYS.insumos).find(i => i.id === id);
      if (ins) {
        form.nombre.value       = ins.nombre;
        form.categoria.value    = ins.categoria;
        form.unidad.value       = ins.unidad || '';
        form.stock_actual.value = ins.stock_actual ?? '';
        form.stock_minimo.value = ins.stock_minimo ?? '';
        form.vencimiento.value  = ins.vencimiento || '';
        form.observaciones.value= ins.observaciones || '';
      }
    }
    document.getElementById('modal-insumo').classList.remove('hidden');
  };

  const closeModal = () => closeModalAnimated('modal-insumo', () => { editingId = null; });

  const saveInsumo = e => {
    e.preventDefault();
    const form = e.target;
    const entry = {
      nombre:       form.nombre.value.trim(),
      categoria:    form.categoria.value,
      unidad:       form.unidad.value.trim(),
      stock_actual: form.stock_actual.value !== '' ? Number(form.stock_actual.value) : 0,
      stock_minimo: form.stock_minimo.value !== '' ? Number(form.stock_minimo.value) : null,
      vencimiento:  form.vencimiento.value || null,
      observaciones:form.observaciones.value.trim(),
    };
    if (!entry.nombre) { ui.fieldError(form.nombre, 'Nombre obligatorio.'); return; }
    const data = getData(KEYS.insumos);
    const wasEditing = !!editingId;
    if (editingId) {
      const idx = data.findIndex(i => i.id === editingId);
      if (idx >= 0) data[idx] = { ...data[idx], ...entry };
    } else {
      data.push({ id: ui.uid(), ...entry });
    }
    saveData(KEYS.insumos, data);
    closeModal();
    renderInsumos();
    ui.toast(wasEditing ? 'Insumo actualizado.' : 'Insumo registrado.');
  };

  // --- Modal movimiento ---
  let movInsumoId = null;

  const openMovModal = id => {
    movInsumoId = id;
    const form = document.getElementById('form-ins-mov');
    form.reset();
    form.fecha.value = new Date().toISOString().slice(0, 10);
    const ins = getData(KEYS.insumos).find(i => i.id === id);
    document.getElementById('mov-insumo-nombre').textContent = ins ? ins.nombre : '';
    document.getElementById('modal-ins-mov').classList.remove('hidden');
  };

  const closeMovModal = () => closeModalAnimated('modal-ins-mov', () => { movInsumoId = null; });

  const saveMov = e => {
    e.preventDefault();
    const form = e.target;
    const tipo     = form.tipo.value;
    const cantidad = Number(form.cantidad.value);
    const costo    = form.costo.value ? Number(form.costo.value) : null;

    if (!cantidad || cantidad <= 0) { ui.fieldError(form.cantidad, 'Cantidad debe ser mayor a 0.'); return; }

    const movs = getData(KEYS.movs);
    movs.push({ id: ui.uid(), insumoId: movInsumoId, fecha: form.fecha.value, tipo, cantidad, motivo: form.motivo.value.trim(), costo });
    saveData(KEYS.movs, movs);

    // Actualizar stock
    const insumos = getData(KEYS.insumos);
    const idx = insumos.findIndex(i => i.id === movInsumoId);
    if (idx >= 0) {
      const delta = tipo === 'entrada' ? cantidad : -cantidad;
      insumos[idx].stock_actual = Math.max(0, (insumos[idx].stock_actual || 0) + delta);
      saveData(KEYS.insumos, insumos);
    }

    closeMovModal();
    renderInsumos();
    ui.toast('Movimiento registrado.');
  };

  // --- Historial de movimientos ---
  const renderMovimientos = () => {
    const movs = [...getData(KEYS.movs)].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const insumos = getData(KEYS.insumos);
    const getName = id => { const ins = insumos.find(i => i.id === id); return ins ? ins.nombre : '(eliminado)'; };
    const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

    document.getElementById('ins-movs-tbody').innerHTML = movs.length
      ? movs.map(m => `<tr>
          <td>${fmtD(m.fecha)}</td>
          <td>${ui.escapeHtml(getName(m.insumoId))}</td>
          <td><span class="badge ${m.tipo === 'entrada' ? 'badge-activo' : 'badge-muerto'}">${m.tipo}</span></td>
          <td>${m.cantidad}</td>
          <td>${ui.escapeHtml(m.motivo || '')}</td>
          <td>${m.costo != null ? '$' + m.costo : '—'}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="6">Sin movimientos registrados.</td></tr>';
  };

  const refresh = () => { renderInsumos(); renderMovimientos(); };

  const init = () => {
    document.getElementById('btn-new-insumo').addEventListener('click', () => openModal());
    document.getElementById('modal-insumo-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-insumo').addEventListener('click', closeModal);
    document.getElementById('modal-insumo').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('form-insumo').addEventListener('submit', saveInsumo);

    document.getElementById('modal-ins-mov-close').addEventListener('click', closeMovModal);
    document.getElementById('btn-cancel-ins-mov').addEventListener('click', closeMovModal);
    document.getElementById('modal-ins-mov').addEventListener('click', e => { if (e.target === e.currentTarget) closeMovModal(); });
    document.getElementById('form-ins-mov').addEventListener('submit', saveMov);

    refresh();
  };

  return { init, refresh, editInsumo: openModal, removeInsumo: id => {
    ui.confirm('¿Eliminar este insumo y todos sus movimientos?').then(ok => {
      if (!ok) return;
      saveData(KEYS.insumos, getData(KEYS.insumos).filter(i => i.id !== id));
      saveData(KEYS.movs,    getData(KEYS.movs).filter(m => m.insumoId !== id));
      renderInsumos(); renderMovimientos();
      ui.toast('Insumo eliminado.');
    });
  }, openMovModal };
})();
