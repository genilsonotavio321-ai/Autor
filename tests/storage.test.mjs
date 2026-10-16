/* Testes de integração dos repositórios (js/storage.js) sobre o
   adaptador de reserva (localStorage). Cada teste recebe um Store
   novo e isolado. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStore } from './helpers/load.mjs';

/* normaliza valores criados no realm do node:vm para o realm do teste */
const plain = (v) => JSON.parse(JSON.stringify(v));

test('init cai para o adaptador localStorage quando não há IndexedDB', async () => {
  const { Store } = await loadStore();
  assert.equal(Store.isFallbackMode(), true);
});

test('Books: create / get / list / save', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'Meu Livro', author: 'Eu' });
  assert.ok(book.id);
  assert.equal(book.status, 'rascunho');

  assert.equal((await Store.Books.get(book.id)).title, 'Meu Livro');
  assert.equal((await Store.Books.list()).length, 1);

  book.title = 'Renomeado';
  await Store.Books.save(book);
  assert.equal((await Store.Books.get(book.id)).title, 'Renomeado');
});

test('Books.create: título vazio vira "Sem título"', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: '   ' });
  assert.equal(book.title, 'Sem título');
});

test('Chapters: ordem incremental e listByBook ordenado', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'L' });
  const c1 = await Store.Chapters.create(book.id, 'Cap 1');
  const c2 = await Store.Chapters.create(book.id, 'Cap 2');
  assert.equal(c1.order, 0);
  assert.equal(c2.order, 1);
  const list = await Store.Chapters.listByBook(book.id);
  assert.deepEqual(plain(list.map(c => c.title)), ['Cap 1', 'Cap 2']);
});

test('Chapters.move reordena os irmãos', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'L' });
  const c1 = await Store.Chapters.create(book.id, 'A');
  await Store.Chapters.create(book.id, 'B');
  await Store.Chapters.create(book.id, 'C');

  assert.equal(await Store.Chapters.move(c1.id, 'down'), true);
  assert.deepEqual(plain((await Store.Chapters.listByBook(book.id)).map(c => c.title)), ['B', 'A', 'C']);
  // fora dos limites não mexe
  assert.equal(await Store.Chapters.move(c1.id, 'down'), true);
  assert.deepEqual(plain((await Store.Chapters.listByBook(book.id)).map(c => c.title)), ['B', 'C', 'A']);
  assert.equal(await Store.Chapters.move(c1.id, 'down'), false);
});

test('Chapters.duplicate cria cópia com id e ordem novos', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'L' });
  const c1 = await Store.Chapters.create(book.id, 'Original');
  const copy = await Store.Chapters.duplicate(c1.id);
  assert.notEqual(copy.id, c1.id);
  assert.equal(copy.title, 'Original (cópia)');
  assert.equal((await Store.Chapters.listByBook(book.id)).length, 2);
});

test('invariante: salvar capítulo cujo livro sumiu não o ressuscita', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'L' });
  const ch = await Store.Chapters.create(book.id, 'C');
  assert.equal((await Store.raw.getAll('chapters')).length, 1);

  await Store.Books.remove(book.id); // leva o capítulo junto
  assert.equal((await Store.raw.getAll('chapters')).length, 0);

  ch.content = 'salvamento atrasado';
  await Store.Chapters.save(ch); // livro não existe mais
  assert.equal((await Store.raw.getAll('chapters')).length, 0, 'não deve recriar o capítulo órfão');
});

test('Books.remove guarda o livro e os capítulos na lixeira', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'L' });
  await Store.Chapters.create(book.id, 'C1');
  await Store.Chapters.create(book.id, 'C2');

  await Store.Books.remove(book.id);
  const trash = await Store.Trash.list();
  assert.equal(trash.length, 1);
  assert.equal(trash[0].type, 'book');
  assert.equal(trash[0].chapters.length, 2);
  assert.equal((await Store.Books.list()).length, 0);
});

test('Trash.restore devolve o livro e seus capítulos', async () => {
  const { Store } = await loadStore();
  const book = await Store.Books.create({ title: 'L' });
  await Store.Chapters.create(book.id, 'C1');
  await Store.Books.remove(book.id);

  const entry = (await Store.Trash.list())[0];
  assert.equal(await Store.Trash.restore(entry), true);
  assert.equal((await Store.Books.list()).length, 1);
  assert.equal((await Store.raw.getAll('chapters')).length, 1);
  assert.equal((await Store.Trash.list()).length, 0);
});

test('Settings: set/get persistem no adaptador', async () => {
  const { Store } = await loadStore();
  assert.equal(Store.Settings.get('theme', 'light'), 'light'); // fallback
  await Store.Settings.set('theme', 'dark');
  assert.equal(Store.Settings.get('theme'), 'dark');
  // recarrega do adaptador
  await Store.Settings.load();
  assert.equal(Store.Settings.get('theme'), 'dark');
});

test('raw: put/get/getAll refletem no adaptador', async () => {
  const { Store } = await loadStore();
  await Store.raw.put('books', { id: 'z', title: 'Direto' });
  assert.equal((await Store.raw.get('books', 'z')).title, 'Direto');
  assert.equal((await Store.raw.getAll('books')).length, 1);
});
