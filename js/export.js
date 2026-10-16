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
     (linhas "----" viram quebras de página; o alinhamento vem do marcador
     de parágrafo ou do padrão do capítulo) */
  function contentToHtml(content, pagebreakClass, chapterAlign) {
    const base = chapterAlign || 'j';
    const cblocks = Content.parse(content || '', base);
    return cblocks.map(function (b) {
      if (b.type === 'rule') {
        return '<hr class="' + (pagebreakClass || 'pagebreak') + '">';
      }
      const align = Content.css(b.align || base);
      const inner = esc(String(b.text == null ? '' : b.text)).replace(/\n/g, '<br>');
      return '<p style="text-align:' + align + '">' + inner + '</p>';
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
      lines.push(Content.toExport(ch.content || '', ch.align || 'j').trim());
      lines.push('', '');
    });
    return lines.join('\n');
  }

  function chapterToText(chapter, book, index) {
    const lines = [];
    lines.push(chapter.title || 'Sem título');
    if (book && book.title) lines.push('de ' + book.title + (book.author ? ' — ' + book.author : ''));
    lines.push('', Content.toExport(chapter.content || '', chapter.align || 'j').trim(), '');
    return lines.join('\n');
  }

  /* ---------------- HTML compartilhado (Word/PDF) ---------------- */

  function bookToHtml(book, chapters, opts) {
    opts = opts || {};
    const parts = [];

    // folha de rosto
    parts.push('<div class="titlepage' + (book.cover ? ' has-cover' : '') + '">');
    if (book.cover) parts.push('<img class="cover" src="' + esc(book.cover) + '" alt="">');
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
      if (ch.cover) parts.push('<img class="cover" src="' + esc(ch.cover) + '" alt="">');
      parts.push('<h2 class="chapter-title">' + (i + 1) + '. ' + esc(ch.title || 'Sem título') + '</h2>');
      parts.push(contentToHtml(ch.content, null, ch.align));
      parts.push('</section>');
    });

    return parts.join('\n');
  }

  function chapterToHtml(chapter, book) {
    const parts = [];
    if (chapter.cover) parts.push('<img class="cover" src="' + esc(chapter.cover) + '" alt="">');
    parts.push('<h1 class="book-title">' + esc(chapter.title || 'Sem título') + '</h1>');
    if (book && book.title) {
      parts.push('<p class="book-author">de ' + esc(book.title) + (book.author ? ' — ' + esc(book.author) : '') + '</p>');
    }
    parts.push(contentToHtml(chapter.content, null, chapter.align));
    return parts.join('\n');
  }

  /* ---------------- Markdown ---------------- */

  function contentToMarkdown(content, chapterAlign) {
    const base = chapterAlign || 'j';
    return Content.parse(content || '', base).map(function (b) {
      if (b.type === 'rule') return '---';
      return String(b.text == null ? '' : b.text);
    }).join('\n\n');
  }

  function bookToMarkdown(book, chapters) {
    const lines = [];
    lines.push('# ' + (book.title || 'Sem título'));
    if (book.author) lines.push('', '*por ' + book.author + '*');
    if (book.description) lines.push('', book.description);
    chapters.forEach(function (ch, i) {
      lines.push('', '## ' + (i + 1) + '. ' + (ch.title || 'Sem título'), '');
      lines.push(contentToMarkdown(ch.content, ch.align));
    });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function chapterToMarkdown(chapter, book) {
    const lines = [];
    lines.push('# ' + (chapter.title || 'Sem título'));
    if (book && book.title) lines.push('', 'de ' + book.title + (book.author ? ' — ' + book.author : ''));
    lines.push('', contentToMarkdown(chapter.content, chapter.align));
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  /* ---------------- EPUB ---------------- */

  function contentToXhtml(content, chapterAlign) {
    const base = chapterAlign || 'j';
    return Content.parse(content || '', base).map(function (b) {
      if (b.type === 'rule') return '<hr class="pagebreak"/>';
      const align = Content.css(b.align || base);
      const inner = esc(String(b.text == null ? '' : b.text)).replace(/\n/g, '<br/>');
      return '<p style="text-align:' + align + '">' + inner + '</p>';
    }).join('\n');
  }

  function dataUrlToBytes(dataUrl) {
    const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/i.exec(String(dataUrl || ''));
    if (!m) return null;
    const mime = m[1];
    let bin;
    try {
      bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
    } catch (e) { return null; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = /png/i.test(mime) ? 'png' : /gif/i.test(mime) ? 'gif' : /svg/i.test(mime) ? 'svg' : 'jpg';
    return { mime: mime, ext: ext, bytes: bytes };
  }

  function xhtmlDoc(title, bodyHtml) {
    return '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<!DOCTYPE html>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR" lang="pt-BR">\n' +
      '<head><meta charset="utf-8"/><title>' + esc(title) + '</title>' +
      '<link rel="stylesheet" type="text/css" href="style.css"/></head>\n' +
      '<body>\n' + bodyHtml + '\n</body></html>';
  }

  const EPUB_CSS =
    'body{font-family:Georgia,"Times New Roman",serif;line-height:1.6;text-align:justify;margin:4%}' +
    'h1{font-size:1.5em;text-align:center;margin:1.4em 0}' +
    'p{margin:0 0 .7em;text-indent:1.25em}' +
    'p:first-of-type{text-indent:0}' +
    'hr.pagebreak{border:none;border-top:1px solid #ccc;margin:1.6em 0}' +
    '.cover{text-align:center;margin:0 0 1.4em}.cover img{max-width:100%;max-height:80vh}';

  function buildEpub(book, chapters) {
    const zip = window.Autor.zip;
    const files = [];
    const manifest = [];
    const spine = [];

    const uid = 'urn:uuid:' + (book.id || 'autor');
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    // capa (imagem + página de capa)
    let hasCoverPage = false;
    if (book.cover) {
      const img = dataUrlToBytes(book.cover);
      if (img) {
        files.push({ name: 'OEBPS/cover.' + img.ext, data: img.bytes });
        manifest.push('<item id="cover-img" href="cover.' + img.ext + '" media-type="' + img.mime + '" properties="cover-image"/>');
        files.push({ name: 'OEBPS/cover.xhtml', data: xhtmlDoc(book.title, '<div class="cover"><img src="cover.' + img.ext + '" alt="Capa"/></div>') });
        manifest.push('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>');
        spine.push('<itemref idref="cover"/>');
        hasCoverPage = true;
      }
    }

    // capítulos
    const navItems = [];
    chapters.forEach(function (ch, i) {
      const n = i + 1;
      const name = 'chapter' + n + '.xhtml';
      let body = '';
      if (ch.cover) {
        const img = dataUrlToBytes(ch.cover);
        if (img) {
          const iname = 'ch' + n + '.' + img.ext;
          files.push({ name: 'OEBPS/' + iname, data: img.bytes });
          manifest.push('<item id="img' + n + '" href="' + iname + '" media-type="' + img.mime + '"/>');
          body += '<div class="cover"><img src="' + iname + '" alt=""/></div>\n';
        }
      }
      body += '<h1>' + esc(ch.title || 'Sem título') + '</h1>\n' + contentToXhtml(ch.content, ch.align);
      files.push({ name: 'OEBPS/' + name, data: xhtmlDoc(ch.title || 'Capítulo ' + n, body) });
      manifest.push('<item id="ch' + n + '" href="' + name + '" media-type="application/xhtml+xml"/>');
      spine.push('<itemref idref="ch' + n + '"/>');
      navItems.push('<li><a href="' + name + '">' + esc(ch.title || 'Capítulo ' + n) + '</a></li>');
    });

    // estilos e sumário de navegação
    files.push({ name: 'OEBPS/style.css', data: EPUB_CSS });

    const navBody = '<nav epub:type="toc" id="toc"><h1>Sumário</h1><ol>\n' + navItems.join('\n') + '\n</ol></nav>';
    const navDoc = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n' +
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR">\n' +
      '<head><meta charset="utf-8"/><title>Sumário</title></head>\n<body>\n' + navBody + '\n</body></html>';
    files.push({ name: 'OEBPS/nav.xhtml', data: navDoc });
    manifest.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
    manifest.push('<item id="css" href="style.css" media-type="text/css"/>');

    // pacote
    const opf =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="pt-BR">\n' +
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '<dc:identifier id="bookid">' + esc(uid) + '</dc:identifier>\n' +
      '<dc:title>' + esc(book.title || 'Sem título') + '</dc:title>\n' +
      '<dc:language>pt-BR</dc:language>\n' +
      (book.author ? '<dc:creator>' + esc(book.author) + '</dc:creator>\n' : '') +
      (book.description ? '<dc:description>' + esc(book.description) + '</dc:description>\n' : '') +
      '<meta property="dcterms:modified">' + modified + '</meta>\n' +
      '</metadata>\n' +
      '<manifest>\n' + manifest.join('\n') + '\n</manifest>\n' +
      '<spine' + (hasCoverPage ? '' : '') + '>\n' + spine.join('\n') + '\n</spine>\n' +
      '</package>';
    files.push({ name: 'OEBPS/content.opf', data: opf });

    const container =
      '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n' +
      '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n' +
      '</container>';
    files.push({ name: 'META-INF/container.xml', data: container });

    // o mimetype precisa ser a primeira entrada e não comprimida
    files.unshift({ name: 'mimetype', data: 'application/epub+zip' });

    return zip.zipWrite(files);
  }

  const BASE_STYLES =
    'body{font-family:Georgia,"Times New Roman",serif;font-size:12pt;line-height:1.6;' +
    'text-align:justify;margin:0;widows:2;orphans:2}' +
    '.titlepage{text-align:center;margin-top:28%;page-break-after:always}' +
    '.titlepage.has-cover{margin-top:6%}' +
    '.book-title{font-size:26pt;font-weight:bold;margin:0 0 18pt;}' +
    '.cover{display:block;width:auto;max-width:55%;max-height:44vh;object-fit:contain;margin:0 auto 22pt}' +
    '.titlepage .cover{margin-bottom:26pt}' +
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
    // opts: {title, filenameBase, html, text, markdown, epub, pdfTitle}
    const body = App.el('div');
    const mdBtn = opts.markdown != null
      ? '<button class="btn" data-fmt="md">' + App.icon('file-text') + ' Markdown (.md)</button>' : '';
    const epubBtn = opts.epub
      ? '<button class="btn" data-fmt="epub">' + App.icon('book-open') + ' EPUB (.epub)</button>' : '';
    body.innerHTML =
      '<p class="muted" style="margin-top:0">Escolha o formato:</p>' +
      '<div class="row" style="flex-wrap:wrap">' +
      '<button class="btn" data-fmt="txt">' + App.icon('file-text') + ' TXT</button>' +
      mdBtn +
      '<button class="btn" data-fmt="doc">' + App.icon('edit') + ' Word (.doc)</button>' +
      epubBtn +
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
        } else if (fmt === 'md') {
          downloadBlob(new Blob([opts.markdown], { type: 'text/markdown;charset=utf-8' }), opts.filenameBase + '.md');
          App.toast('Arquivo Markdown gerado.');
        } else if (fmt === 'doc') {
          downloadDoc(opts.filenameBase + '.doc', opts.html, opts.title);
          App.toast('Arquivo Word gerado.');
        } else if (fmt === 'epub') {
          try {
            downloadBlob(opts.epub(), opts.filenameBase + '.epub');
            App.toast('Arquivo EPUB gerado.');
          } catch (err) {
            App.toast(err.message || 'Não foi possível gerar o EPUB.', 'error');
          }
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
    const base = sanitizeFilename(book.title) + '-' + todayStamp();
    exportDialog({
      title: book.title,
      filenameBase: base,
      text: bookToText(book, chapters),
      markdown: bookToMarkdown(book, chapters),
      html: bookToHtml(book, chapters, { print: true }),
      epub: function () { return buildEpub(book, chapters); },
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
      markdown: chapterToMarkdown(chapter, book),
      html: chapterToHtml(chapter, book),
      pdfTitle: chapter.title
    });
  }

  /* ---------------- backup JSON ---------------- */

  async function exportBackup() {
    const books = await Store.raw.getAll('books');
    const chapters = await Store.raw.getAll('chapters');
    const trash = await Store.raw.getAll('trash');
    const settings = Autor.merge.stripSecrets(Object.assign({}, Store.Settings.cache));

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

  /* documento do app (mesmo formato do backup) — usado pelo sync */
  async function snapshot() {
    return {
      app: 'Autor',
      version: 1,
      exportedAt: new Date().toISOString(),
      books: await Store.raw.getAll('books'),
      chapters: await Store.raw.getAll('chapters'),
      trash: await Store.raw.getAll('trash'),
      settings: Autor.merge.stripSecrets(Object.assign({}, Store.Settings.cache))
    };
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
        if (Autor.merge.SECRET_KEYS.indexOf(key) !== -1) continue;
        await Store.Settings.set(key, data.settings[key]);
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
    importBackup: importBackup,
    snapshot: snapshot,
    mergeImport: mergeImport,
    replaceImport: replaceImport,
    /* puros (testáveis) */
    bookToMarkdown: bookToMarkdown,
    chapterToMarkdown: chapterToMarkdown,
    buildEpub: buildEpub
  };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Exporter = api;
  window.Autor = window.Autor || {};
  window.Autor.exporter = api;

  return api;
})();
