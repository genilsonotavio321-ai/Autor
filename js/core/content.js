/* ============================================================
   core/content.js — Autor.content: Content model.

   Único dono da representação de conteúdo e da sintaxe de marcadores
   de alinhamento ⟦e⟧/⟦c⟧/⟦d⟧/⟦j⟧. Nenhum outro módulo deve conhecer
   esse formato (ver docs/adr/ADR-0001).

   Conceitos (codebase-design):
   - deep module: interface pequena (parse, serialize, toDisplay,
     toExport, strip, countWords…) escondendo decisões de formato.
   - seam: ponto único de verdade para a sintaxe ⟦e⟧/⟦c⟧/⟦d⟧/⟦j⟧.

   O modelo de blocos (Block[]) é o ponto de extensão para texto rico
   e para novos formatos de exportação (Markdown/EPUB/DOCX).
   ============================================================ */
const Content = (function () {
  'use strict';

  const DEFAULT_ALIGN = 'j';

  /* metadados de alinhamento: única fonte de verdade (rótulo p/ UI,
     css p/ estilo). Substitui App.ALIGN_LABEL/ALIGN_CSS. */
  const ALIGN = {
    e: { label: 'Esquerda', css: 'left' },
    c: { label: 'Centralizado', css: 'center' },
    d: { label: 'Direita', css: 'right' },
    j: { label: 'Justificado', css: 'justify' }
  };
  const ALIGN_KEYS = ['e', 'c', 'd', 'j'];

  const PARA_MARK_RE = /^\s*⟦([ecjd])⟧ ?/;
  const ALIGN_MARKER_RE = /(^|\n{2,})⟦([ecjd])⟧ ?/g;
  const MARK_SPLIT = /\n{2,}/;
  const RULE_RE = /^-{3,}$/;

  function css(code) { return (ALIGN[code] || ALIGN[DEFAULT_ALIGN]).css; }
  function label(code) { return (ALIGN[code] || ALIGN[DEFAULT_ALIGN]).label; }

  /**
   * @typedef {Object} Block
   * @property {'para'|'rule'} type
   * @property {'e'|'c'|'d'|'j'|null} align  // alinhamento efetivo (ou null se não aplicável)
   * @property {string} text  // texto lógico sem marcador de parágrafo
   */

  /* texto salvo → blocos lógicos */
  function parse(text, chapterAlign) {
    chapterAlign = chapterAlign || DEFAULT_ALIGN;
    const blocks = [];
    const raw = String(text == null ? '' : text);
    const parts = raw.split(MARK_SPLIT);
    for (let i = 0; i < parts.length; i++) {
      const blockText = parts[i];
      if (blockText == null) continue;
      const trimmed = blockText.trim();
      if (!trimmed) continue;
      if (RULE_RE.test(trimmed)) {
        blocks.push({ type: 'rule', align: null, text: trimmed });
        continue;
      }
      const m = PARA_MARK_RE.exec(blockText);
      const align = m ? m[1] : chapterAlign;
      const pure = blockText.replace(PARA_MARK_RE, '');
      blocks.push({ type: 'para', align: align, text: pure });
    }
    return blocks;
  }

  /* blocos lógicos → texto salvo (com marcadores só onde difere do padrão) */
  function serialize(blocks, chapterAlign) {
    chapterAlign = chapterAlign || DEFAULT_ALIGN;
    if (!Array.isArray(blocks) || !blocks.length) return '';
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'rule') {
        out.push('---');
        continue;
      }
      if (b.type === 'para') {
        const align = b.align || chapterAlign;
        if (align === chapterAlign) {
          out.push(String(b.text == null ? '' : b.text));
        } else {
          out.push('⟦' + align + '⟧ ' + String(b.text == null ? '' : b.text));
        }
      }
    }
    return out.join('\n\n');
  }

  /* normaliza texto para exibição (marcadores canônicos) */
  function toDisplay(text, chapterAlign) {
    return serialize(parse(text, chapterAlign), chapterAlign);
  }

  /* texto puro para exportação (sem marcadores) */
  function toExport(text, chapterAlign) {
    const blocks = parse(text, chapterAlign);
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'rule') {
        out.push('---');
        continue;
      }
      if (b.type === 'para') {
        out.push(String(b.text == null ? '' : b.text));
      }
    }
    return out.join('\n\n');
  }

  /* remove todos os marcadores (contagem de palavras, busca, IA…) */
  function strip(text) {
    return String(text == null ? '' : text).replace(ALIGN_MARKER_RE, '$1');
  }

  /* remove o marcador do início de um parágrafo */
  function stripParaMarker(paraText) {
    return String(paraText == null ? '' : paraText).replace(PARA_MARK_RE, '');
  }

  /* alinhamento efetivo de um parágrafo: marcador, senão o padrão */
  function paraAlign(paraText, chapterAlign) {
    const m = PARA_MARK_RE.exec(String(paraText == null ? '' : paraText));
    return m ? m[1] : (chapterAlign || DEFAULT_ALIGN);
  }

  function countWords(text) {
    const t = strip(text).trim();
    if (!t) return 0;
    return t.split(/\s+/).length;
  }

  return {
    ALIGN: ALIGN,
    ALIGN_KEYS: ALIGN_KEYS,
    DEFAULT_ALIGN: DEFAULT_ALIGN,
    MARK_RE: PARA_MARK_RE,
    parse: parse,
    serialize: serialize,
    toDisplay: toDisplay,
    toExport: toExport,
    strip: strip,
    stripAlignMarkers: strip,
    stripParaMarker: stripParaMarker,
    paraAlign: paraAlign,
    countWords: countWords,
    css: css,
    label: label
  };
})();

window.Content = Content;
window.Autor = window.Autor || {};
window.Autor.content = Content;
