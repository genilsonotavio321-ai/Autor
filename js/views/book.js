/* ============================================================
   views/book.js — tela do livro: dados da obra, lista de capítulos
   (mover, duplicar, status, excluir), formulário de livro e modal de
   status do capítulo.
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

  /* FLIP: posições das linhas antes de reordenar (por id) */
  function rowTops() {
    const map = {};
    document.querySelectorAll('#chapter-list .chapter-item').forEach(function (li) {
      const id = li.getAttribute('data-id');
      if (id) map[id] = li.getBoundingClientRect().top;
    });
    return map;
  }

  function flipRows(before) {
    if (reduceMQ.matches) return;
    // lê as posições novas primeiro, depois anima (evita read/write alternado)
    const moved = [];
    document.querySelectorAll('#chapter-list .chapter-item').forEach(function (li) {
      const id = li.getAttribute('data-id');
      const from = before[id];
      if (from == null) return;
      const dy = from - li.getBoundingClientRect().top;
      if (dy) moved.push({ el: li, dy: dy });
    });
    moved.forEach(function (m) {
      m.el.animate(
        [{ transform: 'translateY(' + m.dy + 'px)' }, { transform: 'translateY(0)' }],
        { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
      );
    });
  }

  function enterRow(id) {
    if (reduceMQ.matches || !id) return;
    const li = document.querySelector('#chapter-list .chapter-item[data-id="' + id + '"]');
    if (!li) return;
    li.animate(
      [{ opacity: 0, transform: 'scale(.98)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    );
  }

  /* ---------------- formulário de livro ---------------- */

  function bookFormModal(bookOrNull) {
    const isNew = !bookOrNull;
    const cover = isNew ? null : (bookOrNull.cover || null);
    const body = el('div');
    body.innerHTML =
      '<div class="field"><label for="bf-title">Título *</label>' +
      '<input id="bf-title" type="text" value="' + esc(isNew ? '' : bookOrNull.title) + '" placeholder="Ex.: O Segredo do Vale"></div>' +
      '<div class="field"><label for="bf-author">Autor(a)</label>' +
      '<input id="bf-author" type="text" value="' + esc(isNew ? (Store.Settings.get('authorName', '')) : bookOrNull.author) + '" placeholder="Seu nome"></div>' +
      '<div class="field"><label for="bf-desc">Descrição / sinopse (opcional)</label>' +
      '<textarea id="bf-desc" placeholder="Sobre o que é esta obra…">' + esc(isNew ? '' : bookOrNull.description) + '</textarea></div>' +
      '<div class="field"><label for="bf-status">Status</label>' +
      '<select id="bf-status">' +
        '<option value="rascunho">Rascunho</option>' +
        '<option value="revisao">Em revisão</option>' +
        '<option value="concluido">Concluído</option>' +
      '</select></div>' +
      '<div class="field"><label>Capa da obra</label>' +
      '<div id="bf-cover"></div></div>';
    body.querySelector('#bf-status').value = isNew ? 'rascunho' : bookOrNull.status;

    const coverWidget = Ui.cover({
      value: cover,
      alt: 'Pré-visualização da capa',
      hint: 'A imagem é reduzida no próprio aparelho (até 400×600 no retrato ou 600×400 na paisagem) e fica salva só no seu dispositivo.'
    });
    body.querySelector('#bf-cover').appendChild(coverWidget.element);

    App.openModal({
      title: isNew ? 'Novo livro' : 'Editar livro',
      body: body,
      actions: [
        { label: 'Cancelar' },
        {
          label: isNew ? 'Criar' : 'Salvar',
          className: 'primary',
          onClick: async function (close) {
            const title = body.querySelector('#bf-title').value.trim();
            if (!title) { App.toast('Dê um título ao livro.', 'error'); return false; }
            const data = {
              title: title,
              author: body.querySelector('#bf-author').value,
              description: body.querySelector('#bf-desc').value,
              status: body.querySelector('#bf-status').value,
              cover: coverWidget.get()
            };
            if (isNew) {
              const book = await Store.Books.create(data);
              // guarda o nome do autor como padrão para próximos livros
              if (data.author) Store.Settings.set('authorName', data.author);
              close();
              App.toast('Livro criado! Agora crie um capítulo.');
              App.openBook(book.id);
            } else {
              Object.assign(bookOrNull, data);
              await Store.Books.save(bookOrNull);
              close();
              App.openBook(bookOrNull.id);
              App.toast('Livro salvo.');
            }
            return false;
          }
        }
      ]
    });
  }

  /* ---------------- status do capítulo ---------------- */

  function chapterStatusModal(chapter, onSaved) {
    const current = chapter.status || 'rascunho';
    const descs = {
      rascunho: 'Ainda em escrita — texto solto, ideias em construção.',
      revisao: 'Escrito e agora em processo de revisão.',
      concluido: 'Revisado e considerado pronto.'
    };
    const body = el('div');
    body.innerHTML =
      '<p class="muted" style="margin-top:0">Em que fase está este capítulo?</p>' +
      '<div class="status-options">' +
      ['rascunho', 'revisao', 'concluido'].map(function (k) {
        return '<button type="button" class="status-option' + (k === current ? ' selected' : '') + '" data-status="' + k + '">' +
          '<span class="badge ' + k + '">' + App.STATUS[k].label + '</span>' +
          '<span class="so-desc">' + descs[k] + '</span>' +
          '</button>';
      }).join('') +
      '</div>';

    const m = App.openModal({
      title: '<span>' + icon('check-circle') + ' Status do capítulo</span>',
      body: body
    });

    body.querySelectorAll('[data-status]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        chapter.status = btn.getAttribute('data-status');
        await Store.Chapters.save(chapter);
        m.close();
        App.toast('Status do capítulo: ' + App.STATUS[chapter.status].label + '.');
        if (typeof onSaved === 'function') onSaved();
      });
    });
  }

  /* ---------------- tela do livro ---------------- */

  async function openBook(id) {
    const book = await Store.Books.get(id);
    if (!book) { App.toast('Livro não encontrado.', 'error'); App.renderShelf(); App.navigate('shelf'); return; }
    App.book = book;
    $('#book-title').textContent = book.title;
    $('#book-author').textContent = book.author ? 'por ' + book.author : '';
    $('#book-desc').textContent = book.description || '';
    $('#book-status').value = book.status;

    const coverEl = $('#book-cover');
    if (book.cover) {
      coverEl.innerHTML = '<img src="' + esc(book.cover) + '" alt="Capa de ' + esc(book.title) + '">';
    } else {
      coverEl.innerHTML = '<svg class="ic" aria-hidden="true"><use href="#i-image"></use></svg>';
    }

    await renderChapters();
    App.navigate('book');
  }

  async function renderChapters(enterId) {
    if (!App.book) return;
    const chapters = await Store.Chapters.listByBook(App.book.id);
    const list = $('#chapter-list');
    list.innerHTML = '';

    chapters.forEach(function (ch, i) {
      const li = el('li', 'chapter-item');
      li.setAttribute('data-id', ch.id);
      const chStatus = ch.status || 'rascunho';
      const st = App.STATUS[chStatus] || App.STATUS.rascunho;
      const words = Content.countWords(ch.content);

      li.innerHTML = '';
      if (ch.cover) {
        const img = el('img', 'ch-cover');
        img.src = ch.cover;
        img.alt = '';
        li.appendChild(img);
      }
      li.insertAdjacentHTML('beforeend',
        '<span class="ch-num">' + (i + 1) + '</span>' +
        '<button type="button" class="ch-main">' +
          '<span class="ch-title">' + esc(ch.title) + '</span>' +
          '<span class="ch-meta muted">' + numberFmt.format(words) + (words === 1 ? ' palavra' : ' palavras') +
            (words ? ' · ' + App.readTime(words) : '') + '</span>' +
        '</button>' +
        '<button type="button" class="badge ' + esc(chStatus) + '" data-act="status" ' +
          'title="Alterar o status do capítulo" aria-label="Status do capítulo: ' + esc(st.label) + '. Clique para mudar.">' +
          esc(st.label) + '</button>' +
        '<div class="ch-actions">' +
          '<button class="icon-btn" data-act="up" title="Mover para cima" aria-label="Mover para cima">' + icon('arrow-up') + '</button>' +
          '<button class="icon-btn" data-act="down" title="Mover para baixo" aria-label="Mover para baixo">' + icon('arrow-down') + '</button>' +
          '<button class="icon-btn" data-act="dup" title="Duplicar capítulo" aria-label="Duplicar capítulo">' + icon('copy') + '</button>' +
          '<button class="icon-btn" data-act="del" title="Excluir capítulo" aria-label="Excluir capítulo">' + icon('trash') + '</button>' +
        '</div>');

      const chMain = li.querySelector('.ch-main');
      chMain.addEventListener('click', function () {
        App.openChapter(ch.id);
      });
      chMain.setAttribute('aria-label', 'Abrir o capítulo ' + ch.title);

      li.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const act = btn.getAttribute('data-act');
          if (act === 'up' || act === 'down') {
            const before = rowTops();
            const moved = await Store.Chapters.move(ch.id, act);
            if (moved) { await renderChapters(); flipRows(before); }
          } else if (act === 'dup') {
            const copy = await Store.Chapters.duplicate(ch.id);
            if (copy) { App.toast('Capítulo duplicado.'); await renderChapters(copy.id); }
          } else if (act === 'status') {
            chapterStatusModal(ch, renderChapters);
          } else if (act === 'del') {
            const ok = await App.confirm(
              'Excluir o capítulo "' + ch.title + '"? Ele irá para a lixeira.',
              { okLabel: 'Excluir', danger: true }
            );
            if (ok) {
              await Store.Chapters.remove(ch.id);
              App.toast('Capítulo movido para a lixeira.');
              renderChapters();
            }
          }
        });
      });

      list.appendChild(li);
    });

    const words = chapters.reduce(function (s, c) { return s + Content.countWords(c.content); }, 0);
    $('#book-stats').textContent =
      numberFmt.format(chapters.length) + (chapters.length === 1 ? ' capítulo' : ' capítulos') +
      ' · ' + numberFmt.format(words) + ' palavras · ' + App.readTime(words);
    $('#book-empty-chapters').classList.toggle('hidden', chapters.length > 0);
    enterRow(enterId);
  }

  async function addChapter() {
    if (!App.book) return;
    const n = (await Store.Chapters.listByBook(App.book.id)).length + 1;
    const ch = await Store.Chapters.create(App.book.id, 'Capítulo ' + n);
    await openChapter(ch.id);
    const titleInput = $('#chapter-title');
    titleInput.select();
  }

  async function openChapter(id, opts) {
    await Editor.open(id, opts);
  }

  const Book = {
    openBook: openBook,
    renderChapters: renderChapters,
    addChapter: addChapter,
    openChapter: openChapter,
    bookFormModal: bookFormModal,
    chapterStatusModal: chapterStatusModal
  };

  App.openBook = openBook;
  App.renderChapters = renderChapters;
  App.addChapter = addChapter;
  App.openChapter = openChapter;
  App.bookFormModal = bookFormModal;
  App.chapterStatusModal = chapterStatusModal;
  window.Autor.views.book = Book;
})();
