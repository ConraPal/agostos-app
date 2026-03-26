const Reports = (() => {
  function getAnimals()      { return Storage.get('ag_animals')      || []; }
  function getMovements()    { return Storage.get('ag_movements')     || []; }
  function getTransactions() { return Storage.get('ag_transactions')  || []; }
  function getFields()       { return Storage.get('ag_fields')        || []; }
  function getReproduction() { return Storage.get('ag_reproduction')  || []; }
  function getForraje()      { return Storage.get('ag_forraje')       || []; }

  // Chart instances — destroyed and recreated on each refresh
  let _chartHacienda = null;
  let _chartFinanzas = null;
  let _chartRepro    = null;

  // Color palette matching app theme
  const CHART_COLORS = ['#3d6b3f', '#7ab87d', '#2c7da0', '#c06c2b', '#7c3aed', '#c0392b'];
  const CHART_GREEN  = '#3d6b3f';
  const CHART_RED    = '#c0392b';

  function destroyChart(ref) { if (ref) { try { ref.destroy(); } catch (_) {} } return null; }

  function getTextColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#2c2c2c';
  }

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

    // Gráfico stock por tipo (doughnut)
    _chartHacienda = destroyChart(_chartHacienda);
    const canvasH = document.getElementById('chart-hacienda');
    if (canvasH && typeof Chart !== 'undefined' && tipoKeys.length) {
      _chartHacienda = new Chart(canvasH.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: tipoKeys.map(t => TIPO_LABELS[t] || t),
          datasets: [{ data: tipoKeys.map(t => byTipo[t]), backgroundColor: CHART_COLORS, borderWidth: 2 }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right', labels: { color: getTextColor(), font: { size: 12 } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} (${total > 0 ? Math.round(ctx.parsed / total * 100) : 0}%)` } }
          }
        }
      });
    }

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
      const monthIdx = parseInt(key.split('-')[1], 10) - 1;
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

    // Gráfico balance mensual (bar)
    _chartFinanzas = destroyChart(_chartFinanzas);
    const canvasF = document.getElementById('chart-finanzas');
    if (canvasF && typeof Chart !== 'undefined') {
      const monthEntries = Object.entries(months);
      _chartFinanzas = new Chart(canvasF.getContext('2d'), {
        type: 'bar',
        data: {
          labels: monthEntries.map(([k]) => MONTH_NAMES[parseInt(k.split('-')[1], 10) - 1]),
          datasets: [
            { label: 'Ingresos', data: monthEntries.map(([, v]) => v.ingresos), backgroundColor: CHART_GREEN + 'cc', borderColor: CHART_GREEN, borderWidth: 1 },
            { label: 'Gastos',   data: monthEntries.map(([, v]) => v.gastos),   backgroundColor: CHART_RED   + 'cc', borderColor: CHART_RED,   borderWidth: 1 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: getTextColor() } } },
          scales: {
            x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.06)' } },
            y: { ticks: { color: getTextColor(), callback: v => '$' + v.toLocaleString('es-AR') }, grid: { color: 'rgba(0,0,0,0.06)' } }
          }
        }
      });
    }
  }

  // --- Tab: Reproducción ---
  function renderReproduccion() {
    const data = [...getReproduction()].sort((a, b) => b.año - a.año);
    const tbody = document.getElementById('rpt-repro-tbody');
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Sin ciclos registrados.</td></tr>';
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
      </tr>
    `).join('');

    // Gráfico % preñez por año (bar)
    _chartRepro = destroyChart(_chartRepro);
    const canvasR = document.getElementById('chart-repro');
    if (canvasR && typeof Chart !== 'undefined' && data.length) {
      const sorted = [...data].sort((a, b) => a.año - b.año);
      _chartRepro = new Chart(canvasR.getContext('2d'), {
        type: 'bar',
        data: {
          labels: sorted.map(r => r.año),
          datasets: [
            { label: '% Preñez',  data: sorted.map(r => r.prenez_pct ?? null),    backgroundColor: CHART_GREEN + 'cc', borderColor: CHART_GREEN, borderWidth: 1 },
            { label: '% Destete', data: sorted.map(r => r.indice_destete ?? null), backgroundColor: '#2c7da0cc',        borderColor: '#2c7da0',   borderWidth: 1 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: getTextColor() } } },
          scales: {
            x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.06)' } },
            y: { min: 0, max: 100, ticks: { color: getTextColor(), callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.06)' } }
          }
        }
      });
    }
  }

  // --- Tab: Forraje ---
  function renderForraje() {
    const data = getForraje();
    const el = document.getElementById('rpt-forraje-content');
    if (!el) return;
    if (!data.length) {
      el.innerHTML = '<p class="resumen-empty">Sin datos de forraje registrados.</p>';
      return;
    }

    const rollos = data.filter(f => f.tipo === 'rollo').reduce((s, f) => s + (Number(f.cantidad) || 0), 0);
    const fardos = data.filter(f => f.tipo === 'fardo').reduce((s, f) => s + (Number(f.cantidad) || 0), 0);

    const byPotrero = {};
    data.forEach(f => {
      if (!byPotrero[f.potrero]) byPotrero[f.potrero] = { rollo: 0, fardo: 0 };
      byPotrero[f.potrero][f.tipo] = (byPotrero[f.potrero][f.tipo] || 0) + (Number(f.cantidad) || 0);
    });

    el.innerHTML = `
      <div class="rpt-forraje-totales">
        <div class="stat-card"><span class="stat-label">Total rollos</span><span class="stat-value">${rollos}</span></div>
        <div class="stat-card"><span class="stat-label">Total fardos</span><span class="stat-value">${fardos}</span></div>
      </div>
      <table class="data-table" style="margin-top:16px">
        <thead><tr><th>Potrero</th><th>Rollos</th><th>Fardos</th></tr></thead>
        <tbody>
          ${Object.entries(byPotrero).sort(([a], [b]) => a.localeCompare(b, 'es')).map(([p, v]) =>
            `<tr><td>${p}</td><td>${v.rollo || 0}</td><td>${v.fardo || 0}</td></tr>`
          ).join('')}
        </tbody>
      </table>
    `;
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

  function exportSanidad() {
    downloadCSV('sanidad.csv',
      ['ID', 'Fecha', 'Caravana', 'Animal', 'Tipo', 'Descripción', 'Producto', 'Observaciones'],
      (Storage.get('ag_sanidad') || []).map(s => [
        s.id, s.fecha, s.caravana || 'Rodeo completo', s.animalNombre,
        s.tipo, s.descripcion, s.producto, s.observaciones
      ])
    );
  }

  function exportReproduccion() {
    downloadCSV('reproduccion.csv',
      ['ID', 'Año', 'Vacas servidas', '% Preñez', 'Partos', '% Destete', 'Mortalidad total', 'IA', '% Preñez IA', 'Observaciones'],
      getReproduction().map(r => [
        r.id, r.año, r.vacas_total,
        r.prenez_pct != null ? r.prenez_pct.toFixed(1) : '',
        r.partos,
        r.indice_destete != null ? r.indice_destete.toFixed(1) : '',
        r.mortalidad_total ?? '',
        r.ia_realizada ? 'Sí' : 'No',
        r.ia_prenez_pct != null ? r.ia_prenez_pct : '',
        r.observaciones
      ])
    );
  }

  // --- Print / PDF ---
  const TIPO_LABELS_PRINT = { vaca: 'Vaca', toro: 'Toro', ternero: 'Ternero', vaquillona: 'Vaquillona', novillo: 'Novillo' };
  const MONTH_NAMES_PRINT = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function printView(titulo, html) {
    const view = document.getElementById('print-view');
    if (!view) return;
    view.innerHTML = `
      <div class="print-header">
        <h1>🌾 Agostos — Gestión de Campo</h1>
        <h2>${titulo}</h2>
        <p>Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
      </div>
      ${html}
    `;
    window.print();
  }

  function printRodeo() {
    const active = getAnimals().filter(a => a.estado === 'activo');
    const total  = active.length;

    const byTipo = {};
    active.forEach(a => { byTipo[a.tipo] = (byTipo[a.tipo] || 0) + 1; });

    const byPotrero = {};
    active.forEach(a => {
      const p = a.potrero || '(sin potrero)';
      byPotrero[p] = (byPotrero[p] || 0) + 1;
    });

    const tipoRows = TIPO_ORDER.filter(t => byTipo[t])
      .concat(Object.keys(byTipo).filter(t => !TIPO_ORDER.includes(t)))
      .map(t => `<tr><td>${TIPO_LABELS_PRINT[t] || t}</td><td>${byTipo[t]}</td><td>${total > 0 ? Math.round(byTipo[t] / total * 100) + '%' : '—'}</td></tr>`)
      .join('');

    const potreroRows = Object.entries(byPotrero).sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `<tr><td>${p}</td><td>${c}</td><td>${total > 0 ? Math.round(c / total * 100) + '%' : '—'}</td></tr>`)
      .join('');

    const html = `
      <div class="print-section">
        <h3>Stock por tipo — Total: ${total} cabezas</h3>
        <table class="data-table">
          <thead><tr><th>Tipo</th><th>Cantidad</th><th>%</th></tr></thead>
          <tbody>${tipoRows || '<tr><td colspan="3">Sin animales activos.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="print-section">
        <h3>Stock por potrero</h3>
        <table class="data-table">
          <thead><tr><th>Potrero</th><th>Cantidad</th><th>%</th></tr></thead>
          <tbody>${potreroRows || '<tr><td colspan="3">Sin animales activos.</td></tr>'}</tbody>
        </table>
      </div>
    `;
    printView('Rodeo actual', html);
  }

  function printMovimientos() {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES_PRINT[now.getMonth()]} ${now.getFullYear()}`;
    const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

    const data = getMovements()
      .filter(m => m.fecha && m.fecha.startsWith(thisMonth))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const rows = data.map(m => `
      <tr>
        <td>${fmtD(m.fecha)}</td>
        <td>${m.caravana || '—'}</td>
        <td>${m.animalNombre || '—'}</td>
        <td>${m.tipo}</td>
        <td>${m.origen || '—'}</td>
        <td>${m.destino || '—'}</td>
      </tr>
    `).join('');

    const html = `
      <div class="print-section">
        <h3>Movimientos — ${monthLabel} (${data.length} registros)</h3>
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Caravana</th><th>Animal</th><th>Tipo</th><th>Origen</th><th>Destino</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">Sin movimientos este mes.</td></tr>'}</tbody>
        </table>
      </div>
    `;
    printView(`Movimientos — ${monthLabel}`, html);
  }

  function printTransacciones() {
    const year = new Date().getFullYear();
    const fmtD = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
    const fmtN = n => '$\u00a0' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const data = getTransactions()
      .filter(t => t.fecha && t.fecha.startsWith(String(year)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const TIPO_LABEL = { ingreso: 'Ingreso', gasto: 'Gasto', impuesto: 'Impuesto' };
    const rows = data.map(t => `
      <tr>
        <td>${fmtD(t.fecha)}</td>
        <td>${TIPO_LABEL[t.tipo] || t.tipo}</td>
        <td>${t.categoria}</td>
        <td>${t.descripcion || '—'}</td>
        <td style="text-align:right">${t.moneda === 'USD' ? 'USD\u00a0' : '$\u00a0'}${Number(t.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const html = `
      <div class="print-section">
        <h3>Transacciones ${year} (${data.length} registros)</h3>
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5">Sin transacciones este año.</td></tr>'}</tbody>
        </table>
      </div>
    `;
    printView(`Transacciones ${year}`, html);
  }

  // --- WhatsApp Share ---
  function shareReport(titulo, texto) {
    if (navigator.share) {
      navigator.share({ title: titulo, text: texto }).catch(() => {});
    } else {
      const encoded = encodeURIComponent(`*${titulo}*\n\n${texto}`);
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  }

  function shareRodeo() {
    const active = getAnimals().filter(a => a.estado === 'activo');
    const total  = active.length;
    const byTipo = {};
    active.forEach(a => { byTipo[a.tipo] = (byTipo[a.tipo] || 0) + 1; });
    const lines = TIPO_ORDER.filter(t => byTipo[t]).map(t => `• ${TIPO_LABELS_PRINT[t] || t}: ${byTipo[t]}`);
    const titulo = `Resumen de Rodeo — ${new Date().toLocaleDateString('es-AR')}`;
    const texto = `Total: ${total} cabezas\n${lines.join('\n')}`;
    shareReport(titulo, texto);
  }

  function shareMovimientos() {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES_PRINT[now.getMonth()]} ${now.getFullYear()}`;
    const data = getMovements().filter(m => m.fecha && m.fecha.startsWith(thisMonth));
    const byTipo = {};
    data.forEach(m => { byTipo[m.tipo] = (byTipo[m.tipo] || 0) + 1; });
    const lines = Object.entries(byTipo).map(([t, c]) => `• ${t.charAt(0).toUpperCase() + t.slice(1)}s: ${c}`);
    const titulo = `Movimientos — ${monthLabel}`;
    const texto = `${data.length} movimientos registrados\n${lines.join('\n')}`;
    shareReport(titulo, texto);
  }

  function shareTransacciones() {
    const year = new Date().getFullYear();
    const data = getTransactions().filter(t => t.fecha && t.fecha.startsWith(String(year)));
    const ingresos = data.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
    const gastos   = data.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
    const fmtN = n => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const titulo = `Finanzas ${year}`;
    const texto = `Ingresos: ${fmtN(ingresos)}\nGastos: ${fmtN(gastos)}\nBalance: ${fmtN(ingresos - gastos)}`;
    shareReport(titulo, texto);
  }

  // --- Backup / Restore ---
  const ALL_KEYS = ['ag_animals', 'ag_movements', 'ag_history', 'ag_reproduction', 'ag_sanidad',
                    'ag_transactions', 'ag_amortizations', 'ag_presupuesto', 'ag_cotizacion',
                    'ag_fields', 'ag_crop_history', 'ag_forraje',
                    'ag_alertas', 'ag_vencimientos'];

  function exportBackup() {
    const backup = {};
    ALL_KEYS.forEach(k => { backup[k] = Storage.get(k) || []; });
    backup._version = 1;
    backup._date = new Date().toISOString();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `agostos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        ALL_KEYS.forEach(k => { if (data[k]) Storage.set(k, data[k]); });
        ui.toast('Backup restaurado. Recargá la página para ver los datos.');
      } catch (_) {
        ui.toast('Archivo inválido. Usá un backup de Agostos.', 'error');
      }
    };
    reader.readAsText(file);
  }

  // --- Public ---
  function refresh() {
    renderHacienda();
    renderFinanzas();
    renderReproduccion();
    renderForraje();
  }

  function init() {
    document.getElementById('btn-export-animals').addEventListener('click', exportAnimals);
    document.getElementById('btn-export-movements').addEventListener('click', exportMovements);
    document.getElementById('btn-export-transactions').addEventListener('click', exportTransactions);
    document.getElementById('btn-export-fields').addEventListener('click', exportFields);
    document.getElementById('btn-export-sanidad')?.addEventListener('click', exportSanidad);
    document.getElementById('btn-export-reproduccion')?.addEventListener('click', exportReproduccion);

    document.getElementById('btn-print-rodeo')?.addEventListener('click', printRodeo);
    document.getElementById('btn-print-movimientos')?.addEventListener('click', printMovimientos);
    document.getElementById('btn-print-transacciones')?.addEventListener('click', printTransacciones);
    document.getElementById('btn-share-rodeo')?.addEventListener('click', shareRodeo);
    document.getElementById('btn-share-movimientos')?.addEventListener('click', shareMovimientos);
    document.getElementById('btn-share-transacciones')?.addEventListener('click', shareTransacciones);

    document.getElementById('btn-export-backup')?.addEventListener('click', exportBackup);
    document.getElementById('import-backup-input')?.addEventListener('change', e => {
      importBackup(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-import-backup')?.addEventListener('click', () => {
      document.getElementById('import-backup-input')?.click();
    });

    refresh();
  }

  return { init, refresh };
})();
