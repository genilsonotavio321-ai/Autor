/* ============================================================
   tests/zip.test.mjs — Autor.zip: leitura/escrita de ZIP.
   Cobre o método store (escrita) e deflate (leitura, usada no DOCX).
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox, loadScripts } from './helpers/load.mjs';

const GLOBALS = {
  Blob, TextEncoder, TextDecoder, Response,
  CompressionStream, DecompressionStream
};

function loadZip() {
  const sb = makeSandbox(GLOBALS);
  return loadScripts(sb, ['js/core/zip.js']).Autor.zip;
}

test('crc32 calcula o valor conhecido de "123456789"', () => {
  const zip = loadZip();
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(zip.crc32(bytes), 0xCBF43926);
});

test('zipWrite + zipRead fazem round-trip (método store)', async () => {
  const zip = loadZip();
  const files = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'OEBPS/content.opf', data: '<package/>' },
    { name: 'bin/data.bin', data: new Uint8Array([1, 2, 3, 4, 5]) }
  ];
  const blob = zip.zipWrite(files);
  assert.ok(blob instanceof Blob);

  const entries = await zip.zipRead(await blob.arrayBuffer());
  const map = zip.entriesToMap(entries);
  assert.equal(map['mimetype'].length, 'application/epub+zip'.length);
  assert.equal(zip.decodeText(map['mimetype']), 'application/epub+zip');
  assert.equal(zip.decodeText(map['OEBPS/content.opf']), '<package/>');
  assert.deepEqual(Array.from(map['bin/data.bin']), [1, 2, 3, 4, 5]);
  assert.equal(entries.length, 3);
});

test('zipRead descompacta entradas no método deflate', async () => {
  const zip = loadZip();
  const original = new TextEncoder().encode('O rato roeu a roupa do rei de Roma. '.repeat(20));

  // produz os bytes deflate-raw
  const cs = new CompressionStream('deflate-raw');
  const compressed = new Uint8Array(
    await new Response(new Blob([original]).stream().pipeThrough(cs)).arrayBuffer()
  );

  // monta um ZIP mínimo com uma entrada (método 8)
  const name = new TextEncoder().encode('doc.txt');
  const crc = zip.crc32(original);
  const local = new Uint8Array(30 + name.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(8, 8, true);              // deflate
  lv.setUint32(14, crc, true);
  lv.setUint32(18, compressed.length, true);
  lv.setUint32(22, original.length, true);
  lv.setUint16(26, name.length, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, compressed.length, true);
  cv.setUint32(24, original.length, true);
  cv.setUint16(28, name.length, true);
  cv.setUint32(42, 0, true);              // offset do cabeçalho local = 0
  central.set(name, 46);

  const centralSize = central.length;
  const dataOffset = local.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, dataOffset + compressed.length, true);

  const archive = new Blob([local, compressed, central, eocd]);
  const entries = await zip.zipRead(await archive.arrayBuffer());
  const map = zip.entriesToMap(entries);
  assert.equal(zip.decodeText(map['doc.txt']), new TextDecoder().decode(original));
});
