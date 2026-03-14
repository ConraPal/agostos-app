const Finance = (() => {
  const KEY = 'ag_transactions';

  const CATEGORIES = {
    ingreso: ['Venta de animales', 'Arrendamiento', 'Subsidios', 'Otro ingreso'],
    gasto:   ['Compra de animales', 'Veterinaria', 'Alimentación', 'Combustible', 'Maquinaria', 'Sueldos', 'Otro gasto'],
  };

  let editingId = null;

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

    const tbody = document.getElementById('transactions-tbody');
    if (data.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No hay transacciones registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(t => `
      <tr>
        <td>${fmt(t.fecha)}</td>
        <td><span class="badge badge-tx-${t.tipo}">${t.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
        <td>${t.categoria}</td>
        <td>${t.descripcion || '—'}</td>
        <td class="monto-cell monto-${t.tipo}">${fmtMoney(t.monto)}</td>
        <td class="actions-cell">
          <button class="action-btn" data-action="edit" data-id="${t.id}" title="Editar">✏️</button>
          <button class="action-btn danger" data-action="delete" data-id="${t.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
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
      document.getElementById('ft-monto').value = tx.monto;
      document.getElementById('ft-descripcion').value = tx.descripcion || '';
      document.getElementById('ft-obs').value = tx.observaciones || '';
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
    const fecha       = document.getElementById('ft-fecha').value;
    const tipo        = document.getElementById('ft-tipo').value;
    const categoria   = document.getElementById('ft-categoria').value;
    const monto       = parseFloat(document.getElementById('ft-monto').value);
    const descripcion = document.getElementById('ft-descripcion').value.trim();
    const observaciones = document.getElementById('ft-obs').value.trim();

    const data = getAll();

    if (editingId) {
      const idx = data.findIndex(t => t.id === editingId);
      if (idx !== -1) data[idx] = { ...data[idx], fecha, tipo, categoria, monto, descripcion, observaciones };
    } else {
      data.push({ id: String(Date.now()), fecha, tipo, categoria, monto, descripcion, observaciones });
    }

    saveAll(data);
    closeModal();
    renderStats();
    renderTable();
    renderResumen();
  }

  // --- Delete ---
  function remove(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    saveAll(getAll().filter(t => t.id !== id));
    renderStats();
    renderTable();
    renderResumen();
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
    document.getElementById('form-transaction').addEventListener('submit', saveTransaction);
    document.getElementById('search-transactions').addEventListener('input', renderTable);
    document.getElementById('filter-tipo-fin').addEventListener('change', renderTable);

    document.getElementById('transactions-tbody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit') openModal(id);
      if (action === 'delete') remove(id);
    });

    renderStats();
    renderTable();
    renderResumen();
  }

  return { init };
})();
