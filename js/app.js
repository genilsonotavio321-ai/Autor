/* ============================================================
   app.js — navegação, prateleira, tela do livro, busca global,
   lixeira, configurações, tema e utilitários de UI.
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

  const STATUS = {
    rascunho: { label: 'Rascunho' },
    revisao: { label: 'Em revisão' },
    concluido: { label: 'Concluído' }
  };
  App.STATUS = STATUS;

  const numberFmt = new Intl.NumberFormat('pt-BR');

  /* ================= utilitários de UI =================
     Delegados ao core: `Autor.dom` (nós/escape) e `Autor.content`
     (modelo de conteúdo). Mantemos aliases em App para os consumidores
     existentes (editor, review, export, reader). */
  const $ = Dom.$;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;

  App.$ = $;
  App.el = el;
  App.esc = esc;
  App.icon = icon;

  App.readTime = function (words) {
    const min = Math.max(1, Math.round(words / 200));
    return '~' + min + ' min de leitura';
  };

  /* ---------------- escolha de imagem (capas) ----------------
     Implementação movida para Autor.image (js/core/image.js). O alias
     App.pickImage é mantido para consumidores existentes. */
  App.pickImage = Img.pick;

  /* ================= ui (toast, modal, confirm) =================
     Movidos para Autor.ui (js/core/ui.js); aliases mantidos em App. */
  App.toast = Ui.toast;
  App.openModal = Ui.openModal;
  App.confirm = Ui.confirm;

  /* ================= navegação ================= */

  App.navigate = async function (view) {
    if (App.view === 'editor' && view !== 'editor' && window.Editor) {
      await Editor.flush();
    }
    App.view = view;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    $('#view-' + view).classList.add('active');
    window.scrollTo(0, 0);
  };

  /* ================= prateleira ================= */

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

  App.renderShelf = async function () {
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
  };

  function bookCard(book, stats) {
    const card = el('button', 'book-card');
    card.type = 'button';
    card.style.setProperty('--spine', spineColor(book.id));
    const st = STATUS[book.status] || STATUS.rascunho;
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

  /* ================= formulário de livro ================= */

  App.bookFormModal = function (bookOrNull) {
    const isNew = !bookOrNull;
    let cover = isNew ? null : (bookOrNull.cover || null);
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
  };

  /* ================= status do capítulo ================= */

  App.chapterStatusModal = function (chapter, onSaved) {
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
          '<span class="badge ' + k + '">' + STATUS[k].label + '</span>' +
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
        App.toast('Status do capítulo: ' + STATUS[chapter.status].label + '.');
        if (typeof onSaved === 'function') onSaved();
      });
    });
  };

  /* ================= tela do livro ================= */

  App.openBook = async function (id) {
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
  };

  async function renderChapters() {
    if (!App.book) return;
    const chapters = await Store.Chapters.listByBook(App.book.id);
    const list = $('#chapter-list');
    list.innerHTML = '';

    chapters.forEach(function (ch, i) {
      const li = el('li', 'chapter-item');
      const chStatus = ch.status || 'rascunho';
      const st = STATUS[chStatus] || STATUS.rascunho;
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
            const moved = await Store.Chapters.move(ch.id, act);
            if (moved) renderChapters();
          } else if (act === 'dup') {
            const copy = await Store.Chapters.duplicate(ch.id);
            if (copy) { App.toast('Capítulo duplicado.'); renderChapters(); }
          } else if (act === 'status') {
            App.chapterStatusModal(ch, renderChapters);
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
  }

  App.renderChapters = renderChapters;

  App.addChapter = async function () {
    if (!App.book) return;
    const n = (await Store.Chapters.listByBook(App.book.id)).length + 1;
    const ch = await Store.Chapters.create(App.book.id, 'Capítulo ' + n);
    await App.openChapter(ch.id);
    const titleInput = $('#chapter-title');
    titleInput.select();
  };

  App.openChapter = async function (id, opts) {
    await Editor.open(id, opts);
  };

  /* ================= busca global ================= */

  App.searchModal = function () {
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
  };

  /* ================= lixeira ================= */

  App.trashModal = async function () {
    const items = await Store.Trash.list();
    const body = el('div');

    if (!items.length) {
      body.appendChild(el('p', 'muted', 'A lixeira está vazia. Itens excluídos aparecem aqui e podem ser restaurados.'));
    }

    items.forEach(function (entry) {
      const row = el('div', 'trash-item');
      const isBook = entry.type === 'book';
      const title = isBook ? entry.item.title : entry.item.title;
      const when = new Date(entry.deletedAt).toLocaleString('pt-BR');
      const meta = isBook
        ? 'Livro com ' + (entry.chapters || []).length + ' capítulo(s) · excluído em ' + when
        : 'Capítulo · excluído em ' + when;

      row.innerHTML =
        '<div class="ti-main"><div class="ti-title">' + icon(isBook ? 'book' : 'file-text') + esc(title) + '</div>' +
        '<div class="ti-meta">' + esc(meta) + '</div></div>';

      const restoreBtn = el('button', 'btn small', 'Restaurar');
      restoreBtn.addEventListener('click', async function () {
        const ok = await Store.Trash.restore(entry);
        if (ok) { App.toast('Item restaurado.'); App.trashModal(); App.renderShelf(); if (App.book) App.renderChapters(); }
        else App.toast('Não foi possível restaurar (crie um livro antes).', 'error');
      });

      const delBtn = el('button', 'btn small danger', 'Excluir');
      delBtn.addEventListener('click', async function () {
        const ok = await App.confirm('Excluir definitivamente "' + title + '"? Esta ação não pode ser desfeita.', { okLabel: 'Excluir', danger: true });
        if (ok) { await Store.Trash.remove(entry.id); App.trashModal(); }
      });

      row.appendChild(restoreBtn);
      row.appendChild(delBtn);
      body.appendChild(row);
    });

    const actions = [{ label: 'Fechar' }];
    if (items.length) {
      actions.push({
        label: 'Esvaziar lixeira',
        className: 'danger',
        onClick: async function (close) {
          const ok = await App.confirm('Esvaziar a lixeira apaga todos os itens permanentemente. Continuar?', { okLabel: 'Esvaziar', danger: true });
          if (ok) { await Store.Trash.empty(); close(); App.toast('Lixeira esvaziada.'); }
          else App.trashModal();
          return false;
        }
      });
    }

    App.openModal({ title: '<span>' + icon('trash') + ' Lixeira</span>', body: body, actions: actions, wide: true });
  };

  /* ================= tema ================= */

  App.applyTheme = function () {
    const theme = Store.Settings.get('theme', 'light');
    document.documentElement.setAttribute('data-theme', theme);
    const themeBtn = $('#btn-theme');
    if (themeBtn) {
      themeBtn.querySelector('use') && (themeBtn.querySelector('use').setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon'));
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
    const meta = document.getElementById('meta-theme-color');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#09090b' : '#fafafa');
  };

  /* ================= configurações ================= */

  App.settingsModal = function () {
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
  };

  /* ================= eventos ================= */

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
    $('#shelf-search').addEventListener('input', function () { App.renderShelf(); });
    $('#shelf-filter').addEventListener('change', function () { App.renderShelf(); });

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
    });

    // topbar
    $('#btn-global-search').addEventListener('click', function () { App.searchModal(); });
    $('#btn-trash-open').addEventListener('click', function () { App.trashModal(); });
    $('#btn-settings-open').addEventListener('click', function () { App.settingsModal(); });
    $('#btn-theme').addEventListener('click', async function () {
      const next = Store.Settings.get('theme', 'light') === 'dark' ? 'light' : 'dark';
      await Store.Settings.set('theme', next);
      App.applyTheme();
    });

    // atalho de busca
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        App.searchModal();
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
