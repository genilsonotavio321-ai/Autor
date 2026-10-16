/* ============================================================
   core/dom.js — Autor.dom: utilitários de DOM puros (sem estado).

   Interface pequena que esconde detalhes de criação de nós e de
   escape de HTML. É a base de `Autor.ui` e `Autor.app`.
   ============================================================ */
window.Dom = (function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function icon(name, size) {
    const cls = size ? 'ic ic-' + size : 'ic';
    return '<svg class="' + cls + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  return { $: $, qsa: qsa, el: el, esc: esc, icon: icon };
})();

window.Autor = window.Autor || {};
window.Autor.dom = window.Dom;
