/* ============================================================
   views/settings.js — configurações: revisão com IA (opcional),
   revisão rápida offline (regras + dicionário pessoal), leitura em
   voz alta, sincronização e backup dos dados.
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;

  function dictionaryText() {
    const raw = Store.Settings.get('personalDict', []);
    const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\n,;]+/);
    return list.map(function (s) { return String(s).trim(); }).filter(Boolean).join('\n');
  }

  function parseDictionary(text) {
    return String(text || '').split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function rulesSection() {
    const cfg = Store.Settings.get('reviewRules', {}) || {};
    const rules = (window.Review && Review.rules) ? Review.rules() : [];
    // agrupa por categoria (name) preservando a ordem de definição das regras
    const groups = [];
    const byName = {};
    rules.forEach(function (r) {
      const key = r.name || 'Geral';
      if (!byName[key]) { byName[key] = { name: key, items: [] }; groups.push(byName[key]); }
      byName[key].items.push(r);
    });
    const groupsHtml = groups.map(function (g) {
      const items = g.items.map(function (r) {
        const on = cfg[r.id] !== false;
        return '<label class="rule-item"><input type="checkbox" data-rule="' + esc(r.id) + '"' + (on ? ' checked' : '') +
          '> <span>' + esc(r.label || r.name || r.id) + '</span></label>';
      }).join('');
      return '<div class="rule-group">' +
        '<div class="rule-group-title">' + esc(g.name) + '</div>' +
        '<div class="rule-list">' + items + '</div>' +
        '</div>';
    }).join('');
    return '<div class="settings-section">' +
      '<h3>' + icon('check-circle') + ' Revisão rápida (offline)</h3>' +
      '<p class="hint">A revisão rápida não usa internet. Escolha quais verificações desejar e liste nomes próprios ou termos inventados para não serem sinalizados.</p>' +
      groupsHtml +
      '<div class="field" style="margin-top:12px"><label for="set-dict">Dicionário pessoal (um termo por linha)</label>' +
      '<textarea id="set-dict" rows="4" placeholder="Frodo&#10;Valíria&#10;Narnia"></textarea></div>' +
      '</div>';
  }

  function syncFieldsHtml() {
    const current = Store.Settings.get('syncProvider', '');
    const options = Object.keys(Sync.providers).map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === current ? ' selected' : '') + '>' + esc(Sync.providers[id].label) + '</option>';
    }).join('');
    const provider = Sync.providers[current];
    let fields = '';
    if (provider) {
      fields = provider.fields.map(function (f) {
        const val = Store.Settings.get(f.key, '');
        return '<div class="field"><label for="set-' + esc(f.key) + '">' + esc(f.label) + '</label>' +
          '<input id="set-' + esc(f.key) + '" type="' + esc(f.type) + '" value="' + esc(val) + '" autocomplete="off"></div>';
      }).join('');
    }
    return '<select id="set-sync-provider"><option value="">(desativado)</option>' + options + '</select>' +
      '<div id="set-sync-fields" style="margin-top:10px">' + fields + '</div>';
  }

  function syncStatusHtml() {
    const st = Sync.status();
    if (!st.provider) return '<span class="muted">Nenhum serviço selecionado.</span>';
    const when = st.lastAt ? new Date(st.lastAt).toLocaleString('pt-BR') : 'nunca';
    return '<span class="muted">Última sincronização: ' + esc(when) + '</span>';
  }

  function settingsModal() {
    const body = el('div');

    body.innerHTML =
      '<div class="settings-section">' +
        '<h3>' + icon('sparkles') + ' Revisão com IA (opcional)</h3>' +
        '<p class="hint">A revisão rápida offline funciona sem nada aqui. Configure uma chave de API compatível com OpenAI (OpenAI, DeepSeek, Groq etc.) para ativar sugestões inteligentes e o assistente de escrita. A chave fica somente neste navegador.</p>' +
        '<div class="field"><label for="set-ai-url">Endpoint (URL base)</label>' +
        '<input id="set-ai-url" type="text" placeholder="https://api.openai.com/v1"></div>' +
        '<div class="field"><label for="set-ai-key">Chave de API</label>' +
        '<input id="set-ai-key" type="password" placeholder="sk-…" autocomplete="off"></div>' +
        '<div class="row">' +
          '<div class="field"><label for="set-ai-model">Modelo</label>' +
          '<input id="set-ai-model" type="text" placeholder="gpt-4o-mini"></div>' +
        '</div>' +
        '<button id="set-ai-test" class="btn small">' + icon('zap') + ' Testar conexão</button> ' +
        '<span id="set-ai-test-result" class="muted"></span>' +
      '</div>' +
      rulesSection() +
      '<div class="settings-section">' +
        '<h3>' + icon('book-open') + ' Leitura em voz alta</h3>' +
        '<p class="hint">Velocidade da leitura no modo Leitura (usa as vozes do próprio navegador).</p>' +
        '<div class="field"><label for="set-tts-rate">Velocidade</label>' +
        '<select id="set-tts-rate">' +
          '<option value="0.8">Lenta</option>' +
          '<option value="1">Normal</option>' +
          '<option value="1.25">Rápida</option>' +
          '<option value="1.5">Muito rápida</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>' + icon('cloud') + ' Sincronização</h3>' +
        '<p class="hint">Reconcilia suas obras entre dispositivos usando um arquivo num WebDAV ou um Gist secreto do GitHub. Em conflitos, vence a versão editada mais recentemente. Suas chaves/senhas não são enviadas no conteúdo sincronizado.</p>' +
        '<div class="field"><label for="set-sync-provider">Serviço</label>' +
        syncFieldsHtml() +
        '</div>' +
        '<div class="row" style="gap:6px">' +
          '<button id="set-sync-test" class="btn small">' + icon('zap') + ' Testar</button>' +
          '<button id="set-sync-now" class="btn small primary">' + icon('refresh') + ' Sincronizar agora</button>' +
        '</div>' +
        '<p style="margin:8px 0 0"><span id="set-sync-status">' + syncStatusHtml() + '</span> <span id="set-sync-result" class="muted"></span></p>' +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>' + icon('database') + ' Seus dados</h3>' +
        '<p class="hint">Tudo é salvo apenas neste dispositivo. Faça backups com frequência. Modo de armazenamento atual: <strong>' +
        (Store.isFallbackMode() ? 'localStorage (emergência)' : 'IndexedDB') + '</strong>.</p>' +
        '<div class="row" style="flex-wrap:wrap">' +
          '<button id="set-backup" class="btn">' + icon('download') + ' Exportar backup (.json)</button>' +
          '<button id="set-import" class="btn">' + icon('upload') + ' Importar backup</button>' +
          '<button id="set-import-doc" class="btn">' + icon('file-text') + ' Importar manuscrito</button>' +
        '</div>' +
      '</div>';

    body.querySelector('#set-ai-url').value = Store.Settings.get('aiUrl', 'https://api.openai.com/v1');
    body.querySelector('#set-ai-key').value = Store.Settings.get('aiKey', '');
    body.querySelector('#set-ai-model').value = Store.Settings.get('aiModel', 'gpt-4o-mini');
    body.querySelector('#set-dict').value = dictionaryText();
    body.querySelector('#set-tts-rate').value = String(Store.Settings.get('readerTTSRate', 1));

    function persist() {
      return Promise.all([
        Store.Settings.set('aiUrl', body.querySelector('#set-ai-url').value.trim() || 'https://api.openai.com/v1'),
        Store.Settings.set('aiKey', body.querySelector('#set-ai-key').value.trim()),
        Store.Settings.set('aiModel', body.querySelector('#set-ai-model').value.trim() || 'gpt-4o-mini'),
        Store.Settings.set('personalDict', parseDictionary(body.querySelector('#set-dict').value)),
        Store.Settings.set('readerTTSRate', Number(body.querySelector('#set-tts-rate').value) || 1),
        persistRules(),
        persistSync()
      ]);
    }

    function persistRules() {
      const map = {};
      body.querySelectorAll('[data-rule]').forEach(function (cb) {
        map[cb.getAttribute('data-rule')] = cb.checked;
      });
      return Store.Settings.set('reviewRules', map);
    }

    function persistSync() {
      const jobs = [Store.Settings.set('syncProvider', body.querySelector('#set-sync-provider').value)];
      const provider = Sync.providers[body.querySelector('#set-sync-provider').value];
      if (provider) {
        provider.fields.forEach(function (f) {
          const input = body.querySelector('#set-' + f.key);
          if (input) jobs.push(Store.Settings.set(f.key, input.value.trim()));
        });
      }
      return Promise.all(jobs);
    }

    // troca de serviço: reconstrói os campos dependentes
    body.querySelector('#set-sync-provider').addEventListener('change', function () {
      // guarda o que já foi digitado antes de trocar
      Store.Settings.set('syncProvider', this.value);
      body.querySelector('#set-sync-fields').innerHTML = '';
      const provider = Sync.providers[this.value];
      if (!provider) return;
      body.querySelector('#set-sync-fields').innerHTML = provider.fields.map(function (f) {
        const val = Store.Settings.get(f.key, '');
        return '<div class="field"><label for="set-' + esc(f.key) + '">' + esc(f.label) + '</label>' +
          '<input id="set-' + esc(f.key) + '" type="' + esc(f.type) + '" value="' + esc(val) + '" autocomplete="off"></div>';
      }).join('');
    });

    body.querySelector('#set-ai-test').addEventListener('click', async function () {
      const out = body.querySelector('#set-ai-test-result');
      out.innerHTML = 'Testando…';
      const ok = await Review.testAI(
        body.querySelector('#set-ai-url').value,
        body.querySelector('#set-ai-key').value,
        body.querySelector('#set-ai-model').value
      );
      if (ok === true) {
        out.innerHTML = '<span style="color:var(--ok)">' + icon('check-circle') + ' Conexão OK</span>';
      } else {
        out.innerHTML = '<span style="color:var(--danger)">' + icon('alert') + ' ' + esc(ok) + '</span>';
      }
    });

    body.querySelector('#set-sync-test').addEventListener('click', async function () {
      await persist();
      const provider = Sync.provider();
      const out = body.querySelector('#set-sync-result');
      if (!provider) { out.innerHTML = 'Escolha um serviço.'; return; }
      out.innerHTML = 'Testando…';
      const res = await provider.test();
      out.innerHTML = res === true
        ? '<span style="color:var(--ok)">' + icon('check-circle') + ' Conexão OK</span>'
        : '<span style="color:var(--danger)">' + icon('alert') + ' ' + esc(res) + '</span>';
    });

    body.querySelector('#set-sync-now').addEventListener('click', async function () {
      await persist();
      const out = body.querySelector('#set-sync-result');
      out.innerHTML = 'Sincronizando…';
      try {
        await Sync.now({ quiet: true });
        out.innerHTML = '<span style="color:var(--ok)">' + icon('check-circle') + ' Sincronizado.</span>';
        var statusEl = body.querySelector('#set-sync-status');
        if (statusEl) statusEl.innerHTML = syncStatusHtml();
      } catch (err) {
        out.innerHTML = '<span style="color:var(--danger)">' + icon('alert') + ' ' + esc(err.message || 'Falha ao sincronizar.') + '</span>';
      }
    });

    body.querySelector('#set-backup').addEventListener('click', function () {
      Exporter.exportBackup();
    });
    body.querySelector('#set-import').addEventListener('click', function () {
      Exporter.importBackup();
    });
    body.querySelector('#set-import-doc').addEventListener('click', function () {
      Importer.open();
    });

    App.openModal({
      title: '<span>' + icon('settings') + ' Configurações</span>',
      body: body,
      wide: true,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar',
          className: 'primary',
          onClick: async function (close) {
            await persist();
            close();
            App.toast('Configurações salvas.');
          }
        }
      ]
    });
  }

  App.settingsModal = settingsModal;
  window.Autor.views.settings = { settingsModal: settingsModal };
})();
