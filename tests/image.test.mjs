/* Testes do cálculo puro de redimensionamento (js/core/image.js).
   Só o que não depende de <canvas>/FileReader — o resto é verificado
   manualmente no navegador. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadScripts } from './helpers/load.mjs';

const sandbox = loadScripts(makeSandbox(), ['js/core/image.js']);
const Img = sandbox.Img;

/* normaliza valores criados no realm do node:vm para o realm do teste */
const plain = (v) => JSON.parse(JSON.stringify(v));

test('expõe a interface e os limites padrão', () => {
  for (const fn of ['pick', 'fromFile', 'resize', 'fit']) {
    assert.equal(typeof Img[fn], 'function', fn);
  }
  assert.deepEqual(plain(Img.DEFAULT.portrait), { w: 400, h: 600 });
  assert.deepEqual(plain(Img.DEFAULT.landscape), { w: 600, h: 400 });
  assert.equal(Img.DEFAULT.quality, 0.9);
});

test('fit: retrato até 400×600, proporção preservada', () => {
  assert.deepEqual(plain(Img.fit(800, 1200)), { w: 400, h: 600 });
  assert.deepEqual(plain(Img.fit(200, 1000)), { w: 120, h: 600 });
  assert.deepEqual(plain(Img.fit(333, 500)), { w: 333, h: 500 });
});

test('fit: paisagem até 600×400, proporção preservada', () => {
  assert.deepEqual(plain(Img.fit(1200, 800)), { w: 600, h: 400 });
  assert.deepEqual(plain(Img.fit(1000, 200)), { w: 600, h: 120 });
});

test('fit: quadrado usa a caixa retrato', () => {
  assert.deepEqual(plain(Img.fit(1000, 1000)), { w: 400, h: 400 });
});

test('fit: nunca amplia imagens pequenas', () => {
  assert.deepEqual(plain(Img.fit(100, 100)), { w: 100, h: 100 });
  assert.deepEqual(plain(Img.fit(50, 30)), { w: 50, h: 30 });
});

test('fit: aceita caixas personalizadas', () => {
  assert.deepEqual(plain(Img.fit(100, 200, { portrait: { w: 10, h: 20 } })), { w: 10, h: 20 });
});
