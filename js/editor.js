/* ============================================================
   editor.js — editor de capítulos com salvamento automático,
   estatísticas e integração com o painel de revisão.
   ============================================================ */
const Editor = (function () {
  'use strict';

  const titleInput = document.getElementById('chapter-title');
  const contentEl = document.getElementById('chapter-content');
  const saveIndicator = document.getElementById('save-indicator');
  const statsEl = document.getElementById('editor-stats');
  const statusSelect = document.getElementById('chapter-status');
  const alignScope = document.getElementById('align-scope');
  const alignCurrent = document.getElementById('align-current');
  const alignButtons = Array.prototype.slice.call(document.querySelectorAll('.align-btn'));

  let dirty = false;
  let saveTimer = null;
  let pendingSelect = null;
  let lastCaret = 0; // última posição conhecida do cursor (para a barra de alinhamento)
  const numberFmt = new Intl.NumberFormat('pt-BR');

  /* ---------------- abrir / salvar ---------------- */

  async function open(chapterId, opts) {
    await flush();
    const chapter = await Store.Chapters.get(chapterId);
    if (!chapter) {
      App.toast('Capítulo não encontrado.', 'error');
      return;
    }
    // garante que o livro aberto é o dono deste capítulo
    if (!App.book || App.book.id !== chapter.bookId) {
      App.book = await Store.Books.get(chapter.bookId);
    }
    App.chapter = chapter;
    titleInput.value = chapter.title || '';
    contentEl.value = chapter.content || '';
    statusSelect.value = chapter.status || 'rascunho';
    if (alignScope) alignScope.value = 'para';
    lastCaret = 0;
    dirty = false;
    setSaveState('saved');
    updateStats();
    updateAlignUI();
    App.navigate('editor');
    if (window.Review) Review.reset();

    if (opts && opts.select) {
      pendingSelect = opts.select;
      setTimeout(focusSelection, 60);
    } else {
      contentEl.focus();
    }
  }

  function focusSelection() {
    const q = pendingSelect;
    pendingSelect = null;
    if (!q) { contentEl.focus(); return; }
    const text = contentEl.value;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) { contentEl.focus(); return; }
    selectRange(idx, idx + q.length);
  }

  function scheduleSave() {
    dirty = true;
    setSaveState('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 900);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (!dirty || !App.chapter) return;
    dirty = false;
    App.chapter.title = titleInput.value.trim() || 'Capítulo sem título';
    App.chapter.content = contentEl.value;
    await Store.Chapters.save(App.chapter);
    setSaveState('saved');
  }

  /* salva imediatamente se houver alterações pendentes */
  async function flush() {
    if (dirty) await saveNow();
  }

  function icon(name) { return (window.App && App.icon ? App.icon(name) : ''); }

  function setSaveState(state) {
    if (state === 'saving') {
      saveIndicator.innerHTML = 'Salvando…';
      saveIndicator.classList.add('saving');
    } else {
      saveIndicator.innerHTML = icon('check') + ' Salvo';
      saveIndicator.classList.remove('saving');
    }
  }

  /* ---------------- estatísticas ---------------- */

  function updateStats() {
    const text = contentEl.value;
    const words = App.countWords(text);
    const chars = App.stripAlignMarkers(text).length;
    statsEl.textContent =
      numberFmt.format(words) + (words === 1 ? ' palavra' : ' palavras') +
      ' · ' + numberFmt.format(chars) + ' caracteres' +
      (words ? ' · ' + App.readTime(words) : '');
  }

  /* ---------------- alinhamento por parágrafo ----------------
     O marcador (⟦c⟧ etc.) é escrito/apagado pelo próprio app no início
     do parágrafo; ele só existe quando o parágrafo difere do alinhamento
     padrão do capítulo (App.chapter.align). */

  /* limites dos parágrafos (separados por linha em branco) */
  function paragraphsOf(text) {
    const list = [];
    const re = /\n{2,}/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      list.push({ start: last, end: m.index });
      last = m.index + m[0].length;
    }
    list.push({ start: last, end: text.length });
    return list;
  }

  /* parágrafo que contém a posição do cursor */
  function paragraphAt(offset) {
    const paras = paragraphsOf(contentEl.value);
    for (let i = paras.length - 1; i >= 0; i--) {
      if (offset >= paras[i].start) return paras[i];
    }
    return paras[0];
  }

  function chapterAlign() { return (App.chapter && App.chapter.align) || 'j'; }

  function currentParagraphAlign() {
    const para = paragraphAt(lastCaret);
    return App.paraAlign(contentEl.value.slice(para.start, para.end), chapterAlign());
  }

  /* o textarea inteiro segue o padrão do capítulo; a barra mostra o
     alinhamento efetivo do parágrafo onde está o cursor */
  function updateAlignUI() {
    contentEl.style.textAlign = App.ALIGN_CSS[chapterAlign()] || 'justify';
    const eff = currentParagraphAlign();
    alignButtons.forEach(function (b) {
      const on = b.getAttribute('data-align') === eff;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (alignCurrent) alignCurrent.textContent = 'Parágrafo: ' + (App.ALIGN_LABEL[eff] || '');
  }

  function applyAlign(code) {
    if (!App.chapter || !code) return;
    const base = chapterAlign();
    const scope = alignScope ? alignScope.value : 'para';

    if (scope === 'chapter') {
      // novo padrão do capítulo: marcadores iguais ao novo padrão viram ruído
      App.chapter.align = code;
      const oldText = contentEl.value;
      const caret = Math.min(lastCaret, oldText.length);
      const stripRedundant = function (s) {
        return s.replace(
          /(^|\n{2,})⟦([ecjd])⟧ ?/g,
          function (full, pre, mk) { return mk === code ? pre : full; }
        );
      };
      // recalcula a posição do cursor só com o que mudou antes dele
      const newCaret = stripRedundant(oldText.slice(0, caret)).length;
      contentEl.value = stripRedundant(oldText);
      contentEl.focus();
      contentEl.setSelectionRange(newCaret, newCaret);
      lastCaret = newCaret;
      updateStats();
      scheduleSave();
      updateAlignUI();
      App.toast('Alinhamento do capítulo: ' + App.ALIGN_LABEL[code] + '.');
      return;
    }

    const para = paragraphAt(lastCaret);
    const raw = contentEl.value.slice(para.start, para.end);
    const stripped = raw.replace(/^⟦([ecjd])⟧ ?/, '');
    const novo = (code === base) ? stripped : ('⟦' + code + '⟧ ' + stripped);
    if (novo === raw) { updateAlignUI(); return; }

    const delta = novo.length - raw.length;
    const newCaret = Math.min(contentEl.value.length, lastCaret + delta);
    contentEl.value =
      contentEl.value.slice(0, para.start) + novo + contentEl.value.slice(para.end);
    contentEl.focus();
    contentEl.setSelectionRange(newCaret, newCaret);
    lastCaret = newCaret;
    updateStats();
    scheduleSave();
    updateAlignUI();
  }

  /* ---------------- navegação até um trecho ---------------- */

  /* leva o cursor até a posição exata usando um "espelho" invisível
     (mesma fonte e espaçamento) para medir onde o texto realmente está */
  function scrollToOffset(offset) {
    const ta = contentEl;
    try {
      const cs = window.getComputedStyle(ta);
      const mirror = document.createElement('div');
      [
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
        'lineHeight', 'wordSpacing', 'textIndent', 'textTransform'
      ].forEach(function (p) { mirror.style[p] = cs[p]; });
      mirror.style.position = 'absolute';
      mirror.style.visibility = 'hidden';
      mirror.style.pointerEvents = 'none';
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.overflowWrap = 'break-word';
      mirror.style.margin = '0';
      mirror.style.border = '0';
      mirror.style.boxSizing = 'border-box';
      mirror.style.padding = cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft;
      mirror.style.width = ta.clientWidth + 'px'; // inclui a mesma largura de quebra do textarea
      mirror.style.top = '0';
      mirror.style.left = '0';
      mirror.textContent = ta.value.slice(0, offset);
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      mirror.appendChild(marker);
      document.body.appendChild(mirror);

      const delta = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top -
        parseFloat(cs.paddingTop || '0');
      mirror.remove();

      const target = delta - ta.clientHeight * 0.3;
      ta.scrollTop = target > 0 ? target : 0;
    } catch (e) {
      // reserva: rolagem proporcional aproximada
      const ratio = offset / Math.max(1, ta.value.length);
      ta.scrollTop = ratio * (ta.scrollHeight - ta.clientHeight) - 60;
    }
  }

  /* seleciona um trecho no editor e rola até ele */
  function selectRange(start, end) {
    const text = contentEl.value;
    start = Math.max(0, Math.min(start, text.length));
    end = Math.max(start, Math.min(end == null ? start : end, text.length));
    contentEl.focus();
    contentEl.setSelectionRange(start, end);
    lastCaret = start;
    scrollToOffset(start);
    updateAlignUI();
  }

  /* ---------------- capa do capítulo ---------------- */

  function openCoverModal() {
    if (!App.chapter) return;
    let cover = App.chapter.cover || null;
    const body = App.el('div');
    body.innerHTML =
      '<div class="cover-picker">' +
        '<img id="cc-preview" class="cover-thumb hidden" alt="Pré-visualização da capa">' +
        '<div class="cover-actions">' +
          '<button type="button" class="btn small" id="cc-pick">' + icon('image') + ' Escolher imagem</button>' +
          '<button type="button" class="btn small ghost hidden" id="cc-remove">' + icon('trash') + ' Remover capa</button>' +
        '</div>' +
        '<p class="hint cover-hint">A capa aparece na lista de capítulos, no leitor e nas exportações. A imagem é reduzida aqui no aparelho (máx. 1200px).</p>' +
      '</div>';

    const preview = body.querySelector('#cc-preview');
    const removeBtn = body.querySelector('#cc-remove');
    function sync() {
      if (cover) {
        preview.src = cover;
        preview.classList.remove('hidden');
        removeBtn.classList.remove('hidden');
      } else {
        preview.removeAttribute('src');
        preview.classList.add('hidden');
        removeBtn.classList.add('hidden');
      }
    }
    sync();

    body.querySelector('#cc-pick').addEventListener('click', async function () {
      const url = await App.pickImage({ maxDim: 1200 });
      if (!url) return;
      cover = url;
      sync();
    });
    removeBtn.addEventListener('click', function () { cover = null; sync(); });

    App.openModal({
      title: '<span>' + icon('image') + ' Capa do capítulo</span>',
      body: body,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar',
          className: 'primary',
          onClick: async function (close) {
            App.chapter.cover = cover;
            await Store.Chapters.save(App.chapter);
            App.toast(cover ? 'Capa do capítulo salva.' : 'Capa do capítulo removida.');
            if (App.book && typeof App.renderChapters === 'function') App.renderChapters();
            close();
            return false;
          }
        }
      ]
    });
  }

  /* ---------------- API pública ---------------- */

  function getText() { return contentEl.value; }

  async function setText(newText) {
    contentEl.value = newText;
    updateStats();
    scheduleSave();
    await flush();
  }

  function isDirty() { return dirty; }

  function setTitle(newTitle) {
    titleInput.value = newTitle;
    scheduleSave();
  }

  /* ---------------- eventos ---------------- */

  function trackCaret() {
    lastCaret = contentEl.selectionStart || 0;
    updateAlignUI();
  }

  contentEl.addEventListener('input', function () {
    updateStats();
    scheduleSave();
    trackCaret();
    if (window.Review) Review.onTextChange();
  });

  contentEl.addEventListener('click', trackCaret);
  contentEl.addEventListener('keyup', trackCaret);
  contentEl.addEventListener('select', trackCaret);

  titleInput.addEventListener('input', scheduleSave);

  // barra de alinhamento
  alignButtons.forEach(function (btn) {
    // impede que o clique roube a seleção do textarea
    btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    btn.addEventListener('click', function () { applyAlign(btn.getAttribute('data-align')); });
  });
  if (alignScope) {
    alignScope.addEventListener('change', function () {
      contentEl.focus();
      updateAlignUI();
    });
  }

  // status do capítulo (rodapé do editor)
  statusSelect.addEventListener('change', async function () {
    if (!App.chapter) return;
    App.chapter.status = statusSelect.value;
    await Store.Chapters.save(App.chapter);
    const st = (window.App && App.STATUS && App.STATUS[App.chapter.status]) || { label: App.chapter.status };
    App.toast('Status do capítulo: ' + st.label + '.');
    if (App.book && typeof App.renderChapters === 'function') App.renderChapters();
  });

  // capa do capítulo
  document.getElementById('btn-chapter-cover').addEventListener('click', openCoverModal);

  // substituição em massa (aba do painel de revisão)
  document.getElementById('btn-replace').addEventListener('click', function () {
    if (window.Review) Review.openTab('replace');
  });

  // Ctrl+S salva agora · Ctrl+H abre a substituição
  document.addEventListener('keydown', function (ev) {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const key = ev.key.toLowerCase();
    if (key === 's') {
      if (App.view !== 'editor') return;
      ev.preventDefault();
      saveNow().then(function () { App.toast('Salvo'); });
    } else if (key === 'h') {
      if (App.view !== 'editor') return;
      ev.preventDefault();
      if (window.Review) Review.openTab('replace');
    }
  });

  document.getElementById('btn-back-book').addEventListener('click', async function () {
    await flush();
    if (App.book) App.openBook(App.book.id);
  });

  document.getElementById('btn-delete-chapter').addEventListener('click', async function () {
    if (!App.chapter) return;
    const ok = await App.confirm(
      'Excluir o capítulo "' + titleInput.value + '"? Ele irá para a lixeira.',
      { okLabel: 'Excluir', danger: true }
    );
    if (ok) {
      dirty = false;
      await Store.Chapters.remove(App.chapter.id);
      App.chapter = null;
      App.toast('Capítulo movido para a lixeira.');
      if (App.book) App.openBook(App.book.id);
    }
  });

  document.getElementById('btn-review').addEventListener('click', function () {
    if (window.Review) Review.toggle();
  });

  document.getElementById('btn-read-chapter').addEventListener('click', async function () {
    await flush();
    if (App.chapter) Reader.open({ chapterId: App.chapter.id });
  });

  document.getElementById('btn-export-chapter').addEventListener('click', async function () {
    await flush();
    if (App.chapter) Exporter.chapterDialog(App.chapter);
  });

  // salva ao sair da aba
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && dirty) saveNow();
  });

  const api = {
    open: open,
    flush: flush,
    saveNow: saveNow,
    getText: getText,
    setText: setText,
    setTitle: setTitle,
    isDirty: isDirty,
    selectRange: selectRange
  };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Editor = api;

  return api;
})();
