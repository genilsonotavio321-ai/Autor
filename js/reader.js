/* ============================================================
   reader.js — modo leitura (livro inteiro ou capítulo),
   com fonte ajustável, serifada/sans e temas claro/sépia/escuro.
   ============================================================ */
const Reader = (function () {
  'use strict';

  const view = document.getElementById('view-reader');
  const content = document.getElementById('reader-content');
  const progressEl = document.getElementById('reader-progress');
  const themeSelect = document.getElementById('reader-theme');
  const serifBtn = document.getElementById('reader-font-serif');

  let current = null; // {bookId} ou {chapterId}
  let chapterCount = 0;

  const MIN_FONT = 15;
  const MAX_FONT = 30;

  /* ---------------- preferências ---------------- */

  function applyPrefs() {
    const size = Store.Settings.get('readerFont', 19);
    const font = Store.Settings.get('readerFontFamily', 'serif'); // serif | sans
    const theme = Store.Settings.get('readerTheme', 'light');     // light | sepia | dark

    content.style.setProperty('--reader-font', size + 'px');
    view.setAttribute('data-reader-font', font);
    view.setAttribute('data-reader-theme', theme);

    themeSelect.value = theme;
    serifBtn.textContent = font === 'serif' ? 'Serif ✓' : 'Serif';
    serifBtn.classList.toggle('primary', font === 'sans');
  }

  async function changeFont(delta) {
    let size = Store.Settings.get('readerFont', 19) + delta;
    size = Math.max(MIN_FONT, Math.min(MAX_FONT, size));
    await Store.Settings.set('readerFont', size);
    applyPrefs();
  }

  /* ---------------- renderização ---------------- */

  function renderContent(chapters) {
    const parts = [];
    parts.push('<h1>' + App.esc(chapters._bookTitle || 'Leitura') + '</h1>');
    if (chapters._bookAuthor) parts.push('<p class="muted" style="text-align:center">por ' + App.esc(chapters._bookAuthor) + '</p>');

    chapters.forEach(function (ch, i) {
      parts.push('<section class="chapter-block" data-index="' + i + '">');
      parts.push('<h2>' + (chapters._bookTitle ? (i + 1) + '. ' : '') + App.esc(ch.title || 'Sem título') + '</h2>');
      const blocks = (ch.content || '').split(/\n{2,}/);
      blocks.forEach(function (block) {
        const trimmed = block.trim();
        if (!trimmed) return;
        if (/^-{3,}$/.test(trimmed)) {
          parts.push('<hr class="pagebreak">');
          return;
        }
        parts.push('<p>' + App.esc(trimmed).replace(/\n/g, '<br>') + '</p>');
      });
      parts.push('</section>');
    });

    content.innerHTML = parts.join('');
    content.scrollTop = 0;
    updateProgress();
  }

  async function open(opts) {
    current = opts;
    applyPrefs();

    if (opts.chapterId) {
      const ch = await Store.Chapters.get(opts.chapterId);
      if (!ch) { App.toast('Capítulo não encontrado.', 'error'); return; }
      const book = await Store.Books.get(ch.bookId);
      chapterCount = 0;
      progressEl.textContent = book ? book.title : '';
      const list = [ch];
      list._bookTitle = null;
      renderContent(list);
    } else {
      const book = await Store.Books.get(opts.bookId);
      if (!book) { App.toast('Livro não encontrado.', 'error'); return; }
      const chapters = await Store.Chapters.listByBook(book.id);
      if (!chapters.length) { App.toast('Este livro ainda não tem capítulos.', 'error'); return; }
      chapterCount = chapters.length;
      progressEl.textContent = '';
      chapters._bookTitle = book.title;
      chapters._bookAuthor = book.author;
      renderContent(chapters);
    }

    await App.navigate('reader');
    updateProgress();
  }

  function updateProgress() {
    if (!chapterCount) return;
    const max = content.scrollHeight - content.clientHeight;
    const pct = max > 0 ? Math.round((content.scrollTop / max) * 100) : 0;
    // capítulo atual pelo topo da tela
    const blocks = content.querySelectorAll('.chapter-block');
    let currentIdx = 1;
    blocks.forEach(function (b) {
      if (b.offsetTop - content.offsetTop <= 120) currentIdx = Number(b.getAttribute('data-index')) + 1;
    });
    progressEl.textContent = 'Cap. ' + currentIdx + ' de ' + chapterCount + ' · ' + pct + '%';
  }

  /* ---------------- eventos ---------------- */

  content.addEventListener('scroll', updateProgress);

  document.getElementById('btn-close-reader').addEventListener('click', function () {
    if (App.book && current && current.bookId) {
      App.openBook(App.book.id);
    } else if (App.chapter && current && current.chapterId) {
      App.navigate('editor');
    } else {
      App.renderShelf();
      App.navigate('shelf');
    }
  });

  document.getElementById('reader-font-minus').addEventListener('click', function () { changeFont(-1); });
  document.getElementById('reader-font-plus').addEventListener('click', function () { changeFont(1); });

  serifBtn.addEventListener('click', async function () {
    const next = Store.Settings.get('readerFontFamily', 'serif') === 'serif' ? 'sans' : 'serif';
    await Store.Settings.set('readerFontFamily', next);
    applyPrefs();
  });

  themeSelect.addEventListener('change', async function () {
    await Store.Settings.set('readerTheme', themeSelect.value);
    applyPrefs();
  });

  return { open: open };
})();
