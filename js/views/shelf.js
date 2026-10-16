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
    // cor determinística a partir do id
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 42%, 48%)';
  }

  function bookCard(book, stats) {
    const card = el('button', 'book-card');
    card.type = 'button';
    card.style.setProperty('--spine', spineColor(book.id));
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

  async function render() {
    const books = await Store.Books.list();
    const stats = await statsByBook();
    const q = $('#shelf-search').value.trim().toLowerCase();
    const filter = $('#shelf-filter').value;

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
    $('#shelf-empty').classList.toggle('hidden', filtered.length > 0);
  }

  const Shelf = { render: render, bookCard: bookCard, statsByBook: statsByBook, spineColor: spineColor };

  App.renderShelf = render;
  window.Autor.views.shelf = Shelf;
})();
