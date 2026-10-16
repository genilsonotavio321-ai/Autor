/* ============================================================
   core/persistence.js — Autor.persistence: seam de persistência.

   Um "adaptador" é a implementação concreta de um backend de
   armazenamento chave→valor por store (books, chapters, trash,
   settings). A interface é pequena e assíncrona; os repositórios
   (js/storage.js) dependem só dela — nunca de IndexedDB ou
   localStorage diretamente.

   Adaptadores incluídos:
     · idb() → IndexedDB (preferido)
     · ls()  → localStorage (reserva de emergência)

   Próximo adaptador previsto (sync/nuvem) pluga aqui sem mexer
   nos repositórios — é o ponto de extensão da camada de dados.
   ============================================================ */
window.Autor = window.Autor || {};

window.Autor.persistence = (function () {
  'use strict';

  const DB_NAME = 'autor_db';
  const DB_VERSION = 1;
  const LS_PREFIX = 'autor_ls_';

  /* ---------------- IndexedDB ---------------- */

  function idbReq(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponível')); return; }
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

  function makeIdb() {
    let db = null;
    return {
      mode: 'idb',

      open: async function () { db = await openDB(); },

      getAll: async function (store) {
        const tx = db.transaction(store, 'readonly');
        return idbReq(tx.objectStore(store).getAll());
      },

      get: async function (store, key) {
        const tx = db.transaction(store, 'readonly');
        return idbReq(tx.objectStore(store).get(key));
      },

      put: async function (store, value) {
        const tx = db.transaction(store, 'readwrite');
        await idbReq(tx.objectStore(store).put(value));
        return value;
      },

      del: async function (store, key) {
        const tx = db.transaction(store, 'readwrite');
        await idbReq(tx.objectStore(store).delete(key));
      },

      clear: async function (store) {
        const tx = db.transaction(store, 'readwrite');
        await idbReq(tx.objectStore(store).clear());
      },

      byIndex: async function (store, index, value) {
        const tx = db.transaction(store, 'readonly');
        const idx = tx.objectStore(store).index(index);
        return idbReq(idx.getAll(value));
      }
    };
  }

  /* ---------------- localStorage (reserva) ----------------
     Detalhe que pertencia ao storage.js antigo e agora fica aqui:
     "settings" é guardado como um mapa {chave: valor}, não como lista. */

  function lsLoad(store) {
    const empty = store === 'settings' ? {} : [];
    try {
      const raw = localStorage.getItem(LS_PREFIX + store);
      if (raw == null) return empty;
      const parsed = JSON.parse(raw);
      return parsed == null ? empty : parsed;
    } catch (e) { return empty; }
  }

  function lsSave(store, data) {
    localStorage.setItem(LS_PREFIX + store, JSON.stringify(data));
  }

  function makeLs() {
    return {
      mode: 'ls',

      open: async function () { /* nada a abrir */ },

      getAll: async function (store) {
        if (store === 'settings') {
          const map = lsLoad(store);
          return Object.keys(map).map(function (k) { return { key: k, value: map[k] }; });
        }
        return lsLoad(store);
      },

      get: async function (store, key) {
        if (store === 'settings') return lsLoad(store)[key];
        const arr = lsLoad(store);
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].id === key) return arr[i];
        }
        return null;
      },

      put: async function (store, value) {
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
      },

      del: async function (store, key) {
        if (store === 'settings') {
          const map = lsLoad(store);
          delete map[key];
          lsSave(store, map);
          return;
        }
        lsSave(store, lsLoad(store).filter(function (it) { return it.id !== key; }));
      },

      clear: async function (store) {
        lsSave(store, store === 'settings' ? {} : []);
      },

      byIndex: async function (store, index, value) {
        return lsLoad(store).filter(function (it) { return it[index] === value; });
      }
    };
  }

  /* memoizado: preserva o estado (ex.: a conexão do IndexedDB) entre
     as chamadas, sem abrir o banco várias vezes */
  let idbInstance = null;
  let lsInstance = null;

  return {
    idb: function () { return idbInstance || (idbInstance = makeIdb()); },
    ls: function () { return lsInstance || (lsInstance = makeLs()); }
  };
})();
