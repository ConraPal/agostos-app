const Finance = (() => {
  const KEY = 'ag_transactions';
  const AMORT_KEY = 'ag_amortizations';
  const PRESUPUESTO_KEY = 'ag_presupuesto';
  const COTIZACION_KEY = 'ag_cotizacion';

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
  let amortPage = 1;
  let presupuestoYear = new Date().getFullYear();
  let editingPresupuestoId = null;

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

  function toARS(monto, moneda) {
    if (moneda === 'USD') {
      const cot = Storage.get(COTIZACION_KEY);
      return Number(monto) * (cot?.usd_ars || 1);
    }
    return Number(monto);
  }

  function fmtMoneda(monto, moneda) {
    if (moneda === 'USD') {
      return 'USD\u00a0' + Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return fmtMoney(monto);
  }

  // --- Potrero datalist for transactions ---
  function populateTxPotreroOptions() {
    const fields = Storage.get('ag_fields') || [];
    const dl = document.getElementById('tx-potrero-options');
    if (!dl) return;
    dl.innerHTML = fields
      .filter(f => f.estado === 'activo')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(f => `<option value="${ui.escapeHtml(f.nombre)}">`)
      .join('');
  }

  // --- Stats ---
  function renderStats() {
    const all = getAll();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let arsIngresos = 0, usdIngresos = 0;
    let arsGastos   = 0, usdGastos   = 0;
    let arsImpuestos = 0;
    let txMes = 0;

    all.forEach(t => {
      const monto = Number(t.monto);
      const isUSD = t.moneda === 'USD';
      if (t.tipo === 'ingreso') {
        if (isUSD) usdIngresos += monto; else arsIngresos += monto;
      } else if (t.tipo === 'impuesto') {
        arsImpuestos += toARS(monto, t.moneda);
      } else {
        if (isUSD) usdGastos += monto; else arsGastos += monto;
      }
      if (t.fecha?.startsWith(thisMonth)) txMes++;
    });

    const totalGastosARS = arsGastos + toARS(usdGastos, 'USD') + arsImpuestos;
    const balance = (arsIngresos + toARS(usdIngresos, 'USD')) - totalGastosARS;
    const balanceEl = document.getElementById('stat-balance');
    balanceEl.textContent = fmtMoney(balance);
    balanceEl.className = 'stat-value ' + (balance < 0 ? 'stat-negativo' : '');

    document.getElementById('stat-ingresos-ars').textContent = fmtMoney(arsIngresos);
    const ingUsdEl = document.getElementById('stat-ingresos-usd');
    if (ingUsdEl) {
      ingUsdEl.textContent = usdIngresos > 0 ? fmtMoneda(usdIngresos, 'USD') : '';
      ingUsdEl.style.display = usdIngresos > 0 ? '' : 'none';
    }

    document.getElementById('stat-gastos-ars').textContent = fmtMoney(arsGastos);
    const gastUsdEl = document.getElementById('stat-gastos-usd');
    if (gastUsdEl) {
      gastUsdEl.textContent = usdGastos > 0 ? fmtMoneda(usdGastos, 'USD') : '';
      gastUsdEl.style.display = usdGastos > 0 ? '' : 'none';
    }

    const impEl = document.getElementById('stat-impuestos-ars');
    if (impEl) impEl.textContent = fmtMoney(arsImpuestos);

    ui.countUp(document.getElementById('stat-mes'), txMes);
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
      tbody.innerHTML = emptyStateHTML(
        search || filterTipo ? 'No hay transacciones que coincidan.' : 'Aún no registraste transacciones.',
        search || filterTipo ? '' : '+ Nueva transacción',
        "document.getElementById('btn-new-transaction').click()"
      );
      ui.pagination('transactions-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const paged = data.slice((transactionsPage - 1) * PAGE_SIZE, transactionsPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(t => {
      const esEgreso = t.tipo === 'gasto' || t.tipo === 'impuesto';
      const montoFmt = (esEgreso ? '−\u00a0' : '') + fmtMoneda(t.monto, t.moneda);
      const ecat = ui.escapeHtml(t.categoria);
      const edesc = ui.escapeHtml(t.descripcion);
      const epot = ui.escapeHtml(t.potrero);
      return `
      <tr>
        <td>${fmt(t.fecha)}</td>
        <td><span class="badge badge-tx-${t.tipo}">${TIPO_LABEL[t.tipo] || t.tipo}</span></td>
        <td>${ecat}</td>
        <td>${edesc || '—'}${epot ? `<br><span class="cell-sub">${epot}</span>` : ''}</td>
        <td class="monto-cell monto-${t.tipo}">${montoFmt}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${t.id}" title="Editar" aria-label="Editar transacción ${ecat}">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${t.id}" title="Eliminar" aria-label="Eliminar transacción ${ecat}">🗑️</button>
        </td>
      </tr>
    `}).join('');
    ui.pagination('transactions-pagination', data.length, transactionsPage, PAGE_SIZE, p => { transactionsPage = p; renderTable(); });
  }

  // --- Tab: Resumen ---
  function renderResumen() {
    const all = getAll();
    // byCategory: { tipo, ars, usd }
    const byCategory = {};

    all.forEach(t => {
      if (!byCategory[t.categoria]) byCategory[t.categoria] = { tipo: t.tipo, ars: 0, usd: 0 };
      if (t.moneda === 'USD') byCategory[t.categoria].usd += Number(t.monto);
      else                    byCategory[t.categoria].ars += Number(t.monto);
    });

    const ingresos = Object.entries(byCategory)
      .filter(([, v]) => v.tipo === 'ingreso')
      .sort((a, b) => (b[1].ars + toARS(b[1].usd, 'USD')) - (a[1].ars + toARS(a[1].usd, 'USD')));

    const gastos = Object.entries(byCategory)
      .filter(([, v]) => v.tipo === 'gasto')
      .sort((a, b) => (b[1].ars + toARS(b[1].usd, 'USD')) - (a[1].ars + toARS(a[1].usd, 'USD')));

    const impuestos = Object.entries(byCategory)
      .filter(([, v]) => v.tipo === 'impuesto')
      .sort((a, b) => (b[1].ars + toARS(b[1].usd, 'USD')) - (a[1].ars + toARS(a[1].usd, 'USD')));

    const fmtRow = (cat, v) => {
      const arsStr = v.ars > 0 ? `<span class="monto-${v.tipo}">${fmtMoney(v.ars)}</span>` : '';
      const usdStr = v.usd > 0 ? `<span class="badge-moneda-usd">USD\u00a0${v.usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : '';
      const sep = arsStr && usdStr ? '<span class="resumen-sep">+</span>' : '';
      return `<tr><td>${ui.escapeHtml(cat)}</td><td class="monto-cell resumen-monto">${arsStr}${sep}${usdStr}</td></tr>`;
    };

    const renderGroup = (items, emptyMsg) => {
      if (items.length === 0) return `<p class="resumen-empty">${emptyMsg}</p>`;
      return `<table class="data-table">
        <thead><tr><th>Categoría</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${items.map(([cat, v]) => fmtRow(cat, v)).join('')}</tbody>
      </table>`;
    };

    document.getElementById('resumen-ingresos').innerHTML  = renderGroup(ingresos,  'Sin ingresos registrados.');
    document.getElementById('resumen-gastos').innerHTML    = renderGroup(gastos,    'Sin gastos registrados.');
    const impEl = document.getElementById('resumen-impuestos');
    if (impEl) impEl.innerHTML = renderGroup(impuestos, 'Sin impuestos registrados.');

    // Gastos por potrero — separados por moneda
    const gastosPorPotrero = {};
    all.filter(t => t.tipo === 'gasto' && t.potrero).forEach(t => {
      if (!gastosPorPotrero[t.potrero]) gastosPorPotrero[t.potrero] = { ars: 0, usd: 0 };
      if (t.moneda === 'USD') gastosPorPotrero[t.potrero].usd += Number(t.monto);
      else                    gastosPorPotrero[t.potrero].ars += Number(t.monto);
    });
    const potreroEntries = Object.entries(gastosPorPotrero)
      .sort((a, b) => (b[1].ars + toARS(b[1].usd, 'USD')) - (a[1].ars + toARS(a[1].usd, 'USD')));
    const resumenPotrero = document.getElementById('resumen-potrero');
    if (resumenPotrero) {
      resumenPotrero.innerHTML = potreroEntries.length
        ? `<table class="data-table"><thead><tr><th>Potrero</th><th style="text-align:right">Total gastos</th></tr></thead><tbody>${
            potreroEntries.map(([p, v]) => {
              const arsStr = v.ars > 0 ? `<span class="monto-gasto">${fmtMoney(v.ars)}</span>` : '';
              const usdStr = v.usd > 0 ? `<span class="badge-moneda-usd">USD\u00a0${v.usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : '';
              const sep = arsStr && usdStr ? '<span class="resumen-sep">+</span>' : '';
              return `<tr><td>${ui.escapeHtml(p)}</td><td class="monto-cell resumen-monto">${arsStr}${sep}${usdStr}</td></tr>`;
            }).join('')
          }</tbody></table>`
        : '<p class="resumen-empty">Sin gastos asignados a potreros.</p>';
    }
  }

  // --- Categories select ---
  function updateCategories(tipo) {
    const sel = document.getElementById('ft-categoria');
    const cats = CATEGORIES[tipo] || [];
    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    updateCategoryFields(sel.value);
    const monedaSel = document.getElementById('ft-moneda');
    if (monedaSel) {
      if (tipo === 'impuesto') {
        monedaSel.value = 'ARS';
        monedaSel.disabled = true;
      } else {
        monedaSel.disabled = false;
      }
    }
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
      document.getElementById('ft-moneda').value = tx.tipo === 'impuesto' ? 'ARS' : (tx.moneda || 'ARS');
      document.getElementById('ft-moneda').disabled = tx.tipo === 'impuesto';
      document.getElementById('ft-descripcion').value = tx.descripcion || '';
      document.getElementById('ft-potrero').value = tx.potrero || '';
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

    populateTxPotreroOptions();
    document.getElementById('modal-transaction').classList.remove('hidden');
  }

  function closeModal() {
    closeModalAnimated('modal-transaction', () => {
      const monedaSel = document.getElementById('ft-moneda');
      if (monedaSel) monedaSel.disabled = false;
      editingId = null;
    });
  }

  // --- Save ---
  function saveTransaction(e) {
    e.preventDefault();
    const fecha           = document.getElementById('ft-fecha').value;
    const tipo            = document.getElementById('ft-tipo').value;
    const categoria       = document.getElementById('ft-categoria').value;
    const monto           = parseFloat(document.getElementById('ft-monto').value);
    const moneda          = tipo === 'impuesto' ? 'ARS' : (document.getElementById('ft-moneda').value || 'ARS');
    const descripcion     = document.getElementById('ft-descripcion').value.trim();
    const observaciones   = document.getElementById('ft-obs').value.trim();
    const potrero         = document.getElementById('ft-potrero').value.trim() || null;
    const cantidad        = parseFloat(document.getElementById('ft-cantidad').value) || null;
    const precio_unitario = parseFloat(document.getElementById('ft-precio-unit').value) || null;
    const peso_kg         = parseFloat(document.getElementById('ft-peso-kg').value) || null;
    const precio_kg       = parseFloat(document.getElementById('ft-precio-kg').value) || null;

    if (!monto || monto <= 0) {
      ui.toast('El monto debe ser mayor a cero.', 'error');
      document.getElementById('ft-monto').focus();
      return;
    }

    const data = getAll();

    if (editingId) {
      const idx = data.findIndex(t => t.id === editingId);
      if (idx !== -1) data[idx] = { ...data[idx], fecha, tipo, categoria, monto, moneda, descripcion, observaciones, potrero, cantidad, precio_unitario, peso_kg, precio_kg };
    } else {
      data.push({ id: String(Date.now()), fecha, tipo, categoria, monto, moneda, descripcion, observaciones, potrero, cantidad, precio_unitario, peso_kg, precio_kg });
    }

    const isNew = !editingId;
    saveAll(data);
    transactionsPage = 1;
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

    ui.countUp(document.getElementById('stat-amort-total'), total);
    document.getElementById('stat-amort-cuota').textContent = fmtMoney(cuotaTotal);

    const tbody = document.getElementById('amort-tbody');
    if (!data.length) {
      tbody.innerHTML = emptyStateHTML('Aún no registraste activos amortizables.', '', '');
      ui.pagination('amort-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }
    const paged = data.slice((amortPage - 1) * PAGE_SIZE, amortPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(a => {
      const en = ui.escapeHtml(a.nombre);
      return `
      <tr>
        <td>${en}</td>
        <td><span class="badge badge-amort-tipo">${a.tipo}</span></td>
        <td class="monto-cell">${fmtMoney(a.valor_original)}</td>
        <td>${a.vida_util} años</td>
        <td class="monto-cell">${fmtMoney(a.cuota_anual)}</td>
        <td>${a.año_inicio}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${a.id}" title="Editar" aria-label="Editar amortización ${en}">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${a.id}" title="Eliminar" aria-label="Eliminar amortización ${en}">🗑️</button>
        </td>
      </tr>`;
    }).join('');
    ui.pagination('amort-pagination', data.length, amortPage, PAGE_SIZE, p => { amortPage = p; renderAmortizaciones(); });
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
    closeModalAnimated('modal-amortization', () => { editingAmortId = null; });
  }

  function saveAmort(e) {
    e.preventDefault();
    const nombre         = document.getElementById('fa-nombre').value.trim();
    const tipo           = document.getElementById('fa-tipo').value;
    const año_inicio     = parseInt(document.getElementById('fa-año-inicio').value, 10);
    const valor_original = parseFloat(document.getElementById('fa-valor').value);
    const vida_util      = parseInt(document.getElementById('fa-vida-util').value, 10);
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
    amortPage = 1;
    const wasEditingAmort = !!editingAmortId;
    closeModalAmort();
    renderAmortizaciones();
    ui.toast(wasEditingAmort ? 'Amortización actualizada.' : 'Amortización registrada.');
  }

  function removeAmort(id) {
    ui.confirm('¿Eliminar esta amortización?').then(ok => {
      if (!ok) return;
      Storage.set(AMORT_KEY, (Storage.get(AMORT_KEY) || []).filter(a => a.id !== id));
      amortPage = 1;
      renderAmortizaciones();
      ui.toast('Amortización eliminada.');
    });
  }

  // --- Tab: Margen ---
  function renderMargen(año) {
    const txAll  = getAll().filter(t => t.fecha && t.fecha.startsWith(String(año)));
    const amorts = Storage.get(AMORT_KEY) || [];

    const ingresos  = txAll.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + toARS(t.monto, t.moneda), 0);
    const costos    = txAll.filter(t => t.tipo === 'gasto').reduce((s, t) => s + toARS(t.monto, t.moneda), 0);
    const impuestos = txAll.filter(t => t.tipo === 'impuesto').reduce((s, t) => s + toARS(t.monto, t.moneda), 0);

    const amortizacionesAño = amorts
      .filter(a => año >= a.año_inicio && año < a.año_inicio + a.vida_util)
      .reduce((s, a) => s + (a.cuota_anual || 0), 0);

    const margenBruto = ingresos - costos;
    const margenNeto  = margenBruto - impuestos;

    const card = (label, value) => {
      const cls = value < 0 ? 'margen-card negativo' : 'margen-card positivo';
      return `<div class="${cls}"><span class="margen-label">${label}</span><span class="margen-value">${fmtMoney(value)}</span></div>`;
    };

    document.getElementById('margen-cards').innerHTML = `
      ${card('Ingresos', ingresos)}
      ${card('Costos operativos', costos)}
      ${card('Margen Bruto', margenBruto)}
      ${card('Impuestos / Retenciones', impuestos)}
      ${card('Margen Neto', margenNeto)}
      ${card('Amortizaciones', amortizacionesAño)}
    `;
  }

  function initMargenYear() {
    const sel = document.getElementById('margen-year');
    const currentYear = new Date().getFullYear();
    sel.innerHTML = '';
    for (let y = currentYear; y >= currentYear - 5; y--) {
      sel.innerHTML += `<option value="${y}">${y}</option>`;
    }
    sel.addEventListener('change', () => renderMargen(parseInt(sel.value, 10)));
    renderMargen(currentYear);
  }

  // --- Tab: Presupuesto ---
  function renderPresupuesto(año) {
    const presup = (Storage.get(PRESUPUESTO_KEY) || []).filter(p => p.año === año);
    const txAll  = getAll().filter(t => t.fecha && t.fecha.startsWith(String(año)));
    const tbody  = document.getElementById('presupuesto-tbody');
    if (!tbody) return;

    if (!presup.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Sin presupuesto para este año. Agregá ítems con el botón.</td></tr>';
      return;
    }

    const TIPO_LABEL = { ingreso: 'Ingreso', gasto: 'Gasto' };
    tbody.innerHTML = presup.map(p => {
      const real   = txAll.filter(t => t.tipo === p.tipo && t.categoria === p.categoria).reduce((s, t) => s + Number(t.monto), 0);
      const diff   = p.monto - real;
      const pct    = p.monto > 0 ? (real / p.monto * 100).toFixed(0) + '%' : '—';
      // Para gastos: si real > presup → rojo (sobrepasó); para ingresos: si real < presup → rojo
      const diffCls = p.tipo === 'gasto'
        ? (diff < 0 ? 'monto-gasto' : 'monto-ingreso')
        : (diff > 0 ? 'monto-ingreso' : 'monto-gasto');
      const ecat = ui.escapeHtml(p.categoria);
      return `
        <tr>
          <td>${ecat}</td>
          <td><span class="badge badge-tx-${p.tipo}">${TIPO_LABEL[p.tipo] || p.tipo}</span></td>
          <td class="monto-cell">${fmtMoney(p.monto)}</td>
          <td class="monto-cell monto-${p.tipo}">${fmtMoney(real)}</td>
          <td class="monto-cell ${diffCls}">${fmtMoney(Math.abs(diff))}</td>
          <td>${pct}</td>
          <td class="actions-cell">
            <button class="action-btn" data-action="edit-presup" data-id="${p.id}" title="Editar" aria-label="Editar presupuesto ${ecat}">✏️</button>
            <button class="action-btn danger" data-action="delete-presup" data-id="${p.id}" title="Eliminar" aria-label="Eliminar presupuesto ${ecat}">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initPresupuestoYear() {
    const sel = document.getElementById('presupuesto-year');
    if (!sel) return;
    const cur = new Date().getFullYear();
    sel.innerHTML = '';
    for (let y = cur + 1; y >= cur - 3; y--) {
      sel.innerHTML += `<option value="${y}"${y === cur ? ' selected' : ''}>${y}</option>`;
    }
    sel.addEventListener('change', () => { presupuestoYear = parseInt(sel.value, 10); renderPresupuesto(presupuestoYear); });
    renderPresupuesto(cur);
  }

  function updatePresupuestoCategorias(tipo) {
    const sel  = document.getElementById('fp-categoria');
    if (!sel) return;
    const cats = CATEGORIES[tipo] || [];
    sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function openModalPresupuesto(id = null) {
    editingPresupuestoId = id;
    document.getElementById('form-presupuesto').reset();
    document.getElementById('modal-presup-title').textContent = id ? 'Editar presupuesto' : 'Nuevo ítem de presupuesto';
    const yearSel = document.getElementById('presupuesto-year');
    document.getElementById('fp-año').value = yearSel ? yearSel.value : new Date().getFullYear();

    if (id) {
      const p = (Storage.get(PRESUPUESTO_KEY) || []).find(x => x.id === id);
      if (!p) return;
      document.getElementById('fp-año').value = p.año;
      document.getElementById('fp-tipo').value = p.tipo;
      updatePresupuestoCategorias(p.tipo);
      document.getElementById('fp-categoria').value = p.categoria;
      document.getElementById('fp-monto').value = p.monto;
    } else {
      updatePresupuestoCategorias('ingreso');
    }
    document.getElementById('modal-presupuesto').classList.remove('hidden');
  }

  function closeModalPresupuesto() {
    closeModalAnimated('modal-presupuesto', () => { editingPresupuestoId = null; });
  }

  function savePresupuesto(e) {
    e.preventDefault();
    const año      = parseInt(document.getElementById('fp-año').value, 10);
    const tipo     = document.getElementById('fp-tipo').value;
    const categoria = document.getElementById('fp-categoria').value;
    const monto    = parseFloat(document.getElementById('fp-monto').value);

    const data = Storage.get(PRESUPUESTO_KEY) || [];
    if (!editingPresupuestoId) {
      if (data.some(p => p.año === año && p.tipo === tipo && p.categoria === categoria)) {
        ui.toast(`Ya hay presupuesto para "${categoria}" en ${año}. Editalo directamente.`, 'error');
        return;
      }
      data.push({ id: String(Date.now()), año, tipo, categoria, monto });
    } else {
      const idx = data.findIndex(p => p.id === editingPresupuestoId);
      if (idx !== -1) data[idx] = { ...data[idx], año, tipo, categoria, monto };
    }
    Storage.set(PRESUPUESTO_KEY, data);
    const wasEditingPresup = !!editingPresupuestoId;
    closeModalPresupuesto();
    renderPresupuesto(presupuestoYear);
    ui.toast(wasEditingPresup ? 'Presupuesto actualizado.' : 'Presupuesto registrado.');
  }

  function removePresupuesto(id) {
    ui.confirm('¿Eliminar este ítem del presupuesto?').then(ok => {
      if (!ok) return;
      Storage.set(PRESUPUESTO_KEY, (Storage.get(PRESUPUESTO_KEY) || []).filter(p => p.id !== id));
      renderPresupuesto(presupuestoYear);
      ui.toast('Ítem eliminado.');
    });
  }

  // --- Tab: Vencimientos ---
  const VENC_KEY = 'ag_vencimientos';
  let editingVencId = null;
  let vencimientosPage = 1;

  function getVenc() { return Storage.get(VENC_KEY) || []; }
  function saveAllVenc(data) { Storage.set(VENC_KEY, data); }

  function vencStatus(item) {
    if (item.completado) return { label: 'Pagado', cls: 'pagado' };
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date(); limit.setDate(limit.getDate() + 30);
    const limitStr = limit.toISOString().slice(0, 10);
    if (item.fecha < today)          return { label: 'Vencido',  cls: 'vencido'   };
    if (item.fecha <= limitStr)      return { label: 'Próximo',  cls: 'proximo'   };
    return                                  { label: 'Pendiente', cls: 'pendiente' };
  }

  function openModalVenc(id = null) {
    editingVencId = id;
    document.getElementById('form-vencimiento').reset();
    document.getElementById('modal-venc-title').textContent = id ? 'Editar vencimiento' : 'Nuevo vencimiento';
    if (id) {
      const v = getVenc().find(x => x.id === id);
      if (!v) return;
      document.getElementById('fv-concepto').value = v.concepto;
      document.getElementById('fv-fecha').value    = v.fecha;
      document.getElementById('fv-monto').value    = v.monto;
    }
    document.getElementById('modal-vencimiento').classList.remove('hidden');
  }

  function closeModalVenc() {
    closeModalAnimated('modal-vencimiento', () => { editingVencId = null; });
  }

  function saveVencimiento(e) {
    e.preventDefault();
    const concepto = document.getElementById('fv-concepto').value.trim();
    const fecha    = document.getElementById('fv-fecha').value;
    const monto    = parseFloat(document.getElementById('fv-monto').value);

    const data = getVenc();
    const wasEditing = !!editingVencId;
    if (wasEditing) {
      const idx = data.findIndex(v => v.id === editingVencId);
      if (idx !== -1) data[idx] = { ...data[idx], concepto, fecha, monto };
    } else {
      data.push({ id: String(Date.now()), concepto, fecha, monto, completado: false });
    }
    saveAllVenc(data);
    vencimientosPage = 1;
    closeModalVenc();
    renderVencimientos();
    ui.toast(wasEditing ? 'Vencimiento actualizado.' : 'Vencimiento registrado.');
  }

  function removeVenc(id) {
    ui.confirm('¿Eliminar este vencimiento?').then(ok => {
      if (!ok) return;
      saveAllVenc(getVenc().filter(v => v.id !== id));
      renderVencimientos();
      ui.toast('Vencimiento eliminado.');
    });
  }

  function toggleVencPagado(id) {
    const data = getVenc();
    const idx = data.findIndex(v => v.id === id);
    if (idx !== -1) data[idx].completado = !data[idx].completado;
    saveAllVenc(data);
    renderVencimientos();
  }

  function renderVencimientos() {
    const all = getVenc();

    // Sort: vencidos/próximos/pendientes ASC por fecha, pagados al fondo
    all.sort((a, b) => {
      const aPagado = a.completado ? 1 : 0;
      const bPagado = b.completado ? 1 : 0;
      if (aPagado !== bPagado) return aPagado - bPagado;
      return a.fecha.localeCompare(b.fecha);
    });

    const tbody = document.getElementById('vencimientos-tbody');
    if (!all.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay vencimientos registrados.</td></tr>';
      ui.pagination('vencimientos-pagination', 0, 1, PAGE_SIZE, () => {});
      return;
    }

    const paged = all.slice((vencimientosPage - 1) * PAGE_SIZE, vencimientosPage * PAGE_SIZE);
    tbody.innerHTML = paged.map(v => {
      const { label, cls } = vencStatus(v);
      const toggleLabel = v.completado ? '↩️' : '✅';
      const toggleTitle = v.completado ? 'Desmarcar como pagado' : 'Marcar como pagado';
      return `
        <tr>
          <td>${fmt(v.fecha)}</td>
          <td>${v.concepto}</td>
          <td class="monto-cell">${fmtMoney(v.monto)}</td>
          <td><span class="badge badge-venc-${cls}">${label}</span></td>
          <td class="actions-cell">
            <button class="action-btn" data-action="toggle-venc" data-id="${v.id}" title="${toggleTitle}" aria-label="${toggleTitle}">${toggleLabel}</button>
            <button class="action-btn" data-action="edit-venc" data-id="${v.id}" title="Editar" aria-label="Editar vencimiento ${v.concepto}">✏️</button>
            <button class="action-btn danger" data-action="delete-venc" data-id="${v.id}" title="Eliminar" aria-label="Eliminar vencimiento ${v.concepto}">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
    ui.pagination('vencimientos-pagination', all.length, vencimientosPage, PAGE_SIZE, p => { vencimientosPage = p; renderVencimientos(); });
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
    document.getElementById('search-transactions').addEventListener('input', ui.debounce(() => { transactionsPage = 1; renderTable(); }, 300));
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

    // Cotización USD
    function updateCotizacionUI() {
      const cot = Storage.get(COTIZACION_KEY);
      const hint = document.getElementById('cotizacion-hint');
      const input = document.getElementById('cotizacion-usd');
      if (cot?.usd_ars) {
        if (input) input.value = cot.usd_ars;
        if (hint) hint.textContent = `Actualizado: ${fmt(cot.fecha)}`;
      }
    }
    updateCotizacionUI();
    document.getElementById('btn-save-cotizacion')?.addEventListener('click', () => {
      const val = parseFloat(document.getElementById('cotizacion-usd').value);
      if (!val || val <= 0) { ui.toast('Ingresá un valor de cotización válido.', 'error'); return; }
      Storage.set(COTIZACION_KEY, { usd_ars: val, fecha: new Date().toISOString().slice(0, 10) });
      updateCotizacionUI();
      renderStats();
      ui.toast('Cotización USD guardada.');
    });

    renderStats();
    renderTable();
    renderResumen();
    renderAmortizaciones();
    initMargenYear();

    // Presupuesto
    document.getElementById('btn-new-presup')?.addEventListener('click', () => openModalPresupuesto());
    document.getElementById('modal-presup-close')?.addEventListener('click', closeModalPresupuesto);
    document.getElementById('btn-cancel-presup')?.addEventListener('click', closeModalPresupuesto);
    document.getElementById('modal-presupuesto')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalPresupuesto();
    });
    document.getElementById('fp-tipo')?.addEventListener('change', e => updatePresupuestoCategorias(e.target.value));
    document.getElementById('form-presupuesto')?.addEventListener('submit', savePresupuesto);
    document.getElementById('presupuesto-tbody')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'edit-presup') openModalPresupuesto(btn.dataset.id);
      if (btn.dataset.action === 'delete-presup') removePresupuesto(btn.dataset.id);
    });
    initPresupuestoYear();

    // Vencimientos
    document.getElementById('btn-new-vencimiento').addEventListener('click', () => openModalVenc());
    document.getElementById('modal-venc-close').addEventListener('click', closeModalVenc);
    document.getElementById('btn-cancel-venc').addEventListener('click', closeModalVenc);
    document.getElementById('modal-vencimiento').addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModalVenc();
    });
    document.getElementById('form-vencimiento').addEventListener('submit', saveVencimiento);
    document.getElementById('vencimientos-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'toggle-venc') toggleVencPagado(btn.dataset.id);
      if (btn.dataset.action === 'edit-venc')   openModalVenc(btn.dataset.id);
      if (btn.dataset.action === 'delete-venc') removeVenc(btn.dataset.id);
    });
    renderVencimientos();
  }

  return { init };
})();
