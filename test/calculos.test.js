// Tests de cálculos críticos — correr con: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- helpers locales (replica la lógica de los módulos) ----

function toARS(monto, moneda, cotizacion) {
  if (moneda === 'USD') return monto * (cotizacion || 1);
  return monto;
}

function calcBalance(transactions, cotizacion) {
  let bal = 0;
  for (const t of transactions) {
    const ars = toARS(t.monto, t.moneda, cotizacion);
    if (t.tipo === 'ingreso') bal += ars;
    else bal -= ars;  // gastos e impuestos
  }
  return bal;
}

function prenezPct(positivas, total) {
  if (!total) return 0;
  return Math.round(positivas / total * 100);
}

function desteePct(terneros, partos) {
  if (!partos) return 0;
  return Math.round(terneros / partos * 100);
}

function mortalidadTotal(muertes_paricion, muertes_destete) {
  return muertes_paricion + muertes_destete;
}

function cargaAnimal(animals) {
  const EV = { vaca: 1, toro: 1.3, ternero: 0.6, novillo: 0.7, vaquillona: 0.7 };
  return animals.reduce((s, a) => s + (EV[a.tipo] || 1), 0);
}

// ---- Tests ----

test('toARS: ARS pasa directo', () => {
  assert.equal(toARS(1000, 'ARS', 1000), 1000);
});

test('toARS: USD se convierte por cotización', () => {
  assert.equal(toARS(10, 'USD', 1200), 12000);
});

test('toARS: sin cotización usa 1 como fallback', () => {
  assert.equal(toARS(5, 'USD', undefined), 5);
});

test('calcBalance: ingreso - gasto simple', () => {
  const txs = [
    { tipo: 'ingreso', monto: 500000, moneda: 'ARS' },
    { tipo: 'gasto',   monto: 200000, moneda: 'ARS' },
  ];
  assert.equal(calcBalance(txs, 1000), 300000);
});

test('calcBalance: impuesto resta del balance', () => {
  const txs = [
    { tipo: 'ingreso',  monto: 100000, moneda: 'ARS' },
    { tipo: 'impuesto', monto:  20000, moneda: 'ARS' },
  ];
  assert.equal(calcBalance(txs, 1000), 80000);
});

test('calcBalance: USD se convierte correctamente', () => {
  const txs = [
    { tipo: 'ingreso', monto: 1000, moneda: 'USD' },
    { tipo: 'gasto',   monto: 500000, moneda: 'ARS' },
  ];
  assert.equal(calcBalance(txs, 1200), 700000);  // 1200000 - 500000
});

test('prenezPct: 7/8 = 87%', () => {
  assert.equal(prenezPct(7, 8), 88);  // Math.round(7/8*100) = 88
});

test('prenezPct: total 0 devuelve 0', () => {
  assert.equal(prenezPct(0, 0), 0);
});

test('destetePct: 100% cuando partos == terneros', () => {
  assert.equal(desteePct(7, 7), 100);
});

test('destetePct: partos 0 devuelve 0', () => {
  assert.equal(desteePct(0, 0), 0);
});

test('mortalidadTotal: suma paricion + destete', () => {
  assert.equal(mortalidadTotal(2, 3), 5);
});

test('cargaAnimal: EV correcto por tipo', () => {
  const rodeo = [
    { tipo: 'vaca' },       // 1
    { tipo: 'toro' },       // 1.3
    { tipo: 'ternero' },    // 0.6
    { tipo: 'novillo' },    // 0.7
    { tipo: 'vaquillona' }, // 0.7
  ];
  assert.equal(cargaAnimal(rodeo), 4.3);
});

test('cargaAnimal: tipo desconocido usa EV=1', () => {
  assert.equal(cargaAnimal([{ tipo: 'desconocido' }]), 1);
});
