/* ============================================================
   import.js — importação de manuscritos externos.

   Formatos: .txt, .md/.markdown (texto simples e Markdown) e .docx
   (lê o XML interno via Autor.zip). Também aceita .epub com um único
   fluxo de texto simples (sem capítulos internos).

   Os analisadores são puros (recebem string/buffer e devolvem
   { title, chapters:[{title, content}] }) para poderem ser testados.
   O texto entra no Content model canônico (parágrafos separados por
   linha em branco), então o alinhamento padrão do capítulo é 'j'.
   ============================================================ */
window.Autor = window.Autor || {};

const Importer = (function () {
  'use strict';

  /* ---------------- limpeza de marcações inline ---------------- */

  function cleanInline(s) {
    return String(s == null ? '' : s)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1$2')
      .replace(/(^|[^_])_([^_\s][^_]*?)_/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .trim();
  }

  function titleFromFilename(name) {
    return String(name || '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Texto importado';
  }

  function isRule(line) {
    return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  }

  /* acumula linhas soltas num único parágrafo e fecha nos vazios */
  function ParagraphBuilder() {
    const blocks = [];
    let buf = [];
    function flush() {
      if (buf.length) { blocks.push({ type: 'para', text: buf.join(' ') }); buf = []; }
    }
    return {
      addPara: function (text) { flush(); blocks.push({ type: 'para', text: cleanInline(text) }); },
      addRule: function () { flush(); blocks.push({ type: 'rule' }); },
      /* `raw` evita mexer em marcações que não são Markdown (texto simples) */
      addLine: function (line, raw) {
        const t = String(line == null ? '' : line);
        if (!t.trim()) { flush(); return; } // linha vazia fecha o parágrafo
        buf.push(raw ? t.trim() : cleanInline(t));
      },
      finish: function () {
        flush();
        return blocks.map(function (b) { return b.type === 'rule' ? '---' : b.text; }).join('\n\n');
      }
    };
  }

  /* ---------------- Markdown ---------------- */

  function parseMarkdown(text, fallbackTitle) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const chapters = [];
    let bookTitle = fallbackTitle || 'Texto importado';
    let current = null;
    let sawTitle = false;
    let builder = ParagraphBuilder();

    function closeChapter() {
      if (current == null) return;
      chapters.push({ title: current, content: builder.finish() });
      builder = ParagraphBuilder();
    }

    lines.forEach(function (line) {
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (heading) {
        const title = cleanInline(heading[2]) || 'Capítulo ' + (chapters.length + 1);
        if (heading[1].length === 1 && !sawTitle) {
          bookTitle = title || bookTitle;
          sawTitle = true;
          return;
        }
        closeChapter();
        current = title;
        return;
      }
      if (isRule(line)) { builder.addRule(); return; }
      if (!line.trim()) { builder.addLine(''); return; }
      if (current == null) current = bookTitle;
      const item = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/);
      if (item) builder.addPara(item[1]);
      else builder.addLine(line);
    });

    closeChapter();
    if (!chapters.length) {
      chapters.push({ title: bookTitle, content: cleanInline(String(text || '').trim()) });
    }
    return { title: bookTitle, chapters: chapters };
  }

  /* ---------------- Texto simples (.txt) ---------------- */

  function parsePlainText(text, fallbackTitle) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const chapters = [];
    let current = null;
    let builder = ParagraphBuilder();
    const headingRe = /^\s*(cap[ií]tulo|chapter)\b[^\n]{0,80}$/i;

    function closeChapter() {
      if (current == null) return;
      chapters.push({ title: current, content: builder.finish() });
      builder = ParagraphBuilder();
    }

    lines.forEach(function (line) {
      if (headingRe.test(line) && line.trim().length <= 80) {
        closeChapter();
        current = line.trim();
        return;
      }
      if (isRule(line)) { builder.addRule(); return; }
      if (!line.trim()) { builder.addLine(''); return; }
      if (current == null) current = fallbackTitle || 'Capítulo 1';
      builder.addLine(line, true);
    });

    closeChapter();
    if (!chapters.length) {
      chapters.push({ title: fallbackTitle || 'Texto importado', content: String(text || '').trim() });
    }
    return { title: fallbackTitle || 'Texto importado', chapters: chapters };
  }

  /* ---------------- DOCX ---------------- */

  function decodeXml(s) {
    return String(s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCodePoint(Number(n)); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) { return String.fromCodePoint(parseInt(n, 16)); })
      .replace(/&amp;/g, '&');
  }

  function paragraphText(xml) {
    let out = '';
    const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:br\b[^>]*\/?>|<w:tab\b[^>]*\/?>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      if (/^<w:t\b/.test(m[0])) out += decodeXml(m[1]);
      else if (/^<w:br/.test(m[0])) out += '\n';
      else out += '\t';
    }
    return out;
  }

  /* extrai os parágrafos de word/document.xml, em ordem */
  function docxXmlToParagraphs(xml) {
    const paras = [];
    const re = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const inner = m[1] || '';
      const text = paragraphText(inner);
      paras.push(text);
    }
    return paras;
  }

  function paragraphsToContent(paras) {
    const blocks = [];
    paras.forEach(function (p) {
      const text = String(p == null ? '' : p).replace(/\s+$/, '');
      if (!text.trim()) return;
      if (isRule(text)) { blocks.push('---'); return; }
      blocks.push(text.replace(/\n+/g, ' ').trim());
    });
    return blocks.join('\n\n');
  }

  function docxXmlToDoc(xml, fallbackTitle) {
    const paras = docxXmlToParagraphs(xml);
    // usa o primeiro parágrafo como título se o nome do arquivo não ajudar
    let title = fallbackTitle || 'Documento importado';
    return { title: title, chapters: [{ title: title, content: paragraphsToContent(paras) }] };
  }

  async function docxToDoc(buffer, fallbackTitle) {
    const entries = await Autor.zip.zipRead(buffer);
    const map = Autor.zip.entriesToMap(entries);
    const bytes = map['word/document.xml'];
    if (!bytes) throw new Error('DOCX inválido: não encontrei o conteúdo do documento.');
    return docxXmlToDoc(Autor.zip.decodeText(bytes), fallbackTitle);
  }

  /* ---------------- EPUB (texto simples) ---------------- */

  async function epubToDoc(buffer, fallbackTitle) {
    const entries = await Autor.zip.zipRead(buffer);
    // junta os arquivos .xhtml/.html em ordem alfabética (aproxima a ordem de leitura)
    const pages = entries
      .filter(function (e) { return /\.x?html?$/i.test(e.name); })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    const parts = [];
    for (let i = 0; i < pages.length; i++) {
      parts.push(htmlToText(Autor.zip.decodeText(pages[i].data)));
    }
    const content = paragraphsToContent(parts.join('\n\n').split('\n'));
    return { title: fallbackTitle || 'Livro importado', chapters: [{ title: fallbackTitle || 'Livro importado', content: content }] };
  }

  /* converte HTML em texto simples preservando parágrafos */
  function htmlToText(html) {
    return String(html || '')
      .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi, '')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|h[1-6]|li)\s*>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* ---------------- leitura de arquivo ---------------- */

  function readAsText(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
      r.readAsText(file);
    });
  }

  function readAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
      r.readAsArrayBuffer(file);
    });
  }

  async function parseFile(file) {
    const name = file.name || '';
    const fallback = titleFromFilename(name);
    const ext = (name.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();

    if (ext === 'docx') return docxToDoc(await readAsArrayBuffer(file), fallback);
    if (ext === 'epub') return epubToDoc(await readAsArrayBuffer(file), fallback);
    if (ext === 'html' || ext === 'htm') {
      return { title: fallback, chapters: [{ title: fallback, content: paragraphsToContent(htmlToText(await readAsText(file)).split('\n')) }] };
    }
    if (ext === 'md' || ext === 'markdown') return parseMarkdown(await readAsText(file), fallback);
    return parsePlainText(await readAsText(file), fallback);
  }

  /* ---------------- criação no app ---------------- */

  function docStats(doc) {
    let words = 0;
    doc.chapters.forEach(function (c) { words += Content.countWords(c.content || ''); });
    return { chapters: doc.chapters.length, words: words };
  }

  async function createFromDoc(doc, opts) {
    opts = opts || {};
    let book;
    if (opts.bookId) {
      book = await Store.Books.get(opts.bookId);
      if (!book) throw new Error('Obra de destino não encontrada.');
    } else {
      book = await Store.Books.create({
        title: opts.title || doc.title,
        author: opts.author || ''
      });
    }
    const existing = await Store.Chapters.listByBook(book.id);
    let order = existing.length;
    for (let i = 0; i < doc.chapters.length; i++) {
      const ch = await Store.Chapters.create(book.id, doc.chapters[i].title);
      ch.content = doc.chapters[i].content || '';
      ch.order = order++;
      await Store.Chapters.save(ch);
    }
    return book;
  }

  /* ---------------- interface ---------------- */

  async function preview(doc, fileName) {
    const stats = docStats(doc);
    const books = await Store.Books.list();

    const body = App.el('div');
    body.innerHTML =
      '<p class="hint" style="margin-top:0">Encontrei <strong>' + stats.chapters + '</strong> capítulo(s) e <strong>' +
      Number(stats.words).toLocaleString('pt-BR') + '</strong> palavra(s) em <em>' + App.esc(fileName) + '</em>.</p>' +
      '<div class="field"><label for="imp-title">Título da obra</label>' +
      '<input id="imp-title" type="text" value="' + App.esc(doc.title) + '"></div>' +
      '<div class="field"><label for="imp-author">Autor(a)</label>' +
      '<input id="imp-author" type="text" placeholder="(opcional)"></div>' +
      '<div class="field"><label for="imp-target">Onde importar</label>' +
      '<select id="imp-target"><option value="">Criar uma nova obra</option>' +
      books.map(function (b) { return '<option value="' + App.esc(b.id) + '">Adicionar a: ' + App.esc(b.title) + '</option>'; }).join('') +
      '</select></div>';

    const m = App.openModal({
      title: '<span>' + App.icon('upload') + ' Importar manuscrito</span>',
      body: body,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Importar',
          className: 'primary',
          onClick: async function (close) {
            const target = body.querySelector('#imp-target').value;
            try {
              const book = await createFromDoc(doc, {
                bookId: target || null,
                title: body.querySelector('#imp-title').value.trim(),
                author: body.querySelector('#imp-author').value.trim()
              });
              close();
              App.toast('Importado: ' + stats.chapters + ' capítulo(s).');
              await App.renderShelf();
              App.openBook(book.id);
            } catch (err) {
              App.toast(err.message || 'Falha ao importar.', 'error');
            }
          }
        }
      ]
    });
  }

  function open() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.markdown,.docx,.epub,.html,.htm,text/plain,text/markdown';
    input.addEventListener('change', async function () {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const doc = await parseFile(file);
        if (!doc.chapters.length || !doc.chapters.some(function (c) { return (c.content || '').trim(); })) {
          App.toast('Não encontrei texto para importar neste arquivo.', 'error');
          return;
        }
        await preview(doc, file.name);
      } catch (err) {
        App.toast(err.message || 'Não foi possível importar o arquivo.', 'error');
      }
    });
    input.click();
  }

  const api = {
    open: open,
    parseFile: parseFile,
    createFromDoc: createFromDoc,
    // puros (testáveis)
    parseMarkdown: parseMarkdown,
    parsePlainText: parsePlainText,
    docxXmlToDoc: docxXmlToDoc,
    htmlToText: htmlToText,
    titleFromFilename: titleFromFilename
  };

  window.Importer = api;
  window.Autor.importer = api;
  return api;
})();
