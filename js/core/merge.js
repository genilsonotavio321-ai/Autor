/* ============================================================
   core/merge.js — Autor.merge: mesclagem de documentos do Autor.

   Um "documento" tem o mesmo formato do backup JSON:
     { books: [], chapters: [], trash: [], settings: {} }

   A mesclagem é pura (sem DOM, sem Store, sem rede) — por isso é
   testável e reutilizada tanto pela importação quanto pela
   sincronização. Regras:
     · listas são unidas por id; em conflito vence o registro com
       updatedAt maior (empate → mantém o existente quando prefereLocal);
     · capítulos cujo livro não existe no resultado são descartados;
     · segredos nunca saem (stripSecrets) nem são sobrescritos.
   ============================================================ */
window.Autor = window.Autor || {};

window.Autor.merge = (function () {
  'use strict';

  /* chaves que nunca devem ir para um backup/serviço remoto */
  const SECRET_KEYS = ['aiKey', 'gistToken', 'webdavPass'];
  /* chaves de preferências por dispositivo que não devem ser copiadas
     de um backup/serviço remoto para cá (sobrescreveriam o local) */
  const LOCAL_ONLY_KEYS = ['readerProgress', 'lastLocation', 'editorFocus', 'writingStats', 'writingGoal'];

  function stripSecrets(settings) {
    const out = Object.assign({}, settings || {});
    SECRET_KEYS.forEach(function (k) { delete out[k]; });
    return out;
  }

  function isLocalOnly(key) { return LOCAL_ONLY_KEYS.indexOf(key) !== -1; }

  function ts(rec) {
    const t = rec && rec.updatedAt;
    return typeof t === 'number' ? t : 0;
  }

  function emptyDoc() {
    return { books: [], chapters: [], trash: [], settings: {} };
  }

  function normalizeDoc(doc) {
    return {
      books: Array.isArray(doc && doc.books) ? doc.books : [],
      chapters: Array.isArray(doc && doc.chapters) ? doc.chapters : [],
      trash: Array.isArray(doc && doc.trash) ? doc.trash : [],
      settings: (doc && doc.settings && typeof doc.settings === 'object') ? doc.settings : {}
    };
  }

  /* une duas listas por id; `preferLocal` decide empates de updatedAt */
  function mergeList(localList, remoteList, preferLocal) {
    const map = new Map();
    const stats = { added: 0, updated: 0, kept: 0 };
    (localList || []).forEach(function (it) { if (it && it.id) map.set(it.id, it); });
    (remoteList || []).forEach(function (it) {
      if (!it || !it.id) return;
      const found = map.get(it.id);
      if (!found) { map.set(it.id, it); stats.added++; return; }
      const takeRemote = preferLocal ? (ts(it) > ts(found)) : (ts(it) >= ts(found));
      if (takeRemote) { map.set(it.id, it); stats.updated++; }
      else stats.kept++;
    });
    return { items: Array.from(map.values()), stats: stats };
  }

  /* mescla settings: preenche apenas o que falta e nunca aplica
     segredos nem preferências locais do remoto */
  function mergeSettings(local, remote) {
    const out = Object.assign({}, local || {});
    const src = stripSecrets(remote);
    Object.keys(src).forEach(function (k) {
      if (isLocalOnly(k)) return;
      if (!(k in out)) out[k] = src[k];
    });
    return out;
  }

  function pruneOrphans(chapters, books) {
    const ids = new Set((books || []).map(function (b) { return b.id; }));
    let dropped = 0;
    const kept = (chapters || []).filter(function (c) {
      if (c && ids.has(c.bookId)) return true;
      dropped++;
      return false;
    });
    return { items: kept, dropped: dropped };
  }

  /* ids marcados como excluídos na lixeira (tombstones) */
  function deletedIds(trash) {
    const set = new Set();
    (trash || []).forEach(function (entry) {
      if (!entry || !entry.item) return;
      if (entry.item.id) set.add(entry.item.id);
      (entry.chapters || []).forEach(function (c) { if (c && c.id) set.add(c.id); });
    });
    return set;
  }

  /* mergeDoc(local, remote, opts) → { doc, stats }
     opts.preferRemote: em empate de updatedAt, vence o remoto (usado ao
     baixar alterações); padrão mantém o local. */
  function mergeDoc(localDoc, remoteDoc, opts) {
    opts = opts || {};
    const local = normalizeDoc(localDoc);
    const remote = normalizeDoc(remoteDoc);

    const trash = mergeList(local.trash, remote.trash, true);
    const del = deletedIds(trash.items);

    const books = mergeList(local.books, remote.books, !opts.preferRemote);
    const chapters = mergeList(local.chapters, remote.chapters, !opts.preferRemote);
    const pruned = pruneOrphans(chapters.items, books.items);

    const keptBooks = books.items.filter(function (b) { return !del.has(b.id); });
    const keptChapters = pruned.items.filter(function (c) { return !del.has(c.id); });

    return {
      doc: {
        books: keptBooks,
        chapters: keptChapters,
        trash: trash.items,
        settings: mergeSettings(local.settings, remote.settings)
      },
      stats: {
        books: books.stats,
        chapters: chapters.stats,
        orphans: pruned.dropped,
        deleted: (books.items.length - keptBooks.length) + (pruned.items.length - keptChapters.length)
      }
    };
  }

  return {
    SECRET_KEYS: SECRET_KEYS,
    LOCAL_ONLY_KEYS: LOCAL_ONLY_KEYS,
    emptyDoc: emptyDoc,
    normalizeDoc: normalizeDoc,
    stripSecrets: stripSecrets,
    isLocalOnly: isLocalOnly,
    mergeList: mergeList,
    mergeSettings: mergeSettings,
    pruneOrphans: pruneOrphans,
    deletedIds: deletedIds,
    mergeDoc: mergeDoc
  };
})();
