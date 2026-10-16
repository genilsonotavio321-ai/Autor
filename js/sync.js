/* ============================================================
   sync.js — sincronização entre dispositivos (dois sentidos).

   Estratégia: um documento remoto no mesmo formato do backup JSON
   (books/chapters/trash/settings). A cada sincronização:
     1. tira um retrato local (Exporter.snapshot);
     2. baixa o documento remoto;
     3. mescla os dois (Autor.merge) — vence o registro mais recente,
        exclusões via lixeira (tombstones), segredos nunca trafegam;
     4. grava o resultado localmente e reenvia ao serviço remoto.

   Provedores (apenas strings em Settings, nada de IndexedDB extra):
     · WebDAV  — um arquivo .json num servidor WebDAV (URL + usuário/senha);
     · Gist    — um Gist secreto do GitHub (token + id do Gist).

   É um "motor" separado da camada de persistência: continua-se usando
   IndexedDB/localStorage normalmente; o sync só reconcilia documentos.
   ============================================================ */
window.Autor = window.Autor || {};

const Sync = (function () {
  'use strict';

  const GIST_FILE = 'autor-backup.json';

  /* ---------------- utilidades ---------------- */

  function b64(s) {
    const bytes = new TextEncoder().encode(String(s));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  async function readError(res) {
    try {
      const text = await res.text();
      if (!text) return '';
      try {
        const j = JSON.parse(text);
        return (j.error && j.error.message) || j.message || text.slice(0, 160);
      } catch (e) { return text.slice(0, 160); }
    } catch (e) { return ''; }
  }

  /* ---------------- provedor: WebDAV ---------------- */

  const webdav = {
    id: 'webdav',
    label: 'WebDAV (Nextcloud, ownCloud…)',
    fields: [
      { key: 'webdavUrl', label: 'URL do arquivo (ex.: https://nuvem/dav/autor/backup.json)', type: 'text' },
      { key: 'webdavUser', label: 'Usuário', type: 'text' },
      { key: 'webdavPass', label: 'Senha / token', type: 'password' }
    ],
    config: function () {
      return {
        url: String(Store.Settings.get('webdavUrl', '') || '').trim(),
        user: String(Store.Settings.get('webdavUser', '') || ''),
        pass: String(Store.Settings.get('webdavPass', '') || '')
      };
    },
    ready: function () { return !!this.config().url; },

    headers: function (extra) {
      const cfg = this.config();
      const h = Object.assign({ 'Accept': 'application/json' }, extra || {});
      if (cfg.user) h['Authorization'] = 'Basic ' + b64(cfg.user + ':' + cfg.pass);
      return h;
    },

    pull: async function () {
      const res = await fetch(this.config().url, { headers: this.headers(), cache: 'no-store' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('WebDAV respondeu ' + res.status + '. ' + await readError(res));
      const text = await res.text();
      if (!text.trim()) return null;
      return JSON.parse(text);
    },

    push: async function (doc) {
      const res = await fetch(this.config().url, {
        method: 'PUT',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(doc)
      });
      if (!res.ok) throw new Error('WebDAV recusou a gravação (' + res.status + '). ' + await readError(res));
    },

    test: async function () {
      const cfg = this.config();
      if (!cfg.url) return 'Informe a URL do arquivo.';
      try { await this.pull(); return true; }
      catch (err) { return err.message; }
    }
  };

  /* ---------------- provedor: GitHub Gist ---------------- */

  const gist = {
    id: 'gist',
    label: 'GitHub Gist (secreto)',
    fields: [
      { key: 'gistToken', label: 'Token do GitHub (escopo "gist")', type: 'password' },
      { key: 'gistId', label: 'ID do Gist (deixe vazio para criar um novo)', type: 'text' }
    ],
    config: function () {
      return {
        token: String(Store.Settings.get('gistToken', '') || '').trim(),
        id: String(Store.Settings.get('gistId', '') || '').trim()
      };
    },
    ready: function () { return !!this.config().token; },

    headers: function () {
      return {
        'Authorization': 'token ' + this.config().token,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
    },

    pull: async function () {
      const cfg = this.config();
      if (!cfg.id) return null;
      const res = await fetch('https://api.github.com/gists/' + cfg.id, { headers: this.headers(), cache: 'no-store' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('GitHub respondeu ' + res.status + '. ' + await readError(res));
      const data = await res.json();
      const file = data.files && data.files[GIST_FILE];
      if (!file) return null;
      let content = file.content;
      if (file.truncated && file.raw_url) {
        const raw = await fetch(file.raw_url, { cache: 'no-store' });
        content = await raw.text();
      }
      return content ? JSON.parse(content) : null;
    },

    push: async function (doc) {
      const cfg = this.config();
      const files = {};
      files[GIST_FILE] = { content: JSON.stringify(doc) };

      if (cfg.id) {
        const res = await fetch('https://api.github.com/gists/' + cfg.id, {
          method: 'PATCH',
          headers: this.headers(),
          body: JSON.stringify({ files: files })
        });
        if (!res.ok) throw new Error('GitHub recusou a atualização (' + res.status + '). ' + await readError(res));
      } else {
        const res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ description: 'Backup do Autor', public: false, files: files })
        });
        if (!res.ok) throw new Error('GitHub recusou a criação do Gist (' + res.status + '). ' + await readError(res));
        const data = await res.json();
        await Store.Settings.set('gistId', data.id);
      }
    },

    test: async function () {
      const cfg = this.config();
      if (!cfg.token) return 'Informe o token do GitHub.';
      try {
        if (cfg.id) { await this.pull(); return true; }
        const res = await fetch('https://api.github.com/user', { headers: this.headers(), cache: 'no-store' });
        if (!res.ok) return 'Token inválido (' + res.status + ').';
        return true;
      } catch (err) { return err.message; }
    }
  };

  const PROVIDERS = { webdav: webdav, gist: gist };

  function provider() {
    const id = Store.Settings.get('syncProvider', '');
    return PROVIDERS[id] || null;
  }

  function configured() {
    const p = provider();
    return !!p && p.ready();
  }

  /* ---------------- aplicação do documento mesclado ---------------- */

  async function applyList(store, items) {
    const current = await Store.raw.getAll(store);
    const nextIds = new Set(items.map(function (it) { return it.id; }));
    for (let i = 0; i < items.length; i++) await Store.raw.put(store, items[i]);
    for (let i = 0; i < current.length; i++) {
      if (!nextIds.has(current[i].id)) await Store.raw.del(store, current[i].id);
    }
  }

  async function applyDoc(doc) {
    await applyList('books', doc.books || []);
    await applyList('chapters', doc.chapters || []);
    await applyList('trash', doc.trash || []);
    const settings = doc.settings || {};
    const keys = Object.keys(settings);
    for (let i = 0; i < keys.length; i++) {
      if (Autor.merge.isLocalOnly(keys[i])) continue;
      if (Autor.merge.SECRET_KEYS.indexOf(keys[i]) !== -1) continue;
      await Store.Settings.set(keys[i], settings[keys[i]]);
    }
    await Store.Settings.load();
  }

  /* ---------------- sincronização ---------------- */

  let busy = false;

  async function now(opts) {
    opts = opts || {};
    const p = provider();
    if (!p) { App.toast('Escolha um serviço de sincronização primeiro.', 'error'); return null; }
    if (!p.ready()) { App.toast('A sincronização ainda não está configurada.', 'error'); return null; }
    if (busy) { App.toast('Já existe uma sincronização em andamento.', 'info'); return null; }
    busy = true;
    try {
      const local = await Exporter.snapshot();
      let remote = null;
      try {
        remote = await p.pull();
      } catch (err) {
        // sem documento remoto ainda (404 tratado como null); erro real sobe
        throw err;
      }
      const merged = Autor.merge.mergeDoc(local, remote || Autor.merge.emptyDoc(), { preferRemote: !!opts.preferRemote });
      await applyDoc(merged.doc);
      if (!opts.pullOnly) await p.push(merged.doc);

      await Store.Settings.set('syncLastAt', Date.now());
      await Store.Settings.set('syncLastResult', {
        added: merged.stats.books.added + merged.stats.chapters.added,
        updated: merged.stats.books.updated + merged.stats.chapters.updated,
        deleted: merged.stats.deleted || 0
      });

      if (App.view === 'shelf') App.renderShelf();
      if (App.view === 'book' && App.book) App.openBook(App.book.id);

      if (!opts.quiet) {
        App.toast('Sincronizado: +' + (merged.stats.books.added + merged.stats.chapters.added) +
          ' novo(s), ' + (merged.stats.books.updated + merged.stats.chapters.updated) + ' atualizado(s).');
      }
      return merged.stats;
    } finally {
      busy = false;
    }
  }

  function status() {
    const p = provider();
    return {
      configured: configured(),
      provider: p ? p.id : '',
      providerLabel: p ? p.label : '',
      lastAt: Store.Settings.get('syncLastAt', 0),
      lastResult: Store.Settings.get('syncLastResult', null)
    };
  }

  const api = {
    providers: PROVIDERS,
    provider: provider,
    configured: configured,
    now: now,
    status: status
  };

  window.Sync = api;
  window.Autor.sync = api;
  return api;
})();
