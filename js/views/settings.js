/* ============================================================
   views/settings.js — configurações: revisão com IA (opcional) e
   backup dos dados (exportar/importar).
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;

  function settingsModal() {
    const body = el('div');

    body.innerHTML =
      '<div class="settings-section">' +
        '<h3>' + icon('sparkles') + ' Revisão com IA (opcional)</h3>' +
        '<p class="hint">A revisão rápida offline funciona sem nada aqui. Configure uma chave de API compatível com OpenAI (OpenAI, DeepSeek, Groq etc.) para ativar sugestões inteligentes. A chave fica somente neste navegador.</p>' +
        '<div class="field"><label for="set-ai-url">Endpoint (URL base)</label>' +
        '<input id="set-ai-url" type="text" placeholder="https://api.openai.com/v1"></div>' +
        '<div class="field"><label for="set-ai-key">Chave de API</label>' +
        '<input id="set-ai-key" type="password" placeholder="sk-…"></div>' +
        '<div class="row">' +
          '<div class="field"><label for="set-ai-model">Modelo</label>' +
          '<input id="set-ai-model" type="text" placeholder="gpt-4o-mini"></div>' +
        '</div>' +
        '<button id="set-ai-test" class="btn small">' + icon('zap') + ' Testar conexão</button> ' +
        '<span id="set-ai-test-result" class="muted"></span>' +
      '</div>' +
      '<div class="settings-section">' +
        '<h3>' + icon('database') + ' Seus dados</h3>' +
        '<p class="hint">Tudo é salvo apenas neste dispositivo. Faça backups com frequência. Modo de armazenamento atual: <strong>' +
        (Store.isFallbackMode() ? 'localStorage (emergência)' : 'IndexedDB') + '</strong>.</p>' +
        '<div class="row">' +
          '<button id="set-backup" class="btn">' + icon('download') + ' Exportar backup (.json)</button>' +
          '<button id="set-import" class="btn">' + icon('upload') + ' Importar backup</button>' +
        '</div>' +
      '</div>';

    body.querySelector('#set-ai-url').value = Store.Settings.get('aiUrl', 'https://api.openai.com/v1');
    body.querySelector('#set-ai-key').value = Store.Settings.get('aiKey', '');
    body.querySelector('#set-ai-model').value = Store.Settings.get('aiModel', 'gpt-4o-mini');

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

    body.querySelector('#set-backup').addEventListener('click', function () {
      Exporter.exportBackup();
    });
    body.querySelector('#set-import').addEventListener('click', function () {
      Exporter.importBackup();
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
            await Store.Settings.set('aiUrl', body.querySelector('#set-ai-url').value.trim() || 'https://api.openai.com/v1');
            await Store.Settings.set('aiKey', body.querySelector('#set-ai-key').value.trim());
            await Store.Settings.set('aiModel', body.querySelector('#set-ai-model').value.trim() || 'gpt-4o-mini');
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
