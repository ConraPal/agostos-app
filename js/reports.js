const Reports = (() => {
  function getAnimals()      { return Storage.get('ag_animals')      || []; }
  function getMovements()    { return Storage.get('ag_movements')     || []; }
  function getTransactions() { return Storage.get('ag_transactions')  || []; }
  function getFields()       { return Storage.get('ag_fields')        || []; }

  const TIPO_LABELS  = { vaca: 'Vaca', toro: 'Toro', ternero: 'Ternero', vaquillona: 'Vaquillona', novillo: 'Novillo' };
  const TIPO_ORDER   = ['vaca', 'toro', 'ternero', 'vaquillona', 'novillo'];
  const MONTH_NAMES  = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  function fmtMoney(n) {
    return '$\u00a0' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Tab: Hacienda ---
  function renderHacienda() {
    const active = getAnimals().filter(a => a.estado === 'activo');
    const total  = active.length;

    // Por tipo
    const byTipo = {};
    active.forEach(a => { byTipo[a.tipo] = (byTipo[a.tipo] || 0) + 1; });

    const tipoKeys = TIPO_ORDER.filter(t => byTipo[t])
      .concat(Object.keys(byTipo).filter(t => !TIPO_ORDER.includes(t)));

    document.getElementById('rpt-tipo-tbody').innerHTML = tipoKeys.length
      ? tipoKeys.map(t => `<tr>
          <td>${TIPO_LABELS[t] || t}</td>
          <td>${byTipo[t]}</td>
          <td>${total > 0 ? Math.round(byTipo[t] / total * 100) + '%' : '—'}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="3">Sin animales activos.</td></tr>';
    document.getElementById('rpt-tipo-total').textContent = total;

    // Por potrero
    const byPotrero = {};
    active.forEach(a => {
      const p = a.potrero || '(sin potrero)';
      byPotrero[p] = (byPotrero[p] || 0) + 1;
    });

    const potreroEntries = Object.entries(byPotrero).sort((a, b) => b[1] - a[1]);
    document.getElementById('rpt-potrero-tbody').innerHTML = potreroEntries.length
      ? potreroEntries.map(([p, c]) => `<tr>
          <td>${p}</td>
          <td>${c}</td>
          <td>${total > 0 ? Math.round(c / total * 100) + '%' : '—'}</td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="3">Sin animales activos.</td></tr>';
  }

  // --- Tab: Finanzas ---
  function renderFinanzas() {
    const year = new Date().getFullYear();
    document.getElementById('rpt-finanzas-year').textContent = year;

    const months = {};
    for (let m = 1; m <= 12; m++) {
      months[`${year}-${String(m).padStart(2, '0')}`] = { ingresos: 0, gastos: 0 };
    }

    getTransactions().forEach(t => {
      if (!t.fecha?.startsWith(String(year))) return;
      const key = t.fecha.substring(0, 7);
      if (!months[key]) return;
      if (t.tipo === 'ingreso') months[key].ingresos += Number(t.monto);
      else months[key].gastos += Number(t.monto);
    });

    let totalIngresos = 0, totalGastos = 0;
    const rows = Object.entries(months).map(([key, v]) => {
      totalIngresos += v.ingresos;
      totalGastos   += v.gastos;
      const bal = v.ingresos - v.gastos;
      const cls = bal < 0 ? 'monto-gasto' : bal > 0 ? 'monto-ingreso' : '';
      const monthIdx = parseInt(key.split('-')[1]) - 1;
      return `<tr>
        <td>${MONTH_NAMES[monthIdx]}</td>
        <td class="monto-cell monto-ingreso">${fmtMoney(v.ingresos)}</td>
        <td class="monto-cell monto-gasto">${fmtMoney(v.gastos)}</td>
        <td class="monto-cell ${cls}">${fmtMoney(bal)}</td>
      </tr>`;
    });

    const totalBal = totalIngresos - totalGastos;
    const totalCls = totalBal < 0 ? 'monto-gasto' : 'monto-ingreso';
    rows.push(`<tr class="rpt-total-row">
      <td><strong>Total</strong></td>
      <td class="monto-cell monto-ingreso"><strong>${fmtMoney(totalIngresos)}</strong></td>
      <td class="monto-cell monto-gasto"><strong>${fmtMoney(totalGastos)}</strong></td>
      <td class="monto-cell ${totalCls}"><strong>${fmtMoney(totalBal)}</strong></td>
    </tr>`);

    document.getElementById('rpt-finanzas-tbody').innerHTML = rows.join('');
  }

  // --- CSV export ---
  function downloadCSV(filename, headers, rows) {
    const esc = v => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers, ...rows].map(r => r.map(esc).join(','));
    const blob  = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportAnimals() {
    downloadCSV('animales.csv',
      ['ID', 'Caravana', 'Nombre', 'Tipo', 'Raza', 'Nacimiento', 'Potrero', 'Estado', 'Peso (kg)', 'Observaciones'],
      getAnimals().map(a => [a.id, a.caravana, a.nombre, a.tipo, a.raza, a.nacimiento, a.potrero, a.estado, a.peso, a.observaciones])
    );
  }

  function exportMovements() {
    downloadCSV('movimientos.csv',
      ['ID', 'Fecha', 'Caravana', 'Animal', 'Tipo', 'Origen', 'Destino', 'Observaciones'],
      getMovements().map(m => [m.id, m.fecha, m.caravana, m.animalNombre, m.tipo, m.origen, m.destino, m.observaciones])
    );
  }

  function exportTransactions() {
    downloadCSV('transacciones.csv',
      ['ID', 'Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción', 'Observaciones'],
      getTransactions().map(t => [t.id, t.fecha, t.tipo, t.categoria, t.monto, t.descripcion, t.observaciones])
    );
  }

  function exportFields() {
    downloadCSV('potreros.csv',
      ['ID', 'Nombre', 'Hectáreas', 'Pastura', 'Estado', 'Observaciones'],
      getFields().map(f => [f.id, f.nombre, f.hectareas, f.pastura, f.estado, f.observaciones])
    );
  }

  // --- Public ---
  function refresh() {
    renderHacienda();
    renderFinanzas();
  }

  function init() {
    document.getElementById('btn-export-animals').addEventListener('click', exportAnimals);
    document.getElementById('btn-export-movements').addEventListener('click', exportMovements);
    document.getElementById('btn-export-transactions').addEventListener('click', exportTransactions);
    document.getElementById('btn-export-fields').addEventListener('click', exportFields);
    refresh();
  }

  return { init, refresh };
})();
