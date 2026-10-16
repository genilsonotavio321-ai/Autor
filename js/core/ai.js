/* ============================================================
   core/ai.js — Autor.ai: cliente de IA (API compatível com OpenAI).

   Módulo profundo: interface pequena (config, available, chat,
   chatJSON, test) escondendo o fetch, os cabeçalhos e a tradução de
   erros HTTP. A configuração (endpoint/chave/modelo) vive em
   Store.Settings; nenhum consumidor precisa conhecê-la. Reutilizado
   pela revisão (review.js) e pelo assistente de escrita
   (views/assistant.js).
   ============================================================ */
window.Autor = window.Autor || {};

window.Autor.ai = (function () {
  'use strict';

  const DEFAULT_URL = 'https://api.openai.com/v1';
  const DEFAULT_MODEL = 'gpt-4o-mini';

  /* configuração efetiva (padrões + Settings), com overrides pontuais */
  function config(overrides) {
    const cfg = {
      url: (Store.Settings.get('aiUrl', DEFAULT_URL) || '').replace(/\/+$/, '') || DEFAULT_URL,
      key: Store.Settings.get('aiKey', ''),
      model: Store.Settings.get('aiModel', DEFAULT_MODEL) || DEFAULT_MODEL
    };
    return Object.assign(cfg, overrides || {});
  }

  function available() { return !!config().key; }

  async function chat(messages, opts) {
    opts = opts || {};
    const cfg = config(opts);
    const res = await fetch(cfg.url + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.key
      },
      body: JSON.stringify({
        model: opts.model || cfg.model,
        temperature: opts.temperature == null ? 0.2 : opts.temperature,
        messages: messages
      })
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = (errJson.error && errJson.error.message) || '';
      } catch (e) { /* corpo não era JSON */ }
      if (res.status === 401) throw new Error('Chave de API inválida (401).');
      if (res.status === 404) throw new Error('Endpoint ou modelo não encontrado (404). Verifique a URL e o nome do modelo.');
      if (res.status === 429) throw new Error('Limite de requisições atingido (429). Tente novamente em instantes.');
      throw new Error('Erro na API (' + res.status + ').' + (detail ? ' ' + detail : ''));
    }

    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('Resposta vazia da API.');
    return content;
  }

  /* extrai o primeiro objeto JSON de um texto (tolera cercas ```json) */
  function parseJSON(content) {
    const s = String(content == null ? '' : content);
    let obj = null;
    try {
      obj = JSON.parse(s.replace(/^```(json)?/i, '').replace(/```$/, '').trim());
    } catch (e) {
      const match = s.match(/\{[\s\S]*\}/);
      if (match) { try { obj = JSON.parse(match[0]); } catch (e2) { /* desiste */ } }
    }
    return obj;
  }

  /* pede uma resposta em JSON e devolve o objeto já parseado */
  async function chatJSON(systemPrompt, userText, opts) {
    const content = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ], opts);
    return parseJSON(content);
  }

  /* teste de conexão usado pelas configurações: true ou mensagem de erro */
  async function test(url, key, model) {
    try {
      await chat(
        [{ role: 'user', content: 'Responda apenas com a palavra: ok' }],
        { url: (url || '').replace(/\/+$/, ''), key: key, model: model || DEFAULT_MODEL, temperature: 0 }
      );
      return true;
    } catch (err) {
      return err.message;
    }
  }

  return {
    DEFAULT_URL: DEFAULT_URL,
    DEFAULT_MODEL: DEFAULT_MODEL,
    config: config,
    available: available,
    chat: chat,
    chatJSON: chatJSON,
    parseJSON: parseJSON,
    test: test
  };
})();
