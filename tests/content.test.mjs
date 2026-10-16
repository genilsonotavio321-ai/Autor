/* Testes do Content model (js/core/content.js).
   Lógica pura: não precisam de DOM. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from './helpers/load.mjs';

const sandbox = loadContent();
const Content = sandbox.Content;

/* normaliza valores criados no realm do node:vm para o realm do teste
   (senão deepStrictEqual acusa diferença de protótipo) */
const plain = (v) => JSON.parse(JSON.stringify(v));

test('exposed interface é estável', () => {
  for (const fn of ['parse', 'serialize', 'toDisplay', 'toExport', 'strip',
    'stripParaMarker', 'paraAlign', 'countWords', 'css', 'label']) {
    assert.equal(typeof Content[fn], 'function', fn + ' deve ser função');
  }
  assert.deepEqual(plain(Content.ALIGN_KEYS), ['e', 'c', 'd', 'j']);
  assert.equal(Content.DEFAULT_ALIGN, 'j');
});

test('parse: separa parágrafos e lê o marcador de alinhamento', () => {
  const blocks = Content.parse('Um.\n\n⟦c⟧ Centro\n\n⟦e⟧ Esq.', 'j');
  assert.deepEqual(plain(blocks), [
    { type: 'para', align: 'j', text: 'Um.' },
    { type: 'para', align: 'c', text: 'Centro' },
    { type: 'para', align: 'e', text: 'Esq.' }
  ]);
});

test('parse: sem marcador usa o alinhamento padrão do capítulo', () => {
  const blocks = Content.parse('a\n\nb', 'd');
  assert.equal(blocks[0].align, 'd');
  assert.equal(blocks[1].align, 'd');
});

test('parse: linha ---- vira regra (quebra de página), com texto preservado', () => {
  const blocks = Content.parse('a\n\n---\n\nb', 'j');
  assert.deepEqual(plain(blocks.map(b => b.type)), ['para', 'rule', 'para']);
  assert.equal(blocks[1].text, '---');
});

test('serialize: só marca o parágrafo que difere do padrão', () => {
  const out = Content.serialize([
    { type: 'para', align: 'j', text: 'Um.' },
    { type: 'para', align: 'c', text: 'Centro' }
  ], 'j');
  assert.equal(out, 'Um.\n\n⟦c⟧ Centro');
});

test('parse ∘ serialize é idempotente (round-trip)', () => {
  const original = 'Primeiro.\n\n⟦c⟧ Centro\n\n⟦e⟧ Esquerda\n\n---\n\n⟦d⟧ Direita';
  const canonical = Content.serialize(Content.parse(original, 'j'), 'j');
  assert.equal(Content.serialize(Content.parse(canonical, 'j'), 'j'), canonical);
  assert.equal(canonical, original);
});

test('toDisplay normaliza; toExport remove todos os marcadores', () => {
  const saved = 'a\n\n⟦c⟧ b\n\n⟦e⟧ c';
  assert.equal(Content.toDisplay(saved, 'j'), 'a\n\n⟦c⟧ b\n\n⟦e⟧ c');
  assert.equal(Content.toExport(saved, 'j'), 'a\n\nb\n\nc');
});

test('strip remove marcadores (em início de parágrafo)', () => {
  assert.equal(Content.strip('a\n\n⟦c⟧ b'), 'a\n\nb');
  assert.equal(Content.strip('⟦c⟧ começo'), 'começo');
  // marcador inválido permanece como texto
  assert.equal(Content.strip('⟦q⟧ não é marcador'), '⟦q⟧ não é marcador');
});

test('stripParaMarker e paraAlign', () => {
  assert.equal(Content.stripParaMarker('⟦d⟧ texto'), 'texto');
  assert.equal(Content.paraAlign('⟦d⟧ texto', 'j'), 'd');
  assert.equal(Content.paraAlign('texto', 'c'), 'c');
});

test('countWords ignora marcadores', () => {
  assert.equal(Content.countWords(''), 0);
  assert.equal(Content.countWords('   '), 0);
  assert.equal(Content.countWords('um dois três'), 3);
  assert.equal(Content.countWords('⟦c⟧ um\n\ndois'), 2);
});

test('css e label com fallback para o padrão', () => {
  assert.equal(Content.css('c'), 'center');
  assert.equal(Content.css('nao-existe'), 'justify');
  assert.equal(Content.label('d'), 'Direita');
  assert.equal(Content.label(undefined), 'Justificado');
});
