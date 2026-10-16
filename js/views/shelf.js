/* ============================================================
   views/shelf.js — tela da prateleira: lista de obras, filtro,
   busca local e cartões.
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const $ = Dom.$;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;
  const numberFmt = new Intl.NumberFormat('pt-BR');
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';

  /* soma de palavras e capítulos por livro */
  async function statsByBook() {
    const all = await Store.raw.getAll('chapters');
    const map = {};
    all.forEach(function (c) {
      const s = map[c.bookId] || (map[c.bookId] = { words: 0, chapters: 0 });
      s.chapters++;
      s.words += Content.countWords(c.content);
    });
    return map;
  }

  function spineColor(id) {
    return null;
  }

  /* faixa "continuar de onde parei" (última parte aberta no editor) */
  async function renderContinue() {
    const wrap = $('#shelf-continue');
    if (!wrap) return;
    const loc = Store.Settings.get('lastLocation', null);
    if (!loc || !loc.chapterId) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
    const chapter = await Store.Chapters.get(loc.chapterId);
    if (!chapter) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
    const book = await Store.Books.get(chapter.bookId);
    const words = Content.countWords(chapter.content);
    const wasHidden = wrap.classList.contains('hidden');

    wrap.innerHTML =
      '<button type="button" class="continue-card">' +
        '<span class="continue-icon">' + icon('bookmark') + '</span>' +
        '<span class="continue-info">' +
          '<span class="continue-label">Continuar escrevendo</span>' +
          '<span class="continue-title">' + esc(chapter.title || 'Sem título') + '</span>' +
          '<span class="continue-meta muted">' +
            (book ? esc(book.title) + ' · ' : '') + numberFmt.format(words) +
            (words === 1 ? ' palavra' : ' palavras') +
          '</span>' +
        '</span>' +
        '<span class="continue-go">Continuar ' + icon('arrow-right') + '</span>' +
      '</button>';
    wrap.classList.remove('hidden');
    const card = wrap.querySelector('.continue-card');
    card.addEventListener('click', function () {
      App.openChapter(chapter.id);
    });
    // só anima quando o card realmente aparece (não a cada filtro/busca)
    if (wasHidden && !reduceMQ.matches) {
      card.animate(
        [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 220, easing: EASE_OUT }
      );
    }
  }

  function bookCard(book, stats) {
    const card = el('button', 'book-card');
    card.type = 'button';
    card.style.setProperty('--spine', spineColor(book.id) || 'var(--accent)');
    const st = App.STATUS[book.status] || App.STATUS.rascunho;
    card.innerHTML =
      (book.cover
        ? '<img class="card-cover" src="' + esc(book.cover) + '" alt="">'
        : '<span class="card-cover card-cover-empty" aria-hidden="true">' + icon('image') + '</span>') +
      '<span class="card-title">' + esc(book.title) + '</span>' +
      (book.author ? '<span class="author">por ' + esc(book.author) + '</span>' : '') +
      (book.description ? '<span class="desc">' + esc(book.description) + '</span>' : '') +
      '<span class="card-meta">' +
        '<span class="badge ' + esc(book.status) + '">' + st.label + '</span>' +
        '<span>' + numberFmt.format(stats.chapters) + (stats.chapters === 1 ? ' capítulo' : ' capítulos') +
        ' · ' + numberFmt.format(stats.words) + ' pal.</span>' +
      '</span>';
    card.title = 'Abrir "' + book.title + '"';
    card.setAttribute('aria-label', 'Abrir o livro ' + book.title);
    card.addEventListener('click', function () { App.openBook(book.id); });
    return card;
  }

  async function render(opts) {
    const books = await Store.Books.list();
    const stats = await statsByBook();
    const q = $('#shelf-search').value.trim().toLowerCase();
    const filter = $('#shelf-filter').value;

    await renderContinue();

    const filtered = books.filter(function (b) {
      if (filter !== 'all' && b.status !== filter) return false;
      if (!q) return true;
      return (b.title + ' ' + b.author + ' ' + (b.description || '')).toLowerCase().indexOf(q) >= 0;
    });

    const grid = $('#book-grid');
    grid.innerHTML = '';
    filtered.forEach(function (book) {
      grid.appendChild(bookCard(book, stats[book.id] || { words: 0, chapters: 0 }));
    });
    const guide = $('#shelf-guide');
    if (guide) {
      if (q) {
        guide.textContent = 'Busca · ' + filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's');
      } else if (filter !== 'all') {
        const map = { rascunho: 'Em rascunho', revisao: 'Em revisão', concluido: 'Concluído' };
        guide.textContent = (map[filter] || filter) + ' · ' + filtered.length + ' obra' + (filtered.length === 1 ? '' : 's');
      } else {
        guide.textContent = 'Índice da prateleira · ' + filtered.length + ' obra' + (filtered.length === 1 ? '' : 's');
      }
    }

    // ornamento a ornamento: as entradas entram em stagger só ao ativar a tela
    // (a cada tecla da busca a lista é reconstruída e reanimar seria ruído)
    if (!(opts && opts.silent) && !reduceMQ.matches) {
      grid.querySelectorAll('.book-card').forEach(function (card, i) {
        card.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 220, delay: Math.min(i, 8) * 60, easing: EASE_OUT, fill: 'backwards' }
        );
      });
    }
  }

  const Shelf = { render: render, renderContinue: renderContinue, bookCard: bookCard, statsByBook: statsByBook, spineColor: spineColor };

  App.renderShelf = render;
  window.Autor.views.shelf = Shelf;
})();
