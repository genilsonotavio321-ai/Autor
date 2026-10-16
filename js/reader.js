/* ============================================================
   reader.js — modo leitura (livro inteiro ou capítulo), com fonte
   ajustável, serifada/sans, temas claro/sépia/escuro, sumário,
   busca no texto, leitura em voz alta (TTS) e retomada de posição.
   ============================================================ */
const Reader = (function () {
  'use strict';

  const view = document.getElementById('view-reader');
  const content = document.getElementById('reader-content');
  const progressEl = document.getElementById('reader-progress');
  const themeSelect = document.getElementById('reader-theme');
  const serifBtn = document.getElementById('reader-font-serif');
  const tocEl = document.getElementById('reader-toc');
  const tocBtn = document.getElementById('reader-toc-btn');
  const searchBtn = document.getElementById('reader-search-btn');
  const searchBar = document.getElementById('reader-searchbar');
  const searchInput = document.getElementById('reader-search-input');
  const searchCount = document.getElementById('reader-search-count');
  const ttsPlayBtn = document.getElementById('reader-tts-play');
  const ttsStopBtn = document.getElementById('reader-tts-stop');

  let current = null; // {bookId} ou {chapterId}
  let currentChapters = [];
  let chapterCount = 0;
  let resumePct = 0; // posição (0..1) a ser restaurada ao abrir

  const MIN_FONT = 15;
  const MAX_FONT = 30;

  /* ---------------- preferências ---------------- */

  function applyPrefs() {
    const size = Store.Settings.get('readerFont', 19);
    const font = Store.Settings.get('readerFontFamily', 'serif'); // serif | sans
    const theme = Store.Settings.get('readerTheme', 'light');     // light | sepia | dark

    content.style.setProperty('--reader-font', size + 'px');
    view.setAttribute('data-reader-font', font);
    view.setAttribute('data-reader-theme', theme);

    themeSelect.value = theme;
    serifBtn.textContent = font === 'serif' ? 'Serif' : 'Sans';
    serifBtn.classList.toggle('primary', font === 'sans');
  }

  async function changeFont(delta) {
    let size = Store.Settings.get('readerFont', 19) + delta;
    size = Math.max(MIN_FONT, Math.min(MAX_FONT, size));
    await Store.Settings.set('readerFont', size);
    applyPrefs();
  }

  /* ---------------- renderização ---------------- */

  function renderContent(chapters) {
    currentChapters = chapters;
    const parts = [];
    parts.push('<h1>' + App.esc(chapters._bookTitle || 'Leitura') + '</h1>');
    if (chapters._bookAuthor) parts.push('<p class="muted" style="text-align:center">por ' + App.esc(chapters._bookAuthor) + '</p>');
    if (chapters._bookCover) parts.push('<img class="reader-cover" src="' + App.esc(chapters._bookCover) + '" alt="Capa">');

    chapters.forEach(function (ch, i) {
      const chapterAlign = ch.align || 'j';
      parts.push('<section class="chapter-block" data-index="' + i + '">');
      if (ch.cover) {
        parts.push('<img class="reader-ch-cover" src="' + App.esc(ch.cover) + '" alt="">');
      }
      parts.push('<h2>' + (chapters._bookTitle ? (i + 1) + '. ' : '') + App.esc(ch.title || 'Sem título') + '</h2>');
      const cblocks = Content.parse(ch.content || '', chapterAlign);
      cblocks.forEach(function (b) {
        if (b.type === 'rule') {
          parts.push('<hr class="pagebreak">');
          return;
        }
        if (b.type === 'para') {
          const align = Content.css(b.align || chapterAlign);
          parts.push('<p style="text-align:' + align + '">' +
            App.esc(String(b.text == null ? '' : b.text)).replace(/\n/g, '<br>') + '</p>');
        }
      });
      parts.push('</section>');
    });

    content.innerHTML = parts.join('');
    content.scrollTop = 0;
    updateProgress();
  }

  /* ---------------- sumário ---------------- */

  function buildTOC(currentIdx) {
    if (!tocEl) return;
    tocEl.innerHTML = '';
    const head = App.el('div', 'toc-head');
    head.innerHTML = '<span>' + App.icon('list') + ' Sumário</span>';
    const closeBtn = App.el('button', 'icon-btn');
    closeBtn.innerHTML = App.icon('x');
    closeBtn.title = 'Fechar sumário';
    closeBtn.setAttribute('aria-label', 'Fechar sumário');
    closeBtn.addEventListener('click', function () { tocEl.classList.add('hidden'); });
    head.appendChild(closeBtn);
    tocEl.appendChild(head);

    if (!currentChapters.length) {
      tocEl.appendChild(App.el('p', 'muted', 'Sem capítulos.'));
      return;
    }
    const list = App.el('ol', 'toc-items');
    currentChapters.forEach(function (ch, i) {
      const li = document.createElement('li');
      const b = App.el('button', 'toc-item' + (i === currentIdx ? ' active' : ''));
      b.innerHTML =
        '<span class="toc-num">' + (i + 1) + '</span>' +
        '<span class="toc-title">' + App.esc(ch.title || 'Sem título') + '</span>';
      b.title = ch.title || 'Sem título';
      b.addEventListener('click', function () {
        scrollToChapter(i);
        tocEl.classList.add('hidden');
      });
      li.appendChild(b);
      list.appendChild(li);
    });
    tocEl.appendChild(list);
  }

  function toggleTOC() {
    if (!tocEl) return;
    if (tocEl.classList.contains('hidden')) {
      buildTOC(currentChapterIndex());
      tocEl.classList.remove('hidden');
    } else {
      tocEl.classList.add('hidden');
    }
  }

  function currentChapterIndex() {
    const blocks = content.querySelectorAll('.chapter-block');
    let idx = 0;
    blocks.forEach(function (b) {
      if (b.offsetTop - content.offsetTop <= 120) idx = Number(b.getAttribute('data-index'));
    });
    return idx;
  }

  function scrollToChapter(i) {
    const block = content.querySelector('.chapter-block[data-index="' + i + '"]');
    if (!block) return;
    content.scrollTop = block.offsetTop - content.offsetTop - 8;
  }

  /* ---------------- busca no texto ---------------- */

  let searchHits = [];
  let searchIdx = -1;

  function clearSearchMarks() {
    searchHits.forEach(function (mark) {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    searchHits = [];
    searchIdx = -1;
  }

  function highlightSearch(term) {
    clearSearchMarks();
    if (searchCount) searchCount.textContent = '';
    if (!term) return;

    let re;
    try {
      re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    } catch (e) {
      re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    }

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    textNodes.forEach(function (node) {
      const text = node.nodeValue;
      re.lastIndex = 0;
      let m;
      if (!re.test(text)) { re.lastIndex = 0; return; }
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        mark.textContent = m[0];
        frag.appendChild(mark);
        searchHits.push(mark);
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
    });

    if (!searchHits.length) {
      if (searchCount) searchCount.textContent = '0 resultados';
      return;
    }
    searchNext(1, true);
  }

  function searchNext(delta, jump) {
    if (!searchHits.length) return;
    if (!jump && searchHits[searchIdx]) searchHits[searchIdx].classList.remove('active');
    if (jump) searchIdx = 0;
    else searchIdx = (searchIdx + delta + searchHits.length) % searchHits.length;
    const mark = searchHits[searchIdx];
    mark.classList.add('active');
    mark.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (searchCount) searchCount.textContent = (searchIdx + 1) + ' de ' + searchHits.length;
  }

  function openSearch() {
    if (!searchBar) return;
    searchBar.classList.remove('hidden');
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  }

  function closeSearch() {
    if (!searchBar) return;
    clearSearchMarks();
    searchBar.classList.add('hidden');
  }

  /* ---------------- leitura em voz alta (TTS) ---------------- */

  const TTS = { items: [], index: 0, speaking: false, paused: false, activeEl: null };

  function ttsAvailable() { return typeof window.speechSynthesis !== 'undefined'; }

  function pickVoice() {
    const voices = window.speechSynthesis.getVoices() || [];
    let fallback = null;
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      if (/pt[-_]?BR/i.test(v.lang)) return v;
      if (!fallback && /^pt/i.test(v.lang)) fallback = v;
    }
    return fallback;
  }

  function collectTTSItems() {
    const nodes = content.querySelectorAll('h1, h2, p');
    const items = [];
    nodes.forEach(function (el) {
      const t = el.textContent.trim();
      if (t) items.push({ el: el, text: t });
    });
    return items;
  }

  function speakNext() {
    if (TTS.index >= TTS.items.length) { ttsStop(); return; }
    const item = TTS.items[TTS.index];
    if (TTS.activeEl) TTS.activeEl.classList.remove('tts-current');
    TTS.activeEl = item.el;
    item.el.classList.add('tts-current');
    try { item.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignora */ }
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'pt-BR';
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.rate = Number(Store.Settings.get('readerTTSRate', 1)) || 1;
    u.onend = function () { TTS.index++; if (TTS.speaking) speakNext(); };
    u.onerror = function () { if (TTS.speaking) ttsStop(); };
    window.speechSynthesis.speak(u);
  }

  function ttsStart() {
    if (!ttsAvailable()) { App.toast('Seu navegador não suporta leitura em voz alta.', 'error'); return; }
    window.speechSynthesis.cancel();
    TTS.items = collectTTSItems();
    if (!TTS.items.length) { App.toast('Nada para ler.', 'error'); return; }
    TTS.index = 0;
    TTS.speaking = true;
    TTS.paused = false;
    ttsUI();
    speakNext();
  }

  function ttsToggle() {
    if (!ttsAvailable()) { App.toast('Seu navegador não suporta leitura em voz alta.', 'error'); return; }
    if (TTS.speaking && !TTS.paused) {
      window.speechSynthesis.pause();
      TTS.paused = true;
    } else if (TTS.speaking && TTS.paused) {
      window.speechSynthesis.resume();
      TTS.paused = false;
    } else {
      ttsStart();
    }
    ttsUI();
  }

  function ttsStop() {
    if (ttsAvailable()) window.speechSynthesis.cancel();
    TTS.speaking = false;
    TTS.paused = false;
    if (TTS.activeEl) { TTS.activeEl.classList.remove('tts-current'); TTS.activeEl = null; }
    ttsUI();
  }

  function ttsUI() {
    if (!ttsPlayBtn) return;
    const playing = TTS.speaking && !TTS.paused;
    ttsPlayBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    const use = ttsPlayBtn.querySelector('use');
    if (use) use.setAttribute('href', playing ? '#i-pause' : '#i-play');
    ttsPlayBtn.title = playing ? 'Pausar leitura' : (TTS.speaking ? 'Retomar leitura' : 'Ouvir (ler em voz alta)');
    if (ttsStopBtn) ttsStopBtn.classList.toggle('hidden', !TTS.speaking);
  }

  /* ---------------- abrir / posição ---------------- */

  function saveProgress() {
    if (!current || !current.bookId) return;
    const max = content.scrollHeight - content.clientHeight;
    const pct = max > 0 ? Math.min(1, Math.max(0, content.scrollTop / max)) : 0;
    const all = Object.assign({}, Store.Settings.get('readerProgress', {}) || {});
    all[current.bookId] = { pct: pct, chapterIndex: currentChapterIndex(), at: Date.now() };
    Store.Settings.set('readerProgress', all);
  }

  let progressTimer = null;
  function scheduleProgressSave() {
    clearTimeout(progressTimer);
    progressTimer = setTimeout(saveProgress, 400);
  }

  function restorePosition() {
    if (!resumePct) return;
    const max = content.scrollHeight - content.clientHeight;
    if (max > 0) content.scrollTop = resumePct * max;
    resumePct = 0;
  }

  async function open(opts) {
    current = opts;
    applyPrefs();
    closeSearch();
    ttsStop();
    if (tocEl) tocEl.classList.add('hidden');

    const saved = (current.bookId && (Store.Settings.get('readerProgress', {}) || {})[current.bookId]) || null;

    if (opts.chapterId) {
      const ch = await Store.Chapters.get(opts.chapterId);
      if (!ch) { App.toast('Capítulo não encontrado.', 'error'); return; }
      const book = await Store.Books.get(ch.bookId);
      chapterCount = 0;
      const words = Content.countWords(ch.content);
      progressEl.textContent =
        (book ? book.title + ' · ' : '') + (words ? App.readTime(words) : '');
      const list = [ch];
      list._bookTitle = null;
      resumePct = 0;
      renderContent(list);
    } else {
      const book = await Store.Books.get(opts.bookId);
      if (!book) { App.toast('Livro não encontrado.', 'error'); return; }
      const chapters = await Store.Chapters.listByBook(book.id);
      if (!chapters.length) { App.toast('Este livro ainda não tem capítulos.', 'error'); return; }
      chapterCount = chapters.length;
      progressEl.textContent = '';
      chapters._bookTitle = book.title;
      chapters._bookAuthor = book.author;
      chapters._bookCover = book.cover || null;
      resumePct = saved && typeof saved.pct === 'number' ? saved.pct : 0;
      renderContent(chapters);
    }

    await App.navigate('reader');
    updateProgress();
    restorePosition();
    updateProgress();
    // pré-carrega as vozes do TTS (carregamento assíncrono em alguns navegadores)
    if (ttsAvailable()) window.speechSynthesis.getVoices();
  }

  function updateProgress() {
    if (!chapterCount) return;
    const max = content.scrollHeight - content.clientHeight;
    const pct = max > 0 ? Math.round((content.scrollTop / max) * 100) : 0;
    // capítulo atual pelo topo da tela
    const blocks = content.querySelectorAll('.chapter-block');
    let currentIdx = 1;
    blocks.forEach(function (b) {
      if (b.offsetTop - content.offsetTop <= 120) currentIdx = Number(b.getAttribute('data-index')) + 1;
    });
    progressEl.textContent = 'Cap. ' + currentIdx + ' de ' + chapterCount + ' · ' + pct + '%';
    if (tocEl && !tocEl.classList.contains('hidden')) buildTOC(currentIdx - 1);
    scheduleProgressSave();
  }

  /* ---------------- eventos ---------------- */

  content.addEventListener('scroll', updateProgress);

  document.getElementById('btn-close-reader').addEventListener('click', function () {
    ttsStop();
    closeSearch();
    if (App.book && current && current.bookId) {
      App.openBook(App.book.id);
    } else if (App.chapter && current && current.chapterId) {
      App.navigate('editor');
    } else {
      App.renderShelf();
      App.navigate('shelf');
    }
  });

  document.getElementById('reader-font-minus').addEventListener('click', function () { changeFont(-1); });
  document.getElementById('reader-font-plus').addEventListener('click', function () { changeFont(1); });

  serifBtn.addEventListener('click', async function () {
    const next = Store.Settings.get('readerFontFamily', 'serif') === 'serif' ? 'sans' : 'serif';
    await Store.Settings.set('readerFontFamily', next);
    applyPrefs();
  });

  themeSelect.addEventListener('change', async function () {
    await Store.Settings.set('readerTheme', themeSelect.value);
    applyPrefs();
  });

  if (tocBtn) tocBtn.addEventListener('click', toggleTOC);
  if (searchBtn) searchBtn.addEventListener('click', openSearch);
  if (ttsPlayBtn) ttsPlayBtn.addEventListener('click', ttsToggle);
  if (ttsStopBtn) ttsStopBtn.addEventListener('click', ttsStop);

  if (searchInput) {
    let timer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { highlightSearch(searchInput.value.trim()); }, 180);
    });
  }
  const searchPrev = document.getElementById('reader-search-prev');
  const searchNextBtn = document.getElementById('reader-search-next');
  const searchClose = document.getElementById('reader-search-close');
  if (searchPrev) searchPrev.addEventListener('click', function () { searchNext(-1); });
  if (searchNextBtn) searchNextBtn.addEventListener('click', function () { searchNext(1); });
  if (searchClose) searchClose.addEventListener('click', closeSearch);

  const api = { open: open };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Reader = api;
  window.Autor = window.Autor || {};
  window.Autor.reader = api;

  return api;
})();
