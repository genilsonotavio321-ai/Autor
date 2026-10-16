/* ============================================================
   views/trash.js — lixeira: restaurar ou excluir definitivamente.
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const el = Dom.el;
  const esc = Dom.esc;
  const icon = Dom.icon;

  async function trashModal() {
    const items = await Store.Trash.list();
    const body = el('div');

    if (!items.length) {
      body.appendChild(el('p', 'muted', 'A lixeira está vazia. Itens excluídos aparecem aqui e podem ser restaurados.'));
    }

    items.forEach(function (entry) {
      const row = el('div', 'trash-item');
      const isBook = entry.type === 'book';
      const title = entry.item.title;
      const when = new Date(entry.deletedAt).toLocaleString('pt-BR');
      const meta = isBook
        ? 'Livro com ' + (entry.chapters || []).length + ' capítulo(s) · excluído em ' + when
        : 'Capítulo · excluído em ' + when;

      row.innerHTML =
        '<div class="ti-main"><div class="ti-title">' + icon(isBook ? 'book' : 'file-text') + esc(title) + '</div>' +
        '<div class="ti-meta">' + esc(meta) + '</div></div>';

      const restoreBtn = el('button', 'btn small', 'Restaurar');
      restoreBtn.addEventListener('click', async function () {
        const ok = await Store.Trash.restore(entry);
        if (ok) {
          App.toast('Item restaurado.');
          modal.close();
          await trashModal();
          App.renderShelf();
          if (App.book) App.renderChapters();
        } else {
          App.toast('Não foi possível restaurar (crie um livro antes).', 'error');
        }
      });

      const delBtn = el('button', 'btn small danger', 'Excluir');
      delBtn.addEventListener('click', async function () {
        const ok = await App.confirm('Excluir definitivamente "' + title + '"? Esta ação não pode ser desfeita.', { okLabel: 'Excluir', danger: true });
        if (ok) { await Store.Trash.remove(entry.id); modal.close(); await trashModal(); }
      });

      row.appendChild(restoreBtn);
      row.appendChild(delBtn);
      body.appendChild(row);
    });

    const actions = [{ label: 'Fechar' }];
    if (items.length) {
      actions.push({
        label: 'Esvaziar lixeira',
        className: 'danger',
        onClick: async function (close) {
          const ok = await App.confirm('Esvaziar a lixeira apaga todos os itens permanentemente. Continuar?', { okLabel: 'Esvaziar', danger: true });
          if (ok) {
            await Store.Trash.empty();
            close();
            App.toast('Lixeira esvaziada.');
          }
          // se cancelou, mantém a lixeira aberta
          return false;
        }
      });
    }

    const modal = App.openModal({ title: '<span>' + icon('trash') + ' Lixeira</span>', body: body, actions: actions, wide: true });
    return modal;
  }

  App.trashModal = trashModal;
  window.Autor.views.trash = { trashModal: trashModal };
})();
