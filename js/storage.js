/* ============================================================
   storage.js — banco de dados local do app "Autor"
   IndexedDB com reserva automática em localStorage.
   API: Store.init(), Store.Books, Store.Chapters, Store.Trash,
        Store.Settings, Store.raw
   ============================================================ */
window.Store = (function () {
  'use strict';

  const DB_NAME = 'autor_db';
  const DB_VERSION = 1;
  const LS_PREFIX = 'autor_ls_';

  let db = null;
  let lsMode = false; // true = usando localStorage como reserva

  /* ---------------- utilidades ---------------- */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  }

  /* ---------------- IndexedDB ---------------- */

  function openDB() {
    return new Promise(function (resolve, reject) {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) { reject(err); return; }

      req.onupgradeneeded = function (ev) {
        const d = ev.target.result;
        if (!d.objectStoreNames.contains('books')) {
          d.createObjectStore('books', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('chapters')) {
          const s = d.createObjectStore('chapters', { keyPath: 'id' });
          s.createIndex('bookId', 'bookId', { unique: false });
        }
        if (!d.objectStoreNames.contains('trash')) {
          d.createObjectStore('trash', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Falha ao abrir o banco')); };
      req.onblocked = function () { reject(new Error('Banco bloqueado por outra aba')); };
    });
  }

  function idbReq(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /* ---------------- localStorage (reserva) ---------------- */

  function lsLoad(store) {
    try {
      return JSON.parse(localStorage.getItem(LS_PREFIX + store)) || [];
    } catch (e) { return []; }
  }

  function lsSave(store, data) {
    localStorage.setItem(LS_PREFIX + store, JSON.stringify(data));
  }

  /* ---------------- API genérica ---------------- */

  async function getAll(store) {
    if (lsMode) {
      if (store === 'settings') {
        const map = lsLoad(store); // settings guarda como objeto {key: value}
        return Object.keys(map).map(function (k) { return { key: k, value: map[k] }; });
      }
      return lsLoad(store);
    }
    const tx = db.transaction(store, 'readonly');
    return idbReq(tx.objectStore(store).getAll());
  }

  async function get(store, key) {
    if (lsMode) {
      if (store === 'settings') return lsLoad(store)[key];
      const arr = lsLoad(store);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].id === key) return arr[i];
      }
      return null;
    }
    const tx = db.transaction(store, 'readonly');
    return idbReq(tx.objectStore(store).get(key));
  }

  async function put(store, value) {
    if (lsMode) {
      if (store === 'settings') {
        const map = lsLoad(store);
        map[value.key] = value.value;
        lsSave(store, map);
        return value;
      }
      const arr = lsLoad(store);
      let found = false;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].id === value.id) { arr[i] = value; found = true; break; }
      }
      if (!found) arr.push(value);
      lsSave(store, arr);
      return value;
    }
    const tx = db.transaction(store, 'readwrite');
    await idbReq(tx.objectStore(store).put(value));
    return value;
  }

  async function del(store, key) {
    if (lsMode) {
      if (store === 'settings') {
        const map = lsLoad(store);
        delete map[key];
        lsSave(store, map);
        return;
      }
      lsSave(store, lsLoad(store).filter(function (it) { return it.id !== key; }));
      return;
    }
    const tx = db.transaction(store, 'readwrite');
    await idbReq(tx.objectStore(store).delete(key));
  }

  async function clear(store) {
    if (lsMode) { lsSave(store, store === 'settings' ? {} : []); return; }
    const tx = db.transaction(store, 'readwrite');
    await idbReq(tx.objectStore(store).clear());
  }

  async function byIndex(store, index, value) {
    if (lsMode) {
      return lsLoad(store).filter(function (it) { return it[index] === value; });
    }
    const tx = db.transaction(store, 'readonly');
    const idx = tx.objectStore(store).index(index);
    return idbReq(idx.getAll(value));
  }

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
        order: existing.length ? existing[existing.length - 1].order + 1 : 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await put('chapters', chapter);
      return chapter;
    },

    save: async function (chapter) {
      chapter.updatedAt = Date.now();
      await put('chapters', chapter);
      // atualiza o "editado em" do livro
      const book = await get('books', chapter.bookId);
      if (book) {
        book.updatedAt = Date.now();
        await put('books', book);
      }
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

  /* ---------------- inicialização ---------------- */

  async function init() {
    try {
      db = await openDB();
      // teste de gravação real (alguns navegadores falham em arquivos locais)
      await put('settings', { key: '_teste', value: 1 });
      await del('settings', '_teste');
      lsMode = false;
    } catch (err) {
      console.warn('IndexedDB indisponível — usando localStorage como reserva.', err);
      lsMode = true;
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
    isFallbackMode: function () { return lsMode; }
  };
})();
