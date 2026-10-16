/* ============================================================
   app.js — raiz de composição do app "Autor".

   Define o namespace App, os utilitários de UI compartilhados
   (aliases para Autor.dom/content/ui/image), o roteamento (navigate),
   o tema, o registro de eventos, o PWA e o boot. As telas ficam em
   js/views/*.js e se registram em App (e em Autor.views.*).
   ============================================================ */
(function () {
  'use strict';

  const App = {
    view: 'shelf',
    book: null,     // livro aberto (objeto)
    chapter: null   // capítulo aberto no editor (objeto)
  };
  window.App = App;
  window.Autor = window.Autor || {};
  window.Autor.app = App;
  window.Autor.views = window.Autor.views || {};

  const STATUS = {
    rascunho: { label: 'Rascunho' },
    revisao: { label: 'Em revisão' },
    concluido: { label: 'Concluído' }
  };
  App.STATUS = STATUS;

  /* ================= utilitários compartilhados =================
     Delegados ao core: `Autor.dom` (nós/escape), `Autor.content`
     (modelo de conteúdo), `Autor.ui` (toast/modal/confirm) e
     `Autor.image` (capas). Mantemos aliases em App para os
     consumidores existentes (editor, review, export, reader, views). */
  const $ = Dom.$;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;

  App.$ = $;
  App.el = el;
  App.esc = esc;
  App.icon = icon;

  App.toast = Ui.toast;
  App.openModal = Ui.openModal;
  App.confirm = Ui.confirm;
  App.cover = Ui.cover;

  App.pickImage = Img.pick;

  App.readTime = function (words) {
    const min = Math.max(1, Math.round(words / 200));
    return '~' + min + ' min de leitura';
  };

  /* ================= navegação ================= */

  /* o selo do colofão: assinatura do app (desenha ao trocar de tela;
     carimba ao concluir uma obra). */
  App.colophon = function (kind) {
    const device = document.querySelector('.brand .device');
    if (!device) return;
    device.classList.remove('drawing', 'stamp');
    void device.offsetWidth; /* reinicia a animação */
    if (kind === 'stamp') {
      device.classList.add('stamp');
      clearTimeout(device._stampTimer);
      device._stampTimer = setTimeout(function () { device.classList.remove('stamp'); }, 420);
    } else {
      device.classList.add('drawing');
      clearTimeout(device._drawTimer);
      device._drawTimer = setTimeout(function () { device.classList.remove('drawing'); }, 1100);
    }
  };

  App.navigate = async function (view) {
    if (App.view === 'editor' && view !== 'editor' && window.Editor) {
      await Editor.flush();
    }
    App.view = view;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active', 'view-enter'); });
    const next = $('#view-' + view);
    next.classList.add('active');
    // transição: só as telas de leitura/estante — o editor e o leitor assentam de imediato
    if (view === 'shelf' || view === 'book') {
      next.classList.add('view-enter');
      next.addEventListener('animationend', function handler(ev) {
        if (ev.target !== next || ev.animationName !== 'view-in') return;
        next.classList.remove('view-enter');
        next.removeEventListener('animationend', handler);
      });
    }
    // o modo foco vale só dentro do editor; sair dele limpa a classe
    if (view !== 'editor') {
      document.body.classList.remove('focus-mode');
    }
    window.scrollTo(0, 0);
    App.colophon('draw');
  };

  /* ================= tema ================= */

  App.applyTheme = function (animate) {
    const theme = Store.Settings.get('theme', 'light');
    const root = document.documentElement;
    if (animate) {
      // cross-fade só de cor: nunca anima layout
      root.classList.add('theming');
      clearTimeout(App._themeTimer);
      App._themeTimer = setTimeout(function () { root.classList.remove('theming'); }, 260);
    }
    root.setAttribute('data-theme', theme);
    const themeBtn = $('#btn-theme');
    if (themeBtn) {
      themeBtn.querySelector('use') && (themeBtn.querySelector('use').setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon'));
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e2b22' : '#12362b');
  };

  /* ================= eventos ================= */

  /* true quando o foco está num campo de digitação (para atalhos de tecla) */
  function isEditingTarget(node) {
    if (!node || node.nodeType !== 1) return false;
    const tag = node.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
  }

  function bindEvents() {
    $('#btn-home').addEventListener('click', function () {
      App.renderShelf();
      App.navigate('shelf');
    });

    document.querySelectorAll('[data-back="shelf"]').forEach(function (b) {
      b.addEventListener('click', function () {
        App.renderShelf();
        App.navigate('shelf');
      });
    });

    $('#btn-new-book').addEventListener('click', function () { App.bookFormModal(null); });
    $('#shelf-search').addEventListener('input', function () { App.renderShelf({ silent: true }); });
    $('#shelf-filter').addEventListener('change', function () { App.renderShelf({ silent: true }); });

    // tela do livro
    $('#btn-edit-book').addEventListener('click', function () { App.bookFormModal(App.book); });
    $('#btn-delete-book').addEventListener('click', async function () {
      if (!App.book) return;
      const ok = await App.confirm(
        'Excluir o livro "' + App.book.title + '" e todos os seus capítulos? O item irá para a lixeira.',
        { okLabel: 'Excluir', danger: true }
      );
      if (ok) {
        await Store.Books.remove(App.book.id);
        App.book = null;
        App.toast('Livro movido para a lixeira.');
        App.renderShelf();
        App.navigate('shelf');
      }
    });
    $('#btn-add-chapter').addEventListener('click', function () { App.addChapter(); });
    $('#btn-read-book').addEventListener('click', function () {
      if (App.book) Reader.open({ bookId: App.book.id });
    });
    $('#btn-export-book').addEventListener('click', function () {
      if (App.book) Exporter.bookDialog(App.book);
    });
    $('#book-status').addEventListener('change', async function () {
      if (!App.book) return;
      App.book.status = $('#book-status').value;
      await Store.Books.save(App.book);
      App.toast('Status atualizado: ' + STATUS[App.book.status].label);
      if (App.book.status === 'concluido') App.colophon('stamp');
    });

    // topbar
    $('#btn-global-search').addEventListener('click', function () { App.searchModal(); });
    $('#btn-trash-open').addEventListener('click', function () { App.trashModal(); });
    $('#btn-settings-open').addEventListener('click', function () { App.settingsModal(); });
    $('#btn-help-open').addEventListener('click', function () { App.helpModal(); });

    // importar manuscrito (prateleira)
    $('#btn-import').addEventListener('click', function () { Importer.open(); });

    // assistente de escrita (livro e editor)
    var assistantBook = $('#btn-assistant-book');
    if (assistantBook) assistantBook.addEventListener('click', function () { App.assistantModal(); });
    var assistantEditor = $('#btn-assistant');
    if (assistantEditor) assistantEditor.addEventListener('click', function () { App.assistantModal(); });
    $('#btn-theme').addEventListener('click', async function () {
      const next = Store.Settings.get('theme', 'light') === 'dark' ? 'light' : 'dark';
      await Store.Settings.set('theme', next);
      App.applyTheme(true);
    });

    // atalho de busca
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        App.searchModal();
        return;
      }
      // '?' abre a ajuda, exceto quando o foco está num campo de digitação
      if (ev.key === '?' && !isEditingTarget(ev.target)) {
        ev.preventDefault();
        App.helpModal();
      }
    });

    // aviso ao fechar com alterações pendentes
    window.addEventListener('beforeunload', function (ev) {
      if (window.Editor && Editor.isDirty()) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });
  }

  /* ================= PWA (app instalável) ================= */

  function setupPWA() {
    // O service worker só se aplica quando o app é servido por http(s).
    // Em file:// (duplo clique) o app continua funcionando normalmente.
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* silencioso */ });
      });
    }
    // pede armazenamento persistente (reduz o risco de o navegador limpar os dados sozinho)
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(function () { /* opcional */ });
    }
  }

  /* ================= início ================= */

  document.addEventListener('DOMContentLoaded', async function () {
    setupPWA();
    await Store.init();
    bindEvents();
    App.applyTheme();
    await App.renderShelf();
    if (Store.isFallbackMode()) {
      App.toast('Armazenamento de emergência ativo (localStorage). Recomendado: exportar backups.', 'info');
    }
  });
})();
