/* ============================================================
   views/assistant.js — assistente de escrita com IA (opcional).

   Reúne ferramentas que usam o mesmo cliente Autor.ai da revisão:
   continuar o texto, resumos, títulos, sinopse, consistência e ficha
   de personagens. Cada ferramenta só monta o prompt e mostra o
   resultado; nada é aplicado sem uma ação explícita do autor.
   ============================================================ */
window.Autor = window.Autor || {};
window.Autor.views = window.Autor.views || {};

(function () {
  'use strict';

  const App = window.App;
  const el = Dom.el;
  const icon = Dom.icon;

  const MAX_CHARS = 14000; // recorte enviado à IA, para não estourar o contexto

  function cut(text) {
    const t = String(text || '');
    return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) + '\n[…texto truncado…]' : t;
  }

  async function bookText(book) {
    const chapters = await Store.Chapters.listByBook(book.id);
    return chapters.map(function (c) {
      return '# ' + (c.title || 'Sem título') + '\n\n' + Content.toExport(c.content || '', c.align || 'j');
    }).join('\n\n');
  }

  /* ferramentas: cada uma devolve { system, prompt, canInsert, label } */
  const TOOLS = {
    continue: {
      label: 'Continuar o texto',
      hint: 'Sugere a continuação a partir do capítulo atual.',
      build: function (ctx) {
        return {
          system: 'Você ajuda um(a) autor(a) a continuar sua própria história em português do Brasil. ' +
            'Escreva no mesmo tom, voz e tempo verbal do texto. Entregue de 2 a 3 parágrafos, sem comentários nem títulos.',
          prompt: 'Continue a história a partir daqui, mantendo o estilo:\n\n' + cut(ctx.chapterText),
          canInsert: true
        };
      }
    },
    chapterSummary: {
      label: 'Resumo do capítulo',
      hint: 'Um parágrafo curto sobre o que acontece no capítulo.',
      build: function (ctx) {
        return {
          system: 'Você resume capítulos de um livro em português do Brasil, de forma objetiva.',
          prompt: 'Resuma o capítulo a seguir em um único parágrafo:\n\n' + cut(ctx.chapterText)
        };
      }
    },
    bookSummary: {
      label: 'Resumo da obra',
      hint: 'Resumo por capítulo e um fecho geral.',
      build: function (ctx) {
        return {
          system: 'Você resume obras literárias em português do Brasil, sem inventar fatos.',
          prompt: 'Resuma a obra "' + ctx.bookTitle + '" em tópicos por capítulo e, ao final, um parágrafo geral:\n\n' + cut(ctx.bookText)
        };
      }
    },
    titles: {
      label: 'Sugerir títulos',
      hint: 'Dez títulos para a obra, com uma breve justificativa.',
      build: function (ctx) {
        return {
          system: 'Você sugere títulos literários em português do Brasil.',
          prompt: 'Sugira 10 títulos para a obra "' + ctx.bookTitle + '". Liste um por linha, com uma justificativa curta entre parênteses.\n\n' + cut(ctx.bookText)
        };
      }
    },
    synopsis: {
      label: 'Escrever sinopse',
      hint: 'Texto de quarta capa, sem revelar o final.',
      build: function (ctx) {
        return {
          system: 'Você escreve sinopses de livros em português do Brasil, atraentes e sem spoilers do final.',
          prompt: 'Escreva uma sinopse (texto de quarta capa) para "' + ctx.bookTitle + '", em até 150 palavras:\n\n' + cut(ctx.bookText)
        };
      }
    },
    consistency: {
      label: 'Checar consistência',
      hint: 'Aponta possíveis contradições de fatos, nomes e cronologia.',
      build: function (ctx) {
        return {
          system: 'Você é um(a) leitor(a) atento(a) que aponta possíveis inconsistências de continuidade em um manuscrito. ' +
            'Não corrija o texto; apenas liste suspeitas, com o trecho relacionado.',
          prompt: 'Liste possíveis inconsistências (nomes, lugares, cronologia, características) na obra a seguir. Se não houver, diga isso.\n\n' + cut(ctx.bookText)
        };
      }
    },
    characters: {
      label: 'Ficha de personagens',
      hint: 'Lista personagens e o que se sabe sobre cada um.',
      build: function (ctx) {
        return {
          system: 'Você organiza fichas de personagens a partir de um manuscrito, em português do Brasil, sem inventar dados.',
          prompt: 'Monte uma ficha com os personagens da obra, listando para cada um: papel, características e relações. Baseie-se apenas no texto:\n\n' + cut(ctx.bookText)
        };
      }
    }
  };

  async function buildContext() {
    const book = App.book;
    const chapter = App.chapter;
    const chapterText = chapter ? Content.toExport((window.Editor ? Editor.getText() : chapter.content) || '', chapter.align || 'j') : '';
    return {
      bookTitle: book ? book.title : (chapter ? 'Capítulo' : 'Obra'),
      chapterText: chapterText,
      bookText: book ? await bookText(book) : chapterText
    };
  }

  function assistantModal() {
    if (!Autor.ai.available()) {
      App.openModal({
        title: '<span>' + icon('sparkles') + ' Assistente de escrita</span>',
        body: '<p style="margin-top:0">O assistente usa a mesma chave de IA da revisão. Configure em <strong>Configurações → Revisão com IA</strong>.</p>',
        actions: [{ label: 'Fechar' }, { label: 'Abrir configurações', className: 'primary', onClick: function (close) { close(); App.settingsModal(); } }]
      });
      return;
    }

    const body = el('div');
    const tools = Object.keys(TOOLS);
    body.innerHTML =
      '<p class="hint" style="margin-top:0">Escolha uma ferramenta. O resultado é apenas uma sugestão — nada é alterado sem você aplicar.</p>' +
      '<div class="row" style="flex-wrap:wrap;gap:6px">' +
      tools.map(function (id) {
        return '<button type="button" class="btn small" data-tool="' + id + '">' + App.esc(TOOLS[id].label) + '</button>';
      }).join('') +
      '</div>' +
      '<p class="muted" id="as-hint" style="font-size:var(--fs-sm);margin:12px 0 4px"></p>' +
      '<div id="as-out" class="ai-out" aria-live="polite"></div>' +
      '<div class="row" style="gap:6px;margin-top:8px">' +
      '<button type="button" class="btn small" id="as-copy" disabled>' + icon('copy') + ' Copiar</button>' +
      '<button type="button" class="btn small primary" id="as-insert" style="display:none">' + icon('plus') + ' Inserir no fim do capítulo</button>' +
      '</div>';

    const out = body.querySelector('#as-out');
    const hint = body.querySelector('#as-hint');
    const copyBtn = body.querySelector('#as-copy');
    const insertBtn = body.querySelector('#as-insert');
    let lastResult = '';
    let lastTool = null;

    out.innerHTML = '<p class="muted">O resultado aparecerá aqui.</p>';

    tools.forEach(function (id) {
      body.querySelector('[data-tool="' + id + '"]').addEventListener('click', async function () {
        lastTool = id;
        const tool = TOOLS[id];
        hint.textContent = tool.hint;
        out.innerHTML = '<p class="muted">' + icon('sparkles') + ' Pensando…</p>';
        copyBtn.disabled = true;
        insertBtn.style.display = 'none';
        try {
          const ctx = await buildContext();
          const req = tool.build(ctx);
          const name = Store.Settings.get('aiModel', 'gpt-4o-mini');
          const content = await Autor.ai.chat([
            { role: 'system', content: req.system },
            { role: 'user', content: req.prompt }
          ], { temperature: id === 'continue' ? 0.7 : 0.3, model: name });
          lastResult = content.trim();
          out.innerHTML = '<div class="ai-result settling"></div>';
          out.querySelector('.ai-result').textContent = lastResult;
          copyBtn.disabled = false;
          insertBtn.style.display = req.canInsert && App.chapter ? '' : 'none';
        } catch (err) {
          out.innerHTML = '<p style="color:var(--danger)">' + icon('alert') + ' ' + App.esc(err.message || 'Falha na IA.') + '</p>';
        }
      });
    });

    copyBtn.addEventListener('click', async function () {
      try {
        await navigator.clipboard.writeText(lastResult);
        App.toast('Copiado.');
      } catch (e) {
        App.toast('Não foi possível copiar.', 'error');
      }
    });

    insertBtn.addEventListener('click', async function () {
      if (!lastResult || !App.chapter || !window.Editor) return;
      const current = Editor.getText().replace(/\s+$/, '');
      Editor.setText(current ? current + '\n\n' + lastResult : lastResult);
      await Editor.saveNow();
      App.toast('Continuação inserida no fim do capítulo.');
    });

    App.openModal({
      title: '<span>' + icon('sparkles') + ' Assistente de escrita</span>',
      body: body,
      wide: true,
      actions: [{ label: 'Fechar' }]
    });
    void lastTool;
  }

  App.assistantModal = assistantModal;
  window.Autor.views.assistant = { assistantModal: assistantModal };
})();
