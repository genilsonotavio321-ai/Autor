/* ============================================================
   editor.js — editor de capítulos por parágrafos (blocos) com
   salvamento automático, estatísticas e integração com a revisão.

   O texto salvo continua no mesmo formato do leitor/PDF/backup:
   parágrafos separados por linha em branco e, no início do parágrafo
   que difere do padrão do capítulo, o marcador ⟦e⟧/⟦c⟧/⟦d⟧/⟦j⟧.
   No editor cada parágrafo é um bloco (<p class="para">) com o
   alinhamento guardado em data-align — o marcador nunca aparece.
   ============================================================ */
const Editor = (function () {
  'use strict';

  const titleInput = document.getElementById('chapter-title');
  const contentEl = document.getElementById('chapter-content');
  const saveIndicator = document.getElementById('save-indicator');
  const statsEl = document.getElementById('editor-stats');
  const statusSelect = document.getElementById('chapter-status');
  const alignCurrent = document.getElementById('align-current');
  const alignButtons = Array.prototype.slice.call(document.querySelectorAll('.align-btn'));
  const scopeButtons = Array.prototype.slice.call(document.querySelectorAll('.et-scope-btn'));

  const focusBtn = document.getElementById('btn-focus');
  const tocBtn = document.getElementById('btn-editor-toc');
  const tocEl = document.getElementById('editor-toc');
  const prevChapterBtn = document.getElementById('btn-prev-chapter');
  const nextChapterBtn = document.getElementById('btn-next-chapter');
  const goalEl = document.getElementById('goal-progress');

  let dirty = false;
  let saveTimer = null;
  let pendingSelect = null;
  let lastBlock = null; // parágrafo (bloco) onde está o cursor
  let scopeMode = 'para'; // onde o próximo clique de alinhamento é aplicado
  let lastAlignUI = ''; // guarda para não reescrever o DOM sem mudança
  const numberFmt = new Intl.NumberFormat('pt-BR');

  /* escrita: base para a meta de sessão e para as estatísticas do dia */
  let sessionStartWords = 0;
  let lastSavedWords = 0;
  let lastSaveAt = 0;

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
    statusSelect.value = chapter.status || 'rascunho';
    scopeMode = 'para';
    syncScopeUI();
    lastAlignUI = '';
    lastBlock = null;
    setDoc(chapter.content || '');
    dirty = false;
    setSaveState('saved');
    updateStats();
    updateAlignUI();
    histReset();

    // base para a meta de sessão e para a marcação de "continuar lendo"
    sessionStartWords = Content.countWords(chapter.content || '');
    lastSavedWords = sessionStartWords;
    lastSaveAt = Date.now();
    Store.Settings.set('lastLocation', { bookId: chapter.bookId, chapterId: chapter.id, at: Date.now() });

    App.navigate('editor');
    applyFocus(Store.Settings.get('editorFocus', false) === true);
    await refreshNav();
    updateGoal();
    if (window.Review) Review.reset();

    if (opts && opts.select) {
      pendingSelect = opts.select;
      setTimeout(focusSelection, 60);
    } else {
      focusStart();
    }
  }

  /* foca o editor com o cursor no começo do primeiro parágrafo */
  function focusStart() {
    contentEl.focus();
    const list = paras();
    if (list.length) setCaret(list[0], 0);
  }

  function focusSelection() {
    const q = pendingSelect;
    pendingSelect = null;
    if (!q) { focusStart(); return; }
    const text = getText();
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) { focusStart(); return; }
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
    App.chapter.content = getText();
    await Store.Chapters.save(App.chapter);
    setSaveState('saved');
    trackWriting();
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

  /* ---------------- parágrafos (blocos) ----------------
     Um capítulo é uma sequência de parágrafos separados por linha em
     branco. No editor cada parágrafo é um bloco <p class="para"> com
     alinhamento próprio (data-align); o marcador ⟦x⟧ só existe no
     texto salvo, nunca na tela. */

  const PARA_BREAK = /\n{2,}/;
  const MARKER_LEN = 4; // '⟦x⟧ '

  function isPara(node) {
    return !!node && node.nodeType === 1 && node.tagName === 'P' &&
      !!node.classList && node.classList.contains('para');
  }

  function paras() {
    return Array.prototype.filter.call(contentEl.children, isPara);
  }

  function chapterAlign() { return (App.chapter && App.chapter.align) || 'j'; }

  /* texto lógico de um nó: <br> vira quebra de linha; elementos internos
     (colados de outros programas) entram apenas como texto */
  function textOf(node) {
    let out = '';
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) out += n.nodeValue;
      else if (n.nodeName === 'BR') out += '\n';
      else if (n.nodeType === 1) out += textOf(n);
    }
    return out;
  }

  function hasFormatting(node) {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      if (n.nodeName !== 'BR') return true;
      if (hasFormatting(n)) return true;
    }
    return false;
  }

  /* texto do parágrafo (o <br> "fantasma" do bloco vazio é descartado) */
  function paraText(el) {
    const t = textOf(el);
    return /^\n*$/.test(t) ? '' : t;
  }

  function setParaText(el, text) {
    el.textContent = '';
    const lines = String(text == null ? '' : text).split('\n');
    lines.forEach(function (line, i) {
      if (i) el.appendChild(document.createElement('br'));
      if (line) el.appendChild(document.createTextNode(line));
    });
    if (!el.firstChild) el.appendChild(document.createElement('br')); // cursor visível
  }

  function makePara(text, align) {
    const p = document.createElement('p');
    p.className = 'para';
    if (align) p.setAttribute('data-align', align);
    setParaText(p, text);
    return p;
  }

  /* divide um texto em parágrafos (linha em branco separa) */
  function splitParas(text) {
    const parts = [];
    const re = /\n{2,}/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      parts.push({ text: text.slice(last, m.index), start: last });
      last = m.index + m[0].length;
    }
    parts.push({ text: text.slice(last), start: last });
    return parts;
  }

  function docText() {
    return paras().map(paraText).join('\n\n');
  }

  /* texto no formato salvo (com os marcadores ⟦x⟧) */
  function serialize() {
    const base = chapterAlign();
    const blocks = paras().map(function (p) {
      const align = p.getAttribute('data-align') || base;
      return { type: 'para', align: align, text: paraText(p) };
    });
    return Content.serialize(blocks, base);
  }

  /* reconstrói os blocos a partir do texto salvo */
  function setDoc(text) {
    contentEl.textContent = '';
    const base = chapterAlign();
    const blocks = Content.parse(String(text == null ? '' : text), base);
    blocks.forEach(function (b) {
      if (b.type === 'rule') {
        // regra no editor: mantida como linha divisória dentro de um parágrafo
        contentEl.appendChild(makePara('---', base));
      } else if (b.type === 'para') {
        contentEl.appendChild(makePara(b.text, b.align));
      }
    });
    if (!contentEl.firstChild) contentEl.appendChild(makePara('', null));
    lastBlock = paras()[0] || null;
  }

  /* ---------------- cursor × blocos ---------------- */

  function blockOf(node) {
    while (node && node !== contentEl) {
      if (isPara(node)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function indexOfChild(node) {
    let i = 0;
    while ((node = node.previousSibling)) i++;
    return i;
  }

  function nodeLen(n) {
    if (n.nodeType === 3) return n.nodeValue.length;
    if (n.nodeName === 'BR') return 1;
    if (n.nodeType === 1) return textOf(n).length;
    return 0;
  }

  /* posição lógica (dentro do bloco) do ponto do cursor */
  function offsetWithin(root, container, offset) {
    let acc = 0;
    if (container === root) {
      for (let i = 0; i < offset && i < root.childNodes.length; i++) acc += nodeLen(root.childNodes[i]);
      return acc;
    }
    const path = [];
    let node = container;
    while (node && node !== root) { path.unshift(node); node = node.parentNode; }
    if (node !== root) return null;
    let cur = root;
    for (let i = 0; i < path.length; i++) {
      for (let sib = cur.firstChild; sib && sib !== path[i]; sib = sib.nextSibling) acc += nodeLen(sib);
      cur = path[i];
    }
    if (container.nodeType === 3) return acc + offset;
    for (let i = 0; i < offset && i < cur.childNodes.length; i++) acc += nodeLen(cur.childNodes[i]);
    return acc;
  }

  /* ponto (nó, deslocamento) de uma posição lógica dentro do bloco */
  function pointAt(root, target) {
    let acc = 0;
    let found = null;
    (function walk(node) {
      for (let n = node.firstChild; n && !found; n = n.nextSibling) {
        if (n.nodeType === 3) {
          const len = n.nodeValue.length;
          if (target <= acc + len) { found = { node: n, offset: target - acc }; return; }
          acc += len;
        } else if (n.nodeName === 'BR') {
          if (target <= acc) { found = { node: node, offset: indexOfChild(n) }; return; }
          acc += 1;
          if (target === acc) { found = { node: node, offset: indexOfChild(n) + 1 }; return; }
        } else if (n.nodeType === 1) {
          walk(n);
        }
      }
    })(root);
    return found || { node: root, offset: root.childNodes.length };
  }

  function rangeFor(block, offset) {
    const pt = pointAt(block, Math.max(0, offset || 0));
    const r = document.createRange();
    const max = pt.node.nodeType === 3 ? pt.node.nodeValue.length : pt.node.childNodes.length;
    try { r.setStart(pt.node, Math.min(pt.offset, max)); } catch (e) { r.setStart(block, 0); }
    r.collapse(true);
    return r;
  }

  function setCaret(block, offset) {
    if (!block) return;
    const r = rangeFor(block, offset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    lastBlock = blockOf(r.startContainer) || block;
    updateAlignUI();
  }

  function caretInfo() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    const block = blockOf(r.startContainer);
    if (!block) return null;
    const offset = offsetWithin(block, r.startContainer, r.startOffset);
    return offset == null ? null : { block: block, offset: offset };
  }

  /* nós "estranhos" na raiz (colados de outros programas) viram parágrafos */
  function wrapForeign() {
    Array.prototype.slice.call(contentEl.childNodes).forEach(function (n) {
      if (isPara(n)) return;
      const text = (n.nodeType === 3) ? n.nodeValue : textOf(n);
      if (!text) { contentEl.removeChild(n); return; }
      const frag = document.createDocumentFragment();
      splitParas(text).forEach(function (part) {
        frag.appendChild(makePara(part.text, null));
      });
      contentEl.replaceChild(frag, n);
    });
  }

  function needsCanonicalizeIn(block) {
    if (!isPara(block)) return true;
    if (hasFormatting(block)) return true;
    return PARA_BREAK.test(paraText(block));
  }

  /* verificação completa: além de blocos com formatação colada ou linha
     em branco interna, confere se a lista de blocos é a canônica do texto
     (assim Enter repetido no fim não acumula parágrafos vazios) */
  function needsCanonicalize() {
    const kids = contentEl.childNodes;
    const list = paras();
    if (kids.length !== list.length) return true; // nó estranho na raiz
    for (let i = 0; i < kids.length; i++) {
      if (needsCanonicalizeIn(kids[i])) return true;
    }
    return splitParas(docText()).length !== list.length;
  }

  /* Reconstrói a estrutura em blocos canônicos mexendo o mínimo possível:
     divide blocos com linha em branco interna, engloba nós estranhos na
     raiz e descarta parágrafos vazios que a leitura já ignora. Blocos que
     não precisam mudar ficam intactos — isso preserva o histórico de
     desfazer do navegador (que se perde ao recriar todo o conteúdo). */
  function canonicalize() {
    const info = caretInfo();
    let caretDoc = null;
    if (info) {
      const list0 = paras();
      let acc0 = 0;
      for (let i = 0; i < list0.length; i++) {
        if (list0[i] === info.block) {
          caretDoc = acc0 + Math.min(info.offset, paraText(list0[i]).length);
          break;
        }
        acc0 += paraText(list0[i]).length + 2;
      }
    }

    // 1) nós estranhos na raiz viram parágrafos
    wrapForeign();

    // 2) divide blocos com linha em branco interna (mantendo o alinhamento)
    Array.prototype.slice.call(contentEl.childNodes).forEach(function (node) {
      if (!isPara(node)) return;
      const text = paraText(node);
      if (!PARA_BREAK.test(text)) return;
      const align = node.getAttribute('data-align');
      const frag = document.createDocumentFragment();
      splitParas(text).forEach(function (part) {
        frag.appendChild(makePara(part.text, align));
      });
      contentEl.replaceChild(frag, node);
    });

    // 3) parágrafos vazios: só valem no começo e no fim (um de cada)
    const list = paras();
    for (let i = list.length - 1; i >= 0; i--) {
      if (paraText(list[i]) !== '') continue;
      const prevEmpty = i > 0 && paraText(list[i - 1]) === '';
      if (i > 0 && i < list.length - 1) { contentEl.removeChild(list[i]); continue; } // meio
      if (i === list.length - 1 && prevEmpty) { contentEl.removeChild(list[i]); continue; } // fim duplicado
      if (i === 0 && list.length > 1 && paraText(list[1]) === '') { contentEl.removeChild(list[i]); continue; } // começo duplicado
    }

    if (!contentEl.firstChild) contentEl.appendChild(makePara('', null));
    if (caretDoc != null) setCaretAtDoc(caretDoc);
  }

  /* coloca o cursor a partir de um deslocamento no texto do documento */
  function setCaretAtDoc(docOffset) {
    const list = paras();
    if (!list.length) return;
    let at = 0;
    for (let i = 0; i < list.length; i++) {
      const len = paraText(list[i]).length;
      if (docOffset <= at + len || i === list.length - 1) {
        setCaret(list[i], Math.max(0, Math.min(docOffset - at, len)));
        return;
      }
      at += len + 2;
    }
  }

  /* ---------------- estatísticas ---------------- */

  function updateStats() {
    const text = serialize();
    const words = Content.countWords(text);
    const chars = Content.strip(text).length;
    statsEl.textContent =
      numberFmt.format(words) + (words === 1 ? ' palavra' : ' palavras') +
      ' · ' + numberFmt.format(chars) + ' caracteres' +
      (words ? ' · ' + App.readTime(words) : '');
    syncEmpty(text);
  }

  function syncEmpty(text) {
    const t = (text == null) ? serialize() : text;
    contentEl.classList.toggle('is-empty', Content.strip(t).trim() === '');
  }

  /* ---------------- alinhamento por parágrafo ---------------- */

  function currentParagraphAlign() {
    const block = lastBlock || paras()[0];
    const a = block && block.getAttribute('data-align');
    return a || chapterAlign();
  }

  /* o bloco inteiro segue o padrão do capítulo; cada parágrafo pode
     sobrepor com data-align. A barra mostra o alinhamento do parágrafo
     do cursor e só toca o DOM quando algo muda. */
  function updateAlignUI() {
    contentEl.style.textAlign = Content.css(chapterAlign());
    const eff = currentParagraphAlign();
    const label = 'Parágrafo: ' + Content.label(eff);
    const key = eff + '|' + label;
    if (key === lastAlignUI) return;
    lastAlignUI = key;
    alignButtons.forEach(function (b) {
      const on = b.getAttribute('data-align') === eff;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (alignCurrent) alignCurrent.textContent = label;
  }

  /* estado dos botões de escopo (Parágrafo | Capítulo) */
  function syncScopeUI() {
    scopeButtons.forEach(function (b) {
      const on = b.getAttribute('data-scope') === scopeMode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function applyAlign(code) {
    if (!App.chapter || !code) return;
    const base = chapterAlign();

    if (scopeMode === 'chapter') {
      // novo padrão do capítulo: parágrafos iguais a ele viram redundância
      App.chapter.align = code;
      paras().forEach(function (p) {
        if (p.getAttribute('data-align') === code) p.removeAttribute('data-align');
      });
      lastAlignUI = '';
      updateStats();
      scheduleSave();
      updateAlignUI();
      histPush();
      App.toast('Alinhamento do capítulo: ' + Content.label(code) + '.');
      return;
    }

    const block = lastBlock || paras()[0];
    if (!block) return;
    if (code === base) block.removeAttribute('data-align');
    else block.setAttribute('data-align', code);
    lastBlock = block;
    lastAlignUI = '';
    updateStats();
    scheduleSave();
    updateAlignUI();
    histPush();
  }

  /* ---------------- desfazer/refazer ----------------
     O editor remonta blocos em alguns casos (colar, Enter no fim do
     texto, alinhamento), e isso apaga o histórico nativo do navegador.
     Então mantemos um histórico próprio de estados (texto salvo + cursor),
     o que também deixa o desfazer previsível entre digitação, colagem e
     alinhamento. */

  const HIST_MAX = 120;
  const HIST_DELAY = 500; // agrupa a digitação em um passo só
  let hist = [];
  let histPos = -1;
  let histTimer = null;

  /* deslocamento (no texto salvo) do começo do bloco + posição do cursor */
  function caretDocOffset() {
    const info = caretInfo();
    if (!info) return null;
    const list = paras();
    let acc = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i] === info.block) return acc + Math.min(info.offset, paraText(list[i]).length);
      acc += paraText(list[i]).length + 2;
    }
    return acc;
  }

  function histPush() {
    if (histTimer !== null) { clearTimeout(histTimer); histTimer = null; }
    const text = serialize();
    const caret = caretDocOffset();
    const align = chapterAlign();
    const cur = histPos >= 0 ? hist[histPos] : null;
    if (cur && cur.text === text && cur.align === align) { cur.caret = caret; return; } // só o cursor andou
    hist.splice(histPos + 1);
    hist.push({ text: text, caret: caret, align: align });
    if (hist.length > HIST_MAX) hist.shift();
    histPos = hist.length - 1;
  }

  /* guarda o estado depois de uma pausa na digitação */
  function histSchedule() {
    if (histTimer !== null) clearTimeout(histTimer);
    histTimer = setTimeout(histPush, HIST_DELAY);
  }

  function histReset() {
    if (histTimer !== null) { clearTimeout(histTimer); histTimer = null; }
    hist = [];
    histPos = -1;
    histPush();
  }

  function histApply(entry) {
    if (App.chapter && entry.align) App.chapter.align = entry.align;
    setDoc(entry.text);
    if (entry.caret != null) setCaretAtDoc(entry.caret);
    updateStats();
    scheduleSave();
    lastAlignUI = '';
    updateAlignUI();
    if (window.Review) Review.onTextChange();
  }

  function undo() {
    histPush(); // garante que o estado atual está gravado antes de voltar
    if (histPos <= 0) return;
    histPos--;
    histApply(hist[histPos]);
  }

  function redo() {
    if (histPos < 0 || histPos >= hist.length - 1) return;
    histPos++;
    histApply(hist[histPos]);
  }

  /* ---------------- navegação até um trecho ---------------- */

  /* posição (bloco + deslocamento interno) de um deslocamento no
     texto salvo (com marcadores) */
  function pointForOffset(offset) {
    const base = chapterAlign();
    const list = paras();
    let acc = 0;
    for (let i = 0; i < list.length; i++) {
      const align = list[i].getAttribute('data-align');
      const body = paraText(list[i]);
      const marker = (align && align !== base) ? MARKER_LEN : 0;
      const total = marker + body.length;
      if (offset <= acc + total || i === list.length - 1) {
        return { block: list[i], offset: Math.max(0, Math.min(offset - acc - marker, body.length)) };
      }
      acc += total + 2;
    }
    return { block: list[0], offset: 0 };
  }

  /* rola o editor até a posição pedida */
  function scrollToOffset(offset) {
    const pt = pointForOffset(offset);
    if (!pt.block) return;
    const r = rangeFor(pt.block, pt.offset);
    const rect = r.getBoundingClientRect();
    const box = contentEl.getBoundingClientRect();
    if (!rect || (!rect.height && !rect.top && !rect.bottom)) return;
    const target = contentEl.scrollTop + (rect.top - box.top) - contentEl.clientHeight * 0.3;
    contentEl.scrollTop = target > 0 ? target : 0;
  }

  /* seleciona um trecho no editor e rola até ele */
  function selectRange(start, end) {
    const text = getText();
    start = Math.max(0, Math.min(start, text.length));
    end = Math.max(start, Math.min(end == null ? start : end, text.length));
    contentEl.focus();
    const a = pointForOffset(start);
    const b = pointForOffset(end);
    const ra = rangeFor(a.block, a.offset);
    const rb = rangeFor(b.block, b.offset);
    const span = document.createRange();
    span.setStart(ra.startContainer, ra.startOffset);
    span.setEnd(rb.startContainer, rb.startOffset);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(span);
    lastBlock = a.block;
    scrollToOffset(start);
    updateAlignUI();
  }

  /* ---------------- capa do capítulo ---------------- */

  function openCoverModal() {
    if (!App.chapter) return;
    const body = App.el('div');
    const widget = Ui.cover({
      value: App.chapter.cover || null,
      alt: 'Pré-visualização da capa',
      hint: 'A capa aparece na lista de capítulos, no leitor e nas exportações. A imagem é reduzida aqui no aparelho (até 400×600 no retrato ou 600×400 na paisagem).'
    });
    body.appendChild(widget.element);

    App.openModal({
      title: '<span>' + icon('image') + ' Capa do capítulo</span>',
      body: body,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar',
          className: 'primary',
          onClick: async function (close) {
            App.chapter.cover = widget.get();
            await Store.Chapters.save(App.chapter);
            App.toast(App.chapter.cover ? 'Capa do capítulo salva.' : 'Capa do capítulo removida.');
            if (App.book && typeof App.renderChapters === 'function') App.renderChapters();
            close();
            return false;
          }
        }
      ]
    });
  }

  /* ---------------- modo foco ---------------- */

  function applyFocus(on) {
    document.body.classList.toggle('focus-mode', !!on);
    if (!focusBtn) return;
    focusBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    focusBtn.classList.toggle('primary', !!on);
    const use = focusBtn.querySelector('use');
    if (use) use.setAttribute('href', on ? '#i-minimize' : '#i-maximize');
    focusBtn.title = on ? 'Sair do modo foco (Esc)' : 'Modo foco: esconde os painéis (Ctrl+Shift+F)';
  }

  function toggleFocus() {
    const on = !document.body.classList.contains('focus-mode');
    applyFocus(on);
    Store.Settings.set('editorFocus', on);
    if (on) App.toast('Modo foco ativado. Pressione Esc para sair.', 'info');
  }

  /* ---------------- navegação entre capítulos + sumário ---------------- */

  async function refreshNav() {
    if (!App.book || !App.chapter) return;
    const chapters = await Store.Chapters.listByBook(App.book.id);
    const idx = chapters.findIndex(function (c) { return c.id === App.chapter.id; });
    if (prevChapterBtn) prevChapterBtn.disabled = idx <= 0;
    if (nextChapterBtn) nextChapterBtn.disabled = idx < 0 || idx >= chapters.length - 1;
    renderToc(chapters, idx);
  }

  function renderToc(chapters, currentIdx) {
    if (!tocEl) return;
    tocEl.innerHTML = '';
    const head = App.el('div', 'toc-head');
    head.innerHTML = '<span>' + icon('list') + ' Sumário</span>';
    const closeBtn = App.el('button', 'icon-btn');
    closeBtn.innerHTML = icon('x');
    closeBtn.title = 'Fechar sumário';
    closeBtn.setAttribute('aria-label', 'Fechar sumário');
    closeBtn.addEventListener('click', function () { tocEl.classList.add('hidden'); });
    head.appendChild(closeBtn);
    tocEl.appendChild(head);

    const list = App.el('ol', 'toc-items');
    chapters.forEach(function (ch, i) {
      const li = document.createElement('li');
      const b = App.el('button', 'toc-item' + (i === currentIdx ? ' active' : ''));
      const words = Content.countWords(ch.content);
      b.innerHTML =
        '<span class="toc-num">' + (i + 1) + '</span>' +
        '<span class="toc-title">' + App.esc(ch.title || 'Sem título') + '</span>' +
        '<span class="toc-words muted">' + numberFmt.format(words) + '</span>';
      b.title = ch.title || 'Sem título';
      b.addEventListener('click', async function () {
        tocEl.classList.add('hidden');
        if (i !== currentIdx) await open(ch.id);
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    tocEl.appendChild(list);
    if (!chapters.length) tocEl.appendChild(App.el('p', 'muted', 'Nenhum capítulo.'));
  }

  async function toggleToc() {
    if (!tocEl) return;
    if (tocEl.classList.contains('hidden')) {
      await refreshNav();
      tocEl.classList.remove('hidden');
    } else {
      tocEl.classList.add('hidden');
    }
  }

  async function goRelative(delta) {
    if (!App.book || !App.chapter) return;
    const chapters = await Store.Chapters.listByBook(App.book.id);
    const idx = chapters.findIndex(function (c) { return c.id === App.chapter.id; });
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= chapters.length) return;
    await open(chapters[j].id);
  }

  /* ---------------- meta de escrita ---------------- */

  function todayKey() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function goalConfig() { return Store.Settings.get('writingGoal', {}) || {}; }

  function todayStats() {
    const all = Store.Settings.get('writingStats', {}) || {};
    return all[todayKey()] || { words: 0, ms: 0 };
  }

  /* acumula as palavras escritas (delta positivo desde o último save) e o
     tempo aproximado de escrita do dia; alimenta a meta e o painel. */
  function trackWriting() {
    if (!App.chapter) return;
    const words = Content.countWords(App.chapter.content);
    const delta = words - lastSavedWords;
    lastSavedWords = words;
    const now = Date.now();
    const elapsed = lastSaveAt ? Math.min(now - lastSaveAt, 90000) : 0;
    lastSaveAt = now;

    if (delta > 0 || elapsed > 0) {
      const all = Object.assign({}, Store.Settings.get('writingStats', {}) || {});
      const key = todayKey();
      const day = Object.assign({ words: 0, ms: 0 }, all[key] || {});
      if (delta > 0) day.words += delta;
      day.ms = (day.ms || 0) + elapsed;
      all[key] = day;
      Store.Settings.set('writingStats', all);
    }
    updateGoal();
  }

  function updateGoal() {
    if (!goalEl) return;
    const g = goalConfig();
    const daily = Number(g.daily) || 0;
    const session = Number(g.session) || 0;
    goalEl.classList.remove('hidden');

    if (!daily && !session) {
      goalEl.innerHTML = icon('target') + ' <span class="goal-text">Definir meta</span>';
      goalEl.title = 'Defina uma meta diária ou de sessão';
      goalEl.classList.remove('reached');
      return;
    }

    let done, target, label;
    if (daily) {
      done = todayStats().words;
      target = daily;
      label = 'hoje';
    } else {
      done = Math.max(0, Content.countWords(serialize()) - sessionStartWords);
      target = session;
      label = 'sessão';
    }
    const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
    const reached = target > 0 && done >= target;
    goalEl.classList.toggle('reached', reached);
    goalEl.innerHTML = icon('target') +
      ' <span class="goal-text">' + numberFmt.format(done) + '/' + numberFmt.format(target) + '</span>' +
      ' <span class="goal-meter"><span class="goal-fill" style="transform:scaleX(' + (pct / 100) + ')"></span></span>';
    goalEl.title = 'Meta de ' + label + ': ' + pct + '%' + (reached ? ' — meta atingida!' : '') + '. Clique para ajustar.';
  }

  function openGoalModal() {
    const g = goalConfig();
    const body = App.el('div');
    body.innerHTML =
      '<p class="hint" style="margin-top:0">A meta diária conta as palavras escritas hoje; a de sessão, as escritas desde que este capítulo foi aberto. Use 0 para desativar.</p>' +
      '<div class="field"><label for="goal-daily">Meta diária (palavras)</label>' +
      '<input id="goal-daily" type="number" min="0" step="50" value="' + (Number(g.daily) || 0) + '"></div>' +
      '<div class="field"><label for="goal-session">Meta de sessão (palavras)</label>' +
      '<input id="goal-session" type="number" min="0" step="50" value="' + (Number(g.session) || 0) + '"></div>';
    App.openModal({
      title: '<span>' + icon('target') + ' Meta de escrita</span>',
      body: body,
      actions: [
        { label: 'Cancelar' },
        {
          label: 'Salvar',
          className: 'primary',
          onClick: async function (close) {
            const daily = Math.max(0, parseInt(body.querySelector('#goal-daily').value, 10) || 0);
            const session = Math.max(0, parseInt(body.querySelector('#goal-session').value, 10) || 0);
            await Store.Settings.set('writingGoal', { daily: daily, session: session });
            updateGoal();
            close();
          }
        }
      ]
    });
  }

  /* ---------------- API pública ---------------- */

  function getText() { return serialize(); }

  async function setText(newText) {
    histPush();
    setDoc(newText);
    updateStats();
    scheduleSave();
    histPush();
    await flush();
  }

  function isDirty() { return dirty; }

  function setTitle(newTitle) {
    titleInput.value = newTitle;
    scheduleSave();
  }

  /* ---------------- edição (blocos) ---------------- */

  /* Depois de qualquer edição: conserta a estrutura (se preciso), atualiza
     estatísticas, agenda o salvamento e avisa a revisão.
     `full` faz a checagem completa (estrutura inteira canônica) e é usado
     em Enter/colar; digitar usa a checagem barata só no bloco do cursor. */
  function afterEdit(full) {
    if (full) {
      if (needsCanonicalize()) canonicalize();
    } else {
      const info = caretInfo();
      if (info ? needsCanonicalizeIn(info.block) : needsCanonicalize()) canonicalize();
    }
    updateStats();
    scheduleSave();
    trackCaret();
    histSchedule();
    if (window.Review) Review.onTextChange();
  }

  /* reserva para navegadores sem execCommand: insere texto (e quebras)
     direto no cursor, reposicionando pelo modelo de blocos (a posição
     logo após um <br> final é ambígua para o navegador) */
  function insertAtCaret(text) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const info = caretInfo();
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const frag = document.createDocumentFragment();
    String(text).split('\n').forEach(function (line, i) {
      if (i) frag.appendChild(document.createElement('br'));
      if (line) frag.appendChild(document.createTextNode(line));
    });
    if (!frag.firstChild) return;
    r.insertNode(frag);
    if (info) setCaret(info.block, info.offset + String(text).length);
  }

  function insertLineBreak() {
    let ok = false;
    try { ok = document.execCommand('insertLineBreak'); } catch (e) { ok = false; }
    if (!ok) insertAtCaret('\n');
  }

  /* Colar/inserir texto puro. As quebras não podem ir direto para o
     insertText: o navegador as transforma em parágrafos novos. Elas vão
     como um separador invisível e viram <br> logo depois, preservando a
     diferença entre quebra de linha e parágrafo. */
  const SENTINEL = '\u2063';

  function sentinelsToBreaks(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue.indexOf(SENTINEL) >= 0) targets.push(n);
    }
    targets.forEach(function (node) {
      const parts = node.nodeValue.split(SENTINEL);
      const frag = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i) frag.appendChild(document.createElement('br'));
        if (part) frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  function insertPlainText(text) {
    const clean = String(text).replace(/\r\n?/g, '\n');
    const info = caretInfo();
    const target = info ? { block: info.block, offset: info.offset + clean.length } : null;
    const single = clean.indexOf('\n') < 0;
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, single ? clean : clean.split('\n').join(SENTINEL));
    } catch (e) { ok = false; }
    if (!ok) { insertAtCaret(clean); return; }
    if (!single) sentinelsToBreaks(contentEl);
    if (target) setCaret(target.block, target.offset);
  }

  function trackCaret() {
    const info = caretInfo();
    if (info && info.block) lastBlock = info.block;
    updateAlignUI();
  }

  contentEl.addEventListener('input', function (ev) {
    if (ev.isComposing) return;
    afterEdit();
  });

  /* Enter: dentro do parágrafo vira quebra de linha; no fim do parágrafo
     o navegador cria o bloco seguinte (novo parágrafo). Num parágrafo vazio
     o Enter não faz nada — o parágrafo novo já existe (isso evita acumular
     linhas em branco ao apertar Enter duas vezes, como é costume).
     Shift+Enter é a quebra de linha nativa (útil no fim do parágrafo). */
  function handleEnter() {
    const info = caretInfo();
    histPush();
    if (info && paraText(info.block) === '') return; // já está num parágrafo vazio
    insertLineBreak();
    afterEdit(true);
  }

  contentEl.addEventListener('keydown', function (ev) {
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && !ev.altKey) {
      const k = (ev.key || '').toLowerCase();
      if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); return; }
      if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); redo(); return; }
      return;
    }
    if (ev.key !== 'Enter' || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.isComposing) return;
    ev.preventDefault();
    handleEnter();
  });

  /* cola sempre como texto simples (sem formatação de outros programas) */
  contentEl.addEventListener('paste', function (ev) {
    const data = ev.clipboardData || window.clipboardData;
    const text = data ? data.getData('text/plain') : '';
    ev.preventDefault();
    if (!text) return;
    histPush();
    insertPlainText(text.replace(/\r\n?/g, '\n'));
    afterEdit(true);
    histPush();
  });

  contentEl.addEventListener('drop', function (ev) {
    const data = ev.dataTransfer;
    if (!data) return;
    const text = data.getData('text/plain');
    if (!text) return;
    ev.preventDefault();
    try {
      if (document.caretRangeFromPoint) {
        const r = document.caretRangeFromPoint(ev.clientX, ev.clientY);
        if (r && contentEl.contains(r.startContainer)) {
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        }
      }
    } catch (e) { /* ignora */ }
    histPush();
    insertPlainText(text.replace(/\r\n?/g, '\n'));
    afterEdit(true);
    histPush();
  });

  /* o editor é texto puro e Enter é quebra de linha — mesmo quando o
     teclado (celular) manda insertParagraph sem keydown; o histórico
     nativo (menu/atalho do teclado) é redirecionado para o nosso */
  contentEl.addEventListener('beforeinput', function (ev) {
    const t = ev.inputType || '';
    if (t === 'insertParagraph') {
      ev.preventDefault();
      handleEnter();
      return;
    }
    if (t === 'historyUndo') { ev.preventDefault(); undo(); return; }
    if (t === 'historyRedo') { ev.preventDefault(); redo(); return; }
    if (t.indexOf('format') === 0) ev.preventDefault();
  });

  contentEl.addEventListener('click', trackCaret);
  contentEl.addEventListener('keyup', trackCaret);
  document.addEventListener('selectionchange', function () {
    if (App.view !== 'editor') return;
    const sel = window.getSelection();
    if (sel && sel.anchorNode && contentEl.contains(sel.anchorNode)) trackCaret();
  });

  titleInput.addEventListener('input', scheduleSave);

  // barra de alinhamento
  alignButtons.forEach(function (btn) {
    // impede que o clique roube a seleção do textarea
    btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    btn.addEventListener('click', function () { applyAlign(btn.getAttribute('data-align')); });
  });
  if (scopeButtons.length) {
    scopeButtons.forEach(function (btn) {
      // impede que o clique roube a seleção do textarea
      btn.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
      btn.addEventListener('click', function () {
        scopeMode = btn.getAttribute('data-scope') || 'para';
        syncScopeUI();
        updateAlignUI();
      });
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

  // Ctrl+S salva agora · Ctrl+H abre a substituição · Ctrl+Shift+F modo foco
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
    } else if (key === 'f' && ev.shiftKey) {
      if (App.view !== 'editor') return;
      ev.preventDefault();
      toggleFocus();
    }
  });

  // Esc sai do modo foco (a menos que um modal esteja aberto e trate o Esc)
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape') return;
    if (App.view !== 'editor') return;
    if (document.querySelector('.modal-overlay')) return;
    if (document.body.classList.contains('focus-mode')) { ev.preventDefault(); toggleFocus(); }
  });

  // navegação entre capítulos, sumário, foco e meta
  if (prevChapterBtn) prevChapterBtn.addEventListener('click', function () { goRelative(-1); });
  if (nextChapterBtn) nextChapterBtn.addEventListener('click', function () { goRelative(1); });
  if (tocBtn) tocBtn.addEventListener('click', function () { toggleToc(); });
  if (focusBtn) focusBtn.addEventListener('click', function () { toggleFocus(); });
  if (goalEl) goalEl.addEventListener('click', openGoalModal);

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
    selectRange: selectRange,
    undo: undo,
    redo: redo
  };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Editor = api;
  window.Autor = window.Autor || {};
  window.Autor.editor = api;

  return api;
})();
