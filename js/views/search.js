/* ============================================================
   views/search.js — busca global (títulos/autores e dentro dos textos).
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;

  function searchModal() {
    const body = el('div');
    body.innerHTML =
      '<div class="field"><input id="gs-input" type="search" placeholder="Buscar títulos, autores e palavras dentro dos textos…"></div>' +
      '<div id="gs-results" class="search-results"><p class="muted">Digite para buscar em todas as obras.</p></div>';

    const input = body.querySelector('#gs-input');
    const results = body.querySelector('#gs-results');
    const modalRef = {};
    let searchTimer = null;

    input.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { runSearch(); }, 220);
    });

    async function runSearch() {
      const q = input.value.trim();
      if (q.length < 2) {
        results.innerHTML = '<p class="muted">Digite ao menos 2 letras.</p>';
        return;
      }
      const ql = q.toLowerCase();
      const books = await Store.Books.list();
      const chapters = await Store.raw.getAll('chapters');
      const bookTitleMap = {};
      books.forEach(function (b) { bookTitleMap[b.id] = b.title; });

      results.innerHTML = '';
      let count = 0;

      // obras que casam no título/autor/descrição
      books.forEach(function (b) {
        if ((b.title + ' ' + b.author + ' ' + (b.description || '')).toLowerCase().indexOf(ql) < 0) return;
        count++;
        const btn = el('button', 'search-result');
        btn.innerHTML = '<span class="sr-title">' + icon('book') + esc(b.title) + '</span><br>' +
          '<span class="sr-ctx">Livro' + (b.author ? ' de ' + esc(b.author) : '') + '</span>';
        btn.addEventListener('click', function () { modalRef.close(); App.openBook(b.id); });
        results.appendChild(btn);
      });

      // ocorrências no conteúdo dos capítulos
      chapters.forEach(function (ch) {
        const content = Content.strip(ch.content || '');
        const idx = content.toLowerCase().indexOf(ql);
        if (idx < 0) return;
        count++;
        const from = Math.max(0, idx - 40);
        const to = Math.min(content.length, idx + q.length + 60);
        const pre = (from > 0 ? '…' : '') + content.slice(from, idx);
        const mid = content.slice(idx, idx + q.length);
        const pos = content.slice(idx + q.length, to) + (to < content.length ? '…' : '');
        const btn = el('button', 'search-result');
        btn.innerHTML =
          '<span class="sr-title">' + icon('file-text') + esc(ch.title) + '</span> ' +
          '<span class="sr-ctx muted">(' + esc(bookTitleMap[ch.bookId] || 'sem livro') + ')</span><br>' +
          '<span class="sr-ctx">' + esc(pre) + '<mark>' + esc(mid) + '</mark>' + esc(pos).replace(/\n/g, ' ') + '</span>';
        btn.addEventListener('click', function () {
          modalRef.close();
          App.openChapter(ch.id, { select: q });
        });
        results.appendChild(btn);
      });

      if (!count) results.innerHTML = '<p class="muted">Nada encontrado para "' + esc(q) + '".</p>';
    }

    const ref = App.openModal({ title: '<span>' + icon('search') + ' Buscar</span>', body: body, wide: true });
    modalRef.close = ref.close;
    setTimeout(function () { input.focus(); }, 40);
  }

  App.searchModal = searchModal;
  window.Autor.views.search = { searchModal: searchModal };
})();
