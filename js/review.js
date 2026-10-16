/* ============================================================
   review.js — revisão de texto
   1) Rápida (offline): regras de português + corretor nativo.
   2) Com IA: revisão inteligente via API compatível com OpenAI.
   ============================================================ */
const Review = (function () {
  'use strict';

  const panel = document.getElementById('review-panel');

  let dismissed = new Set(); // ocorrências ignoradas (reinicia ao trocar de capítulo)
  let tab = 'offline';
  let aiSuggestions = [];
  let aiBusy = false;

  /* substituição em massa (aba "Substituir") */
  const replaceState = { find: '', with: '', wholeWord: true, ignoreCase: true };
  const REPLACE_LIST_LIMIT = 150;
  let replaceRefreshTimer = null;
  let offlineRefreshTimer = null;

  /* ============================================================
     REGRAS OFFLINE
     Cada regra retorna uma lista de ocorrências:
     { ruleId, ruleName, priority, start, length, replacement, message, key }
     priority: 'fix' (erro provável) | 'style' (estilo) | 'info' (aviso)
     ============================================================ */

  const ABBREV = ['sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'etc', 'pág', 'pag',
    'av', 'tel', 'ex', 'cia', 'inc', 'ltda', 'ml', 'kg', 'km', 'cm', 'mm', 'vs', 'obs',
    'ref', 'n', 'vol', 'ed', 'fls', 'mês', 'ano'];

  function mkMatches(text, regex, fn) {
    const out = [];
    const re = new RegExp(regex.source, regex.flags.indexOf('g') >= 0 ? regex.flags : regex.flags + 'g');
    let m;
    let occurrence = {};
    while ((m = re.exec(text)) !== null) {
      const item = fn(m, occurrence);
      if (item) {
        const sample = m[0].replace(/\s+/g, ' ').slice(0, 40);
        occurrence[sample] = (occurrence[sample] || 0) + 1;
        item.key = item.key || (item.ruleId + '|' + sample + '#' + occurrence[sample]);
        out.push(item);
      }
      if (m.index === re.lastIndex) re.lastIndex++; // evita laço em match vazio
    }
    return out;
  }

  function issue(ruleId, ruleName, priority, message, start, length, replacement) {
    return { ruleId: ruleId, ruleName: ruleName, priority: priority, message: message, start: start, length: length, replacement: replacement };
  }

  const rules = [
    /* espaço duplicado */
    {
      id: 'espaco-duplo', name: 'Espaços', label: 'Espaços duplicados', priority: 'fix',
      check: function (text) {
        return mkMatches(text, /[ \t\u00a0]{2,}/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Espaço duplicado', m.index, m[0].length, ' ');
        }.bind(this));
      }
    },
    /* espaço antes de pontuação */
    {
      id: 'espaco-antes-pont', name: 'Pontuação', label: 'Espaço antes de pontuação', priority: 'fix',
      check: function (text) {
        return mkMatches(text, /[ \t]+([,.;:!?])/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Espaço antes de "' + m[1] + '"', m.index, m[0].length, m[1]);
        }.bind(this));
      }
    },
    /* espaço faltando depois de pontuação */
    {
      id: 'espaco-faltando', name: 'Pontuação', label: 'Falta de espaço após pontuação', priority: 'fix',
      check: function (text) {
        const a = mkMatches(text, /([,;:!?])(?=[A-Za-zÀ-ÿ])/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Falta espaço depois de "' + m[1] + '"', m.index, 0, m[1] + ' ');
        }.bind(this));
        const b = mkMatches(text, /(?<![0-9)\]])\.(?=[A-Za-zÀ-ÿ])/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Falta espaço depois do ponto', m.index, 0, '. ');
        }.bind(this));
        return a.concat(b);
      }
    },
    /* pontuação duplicada */
    {
      id: 'pont-dupla', name: 'Pontuação', label: 'Pontuação duplicada', priority: 'fix',
      check: function (text) {
        const a = mkMatches(text, /([,;:])\1+/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Pontuação duplicada ("' + m[0] + '")', m.index, m[0].length, m[1]);
        }.bind(this));
        const b = mkMatches(text, /(?<!\.)\.\.(?!\.)/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Ponto duplicado (use "..." ou "…")', m.index, 2, '.');
        }.bind(this));
        return a.concat(b);
      }
    },
    /* palavra repetida */
    {
      id: 'palavra-repetida', name: 'Repetição', label: 'Palavras repetidas', priority: 'fix',
      check: function (text) {
        return mkMatches(text, /(?<![\p{L}])(\p{L}{2,})[ \t]+\1(?![\p{L}])/giu, function (m) {
          return issue(this.id, this.name, 'fix', 'Palavra repetida: "' + m[1] + ' ' + m[1] + '"', m.index, m[0].length, m[1]);
        }.bind(this));
      }
    },
    /* frase começando com letra minúscula depois de pontuação */
    {
      id: 'maiuscula', name: 'Maiúsculas', label: 'Minúscula após fim de frase', priority: 'fix',
      check: function (text) {
        return mkMatches(text, /([.!?…]["»”’)\]]?[ \t]+)(\p{Ll})/gu, function (m) {
          const before = text.slice(Math.max(0, m.index - 12), m.index);
          const wordMatch = before.match(/([\p{L}]+)$/u);
          const word = wordMatch ? wordMatch[1].toLowerCase() : '';
          if (ABBREV.indexOf(word) >= 0) return null; // "Sr. e..." etc.
          return issue(this.id, this.name, 'fix',
            'Provável frase começando com minúscula',
            m.index + m[1].length, 1, m[2].toUpperCase());
        }.bind(this));
      }
    },
    /* ponto final ausente no fim do parágrafo */
    {
      id: 'ponto-faltando', name: 'Pontuação', label: 'Ponto final ausente', priority: 'fix',
      check: function (text) {
        const out = [];
        let offset = 0;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.replace(/[ \t]+$/, '');
          const endChar = trimmed.slice(-1);
          if (trimmed.length >= 40 && /[\p{L}\p{N}]/u.test(endChar) && !/[-—–#*]/.test(trimmed[0])) {
            const pos = offset + trimmed.length;
            out.push({
              ruleId: this.id, ruleName: this.name, priority: 'fix',
              message: 'Provável falta de ponto final no fim do parágrafo',
              start: pos, length: 0, replacement: '.',
              key: this.id + '|linha' + i
            });
          }
          offset += line.length + 1;
        }
        return out;
      }
    },
    /* aspas retas → curvas */
    {
      id: 'aspas-reitas', name: 'Tipografia', label: 'Aspas retas (use “...”)', priority: 'style',
      check: function (text) {
        return mkMatches(text, /"([^"\n]+)"/g, function (m) {
          return issue(this.id, this.name, 'style', 'Aspas retas — use aspas curvas “...”', m.index, m[0].length, '“' + m[1] + '”');
        }.bind(this));
      }
    },
    /* diálogo com hífen → travessão */
    {
      id: 'dialogo-hifen', name: 'Diálogo', label: 'Diálogo com hífen (use travessão)', priority: 'style',
      check: function (text) {
        return mkMatches(text, /^([ \t]*)-(?=[ \t]*\S[^-])/gm, function (m) {
          const lineEnd = text.indexOf('\n', m.index);
          const lineLen = (lineEnd < 0 ? text.length : lineEnd) - m.index;
          if (lineLen < 8) return null; // evita listas curtas
          return issue(this.id, this.name, 'style', 'Diálogo com hífen — a convenção usa travessão (—)', m.index, m[0].length, m[1] + '—');
        }.bind(this));
      }
    },
    /* reticências com pontos */
    {
      id: 'reticencias', name: 'Tipografia', label: 'Reticências com três pontos', priority: 'style',
      check: function (text) {
        return mkMatches(text, /\.{3,}/g, function (m) {
          return issue(this.id, this.name, 'style', 'Use o caractere de reticências (…)', m.index, m[0].length, '…');
        }.bind(this));
      }
    },
    /* excesso de linhas em branco */
    {
      id: 'linhas-branco', name: 'Espaços', label: 'Linhas em branco em excesso', priority: 'fix',
      check: function (text) {
        return mkMatches(text, /\n{4,}/g, function (m) {
          return issue(this.id, this.name, 'fix', 'Muitas linhas em branco seguidas', m.index, m[0].length, '\n\n\n');
        }.bind(this));
      }
    },
    /* parágrafo muito longo (informativo, sem correção automática) */
    {
      id: 'paragrafo-longo', name: 'Estrutura', label: 'Parágrafo muito longo', priority: 'info',
      check: function (text) {
        const out = [];
        let offset = 0;
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length >= 700) {
            out.push({
              ruleId: this.id, ruleName: this.name, priority: 'info',
              message: 'Parágrafo muito longo (' + lines[i].length + ' caracteres) — considere dividir',
              start: offset, length: Math.min(lines[i].length, 50), replacement: null,
              key: this.id + '|linha' + i
            });
          }
          offset += lines[i].length + 1;
        }
        return out;
      }
    }
  ];

  function analyze(text) {
    const enabled = getEnabledRules();
    const dict = getDict();
    let issues = [];
    rules.forEach(function (rule) {
      if (!enabled[rule.id]) return;
      try {
        issues = issues.concat(rule.check(text));
      } catch (err) {
        console.warn('Erro na regra "' + rule.id + '":', err);
      }
    });
    issues = issues.filter(function (it) {
      return !dismissed.has(it.key) && !touchesDict(text, it, dict);
    });
    issues.sort(function (a, b) { return a.start - b.start; });
    return issues;
  }

  /* ---------------- configuração: regras ativas + dicionário pessoal ----------------
     Preferências ficam em Settings, então nenhuma regra precisa saber
     que existe configuração. O dicionário serve para nomes próprios e
     invenções do autor (evita ruído nas regras e instrui a IA). */

  function getEnabledRules() {
    const cfg = Store.Settings.get('reviewRules', null) || {};
    const out = {};
    rules.forEach(function (r) { out[r.id] = cfg[r.id] !== false; });
    return out;
  }

  function normalizeTerm(s) {
    return String(s == null ? '' : s).trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function dictTerms() {
    const raw = Store.Settings.get('personalDict', []);
    const list = Array.isArray(raw) ? raw : String(raw || '').split(/[\n,;]+/);
    return list.map(function (s) { return String(s).trim(); }).filter(Boolean);
  }

  function getDict() {
    const set = new Set();
    dictTerms().forEach(function (w) { const n = normalizeTerm(w); if (n) set.add(n); });
    return set;
  }

  function wordsAround(text, start, len) {
    let a = Math.max(0, start);
    let b = Math.min(text.length, start + Math.max(len, 0));
    while (a > 0 && /[\p{L}\p{N}]/u.test(text[a - 1])) a--;
    while (b < text.length && /[\p{L}\p{N}]/u.test(text[b])) b++;
    return String(text.slice(a, b)).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  }

  function touchesDict(text, it, dict) {
    if (!dict || !dict.size) return false;
    const words = wordsAround(text, it.start, it.length);
    for (let i = 0; i < words.length; i++) {
      if (dict.has(normalizeTerm(words[i]))) return true;
    }
    return false;
  }

  /* ============================================================
     PAINEL DE REVISÃO
     ============================================================ */

  function reset() {
    dismissed = new Set();
    aiSuggestions = [];
    panel.classList.add('hidden');
    panel.innerHTML = '';
  }

  function toggle() {
    if (panel.classList.contains('hidden')) openPanel();
    else panel.classList.add('hidden');
  }

  function openPanel() {
    if (!App.chapter) return;
    panel.classList.remove('hidden');
    render();
  }

  function render() {
    panel.innerHTML = '';

    // cabeçalho
    const header = App.el('div', 'rp-header');
    const hSpan = App.el('span');
    hSpan.innerHTML = (window.App && App.icon ? App.icon('search') : '') + ' Revisão de texto';
    header.appendChild(hSpan);
    const closeBtn = App.el('button', 'icon-btn');
    closeBtn.innerHTML = (window.App && App.icon ? App.icon('x') : '✕');
    closeBtn.title = 'Fechar painel';
    closeBtn.setAttribute('aria-label', 'Fechar painel');
    closeBtn.addEventListener('click', function () { panel.classList.add('hidden'); });
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // abas
    const tabs = App.el('div', 'rp-tabs');
    [['offline', 'Rápida (offline)'], ['replace', 'Substituir'], ['ai', 'Com IA']].forEach(function (t) {
      const b = App.el('button', 'rp-tab' + (tab === t[0] ? ' active' : ''), t[1]);
      b.addEventListener('click', function () { tab = t[0]; render(); });
      tabs.appendChild(b);
    });
    panel.appendChild(tabs);

    const body = App.el('div', 'rp-body');
    panel.appendChild(body);

    if (tab === 'offline') renderOffline(body);
    else if (tab === 'replace') renderReplace(body);
    else renderAI(body);
  }

  /* ============================================================
     ABA: SUBSTITUIÇÃO EM MASSA
     O usuário digita a palavra errada e a corrigida; o painel conta
     as ocorrências, lista cada ponto e permite ir até ele ou
     substituir uma a uma / todas de uma vez.
     ============================================================ */

  function replaceRegex() {
    const find = replaceState.find;
    if (!find) return null;
    const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = replaceState.wholeWord
      ? '(?<![\\p{L}\\p{N}_])' + escaped + '(?![\\p{L}\\p{N}_])'
      : escaped;
    try {
      return new RegExp(boundary, 'g' + (replaceState.ignoreCase ? 'iu' : 'u'));
    } catch (e) {
      // navegador sem lookbehind: cai para busca simples
      try {
        return new RegExp(boundary, 'g' + (replaceState.ignoreCase ? 'i' : ''));
      } catch (e2) {
        return new RegExp(escaped, 'g' + (replaceState.ignoreCase ? 'i' : ''));
      }
    }
  }

  function replaceMatches(text) {
    const re = replaceRegex();
    if (!re) return [];
    const out = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push({ start: m.index, length: m[0].length, text: m[0] });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return out;
  }

  function renderReplace(body) {
    const form = App.el('div', 'replace-form');
    form.innerHTML =
      '<div class="field"><label for="rp-find">Palavra ou trecho a corrigir</label>' +
      '<input id="rp-find" type="text" placeholder="Ex.: Raghata" autocomplete="off" spellcheck="false"></div>' +
      '<div class="field"><label for="rp-with">Substituir por</label>' +
      '<input id="rp-with" type="text" placeholder="Ex.: Ragatah" autocomplete="off" spellcheck="false"></div>' +
      '<div class="replace-options">' +
        '<label class="check"><input type="checkbox" id="rp-word"' + (replaceState.wholeWord ? ' checked' : '') + '> Palavra inteira</label>' +
        '<label class="check"><input type="checkbox" id="rp-case"' + (replaceState.ignoreCase ? ' checked' : '') + '> Ignorar maiúsculas/minúsculas</label>' +
      '</div>';
    body.appendChild(form);

    const findInput = form.querySelector('#rp-find');
    const withInput = form.querySelector('#rp-with');
    const wordBox = form.querySelector('#rp-word');
    const caseBox = form.querySelector('#rp-case');
    findInput.value = replaceState.find;
    withInput.value = replaceState.with;

    const results = App.el('div', 'replace-results');
    body.appendChild(results);

    let timer = null;
    function refresh(immediate) {
      replaceState.find = findInput.value;
      replaceState.with = withInput.value;
      clearTimeout(timer);
      if (immediate) renderReplaceResults(results);
      else timer = setTimeout(function () { renderReplaceResults(results); }, 160);
    }
    findInput.addEventListener('input', function () { refresh(); });
    withInput.addEventListener('input', function () { refresh(); });
    wordBox.addEventListener('change', function () { replaceState.wholeWord = wordBox.checked; refresh(true); });
    caseBox.addEventListener('change', function () { replaceState.ignoreCase = caseBox.checked; refresh(true); });

    renderReplaceResults(results);
    setTimeout(function () { findInput.focus(); }, 40);
  }

  function renderReplaceResults(container) {
    container.innerHTML = '';
    const find = replaceState.find;
    if (!find) {
      container.appendChild(App.el('p', 'rp-summary',
        'Escreva a palavra errada para contar as ocorrências e montar a lista clicável.'));
      return;
    }

    const text = Editor.getText();
    const matches = replaceMatches(text);

    const toolbar = App.el('div', 'rp-toolbar');
    const allBtn = App.el('button', 'btn small primary');
    allBtn.innerHTML = App.icon('repeat') + ' Substituir todas (' + matches.length + ')';
    allBtn.disabled = !matches.length || !replaceState.with;
    allBtn.addEventListener('click', function () { replaceAll(matches); });
    toolbar.appendChild(allBtn);

    const goBtn = App.el('button', 'btn small');
    goBtn.innerHTML = App.icon('search') + ' Ir para a 1ª';
    goBtn.disabled = !matches.length;
    goBtn.addEventListener('click', function () {
      if (matches.length) Editor.selectRange(matches[0].start, matches[0].start + matches[0].length);
    });
    toolbar.appendChild(goBtn);
    container.appendChild(toolbar);

    container.appendChild(App.el('p', 'rp-summary',
      matches.length
        ? matches.length + (matches.length === 1 ? ' ocorrência encontrada' : ' ocorrências encontradas') +
          ' — clique em um item para ir até o ponto exato no texto.'
        : 'Nenhuma ocorrência de "' + find + '" neste capítulo.'));

    const limit = Math.min(matches.length, REPLACE_LIST_LIMIT);
    for (let i = 0; i < limit; i++) {
      container.appendChild(replaceNode(text, matches[i], i, matches.length));
    }
    if (matches.length > limit) {
      container.appendChild(App.el('p', 'rp-summary',
        'Mostrando os primeiros ' + limit + ' de ' + matches.length +
        ' — "Substituir todas" pega a lista inteira.'));
    }
  }

  function replaceNode(text, m, idx, total) {
    const node = App.el('div', 'issue replace-hit');
    const from = Math.max(0, m.start - 45);
    const to = Math.min(text.length, m.start + m.length + 55);
    const pre = (from > 0 ? '…' : '') + text.slice(from, m.start);
    const pos = text.slice(m.start + m.length, to) + (to < text.length ? '…' : '');
    const line = text.slice(0, m.start).split('\n').length;

    const ctx = App.el('div', 'ctx');
    ctx.innerHTML = App.esc(pre.replace(/\n/g, ' ')) +
      '<mark>' + App.esc(m.text.replace(/\n/g, ' ')) + '</mark>' +
      App.esc(pos.replace(/\n/g, ' '));
    node.appendChild(ctx);

    node.appendChild(App.el('div', 'msg',
      'linha ' + line + ' · ' + (idx + 1) + ' de ' + total));

    const goTo = function () {
      Editor.selectRange(m.start, m.start + m.length);
    };
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('title', 'Ir até esta ocorrência no texto');
    node.addEventListener('click', function (ev) {
      if (ev.target.closest('button')) return;
      goTo();
    });
    node.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); goTo(); }
    });

    const actions = App.el('div', 'issue-actions');
    const oneBtn = App.el('button', 'btn small primary', 'Substituir só esta');
    oneBtn.addEventListener('click', function (ev) { ev.stopPropagation(); replaceOne(m); });
    actions.appendChild(oneBtn);
    node.appendChild(actions);
    return node;
  }

  async function replaceOne(m) {
    const text = Editor.getText();
    const novo = replaceState.with;
    if (!novo) { App.toast('Escreva a palavra corrigida.', 'error'); return; }
    const newText = text.slice(0, m.start) + novo + text.slice(m.start + m.length);
    await Editor.setText(newText);
    Editor.selectRange(m.start + novo.length, m.start + novo.length);
    render();
    App.toast('Ocorrência substituída.');
  }

  async function replaceAll(matches) {
    if (!matches.length) return;
    const novo = replaceState.with;
    if (!novo) { App.toast('Escreva a palavra corrigida.', 'error'); return; }
    const text = Editor.getText();
    let newText = text;
    // de trás para frente mantém os offsets válidos
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      newText = newText.slice(0, m.start) + novo + newText.slice(m.start + m.length);
    }
    await Editor.setText(newText);
    render();
    App.toast(matches.length + ' ocorrência(s) substituída(s).');
  }

  /* o texto mudou no editor: atualiza a aba ativa sem perder estado
     (na aba offline reanalisa as regras; na de substituição, só reconta) */
  function onTextChange() {
    if (panel.classList.contains('hidden')) return;
    if (tab === 'replace') {
      clearTimeout(replaceRefreshTimer);
      replaceRefreshTimer = setTimeout(function () {
        const results = panel.querySelector('.replace-results');
        if (results) renderReplaceResults(results);
      }, 250);
      return;
    }
    if (tab === 'offline') {
      clearTimeout(offlineRefreshTimer);
      offlineRefreshTimer = setTimeout(function () {
        if (panel.classList.contains('hidden') || tab !== 'offline') return;
        const body = panel.querySelector('.rp-body');
        if (!body) return;
        const scroll = body.scrollTop;
        body.innerHTML = '';
        renderOffline(body);
        body.scrollTop = scroll;
      }, 350);
    }
  }

  /* abre o painel já na aba escolhida */
  function openTab(name) {
    if (!App.chapter) return;
    tab = name;
    panel.classList.remove('hidden');
    render();
  }

  /* ---------------- aba offline ---------------- */

  function renderOffline(body) {
    const text = Editor.getText();
    const issues = analyze(text);

    const toolbar = App.el('div', 'rp-toolbar');
    const fixAllBtn = App.el('button', 'btn small primary');
    fixAllBtn.innerHTML = App.icon('check') + ' Corrigir tudo (' + issues.filter(function (i) { return i.replacement != null; }).length + ')';
    fixAllBtn.addEventListener('click', fixAll);
    toolbar.appendChild(fixAllBtn);

    const reBtn = App.el('button', 'btn small');
    reBtn.innerHTML = App.icon('refresh') + ' Analisar';
    reBtn.addEventListener('click', function () { dismissed = new Set(); render(); });
    toolbar.appendChild(reBtn);

    if (dismissed.size) {
      const clrBtn = App.el('button', 'btn small ghost', 'Limpar ignorados (' + dismissed.size + ')');
      clrBtn.addEventListener('click', function () { dismissed = new Set(); render(); });
      toolbar.appendChild(clrBtn);
    }
    body.appendChild(toolbar);

    const counts = { fix: 0, style: 0, info: 0 };
    issues.forEach(function (i) { counts[i.priority]++; });
    body.appendChild(App.el('p', 'rp-summary',
      issues.length
        ? counts.fix + ' erro(s) provável(is) · ' + counts.style + ' de estilo · ' + counts.info + ' aviso(s)'
        : 'Nenhum problema encontrado nas regras rápidas.'));

    if (!issues.length) {
      body.appendChild(App.el('p', 'ai-note',
        'Dica: a ortografia é conferida pelo próprio corretor do navegador (pt-BR) — clique com o botão direito em palavras sublinhadas de vermelho no texto.'));
    }

    issues.forEach(function (it) {
      body.appendChild(issueNode(it, text));
    });
  }

  function issueNode(it, text) {
    const node = App.el('div', 'issue ' + it.priority);

    // contexto com a ocorrência destacada
    const from = Math.max(0, it.start - 45);
    const to = Math.min(text.length, it.start + it.length + 55);
    const pre = (from > 0 ? '…' : '') + text.slice(from, it.start);
    const mid = text.substr(it.start, it.length);
    const pos = text.slice(it.start + it.length, to) + (to < text.length ? '…' : '');

    const ctx = App.el('div', 'ctx');
    ctx.innerHTML = App.esc(pre.replace(/\n/g, ' ')) +
      (mid ? '<mark>' + App.esc(mid.replace(/\n/g, ' ')) + '</mark>' : '<mark>‸</mark>') +
      App.esc(pos.replace(/\n/g, ' '));
    node.appendChild(ctx);

    node.appendChild(App.el('div', 'msg', it.message));

    const actions = App.el('div', 'issue-actions');
    if (it.replacement != null) {
      const fixBtn = App.el('button', 'btn small primary', 'Corrigir');
      fixBtn.addEventListener('click', function () { applyIssue(it); });
      actions.appendChild(fixBtn);
    }
    const ignoreBtn = App.el('button', 'btn small', 'Ignorar');
    ignoreBtn.addEventListener('click', function () {
      dismissed.add(it.key);
      render();
    });
    actions.appendChild(ignoreBtn);
    node.appendChild(actions);
    return node;
  }

  async function applyIssue(it) {
    const text = Editor.getText();
    const newText = text.slice(0, it.start) + (it.replacement == null ? '' : it.replacement) + text.slice(it.start + it.length);
    await Editor.setText(newText);
    render();
  }

  async function fixAll() {
    const text = Editor.getText();
    const issues = analyze(text).filter(function (i) { return i.replacement != null; });
    if (!issues.length) return;
    // aplica de trás para frente para manter os offsets válidos
    let newText = text;
    for (let i = issues.length - 1; i >= 0; i--) {
      const it = issues[i];
      newText = newText.slice(0, it.start) + it.replacement + newText.slice(it.start + it.length);
    }
    await Editor.setText(newText);
    App.toast(issues.length + ' correção(ões) aplicada(s).');
    render();
  }

  /* ============================================================
     REVISÃO COM IA (API compatível com OpenAI)
     ============================================================ */

  function renderAI(body) {
    if (!Autor.ai.available()) {
      body.appendChild(App.el('p', 'ai-note',
        'A revisão com IA é opcional e requer uma chave de API compatível com OpenAI (a revisão rápida offline continua funcionando sem nada aqui). A chave fica salva somente neste navegador.'));
      const cfgBtn = App.el('button', 'btn small primary');
      cfgBtn.innerHTML = App.icon('settings') + ' Configurar IA';
      cfgBtn.addEventListener('click', function () { App.settingsModal(); });
      body.appendChild(cfgBtn);
      return;
    }

    const toolbar = App.el('div', 'rp-toolbar');
    const runBtn = App.el('button', 'btn small primary');
    runBtn.innerHTML = App.icon('sparkles') + (aiBusy ? ' Revisando…' : ' Revisar com IA');
    runBtn.disabled = aiBusy;
    runBtn.addEventListener('click', runAIReview);
    toolbar.appendChild(runBtn);
    if (aiSuggestions.length) {
      const allBtn = App.el('button', 'btn small');
      allBtn.innerHTML = App.icon('check') + ' Aplicar todas (' + aiSuggestions.length + ')';
      allBtn.addEventListener('click', applyAllAI);
      toolbar.appendChild(allBtn);
      const clrBtn = App.el('button', 'btn small ghost', 'Limpar');
      clrBtn.addEventListener('click', function () { aiSuggestions = []; render(); });
      toolbar.appendChild(clrBtn);
    }
    body.appendChild(toolbar);

    const progress = App.el('p', 'ai-progress', '');
    progress.id = 'ai-progress';
    body.appendChild(progress);

    if (!aiSuggestions.length && !aiBusy) {
      body.appendChild(App.el('p', 'ai-note',
        'Clique em "Revisar com IA" para analisar gramática, pontuação e clareza. O texto é enviado ao serviço de IA apenas neste momento.'));
    }

    aiSuggestions.forEach(function (sug, idx) {
      const node = App.el('div', 'ai-suggestion');
      node.innerHTML =
        '<span class="old">' + App.esc(sug.find) + '</span>' +
        '<span class="new">' + App.esc(sug.replace) + '</span>' +
        '<div class="reason">' + App.esc(sug.reason || 'Sugestão de edição') + '</div>';
      const actions = App.el('div', 'issue-actions');
      const okBtn = App.el('button', 'btn small primary', 'Aplicar');
      okBtn.addEventListener('click', function () { applyAISuggestion(idx); });
      const noBtn = App.el('button', 'btn small', 'Recusar');
      noBtn.addEventListener('click', function () {
        aiSuggestions.splice(idx, 1);
        render();
      });
      actions.appendChild(okBtn);
      actions.appendChild(noBtn);
      node.appendChild(actions);
      body.appendChild(node);
    });
  }

  function setProgress(msg) {
    const p = document.getElementById('ai-progress');
    if (p) p.textContent = msg || '';
  }

  /* divide o texto em blocos por parágrafos (~9 mil caracteres) */
  function chunkText(text, size) {
    const paras = text.split(/\n{2,}/);
    const chunks = [];
    let cur = '';
    paras.forEach(function (p) {
      if ((cur + '\n\n' + p).length > size && cur) {
        chunks.push(cur);
        cur = p;
      } else {
        cur = cur ? cur + '\n\n' + p : p;
      }
    });
    if (cur) chunks.push(cur);
    return chunks;
  }

  const SYSTEM_PROMPT =
    'Você é um editor profissional de literatura em português do Brasil. ' +
    'Você recebe um trecho de um livro e deve sugerir correções de gramática, ortografia, pontuação e clareza, ' +
    'sem mudar o estilo, o ritmo ou a voz do autor. ' +
    'Responda APENAS com JSON válido exatamente neste formato:\n' +
    '{"sugestoes":[{"trecho":"texto exato copiado do texto original","substituir":"texto corrigido","motivo":"explicação breve em português"]}\n' +
    'Regras: (1) "trecho" deve ser copiado EXATAMENTE do texto, incluindo acentuação e pontuação; ' +
    '(2) máximo 12 sugestões, priorizando erros reais; (3) se não houver nada a corrigir, responda {"sugestoes":[]}.';

  async function callAI(userText) {
    return Autor.ai.chat([
      { role: 'system', content: systemPromptWithDict() },
      { role: 'user', content: 'Texto para revisar:\n\n' + userText }
    ], { temperature: 0.2 });
  }

  /* acrescenta os termos do dicionário pessoal às instruções da IA */
  function systemPromptWithDict() {
    const terms = dictTerms();
    if (!terms.length) return SYSTEM_PROMPT;
    return SYSTEM_PROMPT +
      ' Considere que os seguintes termos são nomes próprios ou invenções do autor e NÃO devem ser corrigidos nem alterados: ' +
      terms.slice(0, 120).join(', ') + '.';
  }

  function parseSuggestions(content) {
    const obj = Autor.ai.parseJSON(content);
    if (!obj || !Array.isArray(obj.sugestoes)) return [];
    return obj.sugestoes.filter(function (s) {
      return s && typeof s.trecho === 'string' && typeof s.substituir === 'string' &&
        s.trecho.length > 0 && s.trecho !== s.substituir;
    }).map(function (s) {
      return { find: s.trecho, replace: s.substituir, reason: s.motivo || '' };
    });
  }

  async function runAIReview() {
    if (aiBusy) return;
    const text = Editor.getText();
    if (!text.trim()) { App.toast('O capítulo está vazio.', 'error'); return; }

    aiBusy = true;
    aiSuggestions = [];
    render();

    try {
      // envia o texto SEM os marcadores de alinhamento; as sugestões da IA
      // são filtradas contra o texto real, então nada fora do lugar entra
      const chunks = chunkText(Content.strip(text), 9000);
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) setProgress('Revisando parte ' + (i + 1) + ' de ' + chunks.length + '…');
        else setProgress('Revisando com IA…');
        const content = await callAI(chunks[i]);
        aiSuggestions = aiSuggestions.concat(parseSuggestions(content));
      }
      // mantém apenas sugestões cujo "trecho" existe no texto atual
      const lower = text.toLowerCase();
      aiSuggestions = aiSuggestions.filter(function (s) {
        return lower.indexOf(s.find.toLowerCase()) >= 0;
      });
      // remove duplicadas
      const seen = {};
      aiSuggestions = aiSuggestions.filter(function (s) {
        const k = s.find + '|' + s.replace;
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
      setProgress('');
      App.toast(aiSuggestions.length
        ? aiSuggestions.length + ' sugestão(ões) recebida(s).'
        : 'Nenhuma correção necessária.');
    } catch (err) {
      setProgress('');
      App.toast('Falha na revisão com IA: ' + err.message, 'error');
    } finally {
      aiBusy = false;
      render();
    }
  }

  async function applyAISuggestion(idx) {
    const sug = aiSuggestions[idx];
    if (!sug) return;
    const text = Editor.getText();
    const pos = text.toLowerCase().indexOf(sug.find.toLowerCase());
    if (pos < 0) { App.toast('Trecho não encontrado mais no texto.', 'error'); aiSuggestions.splice(idx, 1); render(); return; }
    // preserva a caixa original do trecho quando fizer sentido
    let replacement = sug.replace;
    if (sug.find === sug.find.toUpperCase() && sug.find !== sug.find.toLowerCase()) {
      replacement = replacement.toUpperCase();
    }
    const newText = text.slice(0, pos) + replacement + text.slice(pos + sug.find.length);
    aiSuggestions.splice(idx, 1);
    await Editor.setText(newText);
    render();
  }

  async function applyAllAI() {
    const text = Editor.getText();
    let newText = text;
    let applied = 0;
    // aplica do fim para o início para manter offsets
    const sorted = aiSuggestions.slice().sort(function (a, b) {
      return newText.toLowerCase().indexOf(b.find.toLowerCase()) - newText.toLowerCase().indexOf(a.find.toLowerCase());
    });
    for (let i = 0; i < sorted.length; i++) {
      const sug = sorted[i];
      const pos = newText.toLowerCase().indexOf(sug.find.toLowerCase());
      if (pos < 0) continue;
      let replacement = sug.replace;
      if (sug.find === sug.find.toUpperCase() && sug.find !== sug.find.toLowerCase()) {
        replacement = replacement.toUpperCase();
      }
      newText = newText.slice(0, pos) + replacement + newText.slice(pos + sug.find.length);
      applied++;
    }
    aiSuggestions = [];
    await Editor.setText(newText);
    App.toast(applied + ' sugestão(ões) aplicada(s).');
    render();
  }

  /* teste de conexão usado pelas configurações */
  async function testAI(url, key, model) {
    return Autor.ai.test(url, key, model);
  }

  const api = {
    reset: reset,
    toggle: toggle,
    open: openPanel,
    openTab: openTab,
    onTextChange: onTextChange,
    testAI: testAI,
    /* análise offline pura (usada no painel e nos testes) */
    analyze: function (text) { return analyze(String(text == null ? '' : text)); },
    /* metadados das regras rápidas (usado nas configurações) */
    rules: function () {
      return rules.map(function (r) { return { id: r.id, name: r.name, label: r.label, priority: r.priority }; });
    }
  };

  // expõe no escopo global (o <script> é clássico; const não vira propriedade de window)
  window.Review = api;
  window.Autor = window.Autor || {};
  window.Autor.review = api;

  return api;
})();
