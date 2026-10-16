/* ============================================================
   core/image.js — Autor.image (alias global: Img): capas.

   Módulo profundo: uma interface pequena (pick, fromFile, resize,
   fit, DEFAULT) esconde leitura de arquivo, decodificação, canvas e
   redimensionamento. Sem servidor: por isso limites de resolução e
   qualidade. As proporções são preservadas e nunca se amplia.

   Limites por orientação:
     · retrato/vertical   → até 400×600
     · paisagem/horizontal → até 600×400
   Assim todas as miniaturas ficam homogêneas.

   O redimensionamento usa <canvas>, então só roda no navegador — mas
   o cálculo puro de `fit` é testável em Node (tests/image.test.mjs).
   ============================================================ */
window.Autor = window.Autor || {};

window.Img = (function () {
  'use strict';

  const DEFAULT = {
    portrait: { w: 400, h: 600 },
    landscape: { w: 600, h: 400 },
    quality: 0.9,
    background: '#ffffff'
  };

  function fail(msg, opts) {
    if (opts && typeof opts.onError === 'function') { opts.onError(msg); return; }
    if (window.Ui && Ui.toast) { Ui.toast(msg, 'error'); return; }
    if (window.console) window.console.warn(msg);
  }

  /* calcula as dimensões finais (sem canvas): proporção preservada,
     encaixando a imagem na caixa da sua orientação sem ampliar */
  function fit(naturalW, naturalH, opts) {
    opts = opts || {};
    const portrait = opts.portrait || DEFAULT.portrait;
    const landscape = opts.landscape || DEFAULT.landscape;
    const box = naturalW > naturalH ? landscape : portrait;
    const scale = Math.min(1, box.w / naturalW, box.h / naturalH);
    return {
      w: Math.max(1, Math.round(naturalW * scale)),
      h: Math.max(1, Math.round(naturalH * scale))
    };
  }

  /* desenha a imagem num canvas redimensionado e devolve um data URL JPEG */
  function resize(image, opts) {
    opts = opts || {};
    const quality = typeof opts.quality === 'number' ? opts.quality : DEFAULT.quality;
    const background = opts.background || DEFAULT.background;

    const naturalW = image.naturalWidth || image.width;
    const naturalH = image.naturalHeight || image.height;
    const size = fit(naturalW, naturalH, opts);

    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background; // transparência ganha fundo branco
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.drawImage(image, 0, 0, size.w, size.h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  /* lê um File de imagem e resolve com o data URL reduzido (ou null) */
  function fromFile(file, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const reader = new FileReader();
      reader.onload = function () {
        const img = new window.Image();
        img.onload = function () {
          try {
            resolve(resize(img, opts));
          } catch (err) {
            fail('Não foi possível processar a imagem.', opts);
            resolve(null);
          }
        };
        img.onerror = function () {
          fail('Este arquivo não parece ser uma imagem válida.', opts);
          resolve(null);
        };
        img.src = reader.result;
      };
      reader.onerror = function () {
        fail('Não foi possível ler o arquivo.', opts);
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }

  /* abre o seletor de arquivos e resolve com o data URL reduzido (ou null) */
  function pick(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        if (!file) { resolve(null); return; }
        fromFile(file, opts).then(resolve);
      });
      input.click();
    });
  }

  return {
    DEFAULT: DEFAULT,
    fit: fit,
    resize: resize,
    fromFile: fromFile,
    pick: pick
  };
})();

window.Autor.image = window.Img;
