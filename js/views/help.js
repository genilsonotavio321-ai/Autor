/* ============================================================
   views/help.js — modal de ajuda: atalhos de teclado e dicas.
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const el = Dom.el;
  const icon = Dom.icon;

  const SHORTCUTS = [
    { keys: ['Ctrl', 'K'], desc: 'Buscar em todas as obras' },
    { keys: ['Ctrl', 'S'], desc: 'Salvar o capítulo agora (no editor)' },
    { keys: ['Ctrl', 'H'], desc: 'Substituir uma palavra no capítulo (no editor)' },
    { keys: ['Ctrl', 'Z'], desc: 'Desfazer' },
    { keys: ['Ctrl', 'Shift', 'Z'], desc: 'Refazer' },
    { keys: ['Ctrl', 'Shift', 'F'], desc: 'Modo foco (esconde os painéis)' },
    { keys: ['Esc'], desc: 'Sair do modo foco / fechar diálogos' },
    { keys: ['?'], desc: 'Abrir esta ajuda' }
  ];

  const TIPS = [
    'Cada parágrafo é um bloco. Enter no fim do parágrafo cria um novo; Enter no meio vira quebra de linha.',
    'Use três travessões (---) numa linha vazia para marcar uma quebra de página no PDF.',
    'O alinhamento pode ser do parágrafo (só o atual) ou o padrão do capítulo inteiro.',
    'A revisão rápida funciona offline; a revisão com IA é opcional e usa a chave que você configurar.',
    'Tudo é salvo apenas neste dispositivo. Faça backups em Configurações → Seus dados.'
  ];

  function kbd(key) {
    return '<kbd>' + App.esc(key) + '</kbd>';
  }

  function helpModal() {
    const body = el('div', 'help-body');
    body.innerHTML =
      '<p class="hint" style="margin-top:0">Atalhos de teclado</p>' +
      '<div class="shortcut-list">' +
        SHORTCUTS.map(function (s) {
          return '<div class="shortcut-row">' +
            '<span class="shortcut-keys">' + s.keys.map(kbd).join('') + '</span>' +
            '<span class="shortcut-desc">' + App.esc(s.desc) + '</span>' +
            '</div>';
        }).join('') +
      '</div>' +
      '<p class="hint" style="margin-top:18px">Dicas</p>' +
      '<ul class="help-tips">' +
        TIPS.map(function (t) { return '<li>' + App.esc(t) + '</li>'; }).join('') +
      '</ul>';

    App.openModal({
      title: '<span>' + icon('keyboard') + ' Ajuda e atalhos</span>',
      body: body,
      actions: [{ label: 'Fechar', className: 'primary' }]
    });
  }

  App.helpModal = helpModal;
  window.Autor.views.help = { helpModal: helpModal };
})();
