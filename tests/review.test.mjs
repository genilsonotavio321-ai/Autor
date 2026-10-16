/* ============================================================
   tests/review.test.mjs — revisão rápida (offline).
   Carrega js/review.js com um stub de document e um Store em modo
   de reserva (localStorage) para exercitar a lógica pura das regras.
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadScripts } from './helpers/load.mjs';

function makeDoc() {
  const node = () => ({
    classList: { add() {}, remove() {}, contains() { return false; } },
    style: {},
    innerHTML: '', textContent: '', value: '',
    addEventListener() {}, appendChild() {}, setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  });
  return {
    getElementById() { return node(); },
    createElement() { return node(); },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

async function loadReview() {
  const quiet = { log() {}, warn() {}, error: console.error };
  const sb = loadScripts(makeSandbox({ document: makeDoc(), console: quiet }), [
    'js/core/persistence.js',
    'js/storage.js',
    'js/review.js'
  ]);
  await sb.Store.init();
  return sb;
}

test('Review.rules() lista as 12 regras com id e label únicos', async () => {
  const sb = await loadReview();
  const rules = sb.Review.rules();
  assert.equal(rules.length, 12);

  const ids = rules.map(function (r) { return r.id; });
  assert.equal(new Set(ids).size, ids.length, 'os ids devem ser únicos');

  const labels = rules.map(function (r) { return r.label; });
  assert.ok(labels.every(function (l) { return typeof l === 'string' && l.trim(); }), 'toda regra tem label');
  assert.equal(new Set(labels).size, labels.length, 'os labels devem ser únicos (sem tópicos repetidos)');

  // há agrupamento por categoria: ao menos uma categoria reúne mais de uma regra
  const byName = {};
  rules.forEach(function (r) { byName[r.name] = (byName[r.name] || 0) + 1; });
  assert.ok(Object.keys(byName).some(function (k) { return byName[k] > 1; }), 'há categorias com várias regras');
});

test('analyze respeita reviewRules (regra desligada não aparece)', async () => {
  const sb = await loadReview();
  const text = 'Frase com  espaço duplo.';

  await sb.Store.Settings.set('reviewRules', {});
  const on = sb.Review.analyze(text);
  assert.ok(on.some(function (i) { return i.ruleId === 'espaco-duplo'; }), 'regra ligada deve sinalizar');

  await sb.Store.Settings.set('reviewRules', { 'espaco-duplo': false });
  const off = sb.Review.analyze(text);
  assert.ok(!off.some(function (i) { return i.ruleId === 'espaco-duplo'; }), 'regra desligada não deve aparecer');
});

test('personalDict suprime a ocorrência', async () => {
  const sb = await loadReview();
  const text = 'A casa casa caiu.';

  await sb.Store.Settings.set('reviewRules', {});
  await sb.Store.Settings.set('personalDict', []);
  const before = sb.Review.analyze(text);
  assert.ok(before.some(function (i) { return i.ruleId === 'palavra-repetida'; }), 'repetição é sinalizada');

  await sb.Store.Settings.set('personalDict', ['casa']);
  const after = sb.Review.analyze(text);
  assert.ok(!after.some(function (i) { return i.ruleId === 'palavra-repetida'; }), 'termo no dicionário não é sinalizado');
});

test('detecta problemas reais e ignora texto correto', async () => {
  const sb = await loadReview();
  await sb.Store.Settings.set('reviewRules', {});
  await sb.Store.Settings.set('personalDict', []);

  const issues = sb.Review.analyze('Olá  mundo;; Fim');
  const ids = issues.map(function (i) { return i.ruleId; });
  assert.ok(ids.indexOf('espaco-duplo') >= 0, 'detecta espaço duplo');
  assert.ok(ids.indexOf('pont-dupla') >= 0, 'detecta pontuação duplicada');

  const clean = sb.Review.analyze('Olá mundo, tudo bem?');
  assert.equal(clean.filter(function (i) { return i.ruleId === 'espaco-duplo'; }).length, 0);
});
