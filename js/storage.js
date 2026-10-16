/* ============================================================
   storage.js — repositórios de dados do app "Autor".

   A persistência de baixo nível vive em js/core/persistence.js
   (Autor.persistence), com dois adaptadores: IndexedDB (preferido)
   e localStorage (reserva). Aqui ficam apenas os repositórios de
   domínio (Books, Chapters, Trash, Settings), que dependem somente
   da interface do adaptador ativo.

   API: Store.init(), Store.Books, Store.Chapters, Store.Trash,
        Store.Settings, Store.raw, Store.uuid(), Store.isFallbackMode()
   ============================================================ */
window.Store = (function () {
  'use strict';

  const Persistence = window.Autor.persistence;

  let adapter = null;

  /* ---------------- utilidades ---------------- */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------------- API genérica (delega ao adaptador) ---------------- */

  function getAll(store) { return adapter.getAll(store); }
  function get(store, key) { return adapter.get(store, key); }
  function put(store, value) { return adapter.put(store, value); }
  function del(store, key) { return adapter.del(store, key); }
  function clear(store) { return adapter.clear(store); }
  function byIndex(store, index, value) { return adapter.byIndex(store, index, value); }

  /* ---------------- domínio: obras ---------------- */

  const Books = {
    list: async function () {
      const books = await getAll('books');
      return books.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    },

    get: function (id) { return get('books', id); },

    create: async function (data) {
      const now = Date.now();
      const book = {
        id: uuid(),
        title: (data.title || '').trim() || 'Sem título',
        author: (data.author || '').trim(),
        description: (data.description || '').trim(),
        status: data.status || 'rascunho',
        cover: data.cover || null,
        createdAt: now,
        updatedAt: now
      };
      await put('books', book);
      return book;
    },

    save: async function (book) {
      book.updatedAt = Date.now();
      return put('books', book);
    },

    /* move o livro (com capítulos) para a lixeira */
    remove: async function (id) {
      const book = await get('books', id);
      if (!book) return;
      const chapters = await byIndex('chapters', 'bookId', id);
      await put('trash', {
        id: uuid(),
        type: 'book',
        deletedAt: Date.now(),
        item: book,
        chapters: chapters
      });
      await del('books', id);
      for (let i = 0; i < chapters.length; i++) {
        await del('chapters', chapters[i].id);
      }
    }
  };

  /* ---------------- domínio: capítulos ---------------- */

  const Chapters = {
    listByBook: async function (bookId) {
      const list = await byIndex('chapters', 'bookId', bookId);
      return list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    },

    get: function (id) { return get('chapters', id); },

    create: async function (bookId, title) {
      const existing = await Chapters.listByBook(bookId);
      const chapter = {
        id: uuid(),
        bookId: bookId,
        title: (title || '').trim() || 'Novo capítulo',
        content: '',
        status: 'rascunho',
        cover: null,
        align: 'j', // alinhamento padrão do capítulo: j=justificado
        order: existing.length ? existing[existing.length - 1].order + 1 : 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await put('chapters', chapter);
      return chapter;
    },

    save: async function (chapter) {
      // invariante: um capítulo nunca existe sem o seu livro. Sem esta
      // guarda, um salvamento automático atrasado "ressuscitaria" um
      // capítulo cujo livro foi excluído enquanto o editor estava aberto.
      const book = await get('books', chapter.bookId);
      if (!book) return chapter;

      chapter.updatedAt = Date.now();
      await put('chapters', chapter);
      // atualiza o "editado em" do livro
      book.updatedAt = Date.now();
      await put('books', book);
      return chapter;
    },

    remove: async function (id) {
      const chapter = await get('chapters', id);
      if (!chapter) return;
      await put('trash', {
        id: uuid(),
        type: 'chapter',
        deletedAt: Date.now(),
        item: chapter,
        chapters: []
      });
      await del('chapters', id);
    },

    duplicate: async function (id) {
      const chapter = await get('chapters', id);
      if (!chapter) return null;
      const siblings = await Chapters.listByBook(chapter.bookId);
      const copy = Object.assign({}, chapter, {
        id: uuid(),
        title: chapter.title + ' (cópia)',
        order: siblings.length ? siblings[siblings.length - 1].order + 1 : 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      await put('chapters', copy);
      return copy;
    },

    move: async function (id, direction) {
      const chapter = await get('chapters', id);
      if (!chapter) return false;
      const siblings = await Chapters.listByBook(chapter.bookId);
      let i = -1;
      for (let k = 0; k < siblings.length; k++) {
        if (siblings[k].id === id) { i = k; break; }
      }
      const j = direction === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= siblings.length) return false;
      // reordena renumerando tudo (simples e seguro)
      const moved = siblings.splice(i, 1)[0];
      siblings.splice(j, 0, moved);
      for (let k = 0; k < siblings.length; k++) {
        siblings[k].order = k;
        await put('chapters', siblings[k]);
      }
      return true;
    }
  };

  /* ---------------- lixeira ---------------- */

  const Trash = {
    list: async function () {
      const items = await getAll('trash');
      return items.sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
    },

    restore: async function (entry) {
      if (entry.type === 'book') {
        let book = entry.item;
        const chapters = (entry.chapters || []).map(function (c) { return Object.assign({}, c); });
        const existing = await get('books', book.id);
        if (existing) {
          // já existe um livro com o mesmo id: restaura com ids novos
          book = Object.assign({}, book, { id: uuid(), updatedAt: Date.now() });
          for (let i = 0; i < chapters.length; i++) {
            chapters[i].id = uuid();
            chapters[i].bookId = book.id;
          }
        }
        await put('books', book);
        for (let i = 0; i < chapters.length; i++) {
          await put('chapters', chapters[i]);
        }
      } else {
        let ch = entry.item;
        const existing = await get('chapters', ch.id);
        if (existing) ch = Object.assign({}, ch, { id: uuid() });
        const book = await get('books', ch.bookId);
        if (!book) {
          // o livro de origem não existe mais: anexa ao livro editado mais recente
          const books = await Books.list();
          if (!books.length) return false;
          ch.bookId = books[0].id;
        }
        await put('chapters', ch);
      }
      await del('trash', entry.id);
      return true;
    },

    remove: function (id) { return del('trash', id); },

    empty: async function () { await clear('trash'); }
  };

  /* ---------------- configurações ---------------- */

  const Settings = {
    cache: {},

    load: async function () {
      const rows = await getAll('settings');
      const cache = {};
      rows.forEach(function (r) { cache[r.key] = r.value; });
      Settings.cache = cache;
    },

    get: function (key, fallback) {
      return Object.prototype.hasOwnProperty.call(Settings.cache, key)
        ? Settings.cache[key] : fallback;
    },

    set: function (key, value) {
      Settings.cache[key] = value;
      return put('settings', { key: key, value: value });
    }
  };

  /* ---------------- inicialização ----------------
     Escolhe o adaptador: tenta IndexedDB (com um teste de gravação
     real, pois alguns navegadores falham em arquivos locais) e, se
     não der, cai para o localStorage. */

  async function init() {
    try {
      const a = Persistence.idb();
      await a.open();
      await a.put('settings', { key: '_teste', value: 1 });
      await a.del('settings', '_teste');
      adapter = a;
    } catch (err) {
      console.warn('IndexedDB indisponível — usando localStorage como reserva.', err);
      adapter = Persistence.ls();
      await adapter.open();
    }
    await Settings.load();
  }

  return {
    init: init,
    uuid: uuid,
    Books: Books,
    Chapters: Chapters,
    Trash: Trash,
    Settings: Settings,
    raw: { getAll: getAll, get: get, put: put, del: del, clear: clear },
    isFallbackMode: function () { return adapter && adapter.mode === 'ls'; }
  };
})();

window.Autor = window.Autor || {};
window.Autor.store = window.Store;
