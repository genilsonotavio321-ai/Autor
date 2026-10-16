/* ============================================================
   core/ui.js — Autor.ui: primitivas de interface.

   Módulo profundo: interface pequena (toast, openModal, confirm)
   que esconde criação de DOM, foco preso, ARIA e fechamento de
   diálogos. Consumidores (app/editor/review/export) não tocam em
   `#modal-root` nem gerenciam foco diretamente.
   ============================================================ */
window.Ui = (function () {
  'use strict';

  const el = Dom.el;
  const icon = Dom.icon;
  const $ = Dom.$;

  let toastTimer = null;

  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3400);
  }

  /* modal genérico: opts = {title, body (HTMLElement|string), actions:[{label, className, onClick(close)}], wide} */
  function openModal(opts) {
    const overlay = el('div', 'modal-overlay');
    const modal = el('div', 'modal' + (opts.wide ? ' wide' : ''));
    const previouslyFocused = document.activeElement;

    const header = el('div', 'modal-header');
    const titleSpan = el('span');
    // títulos podem conter ícones SVG (HTML); conteúdo vindo do usuário é escapado pelo chamador
    titleSpan.innerHTML = opts.title || '';
    header.appendChild(titleSpan);
    const closeBtn = el('button', 'icon-btn');
    closeBtn.innerHTML = icon('x');
    closeBtn.title = 'Fechar';
    closeBtn.setAttribute('aria-label', 'Fechar');
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // diálogo acessível
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', titleSpan.textContent.trim() || 'Diálogo');

    const body = el('div', 'modal-body');
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    modal.appendChild(body);

    const actions = el('div', 'modal-actions');
    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    }
    function focusableIn() {
      return Array.prototype.filter.call(
        modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'),
        function (n) { return !n.disabled && n.offsetParent !== null; }
      );
    }
    function onKey(ev) {
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key !== 'Tab') return;
      // foco preso dentro do diálogo
      const f = focusableIn();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (!modal.contains(document.activeElement)) {
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
      } else if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
    (opts.actions || []).forEach(function (act) {
      const b = el('button', 'btn ' + (act.className || ''), act.label);
      b.addEventListener('click', function () {
        const result = act.onClick ? act.onClick(close) : undefined;
        if (result !== false) close();
      });
      actions.appendChild(b);
    });
    if ((opts.actions || []).length) modal.appendChild(actions);

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) close();
    });
    document.addEventListener('keydown', onKey);

    overlay.appendChild(modal);
    $('#modal-root').appendChild(overlay);

    // foca o primeiro campo editável (com fallback para o botão Fechar)
    setTimeout(function () {
      const f = modal.querySelector('input, textarea, select, button.primary') || closeBtn;
      if (f) f.focus();
    }, 30);

    return { close: close, body: body, modal: modal };
  }

  /* confirmação simples: retorna Promise<boolean> */
  function confirm(message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      let settled = false;
      const m = openModal({
        title: opts.title || 'Confirmar',
        body: el('p', null, message),
        actions: [
          { label: opts.cancelLabel || 'Cancelar', onClick: function () { settled = true; resolve(false); } },
          {
            label: opts.okLabel || 'Confirmar',
            className: (opts.danger ? 'danger' : 'primary'),
            onClick: function () { settled = true; resolve(true); }
          }
        ]
      });
      // fechar pelo X/ESC/overlay conta como cancelar
      const obs = new MutationObserver(function () {
        if (!document.body.contains(m.modal)) {
          obs.disconnect();
          if (!settled) resolve(false);
        }
      });
      obs.observe($('#modal-root'), { childList: true, subtree: true });
    });
  }

  return { toast: toast, openModal: openModal, confirm: confirm };
})();

window.Autor = window.Autor || {};
window.Autor.ui = window.Ui;
