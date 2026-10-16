/* ============================================================
   tests/import.test.mjs — analisadores de importação (Importer).
   Testa apenas as funções puras (sem DOM nem leitura de arquivo).
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadScripts } from './helpers/load.mjs';

function loadImporter() {
  return loadScripts(makeSandbox(), ['js/core/content.js', 'js/import.js']).Importer;
}

test('parseMarkdown: primeiro H1 vira título e H2 inicia capítulos', () => {
  const Imp = loadImporter();
  const doc = Imp.parseMarkdown('# Minha Obra\n\n## Primeiro\n\nOlá mundo.\n\nSegundo parágrafo.\n\n## Segundo\n\nFim.', 'arquivo');
  assert.equal(doc.title, 'Minha Obra');
  assert.equal(doc.chapters.length, 2);
  assert.equal(doc.chapters[0].title, 'Primeiro');
  assert.equal(doc.chapters[0].content, 'Olá mundo.\n\nSegundo parágrafo.');
  assert.equal(doc.chapters[1].title, 'Segundo');
  assert.equal(doc.chapters[1].content, 'Fim.');
});

test('parseMarkdown: sem títulos gera um capítulo com o nome do arquivo', () => {
  const Imp = loadImporter();
  const doc = Imp.parseMarkdown('Apenas um texto.\n\nCom dois parágrafos.', 'meu-texto');
  assert.equal(doc.chapters.length, 1);
  assert.equal(doc.chapters[0].title, 'meu-texto');
  assert.equal(doc.chapters[0].content, 'Apenas um texto.\n\nCom dois parágrafos.');
});

test('parseMarkdown: lista vira parágrafos e regra vira quebra de página', () => {
  const Imp = loadImporter();
  const doc = Imp.parseMarkdown('## Cap\n\nUm.\n\n---\n\n- item um\n- item dois');
  assert.equal(doc.chapters[0].content, 'Um.\n\n---\n\nitem um\n\nitem dois');
});

test('parseMarkdown: remove marcações inline', () => {
  const Imp = loadImporter();
  const doc = Imp.parseMarkdown('## Cap\n\nIsto é **forte** e _ênfase_ e `código`.');
  assert.equal(doc.chapters[0].content, 'Isto é forte e ênfase e código.');
});

test('parsePlainText: separa por cabeçalhos "CAPÍTULO"', () => {
  const Imp = loadImporter();
  const doc = Imp.parsePlainText('CAPÍTULO 1\n\nEra uma vez.\n\nCapítulo 2\n\nFim.', 'livro');
  assert.equal(doc.chapters.length, 2);
  assert.equal(doc.chapters[0].title, 'CAPÍTULO 1');
  assert.equal(doc.chapters[0].content, 'Era uma vez.');
  assert.equal(doc.chapters[1].content, 'Fim.');
});

test('parsePlainText: sem cabeçalhos usa o título de reserva', () => {
  const Imp = loadImporter();
  const doc = Imp.parsePlainText('Só texto corrido.', 'romance');
  assert.equal(doc.chapters.length, 1);
  assert.equal(doc.chapters[0].title, 'romance');
});

test('htmlToText: extrai parágrafos e remove tags', () => {
  const Imp = loadImporter();
  const text = Imp.htmlToText('<p>Olá <strong>mundo</strong>.</p><p>Fim.</p>');
  assert.equal(text, 'Olá mundo.\n\nFim.');
});

test('docxXmlToDoc: extrai o texto dos parágrafos do document.xml', () => {
  const Imp = loadImporter();
  const xml =
    '<w:document><w:body>' +
    '<w:p><w:r><w:t>Primeiro parágrafo</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t xml:space="preserve">Segundo</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>com quebra</w:t></w:r></w:p>' +
    '<w:p/>' +
    '</w:body></w:document>';
  const doc = Imp.docxXmlToDoc(xml, 'doc');
  assert.equal(doc.chapters.length, 1);
  assert.equal(doc.chapters[0].content, 'Primeiro parágrafo\n\nSegundo com quebra');
});

test('titleFromFilename limpa extensão e separadores', () => {
  const Imp = loadImporter();
  assert.equal(Imp.titleFromFilename('meu_livro-final.md'), 'meu livro final');
});
