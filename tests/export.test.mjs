/* ============================================================
   tests/export.test.mjs — exportação: Markdown e EPUB.
   Usa os construtores puros (bookToMarkdown / buildEpub) e valida o
   EPUB lendo-o de volta com o próprio Autor.zip.
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadScripts } from './helpers/load.mjs';

const GLOBALS = {
  Blob, TextEncoder, TextDecoder, Response,
  CompressionStream, DecompressionStream,
  atob, btoa
};

function loadExporter() {
  const sb = makeSandbox(GLOBALS);
  loadScripts(sb, ['js/core/content.js', 'js/core/zip.js', 'js/export.js']);
  return sb;
}

function book() {
  return {
    id: 'b1', title: 'A Odisseia', author: 'Homero',
    description: 'Uma jornada.', cover: null, status: 'rascunho'
  };
}
function chapters() {
  return [
    { id: 'c1', title: 'Partida', align: 'j', content: 'Primeiro parágrafo.\n\n⟦c⟧Centralizado aqui.\n\n---' },
    { id: 'c2', title: 'Retorno', align: 'j', content: 'Ele voltou <em casa> & partiu.' }
  ];
}

test('bookToMarkdown: título, autor e capítulos por heading', () => {
  const { Exporter } = loadExporter();
  const md = Exporter.bookToMarkdown(book(), chapters());
  assert.match(md, /^# A Odisseia/m);
  assert.match(md, /\*por Homero\*/);
  assert.match(md, /## 1\. Partida/);
  assert.match(md, /## 2\. Retorno/);
  assert.match(md, /Centralizado aqui\./); // marcador removido
  assert.ok(!md.includes('⟦'), 'não deve conter marcadores de alinhamento');
  assert.match(md, /^---$/m); // quebra de página
});

test('chapterToMarkdown: capítulo isolado com referência à obra', () => {
  const { Exporter } = loadExporter();
  const md = Exporter.chapterToMarkdown(chapters()[0], book());
  assert.match(md, /^# Partida/m);
  assert.match(md, /de A Odisseia — Homero/);
});

test('buildEpub: estrutura EPUB válida (mimetype primeiro, OPF e nav)', async () => {
  const sb = loadExporter();
  const blob = sb.Exporter.buildEpub(book(), chapters());
  assert.ok(blob instanceof Blob);

  const entries = await sb.Autor.zip.zipRead(await blob.arrayBuffer());
  const names = entries.map((e) => e.name);
  const map = sb.Autor.zip.entriesToMap(entries);

  // o mimetype tem de ser a primeira entrada e sem compressão
  assert.equal(names[0], 'mimetype');
  assert.equal(sb.Autor.zip.decodeText(map['mimetype']), 'application/epub+zip');

  assert.ok(map['META-INF/container.xml']);
  assert.ok(map['OEBPS/content.opf']);
  assert.ok(map['OEBPS/nav.xhtml']);
  assert.ok(map['OEBPS/chapter1.xhtml']);
  assert.ok(map['OEBPS/chapter2.xhtml']);

  const opf = sb.Autor.zip.decodeText(map['OEBPS/content.opf']);
  assert.match(opf, /<dc:title>A Odisseia<\/dc:title>/);
  assert.match(opf, /<dc:creator>Homero<\/dc:creator>/);
  assert.match(opf, /unique-identifier="bookid"/);
  assert.match(opf, /idref="ch1"/);
  assert.match(opf, /idref="ch2"/);

  const nav = sb.Autor.zip.decodeText(map['OEBPS/nav.xhtml']);
  assert.match(nav, /chapter1\.xhtml/);
  assert.match(nav, /Partida/);

  // XHTML válido: tags vazias fechadas e conteúdo escapado
  const ch1 = sb.Autor.zip.decodeText(map['OEBPS/chapter1.xhtml']);
  assert.match(ch1, /<hr class="pagebreak"\/>/); // quebra de página na cap. 1
  const ch2 = sb.Autor.zip.decodeText(map['OEBPS/chapter2.xhtml']);
  assert.match(ch2, /&lt;em casa&gt; &amp; partiu\./);
});

test('buildEpub: inclui a capa quando presente (data URL)', async () => {
  const sb = loadExporter();
  // 1×1 PNG
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const b = book();
  b.cover = png;
  const blob = sb.Exporter.buildEpub(b, chapters());

  const entries = await sb.Autor.zip.zipRead(await blob.arrayBuffer());
  const map = sb.Autor.zip.entriesToMap(entries);
  assert.ok(map['OEBPS/cover.png'], 'imagem da capa presente');
  const opf = sb.Autor.zip.decodeText(map['OEBPS/content.opf']);
  assert.match(opf, /properties="cover-image"/);
  assert.ok(map['OEBPS/cover.xhtml']);
});
