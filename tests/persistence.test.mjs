/* Testes do adaptador localStorage (js/core/persistence.js).
   É o backend de reserva, difícil de exercitar manualmente. */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadPersistence } from './helpers/load.mjs';

const sandbox = loadPersistence();
const Persistence = sandbox.Autor.persistence;

/* normaliza valores criados no realm do node:vm para o realm do teste */
const plain = (v) => JSON.parse(JSON.stringify(v));

beforeEach(() => { sandbox.localStorage.clear(); });

test('expõe os dois adaptadores com a mesma interface', () => {
  const a = Persistence.ls();
  assert.equal(a.mode, 'ls');
  for (const fn of ['open', 'getAll', 'get', 'put', 'del', 'clear', 'byIndex']) {
    assert.equal(typeof a[fn], 'function', 'ls.' + fn);
  }
  const i = Persistence.idb();
  assert.equal(i.mode, 'idb');
  // memoizado: mesma instância
  assert.equal(Persistence.ls(), a);
  assert.equal(Persistence.idb(), i);
});

test('idb().open() rejeita quando indexedDB não existe', async () => {
  await assert.rejects(() => Persistence.idb().open());
});

test('put/get/getAll atualizam em vez de duplicar', async () => {
  const a = Persistence.ls();
  await a.put('books', { id: '1', title: 'A' });
  await a.put('books', { id: '2', title: 'B' });
  assert.equal((await a.getAll('books')).length, 2);

  await a.put('books', { id: '1', title: 'A2' });
  const all = await a.getAll('books');
  assert.equal(all.length, 2, 'não deve duplicar ao atualizar');
  assert.equal((await a.get('books', '1')).title, 'A2');
  assert.equal(await a.get('books', 'inexistente'), null);
});

test('byIndex filtra por propriedade', async () => {
  const a = Persistence.ls();
  await a.put('chapters', { id: 'c1', bookId: '1' });
  await a.put('chapters', { id: 'c2', bookId: '2' });
  await a.put('chapters', { id: 'c3', bookId: '1' });
  const of1 = await a.byIndex('chapters', 'bookId', '1');
  assert.deepEqual(plain(of1.map(c => c.id).sort()), ['c1', 'c3']);
});

test('del e clear', async () => {
  const a = Persistence.ls();
  await a.put('books', { id: '1' });
  await a.put('books', { id: '2' });
  await a.del('books', '1');
  assert.equal((await a.getAll('books')).length, 1);
  await a.clear('books');
  assert.deepEqual(plain(await a.getAll('books')), []);
});

test('settings é um mapa {chave: valor}, não uma lista', async () => {
  const a = Persistence.ls();
  await a.put('settings', { key: 'theme', value: 'dark' });
  await a.put('settings', { key: 'readerFont', value: 20 });

  assert.equal(await a.get('settings', 'theme'), 'dark');
  const rows = await a.getAll('settings');
  assert.equal(rows.length, 2);
  assert.ok(rows.every(r => 'key' in r && 'value' in r));

  await a.put('settings', { key: 'theme', value: 'light' });
  assert.equal(await a.get('settings', 'theme'), 'light');
  assert.equal((await a.getAll('settings')).length, 2);

  await a.del('settings', 'theme');
  assert.equal(await a.get('settings', 'theme'), undefined);
});

test('settings vazio continua sendo um mapa (regressão)', async () => {
  const a = Persistence.ls();
  await a.clear('settings');
  await a.put('settings', { key: 'x', value: 1 });
  assert.deepEqual(plain(await a.getAll('settings')), [{ key: 'x', value: 1 }]);
});
