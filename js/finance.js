const Finance = (() => {
  const KEY = 'ag_transactions';
  const AMORT_KEY = 'ag_amortizations';

  const CATEGORIES = {
    ingreso:  ['Toros', 'Vacas vacías', 'Terneros machos', 'Terneras hembras', 'Novillos', 'Vaquillonas', 'Cereales', 'Arrendamiento', 'Subsidios', 'Otro ingreso'],
    gasto:    ['Personal', 'Vacunas', 'Semillas', 'Agroquímicos', 'Labranzas', 'Cosechas', 'Almacenamiento', 'Enfardados', 'Gastos veterinarios', 'Reparaciones maquinaria', 'Reparaciones generales', 'Aplicaciones agroquímicos', 'Varios', 'Combustibles', 'Electricidad', 'Materiales y herramientas'],
    impuesto: ['Ganancias', 'Impuesto inmobiliario', 'Tasas municipales', 'Patentes', 'Seguros'],
  };

  // Categorías que usan peso total + precio/kg para calcular monto
  const PESO_CATS = new Set(['Terneros machos', 'Terneras hembras', 'Novillos', 'Vaquillonas']);
  // Categorías que usan cantidad + precio unitario para calcular monto
  const CANT_CATS = new Set(['Toros', 'Vacas vacías', 'Cereales']);

  let editingId = null;
  const PAGE_SIZE = 20;
  let transactionsPage = 1;

  // --- Helpers ---
  function getAll() { return Storage.get(KEY) || []; }
  function saveAll(data) { Storage.set(KEY, data); }

  function fmt(date) {
    if (!date) return '—';
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmtMoney(n) {
    return '$\u00a0' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Stats ---
  function renderStats() {
    const all = getAll();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let totalIngresos = 0, totalGastos = 0, txMes = 0;
    all.forEach(t => {
      if (t.tipo === 'ingreso') totalIngresos += Number(t.monto);
      else totalGastos += Number(t.monto);
      if (t.fecha && t.fecha.startsWith(thisMonth)) txMes++;
    });

    const balance = totalIngresos - totalGastos;
    const balanceEl = document.getElementById('stat-balance');
    balanceEl.textContent = fmtMoney(balance);
    balanceEl.className = 'stat-value ' + (balance < 0 ? 'stat-negativo' : '');

    document.getElementById('stat-ingresos').textContent = fmtMoney(totalIngresos);
    document.getElementById('stat-gastos').textContent = fmtMoney(totalGastos);
    document.getElementById('stat-mes').textContent = txMes;
  }

  // --- Tab: Transacciones ---
  function renderTable() {
    const search = document.getElementById('search-transactions').value.toLowerCase();
    const filterTipo = document.getElementById('filter-tipo-fin').value;

    let data = getAll();
    if (filterTipo) data = data.filter(t => t.tipo === filterTipo);
    if (search) data = data.filter(t =>
      t.descripcion?.toLowerCase().includes(search) ||
      t.categoria?.toLowerCase().includes(search)
    );

    data.sort((a, b) => {
      const d = b.fecha.localeCompare(a.fecha);
      return d !== 0 ? d : b.id.localeCompare(a.id);
    });

    const TIPO_LABEL = { ingreso: 'Ingreso', gasto: 'Gasto', impuesto: 'Impuesto' };

    const tbody = document.getElementById('transactions-tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No hay transacciones registradas.</td></tr>';
      ui.pagination('transactions-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const paged = data.slice((transactionsPage - 1) * PAGE_SIZE, transactionsPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(t => `
      <tr>
        <td>${fmt(t.fecha)}</td>
        <td><span class="badge badge-tx-${t.tipo}">${TIPO_LABEL[t.tipo] || t.tipo}</span></td>
        <td>${t.categoria}</td>
        <td>${t.descripcion || '—'}</td>
        <td class="monto-cell monto-${t.tipo}">${fmtMoney(t.monto)}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${t.id}" title="Editar">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${t.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
    ui.pagination('transactions-pagination', data.length, transactionsPage, PAGE_SIZE, p => { transactionsPage = p; renderTable(); });
  }

  // --- Tab: Resumen ---
  function renderResumen() {
    const all = getAll();
    const byCategory = {};

    all.forEach(t => {
      if (!byCategory[t.categoria]) byCategory[t.categoria] = { tipo: t.tipo, total: 0 };
      byCategory[t.categoria].total += Number(t.monto);
    });

    const ingresos = Object.entries(byCategory)
      .filter(([, v]) => v.tipo === 'ingreso')
      .sort((a, b) => b[1].total - a[1].total);

    const gastos = Object.entries(byCategory)
      .filter(([, v]) => v.tipo === 'gasto')
      .sort((a, b) => b[1].total - a[1].total);

    const renderGroup = (items, emptyMsg) => {
      if (items.length === 0) return `<p class="resumen-empty">${emptyMsg}</p>`;
      return `<table class="data-table">
        <thead><tr><th>Categoría</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${items.map(([cat, v]) =>
          `<tr><td>${cat}</td><td class="monto-cell monto-${v.tipo}">${fmtMoney(v.total)}</td></tr>`
        ).join('')}</tbody>
      </table>`;
    };

    document.getElementById('resumen-ingresos').innerHTML = renderGroup(ingresos, 'Sin ingresos registrados.');
    document.getElementById('resumen-gastos').innerHTML = renderGroup(gastos, 'Sin gastos registrados.');
  }

  // --- Categories select ---
  function updateCategories(tipo) {
    const sel = document.getElementById('ft-categoria');
    const cats = CATEGORIES[tipo] || [];
    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    updateCategoryFields(sel.value);
  }

  function updateCategoryFields(categoria) {
    document.getElementById('row-peso-precio').classList.toggle('hidden', !PESO_CATS.has(categoria));
    document.getElementById('row-cantidad-precio').classList.toggle('hidden', !CANT_CATS.has(categoria));
  }

  function calcMonto() {
    const cat = document.getElementById('ft-categoria').value;
    if (PESO_CATS.has(cat)) {
      const peso = parseFloat(document.getElementById('ft-peso-kg').value) || 0;
      const precioKg = parseFloat(document.getElementById('ft-precio-kg').value) || 0;
      if (peso && precioKg) document.getElementById('ft-monto').value = (peso * precioKg).toFixed(2);
    } else if (CANT_CATS.has(cat)) {
      const cant = parseFloat(document.getElementById('ft-cantidad').value) || 0;
      const precioUnit = parseFloat(document.getElementById('ft-precio-unit').value) || 0;
      if (cant && precioUnit) document.getElementById('ft-monto').value = (cant * precioUnit).toFixed(2);
    }
  }

  // --- Modal ---
  function openModal(id = null) {
    editingId = id;
    const form = document.getElementById('form-transaction');
    form.reset();

    if (id) {
      const tx = getAll().find(t => t.id === id);
      if (!tx) return;
      document.getElementById('modal-tx-title').textContent = 'Editar transacción';
      document.getElementById('ft-fecha').value = tx.fecha;
      document.getElementById('ft-tipo').value = tx.tipo;
      updateCategories(tx.tipo);
      document.getElementById('ft-categoria').value = tx.categoria;
      updateCategoryFields(tx.categoria);
      document.getElementById('ft-monto').value = tx.monto;
      document.getElementById('ft-descripcion').value = tx.descripcion || '';
      document.getElementById('ft-obs').value = tx.observaciones || '';
      if (tx.cantidad)       document.getElementById('ft-cantidad').value   = tx.cantidad;
      if (tx.precio_unitario) document.getElementById('ft-precio-unit').value = tx.precio_unitario;
      if (tx.peso_kg)        document.getElementById('ft-peso-kg').value    = tx.peso_kg;
      if (tx.precio_kg)      document.getElementById('ft-precio-kg').value  = tx.precio_kg;
    } else {
      document.getElementById('modal-tx-title').textContent = 'Nueva transacción';
      document.getElementById('ft-fecha').value = new Date().toISOString().split('T')[0];
      updateCategories('ingreso');
    }

    document.getElementById('modal-transaction').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-transaction').classList.add('hidden');
    editingId = null;
  }

  // --- Save ---
  function saveTransaction(e) {
    e.preventDefault();
    const fecha           = document.getElementById('ft-fecha').value;
    const tipo            = document.getElementById('ft-tipo').value;
    const categoria       = document.getElementById('ft-categoria').value;
    const monto           = parseFloat(document.getElementById('ft-monto').value);
    const descripcion     = document.getElementById('ft-descripcion').value.trim();
    const observaciones   = document.getElementById('ft-obs').value.trim();
    const cantidad        = parseFloat(document.getElementById('ft-cantidad').value) || null;
    const precio_unitario = parseFloat(document.getElementById('ft-precio-unit').value) || null;
    const peso_kg         = parseFloat(document.getElementById('ft-peso-kg').value) || null;
    const precio_kg       = parseFloat(document.getElementById('ft-precio-kg').value) || null;

    const data = getAll();

    if (editingId) {
      const idx = data.findIndex(t => t.id === editingId);
      if (idx !== -1) data[idx] = { ...data[idx], fecha, tipo, categoria, monto, descripcion, observaciones, cantidad, precio_unitario, peso_kg, precio_kg };
    } else {
      data.push({ id: String(Date.now()), fecha, tipo, categoria, monto, descripcion, observaciones, cantidad, precio_unitario, peso_kg, precio_kg });
    }

    const isNew = !editingId;
    saveAll(data);
    closeModal();
    renderStats();
    renderTable();
    renderResumen();
    ui.toast(isNew ? 'Transacción registrada.' : 'Transacción actualizada.');
  }

  // --- Delete ---
  function remove(id) {
    ui.confirm('¿Eliminar esta transacción?').then(ok => {
      if (!ok) return;
      saveAll(getAll().filter(t => t.id !== id));
      renderStats();
      renderTable();
      renderResumen();
      ui.toast('Transacción eliminada.');
    });
  }

  // --- Tab: Amortizaciones ---
  let editingAmortId = null;

  function renderAmortizaciones() {
    const data = Storage.get(AMORT_KEY) || [];
    const total = data.length;
    const cuotaTotal = data.reduce((s, a) => s + (a.cuota_anual || 0), 0);

    document.getElementById('stat-amort-total').textContent = total;
    document.getElementById('stat-amort-cuota').textContent = fmtMoney(cuotaTotal);

    const tbody = document.getElementById('amort-tbody');
    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay amortizaciones registradas.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(a => `
      <tr>
        <td>${a.nombre}</td>
        <td><span class="badge badge-amort-tipo">${a.tipo}</span></td>
        <td class="monto-cell">${fmtMoney(a.valor_original)}</td>
        <td>${a.vida_util} años</td>
        <td class="monto-cell">${fmtMoney(a.cuota_anual)}</td>
        <td>${a.año_inicio}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${a.id}" title="Editar">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${a.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  function openModalAmort(id = null) {
    editingAmortId = id;
    document.getElementById('form-amortization').reset();
    document.getElementById('modal-amort-title').textContent = id ? 'Editar amortización' : 'Nueva amortización';

    if (id) {
      const a = (Storage.get(AMORT_KEY) || []).find(x => x.id === id);
      if (!a) return;
      document.getElementById('fa-nombre').value     = a.nombre;
      document.getElementById('fa-tipo').value       = a.tipo;
      document.getElementById('fa-año-inicio').value = a.año_inicio;
      document.getElementById('fa-valor').value      = a.valor_original;
      document.getElementById('fa-vida-util').value  = a.vida_util;
      document.getElementById('fa-obs').value        = a.observaciones || '';
    } else {
      document.getElementById('fa-año-inicio').value = new Date().getFullYear();
    }
    document.getElementById('modal-amortization').classList.remove('hidden');
  }

  function closeModalAmort() {
    document.getElementById('modal-amortization').classList.add('hidden');
    editingAmortId = null;
  }

  function saveAmort(e) {
    e.preventDefault();
    const nombre         = document.getElementById('fa-nombre').value.trim();
    const tipo           = document.getElementById('fa-tipo').value;
    const año_inicio     = parseInt(document.getElementById('fa-año-inicio').value);
    const valor_original = parseFloat(document.getElementById('fa-valor').value);
    const vida_util      = parseInt(document.getElementById('fa-vida-util').value);
    const cuota_anual    = vida_util > 0 ? valor_original / vida_util : 0;
    const observaciones  = document.getElementById('fa-obs').value.trim();

    const data = Storage.get(AMORT_KEY) || [];
    if (editingAmortId) {
      const idx = data.findIndex(a => a.id === editingAmortId);
      if (idx !== -1) data[idx] = { ...data[idx], nombre, tipo, año_inicio, valor_original, vida_util, cuota_anual, observaciones };
    } else {
      data.push({ id: String(Date.now()), nombre, tipo, año_inicio, valor_original, vida_util, cuota_anual, observaciones });
    }
    Storage.set(AMORT_KEY, data);
    closeModalAmort();
    renderAmortizaciones();
    ui.toast(editingAmortId ? 'Amortización actualizada.' : 'Amortización registrada.');
  }

  function removeAmort(id) {
    ui.confirm('¿Eliminar esta amortización?').then(ok => {
      if (!ok) return;
      Storage.set(AMORT_KEY, (Storage.get(AMORT_KEY) || []).filter(a => a.id !== id));
      renderAmortizaciones();
      ui.toast('Amortización eliminada.');
    });
  }

  // --- Tab: Margen ---
  function renderMargen(año) {
    const txAll  = getAll().filter(t => t.fecha && t.fecha.startsWith(String(año)));
    const amorts = Storage.get(AMORT_KEY) || [];

    const ingresos = txAll.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
    const costos   = txAll.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
    const impuestos = txAll.filter(t => t.tipo === 'impuesto').reduce((s, t) => s + Number(t.monto), 0);

    const amortizacionesAño = amorts
      .filter(a => año >= a.año_inicio && año < a.año_inicio + a.vida_util)
      .reduce((s, a) => s + (a.cuota_anual || 0), 0);

    const margenBruto = ingresos - costos - amortizacionesAño;
    const margenNeto  = margenBruto - impuestos;

    const card = (label, value) => {
      const cls = value < 0 ? 'margen-card negativo' : 'margen-card positivo';
      return `<div class="${cls}"><span class="margen-label">${label}</span><span class="margen-value">${fmtMoney(value)}</span></div>`;
    };

    document.getElementById('margen-cards').innerHTML = `
      ${card('Ingresos', ingresos)}
      ${card('Costos (excl. impuestos)', costos)}
      ${card('Amortizaciones', amortizacionesAño)}
      ${card('Margen Bruto', margenBruto)}
      ${card('Impuestos', impuestos)}
      ${card('Margen Neto', margenNeto)}
    `;
  }

  function initMargenYear() {
    const sel = document.getElementById('margen-year');
    const currentYear = new Date().getFullYear();
    sel.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 5; y--) {
      sel.innerHTML += `<option value="${y}">${y}</option>`;
    }
    sel.addEventListener('change', () => renderMargen(parseInt(sel.value)));
    renderMargen(currentYear);
  }

  // --- Init ---
  function init() {
    document.getElementById('btn-new-transaction').addEventListener('click', () => openModal());
    document.getElementById('modal-tx-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel-tx').addEventListener('click', closeModal);
    document.getElementById('modal-transaction').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('ft-tipo').addEventListener('change', e => updateCategories(e.target.value));
    document.getElementById('ft-categoria').addEventListener('change', e => updateCategoryFields(e.target.value));
    document.getElementById('ft-peso-kg').addEventListener('input', calcMonto);
    document.getElementById('ft-precio-kg').addEventListener('input', calcMonto);
    document.getElementById('ft-cantidad').addEventListener('input', calcMonto);
    document.getElementById('ft-precio-unit').addEventListener('input', calcMonto);
    document.getElementById('form-transaction').addEventListener('submit', saveTransaction);
    document.getElementById('search-transactions').addEventListener('input', () => { transactionsPage = 1; renderTable(); });
    document.getElementById('filter-tipo-fin').addEventListener('change', () => { transactionsPage = 1; renderTable(); });

    document.getElementById('transactions-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit') openModal(id);
      if (action === 'delete') remove(id);
    });

    // Amortizaciones
    document.getElementById('btn-new-amort').addEventListener('click', () => openModalAmort());
    document.getElementById('modal-amort-close').addEventListener('click', closeModalAmort);
    document.getElementById('btn-cancel-amort').addEventListener('click', closeModalAmort);
    document.getElementById('modal-amortization').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalAmort();
    });
    document.getElementById('form-amortization').addEventListener('submit', saveAmort);
    document.getElementById('amort-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit') openModalAmort(btn.dataset.id);
      if (btn.dataset.action === 'delete') removeAmort(btn.dataset.id);
    });

    renderStats();
    renderTable();
    renderResumen();
    renderAmortizaciones();
    initMargenYear();
  }

  return { init };
})();
