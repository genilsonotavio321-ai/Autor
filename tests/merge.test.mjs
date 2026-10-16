/* ============================================================
   tests/merge.test.mjs — mesclagem de documentos (Autor.merge).
   Lógica pura usada pela importação e pela sincronização.
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadScripts } from './helpers/load.mjs';

function loadMerge() {
  return loadScripts(makeSandbox(), ['js/core/merge.js']).Autor.merge;
}

const plain = (v) => JSON.parse(JSON.stringify(v));

function book(id, updatedAt, title) {
  return { id, updatedAt, title: title || id, createdAt: 1 };
}
function chapter(id, bookId, updatedAt, content) {
  return { id, bookId, updatedAt, content: content || '' };
}

test('mergeDoc une listas por id e vence o updatedAt maior (local em empate)', () => {
  const merge = loadMerge();
  const local = {
    books: [book('b1', 100, 'Local')],
    chapters: [chapter('c1', 'b1', 100, 'local')],
    settings: {}
  };
  const remote = {
    books: [book('b1', 200, 'Remoto'), book('b2', 50, 'Novo')],
    chapters: [chapter('c1', 'b1', 100, 'remoto')],
    settings: {}
  };
  const out = merge.mergeDoc(local, remote);
  const books = out.doc.books.sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(books.length, 2);
  assert.equal(books.find((b) => b.id === 'b1').title, 'Remoto'); // 200 > 100
  assert.equal(out.doc.chapters[0].content, 'local'); // empate → local
  assert.equal(out.stats.books.added, 1);
  assert.equal(out.stats.books.updated, 1);
});

test('mergeDoc descarta capítulos órfãos (livro inexistente)', () => {
  const merge = loadMerge();
  const out = merge.mergeDoc(
    { books: [], chapters: [chapter('c9', 'sumiu', 10)] },
    { books: [book('b1', 10)], chapters: [chapter('c1', 'b1', 10)] }
  );
  assert.deepEqual(plain(out.doc.chapters.map((c) => c.id)), ['c1']);
  assert.equal(out.stats.orphans, 1);
});

test('mergeDoc remove itens marcados como excluídos na lixeira (tombstone)', () => {
  const merge = loadMerge();
  const local = {
    books: [],
    chapters: [],
    trash: [{ id: 't1', item: { id: 'b1' }, chapters: [{ id: 'c1' }] }]
  };
  const remote = {
    books: [book('b1', 999)],
    chapters: [chapter('c1', 'b1', 999)],
    trash: []
  };
  const out = merge.mergeDoc(local, remote);
  assert.equal(out.doc.books.length, 0);
  assert.equal(out.doc.chapters.length, 0);
  assert.equal(out.stats.deleted, 2);
});

test('stripSecrets remove chaves sensíveis', () => {
  const merge = loadMerge();
  const clean = merge.stripSecrets({ aiKey: 'x', gistToken: 'y', webdavPass: 'z', theme: 'dark' });
  assert.deepEqual(plain(clean), { theme: 'dark' });
});

test('mergeSettings preserva o local e ignora preferências por dispositivo do remoto', () => {
  const merge = loadMerge();
  const out = merge.mergeSettings(
    { theme: 'light' },
    { theme: 'dark', readerProgress: { b1: 1 }, aiKey: 'segredo', novidade: 42 }
  );
  assert.equal(out.theme, 'light');       // não sobrescreve o local
  assert.equal(out.novidade, 42);         // preenche o que falta
  assert.equal(out.aiKey, undefined);     // segredo nunca entra
  assert.equal(out.readerProgress, undefined); // preferência por dispositivo
});
