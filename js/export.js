/* ============================================================
   export.js — exportação de TXT, Word (.doc), PDF (impressão do
   navegador) e backup completo em JSON (exportar/importar).
   ============================================================ */
const Exporter = (function () {
  'use strict';

  const numberFmt = new Intl.NumberFormat('pt-BR');

  /* ---------------- utilitários ---------------- */

  function sanitizeFilename(s) {
    return String(s || 'sem-titulo')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sem-titulo';
  }

  function todayStamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* converte o conteúdo de um capítulo em HTML de parágrafos
     (linhas "----" viram quebras de página) */
  function contentToHtml(content, pagebreakClass) {
    const blocks = (content || '').split(/\n{2,}/);
    return blocks.map(function (block) {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^-{3,}$/.test(trimmed)) {
        return '<hr class="' + (pagebreakClass || 'pagebreak') + '">';
      }
      const inner = esc(trimmed).replace(/\n/g, '<br>');
      return '<p>' + inner + '</p>';
    }).join('\n');
  }

  /* ---------------- texto (TXT) ---------------- */

  function bookToText(book, chapters) {
    const lines = [];
    lines.push(book.title.toUpperCase());
    if (book.author) lines.push('por ' + book.author);
    if (book.description) lines.push('', book.description);
    lines.push('', '');
    chapters.forEach(function (ch, i) {
      lines.push('='.repeat(60));
      lines.push('CAPÍTULO ' + (i + 1) + (ch.title ? ': ' + ch.title : ''));
      lines.push('='.repeat(60));
      lines.push('');
      lines.push((ch.content || '').trim());
      lines.push('', '');
    });
    return lines.join('\n');
  }

  function chapterToText(chapter, book, index) {
    const lines = [];
    lines.push(chapter.title || 'Sem título');
    if (book && book.title) lines.push('de ' + book.title + (book.author ? ' — ' + book.author : ''));
    lines.push('', (chapter.content || '').trim(), '');
    return lines.join('\n');
  }

  /* ---------------- HTML compartilhado (Word/PDF) ---------------- */

  function bookToHtml(book, chapters, opts) {
    opts = opts || {};
    const parts = [];

    // folha de rosto
    parts.push('<div class="titlepage">');
    parts.push('<h1 class="book-title">' + esc(book.title) + '</h1>');
    if (book.author) parts.push('<p class="book-author">por ' + esc(book.author) + '</p>');
    if (book.description) parts.push('<p class="book-desc">' + esc(book.description).replace(/\n/g, '<br>') + '</p>');
    parts.push('</div>');

    // sumário
    parts.push('<div class="toc' + (opts.print ? ' pagebreak' : '') + '"><h2>Sumário</h2><ol class="toc-list">');
    chapters.forEach(function (ch, i) {
      parts.push('<li>' + esc(ch.title || 'Capítulo ' + (i + 1)) + '</li>');
    });
    parts.push('</ol></div>');

    // capítulos
    chapters.forEach(function (ch, i) {
      parts.push('<section class="chapter' + (opts.print ? ' pagebreak' : '') + '">');
      parts.push('<h2 class="chapter-title">' + (i + 1) + '. ' + esc(ch.title || 'Sem título') + '</h2>');
      parts.push(contentToHtml(ch.content));
      parts.push('</section>');
    });

    return parts.join('\n');
  }

  function chapterToHtml(chapter, book) {
    const parts = [];
    parts.push('<h1 class="book-title">' + esc(chapter.title || 'Sem título') + '</h1>');
    if (book && book.title) {
      parts.push('<p class="book-author">de ' + esc(book.title) + (book.author ? ' — ' + esc(book.author) : '') + '</p>');
    }
    parts.push(contentToHtml(chapter.content));
    return parts.join('\n');
  }

  const BASE_STYLES =
    'body{font-family:Georgia,"Times New Roman",serif;font-size:12pt;line-height:1.6;' +
    'text-align:justify;margin:0;widows:2;orphans:2}' +
    '.titlepage{text-align:center;margin-top:28%;page-break-after:always}' +
    '.book-title{font-size:26pt;font-weight:bold;margin:0 0 18pt;}' +
    '.book-author{font-size:13pt;color:#444;margin:0 0 8pt}' +
    '.book-desc{font-size:11pt;color:#555;font-style:italic;max-width:80%;margin:18pt auto}' +
    '.toc{page-break-after:always}' +
    '.toc h2,.chapter-title{text-align:center}' +
    '.toc-list{font-size:12pt;line-height:2}' +
    '.chapter{page-break-before:always}' +
    '.chapter-title{font-size:16pt;margin:0 0 24pt}' +
    '.chapter p{margin:0 0 8pt;text-indent:1.25cm}' +
    '.chapter p:first-of-type{text-indent:0}' +
    '.pagebreak{page-break-after:always}';

  /* ---------------- Word (.doc) ---------------- */

  function downloadDoc(filename, innerHtml, title) {
    const html =
      '<!DOCTYPE html>' +
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>@page{size:A4;margin:2.5cm} ' + BASE_STYLES + '</style></head>' +
      '<body>' + innerHtml + '</body></html>';
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    downloadBlob(blob, filename);
  }

  /* ---------------- PDF (impressão do navegador) ---------------- */

  function printPdf(filenameBase, innerHtml, title) {
    const w = window.open('', '_blank');
    if (!w) {
      App.toast('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.', 'error');
      return;
    }
    w.document.write(
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<title>' + esc(title) + '</title><style>' +
      '@page{size:A4;margin:2.2cm}' +
      BASE_STYLES +
      'body{background:#fff}' +
      '</style></head><body>' + innerHtml +
      '</body></html>'
    );
    w.document.close();
    w.focus();
    const tryPrint = function () {
      try { w.print(); } catch (e) { /* navegador fechou */ }
    };
    if (w.document.readyState === 'complete') setTimeout(tryPrint, 350);
    else w.onload = function () { setTimeout(tryPrint, 350); };
    App.toast('Escolha "Salvar como PDF" na janela de impressão.');
  }

  /* ---------------- diálogos de exportação ---------------- */

  async function exportDialog(opts) {
    // opts: {title, filenameBase, html, text, pdfTitle}
    const body = App.el('div');
    body.innerHTML =
      '<p class="muted" style="margin-top:0">Escolha o formato:</p>' +
      '<div class="row" style="flex-wrap:wrap">' +
      '<button class="btn" data-fmt="txt">' + App.icon('file-text') + ' TXT</button>' +
      '<button class="btn" data-fmt="doc">' + App.icon('edit') + ' Word (.doc)</button>' +
      '<button class="btn" data-fmt="pdf">' + App.icon('download') + ' PDF (imprimir)</button>' +
      '</div>' +
      '<p class="muted" style="font-size:.8rem;margin-bottom:0">O PDF é gerado pela janela de impressão do navegador — escolha "Salvar como PDF".</p>';

    const m = App.openModal({ title: '<span>' + App.icon('download') + ' Exportar — ' + App.esc(opts.title) + '</span>', body: body });
    body.querySelectorAll('[data-fmt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const fmt = btn.getAttribute('data-fmt');
        if (fmt === 'txt') {
          downloadBlob(new Blob([opts.text], { type: 'text/plain;charset=utf-8' }), opts.filenameBase + '.txt');
          App.toast('Arquivo TXT gerado.');
        } else if (fmt === 'doc') {
          downloadDoc(opts.filenameBase + '.doc', opts.html, opts.title);
          App.toast('Arquivo Word gerado.');
        } else if (fmt === 'pdf') {
          printPdf(opts.filenameBase, opts.html, opts.pdfTitle || opts.title);
        }
        m.close();
      });
    });
  }

  async function bookDialog(book) {
    const chapters = await Store.Chapters.listByBook(book.id);
    if (!chapters.length) {
      App.toast('Este livro ainda não tem capítulos para exportar.', 'error');
      return;
    }
    exportDialog({
      title: book.title,
      filenameBase: sanitizeFilename(book.title) + '-' + todayStamp(),
      text: bookToText(book, chapters),
      html: bookToHtml(book, chapters, { print: true }),
      pdfTitle: book.title
    });
  }

  async function chapterDialog(chapter) {
    const book = App.book && App.book.id === chapter.bookId ? App.book : await Store.Books.get(chapter.bookId);
    const chapters = await Store.Chapters.listByBook(chapter.bookId);
    const idx = chapters.findIndex(function (c) { return c.id === chapter.id; });
    const name = sanitizeFilename((book ? book.title + '-' : '') + (chapter.title || 'capitulo'));
    exportDialog({
      title: chapter.title,
      filenameBase: name + '-' + todayStamp(),
      text: chapterToText(chapter, book, idx),
      html: chapterToHtml(chapter, book),
      pdfTitle: chapter.title
    });
  }

  /* ---------------- backup JSON ---------------- */

  async function exportBackup() {
    const books = await Store.raw.getAll('books');
    const chapters = await Store.raw.getAll('chapters');
    const trash = await Store.raw.getAll('trash');
    const settings = Object.assign({}, Store.Settings.cache);
    delete settings.aiKey; // por segurança, a chave de API não vai no backup

    const data = {
      app: 'Autor',
      version: 1,
      exportedAt: new Date().toISOString(),
      books: books,
      chapters: chapters,
      trash: trash,
      settings: settings
    };
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'backup-autor-' + todayStamp() + '.json'
    );
    App.toast('Backup exportado (' + books.length + ' livro(s), ' + chapters.length + ' capítulo(s)).');
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () { handleImport(reader.result); };
      reader.onerror = function () { App.toast('Não foi possível ler o arquivo.', 'error'); };
      reader.readAsText(file);
    });
    input.click();
  }

  async function handleImport(raw) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      App.toast('Arquivo inválido: não é um JSON válido.', 'error');
      return;
    }
    if (!data || data.app !== 'Autor' || !Array.isArray(data.books) || !Array.isArray(data.chapters)) {
      App.toast('Arquivo inválido: não parece ser um backup do Autor.', 'error');
      return;
    }

    const body = App.el('div');
    body.innerHTML =
      '<p><strong>' + data.books.length + '</strong> livro(s) e <strong>' + data.chapters.length +
      '</strong> capítulo(s) encontrados no backup.</p>' +
      '<p class="muted">O que deseja fazer?</p>';

    const m = App.openModal({
      title: '<span>' + App.icon('upload') + ' Importar backup</span>',
      body: body,
      actions: [{ label: 'Cancelar' }]
    });

    const addBtn = App.el('button', 'btn primary', 'Adicionar aos meus');
    addBtn.addEventListener('click', async function () {
      m.close();
      await mergeImport(data);
    });
    m.modal.querySelector('.modal-actions').appendChild(addBtn);

    const replaceBtn = App.el('button', 'btn danger', 'Substituir tudo');
    replaceBtn.addEventListener('click', async function () {
      const ok = await App.confirm('Isso APAGA tudo o que existe hoje e substitui pelo backup. Continuar?', { okLabel: 'Substituir', danger: true });
      if (!ok) return;
      m.close();
      await replaceImport(data);
    });
    m.modal.querySelector('.modal-actions').appendChild(replaceBtn);
  }

  async function replaceImport(data) {
    await Store.raw.clear('books');
    await Store.raw.clear('chapters');
    await Store.raw.clear('trash');
    for (let i = 0; i < data.books.length; i++) await Store.raw.put('books', data.books[i]);
    for (let i = 0; i < data.chapters.length; i++) await Store.raw.put('chapters', data.chapters[i]);
    for (let i = 0; i < (data.trash || []).length; i++) await Store.raw.put('trash', data.trash[i]);
    if (data.settings) {
      for (const key of Object.keys(data.settings)) {
        if (key !== 'aiKey') await Store.Settings.set(key, data.settings[key]);
      }
    }
    App.toast('Backup restaurado.');
    setTimeout(function () { location.reload(); }, 600);
  }

  async function mergeImport(data) {
    const existingBooks = new Set((await Store.raw.getAll('books')).map(function (b) { return b.id; }));
    const existingChapters = new Set((await Store.raw.getAll('chapters')).map(function (c) { return c.id; }));
    const idMap = {}; // id antigo → id novo (para livros importados com conflito)
    let addedBooks = 0, addedChapters = 0, skipped = 0;

    for (let i = 0; i < data.books.length; i++) {
      let b = Object.assign({}, data.books[i]);
      if (existingBooks.has(b.id) || idMap[b.id]) {
        const newId = Store.uuid();
        idMap[b.id] = newId;
        b.id = newId;
      }
      idMap[data.books[i].id] = b.id;
      await Store.raw.put('books', b);
      addedBooks++;
    }

    for (let i = 0; i < data.chapters.length; i++) {
      let c = Object.assign({}, data.chapters[i]);
      const realBookId = idMap[c.bookId] || c.bookId;
      if (!existingBooks.has(realBookId) && !idMap[c.bookId]) { skipped++; continue; } // órfão
      c.bookId = realBookId;
      if (existingChapters.has(c.id)) c.id = Store.uuid();
      await Store.raw.put('chapters', c);
      addedChapters++;
    }

    App.toast('Importados: ' + addedBooks + ' livro(s), ' + addedChapters + ' capítulo(s)' +
      (skipped ? ' (' + skipped + ' órfão(s) ignorado(s))' : '') + '.');
    App.renderShelf();
  }

  const api = {
    bookDialog: bookDialog,
    chapterDialog: chapterDialog,
    exportBackup: exportBackup,
    importBackup: importBackup
  };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Exporter = api;

  return api;
})();
