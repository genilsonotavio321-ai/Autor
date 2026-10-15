/* ============================================================
   editor.js — editor de capítulos com salvamento automático,
   estatísticas e integração com o painel de revisão.
   ============================================================ */
const Editor = (function () {
  'use strict';

  const titleInput = document.getElementById('chapter-title');
  const contentEl = document.getElementById('chapter-content');
  const saveIndicator = document.getElementById('save-indicator');
  const statsEl = document.getElementById('editor-stats');

  let dirty = false;
  let saveTimer = null;
  let pendingSelect = null;
  const numberFmt = new Intl.NumberFormat('pt-BR');

  /* ---------------- abrir / salvar ---------------- */

  async function open(chapterId, opts) {
    await flush();
    const chapter = await Store.Chapters.get(chapterId);
    if (!chapter) {
      App.toast('Capítulo não encontrado.', 'error');
      return;
    }
    // garante que o livro aberto é o dono deste capítulo
    if (!App.book || App.book.id !== chapter.bookId) {
      App.book = await Store.Books.get(chapter.bookId);
    }
    App.chapter = chapter;
    titleInput.value = chapter.title || '';
    contentEl.value = chapter.content || '';
    dirty = false;
    setSaveState('saved');
    updateStats();
    App.navigate('editor');
    if (window.Review) Review.reset();

    if (opts && opts.select) {
      pendingSelect = opts.select;
      setTimeout(focusSelection, 60);
    } else {
      contentEl.focus();
    }
  }

  function focusSelection() {
    const q = pendingSelect;
    pendingSelect = null;
    if (!q) { contentEl.focus(); return; }
    const text = contentEl.value;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) { contentEl.focus(); return; }
    contentEl.focus();
    contentEl.setSelectionRange(idx, idx + q.length);
    // rola até a ocorrência (aproximação proporcional)
    const ratio = idx / Math.max(1, text.length);
    contentEl.scrollTop = ratio * (contentEl.scrollHeight - contentEl.clientHeight) - 60;
  }

  function scheduleSave() {
    dirty = true;
    setSaveState('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (!dirty || !App.chapter) return;
    dirty = false;
    App.chapter.title = titleInput.value.trim() || 'Capítulo sem título';
    App.chapter.content = contentEl.value;
    await Store.Chapters.save(App.chapter);
    setSaveState('saved');
  }

  /* salva imediatamente se houver alterações pendentes */
  async function flush() {
    if (dirty) await saveNow();
  }

  function icon(name) { return (window.App && App.icon ? App.icon(name) : ''); }

  function setSaveState(state) {
    if (state === 'saving') {
      saveIndicator.innerHTML = 'Salvando…';
      saveIndicator.classList.add('saving');
    } else {
      saveIndicator.innerHTML = icon('check') + ' Salvo';
      saveIndicator.classList.remove('saving');
    }
  }

  /* ---------------- estatísticas ---------------- */

  function updateStats() {
    const text = contentEl.value;
    const words = App.countWords(text);
    const chars = text.length;
    statsEl.textContent =
      numberFmt.format(words) + (words === 1 ? ' palavra' : ' palavras') +
      ' · ' + numberFmt.format(chars) + ' caracteres' +
      (words ? ' · ' + App.readTime(words) : '');
  }

  /* ---------------- API pública ---------------- */

  function getText() { return contentEl.value; }

  async function setText(newText) {
    contentEl.value = newText;
    updateStats();
    scheduleSave();
    await flush();
  }

  function isDirty() { return dirty; }

  function setTitle(newTitle) {
    titleInput.value = newTitle;
    scheduleSave();
  }

  /* ---------------- eventos ---------------- */

  contentEl.addEventListener('input', function () {
    updateStats();
    scheduleSave();
  });

  titleInput.addEventListener('input', scheduleSave);

  // Ctrl+S salva agora
  document.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      if (App.view !== 'editor') return;
      ev.preventDefault();
      saveNow().then(function () { App.toast('Salvo'); });
    }
  });

  document.getElementById('btn-back-book').addEventListener('click', async function () {
    await flush();
    if (App.book) App.openBook(App.book.id);
  });

  document.getElementById('btn-delete-chapter').addEventListener('click', async function () {
    if (!App.chapter) return;
    const ok = await App.confirm(
      'Excluir o capítulo "' + titleInput.value + '"? Ele irá para a lixeira.',
      { okLabel: 'Excluir', danger: true }
    );
    if (ok) {
      dirty = false;
      await Store.Chapters.remove(App.chapter.id);
      App.chapter = null;
      App.toast('Capítulo movido para a lixeira.');
      if (App.book) App.openBook(App.book.id);
    }
  });

  document.getElementById('btn-review').addEventListener('click', function () {
    if (window.Review) Review.toggle();
  });

  document.getElementById('btn-read-chapter').addEventListener('click', async function () {
    await flush();
    if (App.chapter) Reader.open({ chapterId: App.chapter.id });
  });

  document.getElementById('btn-export-chapter').addEventListener('click', async function () {
    await flush();
    if (App.chapter) Exporter.chapterDialog(App.chapter);
  });

  // salva ao sair da aba
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && dirty) saveNow();
  });

  const api = {
    open: open,
    flush: flush,
    saveNow: saveNow,
    getText: getText,
    setText: setText,
    setTitle: setTitle,
    isDirty: isDirty
  };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Editor = api;

  return api;
})();
