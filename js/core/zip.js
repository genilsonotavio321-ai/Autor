/* ============================================================
   core/zip.js — Autor.zip: leitura e escrita de arquivos ZIP.

   Módulo profundo sem dependências. A escrita usa o método "store"
   (sem compressão), suficiente para EPUB; a leitura suporta os
   métodos store (0) e deflate (8), suficiente para DOCX/EPUB.

   A leitura é assíncrona (usa DecompressionStream('deflate-raw'));
   a escrita é síncrona e pura — ambos os lados são testáveis.
   ============================================================ */
window.Autor = window.Autor || {};

window.Autor.zip = (function () {
  'use strict';

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function toBytes(data) {
    if (typeof data === 'string') return new TextEncoder().encode(data);
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    }
    if (data && typeof data.byteLength === 'number') return new Uint8Array(data);
    return new Uint8Array(data);
  }

  /* aceita ArrayBuffer ou uma "view" (Uint8Array/DataView) de qualquer realm */
  function asArrayBuffer(buffer) {
    if (ArrayBuffer.isView(buffer)) {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    if (buffer && typeof buffer.byteLength === 'number') return buffer;
    throw new Error('Conteúdo ZIP inválido.');
  }

  /* ---------------- escrita (método store) ----------------
     files: [{ name: string, data: string|Uint8Array }] → Blob */

  function zipWrite(files) {
    const chunks = [];
    const central = [];
    let offset = 0;

    files.forEach(function (f) {
      const nameBytes = new TextEncoder().encode(f.name);
      const data = toBytes(f.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);   // assinatura
      lv.setUint16(4, 20, true);           // versão necessária
      lv.setUint16(6, 0x0800, true);       // flag: nomes em UTF-8
      lv.setUint16(8, 0, true);            // método: store
      lv.setUint16(10, 0, true);           // hora
      lv.setUint16(12, 0, true);           // data
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      chunks.push(local, data);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);   // assinatura
      cv.setUint16(4, 20, true);           // versão que criou
      cv.setUint16(6, 20, true);           // versão necessária
      cv.setUint16(8, 0x0800, true);       // UTF-8
      cv.setUint16(10, 0, true);           // store
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + data.length;
    });

    const centralSize = central.reduce(function (n, c) { return n + c.length; }, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(chunks.concat(central, [eocd]), { type: 'application/zip' });
  }

  /* ---------------- leitura ----------------
     Retorna Promise<[{ name, data: Uint8Array }]> */

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Este navegador não sabe descompactar arquivos (deflete).');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function findEOCD(view) {
    // assinatura 0x06054b50, no máximo 64 KB a partir do fim
    const max = Math.min(view.byteLength, 0xFFFF + 22);
    for (let i = view.byteLength - 22; i >= view.byteLength - max; i--) {
      if (i < 0) break;
      if (view.getUint32(i, true) === 0x06054b50) return i;
    }
    return -1;
  }

  async function zipRead(buffer) {
    const ab = asArrayBuffer(buffer);
    const view = new DataView(ab);
    const eocd = findEOCD(view);
    if (eocd < 0) throw new Error('Arquivo ZIP inválido.');

    const count = view.getUint16(eocd + 10, true);
    let ptr = view.getUint32(eocd + 16, true);
    const out = [];

    for (let i = 0; i < count; i++) {
      if (view.getUint32(ptr, true) !== 0x02014b50) break;
      const method = view.getUint16(ptr + 10, true);
      const compSize = view.getUint32(ptr + 20, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localOffset = view.getUint32(ptr + 42, true);
      const nameBytes = new Uint8Array(ab, ptr + 46, nameLen);
      const name = new TextDecoder().decode(nameBytes);

      const lNameLen = view.getUint16(localOffset + 26, true);
      const lExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const raw = new Uint8Array(ab, dataStart, compSize);

      let data;
      if (method === 0) data = raw;
      else if (method === 8) data = await inflateRaw(raw);
      else throw new Error('Compressão ZIP não suportada (método ' + method + ').');

      if (!/\/$/.test(name)) out.push({ name: name, data: data });

      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  function entriesToMap(entries) {
    const map = {};
    entries.forEach(function (e) { map[e.name] = e.data; });
    return map;
  }

  function decodeText(bytes) {
    return new TextDecoder('utf-8').decode(bytes);
  }

  return {
    crc32: crc32,
    zipWrite: zipWrite,
    zipRead: zipRead,
    entriesToMap: entriesToMap,
    decodeText: decodeText
  };
})();
