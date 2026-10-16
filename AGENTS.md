# AGENTS.md — Base de referência para agentes de IA que trabalham no "Autor"

> **O que é este arquivo.** Briefing técnico auto-contido do app **Autor**, feito para ser
> enviado/colado como contexto inicial de um agente de coding. Ele descreve o que o app é,
> os contratos que **não podem ser quebrados**, a arquitetura, o modelo de dados, os pontos
> de extensão e as armadilhas conhecidas. Leia tudo antes de alterar qualquer arquivo.
>
> Última atualização: Fase de usabilidade e integrações (assistente de IA, importação,
> EPUB/Markdown, sincronização, sumário/TTS no leitor).
> Versão do service worker: `autor-v13`.

---

## 0. TL;DR — as regras que nunca podem ser quebradas

1. **JavaScript clássico, sem build.** Nada de ES modules (`import`/`export`), bundlers,
   transpiladores ou `npm install` para o app. Tudo é `<script src="...">` no `index.html`.
2. **Tem de funcionar por duplo clique (`file://`)** *e* via `http(s)`. Se quebrar no
   `file://`, está errado.
3. **Sem servidor, sem backend.** Todos os dados ficam no dispositivo do usuário
   (IndexedDB, com reserva em `localStorage`).
4. **Ao adicionar/renomear um arquivo JS: atualize `index.html` (na ordem certa) E
   `sw.js` (`ASSETS`) E suba a versão `CACHE`** (`autor-v13` → `autor-v14`...). Esquecer
   isso é o erro mais comum.
5. **Textos de interface em português (pt-BR)** e todo conteúdo vindo do usuário inserido
   em HTML passa por `esc()`.
6. **Antes de concluir:** rode `node --test` (60 testes) e faça o smoke test no navegador
   (seção 12). Rode também `node --check <arquivo>` nos arquivos alterados.

---

## 1. Visão geral

O **Autor** é um aplicativo de escrita de livros/histórias:

- Cria **obras** (livros) e **capítulos**; cada capítulo tem um editor por parágrafos
  (blocos) com alinhamento, autosave, estatísticas, modo foco, meta de escrita e revisão.
- **Reader** (modo leitura) com preferências de fonte/tema, sumário, busca no texto e
  leitura em voz alta (TTS).
- **Revisão** offline (regras + dicionário pessoal) e opcional com IA (API compatível com
  OpenAI). **Assistente de escrita** com IA (continuar, resumir, títulos, sinopse,
  consistência, personagens).
- **Exportação** em TXT, Word (`.doc`), PDF (via impressão), **Markdown**, **EPUB** e
  **backup** completo (JSON). **Importação** de manuscritos (`.txt`/`.md`/`.docx`/`.epub`/
  `.html`).
- **Sincronização** opcional por **WebDAV** ou **GitHub Gist** (merge por `updatedAt`).
- **Busca** global, **lixeira** (restaurar/excluir), **temas** claro/escuro e atalhos.
- **Offline-first / PWA**: funciona sem internet; instalável quando servido por http(s).

Público: autor escrevendo sozinho, no próprio dispositivo. A sincronização é opcional e
usa armazenamento do próprio autor (nuvem de arquivos/Gist), não um backend do app.

---

## 2. Contratos invioláveis

| # | Contrato | Motivo |
|---|----------|--------|
| C1 | Scripts clássicos, sem ES modules/build | Garantir `file://` por duplo clique |
| C2 | Sem dependências externas no runtime do app | App funciona offline e sem instalação |
| C3 | Dados só no dispositivo (IndexedDB + reserva localStorage) | Privacidade; sem servidor |
| C4 | UI em pt-BR | Público-alvo lusófono |
| C5 | `esc()` para conteúdo do usuário | Evitar injeção de HTML |
| C6 | Ao mexer em arquivos JS: `index.html` + `sw.js` (`ASSETS`) + bump de `CACHE` | Cache/offline corretos |
| C7 | Não quebrar as chaves de dados já salvas | Back-compat dos dados do usuário |
| C8 | Manter os aliases globais existentes (`App.*`, `window.Content`, etc.) | Outros módulos dependem deles |

> **Back-compat:** o app está em migração para um namespace `window.Autor`. Módulos novos
> expõem `Autor.<modulo>` **e** mantêm o global antigo (`window.Content`, `window.Store`,
> `window.Ui`, `window.Img`, `window.App`, `window.Editor`, `window.Review`,
> `window.Exporter`, `window.Reader`, `window.Importer`, `window.Sync`). **Não remova os
> aliases antigos sem migrar todos os consumidores.**

---

## 3. Como rodar, testar e verificar

```bash
# Testes de lógica pura (Node >= 20; sem dependências)
node --test

# Verificação de sintaxe de um arquivo
node --check js/app.js

# Servir localmente (necessário para PWA/service worker)
python -m http.server 8123 --bind 127.0.0.1
# depois abra http://127.0.0.1:8123/
```

- `package.json` existe **apenas** para o script de teste (`"test": "node --test"`). Não
  adicione dependências de runtime.
- Para testar o **modo `file://`**: abra `index.html` com duplo clique. O service worker
  não se aplica nesse caso (é esperado), mas o app tem de funcionar.
- `tools/make-icons.py` gera os ícones (não faz parte do runtime).

---

## 4. Mapa da arquitetura

### 4.1 Árvore de arquivos

```
index.html                 # shell: views + ordem dos <script> (crítica)
manifest.webmanifest       # metadados PWA
sw.js                      # service worker + lista ASSETS + versão CACHE
package.json               # apenas o script de teste (node --test)
GLOSSARY.md                # vocabulário do domínio/arquitetura
.nojekyll                  # publicado via GitHub Pages
css/styles.css             # todos os estilos
icons/*.png                # ícones (PWA/favicon)

js/core/dom.js             # Autor.dom / Dom  — $, qsa, el, esc, icon
js/core/content.js         # Autor.content / Content — modelo de conteúdo
js/core/ui.js              # Autor.ui / Ui   — toast, openModal, confirm, cover
js/core/image.js           # Autor.image / Img — pick, fromFile, resize, fit, DEFAULT
js/core/persistence.js     # Autor.persistence — adaptadores idb()/ls()
js/core/ai.js              # Autor.ai — cliente de IA (API compatível com OpenAI)
js/core/zip.js             # Autor.zip — ZIP (escrita store / leitura store+deflate)
js/core/merge.js           # Autor.merge — merge/tombstone/secrets (import + sync)
js/storage.js              # Autor.store / Store — repositórios Books/Chapters/Trash/Settings
js/app.js                  # Autor.app / App — RAIZ DE COMPOSIÇÃO
js/views/shelf.js          # Autor.views.shelf  — prateleira
js/views/book.js           # Autor.views.book   — tela do livro + form + status
js/views/search.js         # Autor.views.search — busca global
js/views/trash.js          # Autor.views.trash  — lixeira
js/views/settings.js       # Autor.views.settings — configurações
js/views/help.js           # Autor.views.help   — atalhos de teclado
js/views/assistant.js      # Autor.views.assistant — assistente de escrita (IA)
js/editor.js               # Autor.editor / Editor — editor de capítulos
js/review.js               # Autor.review / Review — revisão (offline + IA)
js/import.js               # Autor.importer / Importer — importar manuscrito
js/export.js               # Autor.exporter / Exporter — TXT/DOC/PDF/EPUB/MD/backup
js/sync.js                 # Autor.sync / Sync — sincronização (WebDAV/Gist)
js/reader.js               # Autor.reader / Reader — modo leitura (TOC/busca/TTS)

tests/helpers/load.mjs     # carrega scripts clássicos em sandbox node:vm
tests/content.test.mjs     # testes do Content
tests/persistence.test.mjs # testes dos adaptadores (localStorage)
tests/storage.test.mjs     # testes dos repositórios
tests/image.test.mjs       # testes do cálculo de redimensionamento
tests/merge.test.mjs       # testes do merge/secrets/tombstones
tests/zip.test.mjs         # testes do ZIP (round-trip e deflate)
tests/import.test.mjs      # testes dos parsers de importação
tests/export.test.mjs      # testes de Markdown e EPUB
tests/review.test.mjs      # testes das regras da revisão offline

docs/adr/ADR-0001..0005     # decisões de arquitetura
```

### 4.2 Ordem de carregamento dos `<script>` (no fim do `<body>`)

A ordem importa: alguns módulos leem outros **no momento do load** (não só em runtime).

```
core/dom.js → core/content.js → core/ui.js → core/image.js → core/persistence.js
→ core/ai.js → core/zip.js → core/merge.js → storage.js → app.js
→ views/shelf.js → views/book.js → views/search.js → views/trash.js → views/settings.js
→ views/help.js → views/assistant.js → editor.js → review.js → import.js → export.js
→ sync.js → reader.js
```

Dependências no load que você deve respeitar:

- `ui.js` usa `Dom.el`/`Dom.icon` → **depois** de `dom.js`.
- `app.js` faz `App.toast = Ui.toast`, `App.pickImage = Img.pick` → **depois** de `ui.js` e `image.js`.
- `storage.js` faz `const Persistence = window.Autor.persistence` → **depois** de `persistence.js`.
- `core/ai.js` usa `Store.Settings` só em runtime → pode carregar antes de `storage.js`,
  desde que antes de seus consumidores (`review.js`, `views/assistant.js`).
- As views fazem `const App = window.App` → **depois** de `app.js`.
- `Editor`/`Review`/`Importer`/`Exporter`/`Sync`/`Reader` referenciam `App.*` em runtime →
  depois de `app.js`.

### 4.3 Namespaces

Cada módulo é um IIFE `'use strict'` que expõe um objeto. Como `const` de script clássico
**não** vira propriedade de `window`, os módulos também atribuem explicitamente a
`window.<Global>`. Mapa:

| Global | `Autor.*` | Arquivo |
|--------|-----------|---------|
| `Dom` | `Autor.dom` | `js/core/dom.js` |
| `Content` | `Autor.content` | `js/core/content.js` |
| `Ui` | `Autor.ui` | `js/core/ui.js` |
| `Img` | `Autor.image` | `js/core/image.js` |
| — | `Autor.persistence` | `js/core/persistence.js` |
| — | `Autor.ai` | `js/core/ai.js` |
| — | `Autor.zip` | `js/core/zip.js` |
| — | `Autor.merge` | `js/core/merge.js` |
| `Store` | `Autor.store` | `js/storage.js` |
| `App` | `Autor.app` | `js/app.js` |
| — | `Autor.views.{shelf,book,search,trash,settings,help,assistant}` | `js/views/*.js` |
| `Editor` | `Autor.editor` | `js/editor.js` |
| `Review` | `Autor.review` | `js/review.js` |
| `Importer` | `Autor.importer` | `js/import.js` |
| `Exporter` | `Autor.exporter` | `js/export.js` |
| `Sync` | `Autor.sync` | `js/sync.js` |
| `Reader` | `Autor.reader` | `js/reader.js` |

---

## 5. Modelo de dados

Todos os dados vivem em quatro "stores" chave→valor: `books`, `chapters`, `trash`,
`settings`.

### 5.1 Book

```js
{
  id: string,              // uuid
  title: string,           // obrigatório ("Sem título" se vazio)
  author: string,
  description: string,
  status: 'rascunho' | 'revisao' | 'concluido',
  cover: string | null,    // data URL JPEG (ver seção 7)
  createdAt: number,       // Date.now()
  updatedAt: number
}
```

### 5.2 Chapter

```js
{
  id: string,
  bookId: string,          // invariante: sempre existe um book com este id
  title: string,
  content: string,         // texto com parágrafos separados por linha em branco (ver 5.4)
  status: 'rascunho' | 'revisao' | 'concluido',
  cover: string | null,
  align: 'e' | 'c' | 'd' | 'j',  // alinhamento PADRÃO do capítulo (default 'j')
  order: number,           // 0..n dentro do livro
  createdAt: number,
  updatedAt: number
}
```

- **Invariante importante:** `Chapters.save` **só grava** se o livro ainda existir. Isso
  evita que um autosave atrasado "ressuscite" um capítulo cujo livro foi excluído.
  Não remova essa guarda.

### 5.3 Trash (lixeira)

```js
{
  id: string,
  type: 'book' | 'chapter',
  deletedAt: number,
  item: Book | Chapter,     // o item original
  chapters: Chapter[]       // para type 'book', os capítulos que foram junto
}
```

### 5.4 Content model (`Autor.content` / `Content`)

O texto é guardado como **parágrafos separados por linha em branco** e, no início de um
parágrafo, um **marcador de alinhamento** *apenas quando difere do padrão do capítulo*:

- `⟦e⟧` esquerda · `⟦c⟧` centro · `⟦d⟧` direita · `⟦j⟧` justificado
- Uma linha `---` é uma **quebra de página** (regra) usada na exportação/PDF.

Interface pública:

```js
Content.ALIGN            // mapa chave → { css, label }
Content.ALIGN_KEYS       // ['e','c','d','j']
Content.DEFAULT_ALIGN    // 'j'
Content.MARK_RE          // regex do marcador
Content.parse(text, defaultAlign)   // → [{type:'para'|'rule', align, text}, ...]
Content.serialize(blocks, defaultAlign) // blocks → texto canônico (com marcadores só quando necessário)
Content.toDisplay(text, defaultAlign)   // normaliza para exibir no editor
Content.toExport(text, defaultAlign)    // remove TODOS os marcadores (leitor/PDF/TXT/DOC/backup)
Content.strip(text)                     // remove marcadores (= stripAlignMarkers)
Content.stripParaMarker(text)
Content.paraAlign(text, defaultAlign)
Content.countWords(text)
Content.css(align) / Content.label(align)
```

> **Regra de ouro do conteúdo:** qualquer coisa que **exporte** ou **exiba fora do editor**
> (TXT, DOC, PDF, reader, busca) usa `toExport`/`strip`. O editor usa `parse`/`serialize`
> e mostra o alinhamento por `data-align`, nunca o marcador cru.

---

## 6. Camada de persistência (o "seam")

`Autor.persistence` (`js/core/persistence.js`) define adaptadores com uma **interface
única** (tudo assíncrono):

```js
{
  mode,                                  // 'idb' | 'ls'
  open(): Promise<void>,
  getAll(store): Promise<any[]>,
  get(store, key): Promise<any|null>,
  put(store, value): Promise<any>,
  del(store, key): Promise<void>,
  clear(store): Promise<void>,
  byIndex(store, index, value): Promise<any[]>
}
```

Dois adaptadores prontos: `Autor.persistence.idb()` (IndexedDB, preferido) e
`Autor.persistence.ls()` (localStorage, reserva). São **memoizados** (mesma instância por
sessão).

`Store.init()` escolhe o adaptador: tenta IndexedDB **com um teste de gravação real** e,
se falhar (ex.: `file://` restrito), cai para o localStorage. `Store.isFallbackMode()`
informa se está no modo de reserva.

### 6.1 Como adicionar um novo backend (ex.: sync/nuvem) — ponto de extensão principal

1. Implemente a interface acima em `persistence.js` (ex.: `makeRemote()` → `mode: 'remote'`).
2. Exponha-a: `Autor.persistence.remote = function () { ... }`.
3. Ajuste a seleção em `Store.init()` (ex.: se houver sessão/config, preferir o remote).
4. **Os repositórios (`js/storage.js`) não mudam** — eles dependem só da interface.

Regras de detalhe:

- O adaptador `ls` guarda `settings` como **mapa `{chave: valor}`** (não como lista); os
  demais stores como **array de objetos**.
- Para **adicionar um novo store** no IndexedDB: crie o `createObjectStore` em
  `onupgradeneeded` **e suba `DB_VERSION`** em `persistence.js` (senão bancos já
  existentes não ganham o store). O adaptador `ls` já é genérico e não precisa mudar.
- Prefixo do localStorage: `autor_ls_`. Banco IndexedDB: `autor_db`.

---

## 7. Módulos core — interface pública

### 7.1 `Autor.dom` / `Dom` (`js/core/dom.js`)

```js
Dom.$(sel, root?)      // querySelector
Dom.qsa(sel, root?)    // → Array (não NodeList)
Dom.el(tag, className?, html?)  // cria elemento; se html for string/texto conforme uso
Dom.esc(str)           // escapa & < > " '
Dom.icon(name, size?)  // → string de <svg><use href="#i-<name>"></svg>
```

### 7.2 `Autor.ui` / `Ui` (`js/core/ui.js`)

```js
Ui.toast(msg, type?)      // type: 'error' | 'info' | undefined
Ui.openModal({ title, body, actions, wide })  // → { close, body, modal }
Ui.confirm(msg, opts?)    // → Promise<boolean>; opts {title, okLabel, cancelLabel, danger}
Ui.cover(opts)            // → { element, get(), set(value) }  seletor de capa reutilizável
```

- `openModal` cuida de foco preso, ARIA (`role=dialog`, `aria-modal`) e fechamento por
  Esc/overlay. `actions: [{ label, className, onClick(close) }]`; se `onClick` retornar
  `false`, o modal **não** fecha automaticamente.
- **Não manipule `#modal-root` diretamente.** Use `Ui.openModal`.
- `Ui.cover({ value, alt, hint, onError, onChange })` mostra prévia + botões
  escolher/remover; é usado no formulário de livro e na capa do capítulo.

### 7.3 `Autor.image` / `Img` (`js/core/image.js`)

```js
Img.DEFAULT   // { portrait:{w:400,h:600}, landscape:{w:600,h:400}, quality:0.9, background:'#ffffff' }
Img.fit(w, h, opts?)        // cálculo puro das dimensões finais (sem canvas) — testável
Img.resize(imageEl, opts?)  // → data URL JPEG (usa <canvas>)
Img.fromFile(file, opts?)   // → Promise<data URL|null>
Img.pick(opts?)             // → Promise<data URL|null>; abre o seletor de arquivos
```

- Redimensiona **sem ampliar** e preserva a proporção, encaixando na caixa da orientação
  (retrato 400×600 / paisagem 600×400). `opts.onError(msg)` opcional; senão usa `Ui.toast`.
- `App.pickImage` é alias de `Img.pick` (mantido por compatibilidade).

### 7.4 `Autor.store` / `Store` (`js/storage.js`)

```js
Store.init()                 // escolhe adaptador + carrega settings
Store.uuid()                 // id único
Store.raw                    // { getAll, get, put, del, clear } — acesso direto ao adaptador
Store.isFallbackMode()       // true se estiver em localStorage

Store.Books   = { list, get, create, save, remove }
Store.Chapters= { listByBook, get, create, save, remove, duplicate, move }
Store.Trash   = { list, restore, remove, empty }
Store.Settings= { cache, load, get(key, fallback), set(key, value) }
```

- `Books.list()` ordena por `updatedAt` desc; `Chapters.listByBook()` por `order` asc.
- `Books.remove(id)` move o livro **e seus capítulos** para a lixeira.
- `Chapters.save` tem a guarda de invariante (livro precisa existir).
- `Settings.set` é síncrono no cache e retorna a Promise da gravação.

### 7.5 `Autor.ai` (`js/core/ai.js`)

Cliente fino para uma API compatível com a OpenAI. Esconde endpoint/chave/modelo (lidos de
`Settings`) e a tradução de erros HTTP. É a base da revisão com IA e do assistente de
escrita — **não** duplique `fetch` de IA em outro lugar.

```js
Autor.ai.DEFAULT_URL / DEFAULT_MODEL
Autor.ai.config(overrides?)       // { url, key, model } efetivos (Settings + overrides)
Autor.ai.available()              // true se há chave configurada
Autor.ai.chat(messages, opts?)    // → Promise<string> (conteúdo da resposta)
Autor.ai.chatJSON(messages, opts?)// → Promise<objeto> (espera JSON; usa parseJSON)
Autor.ai.parseJSON(text)          // extrai o 1º objeto/array JSON de um texto
Autor.ai.test(url, key, model)    // → true | string de erro (usado em Configurações)
```

### 7.6 `Autor.zip` (`js/core/zip.js`)

ZIP mínimo, sem dependências: **escreve** entradas com método *store* (sem compressão) e
**lê** entradas *store* ou *deflate* (via `DecompressionStream`). Usado pelo EPUB (export)
e pela importação de `.docx`/`.epub`. É agnóstico de realm (não usa `instanceof`) para
poder ser testado no sandbox do Node.

```js
Autor.zip.crc32(bytes)                         // → number
Autor.zip.zipWrite([{ name, data }])           // → Blob (síncrono; método store)
Autor.zip.zipRead(arrayBuffer)                 // → Promise<[{ name, data }]>
Autor.zip.entriesToMap(entries)                // → { nome: Uint8Array }
Autor.zip.decodeText(bytes)                    // Uint8Array → UTF-8 string
```

> O `mimetype` do EPUB precisa ser a **primeira** entrada e **sem compressão** — o
> `zipWrite` preserva a ordem do array.

### 7.7 `Autor.merge` (`js/core/merge.js`)

Lógica **pura** de merge de documentos (usada pelo backup e pela sincronização) e de
remoção de segredos. Não toca em DOM nem em `Store` — só dados.

```js
Autor.merge.SECRET_KEYS        // chaves que nunca saem no backup (aiKey, webdavPass, gistToken…)
Autor.merge.LOCAL_ONLY_KEYS    // chaves que ficam só no dispositivo (ex.: lastLocation)
Autor.merge.emptyDoc() / normalizeDoc(doc)
Autor.merge.stripSecrets(obj) / isLocalOnly(key)
Autor.merge.mergeList(localList, remoteList, preferLocal)  // por id + updatedAt
Autor.merge.mergeSettings(local, remote)
Autor.merge.pruneOrphans(doc)                // remove capítulos órfãos
Autor.merge.deletedIds(doc)                  // ids "apagados" (tombstones da lixeira)
Autor.merge.mergeDoc(local, remote)          // → { doc, stats }
```

- **Tombstones:** um item na lixeira marca o id como excluído; o merge não o traz de volta
  do remoto. Limitação conhecida: restaurar localmente e depois sincronizar de um remoto
  antigo pode re-podar o item (documentado na seção 13).
- `mergeDoc` nunca propaga `SECRET_KEYS`.

---

## 8. Views e raiz de composição

`js/app.js` é **só** a raiz de composição. Contém: o objeto `App`, `App.STATUS`,
`App.readTime`, os aliases (`App.$/el/esc/icon`, `App.toast/openModal/confirm/cover`,
`App.pickImage`), `App.navigate`, `App.applyTheme`, `bindEvents`, `setupPWA` e o boot
(`DOMContentLoaded`). **As telas não ficam aqui.**

Cada view é um IIFE que registra a API tanto em `App.*` (delegadores finos, para os
módulos legados) quanto em `Autor.views.<nome>`:

| View | Registra |
|------|----------|
| `js/views/shelf.js` | `App.renderShelf` (+ helpers de card/estatística, card "continuar") |
| `js/views/book.js` | `App.openBook`, `App.renderChapters`, `App.addChapter`, `App.openChapter`, `App.bookFormModal`, `App.chapterStatusModal` |
| `js/views/search.js` | `App.searchModal` |
| `js/views/trash.js` | `App.trashModal` |
| `js/views/settings.js` | `App.settingsModal` |
| `js/views/help.js` | `App.helpModal` (atalhos de teclado) |
| `js/views/assistant.js` | `App.assistantModal` (assistente de escrita com IA) |

**Como adicionar uma tela nova:** crie `js/views/<nome>.js` com o IIFE que registra em
`App` e em `Autor.views`, adicione o `<script>` em `index.html` (após `app.js`), adicione a
`sw.js` e suba o `CACHE`, e ligue o botão em `bindEvents` (`js/app.js`).

`App` ainda oferece: `STATUS` (`{ rascunho|revisao|concluido : { label } }`),
`App.readTime(words)`, `App.navigate(view)`, `App.applyTheme()`, `App.book`, `App.chapter`.

---

## 9. Editor, Review, Exporter, Importer, Sync, Reader

### 9.1 `Editor` (`js/editor.js`)
Editor por blocos `<p class="para" data-align="...">`. Autosave com debounce; guarda o
texto no mesmo formato do Content model.

```js
Editor.open(id, opts?)          // abre um capítulo no editor
Editor.flush()                  // grava pendências (chamado ao navegar/exportar/ler)
Editor.saveNow()
Editor.getText() / Editor.setText(text)
Editor.setTitle(title)
Editor.isDirty()
Editor.selectRange(...)
Editor.undo() / Editor.redo()
```

### 9.2 `Review` (`js/review.js`)
```js
Review.reset() / Review.toggle() / Review.open() / Review.openTab(tag)
Review.onTextChange(text)
Review.testAI(url, key, model)  // → true | string de erro
Review.analyze(text)            // → [{ ruleId, message, start, length, replacement, priority }]
Review.rules()                  // → [{ id, name, label, priority }] p/ a tela de configuração
```
Configuração em `Settings`: `reviewRules` (mapa `id → false` para desativar regras; ausente
= ativa) e `personalDict` (lista de termos que suprimem falsos positivos e são anexados ao
prompt da IA). Cada regra tem `name` (categoria, usado para agrupar) e `label` (rótulo
específico, único); a tela de configuração agrupa por `name` e mostra o `label`.

### 9.3 `Exporter` (`js/export.js`)
```js
Exporter.bookDialog(book) / Exporter.chapterDialog(chapter)
Exporter.exportBackup() / Exporter.importBackup()
Exporter.snapshot()                        // → Promise<doc JSON> (sem segredos)
Exporter.mergeImport(doc) / Exporter.replaceImport(doc)
Exporter.bookToMarkdown(book, chapters) / Exporter.chapterToMarkdown(chapter, book)
Exporter.buildEpub(book, chapters)         // → Blob EPUB 2/3 válido (síncrono)
```
Formatos: TXT, Word (`.doc` HTML), PDF (impressão), **Markdown**, **EPUB** e backup JSON
(merge por id). `snapshot`/`mergeImport`/`replaceImport` são o seam reutilizado pela
sincronização; nunca incluem `SECRET_KEYS`.

### 9.4 `Reader` (`js/reader.js`)
```js
Reader.open({ bookId }) | Reader.open({ chapterId }) | Reader.open({ select: termo })
```
Preferências em `Settings`: `readerFontFamily`, `readerTheme`, tamanho de fonte.
O leitor também tem **sumário (TOC)**, **busca no texto** (`<mark class="search-hit">`),
**leitura em voz alta** (Web Speech API) e **retomada de posição** (`Settings.readerProgress`).

### 9.5 `Importer` (`js/import.js`)
```js
Importer.open()                          // abre o seletor de arquivo + prévia (UI)
Importer.parseMarkdown(text, fallbackTitle)
Importer.parsePlainText(text, fallbackTitle)
Importer.parseFile(file)                 // → Promise<doc>; detecta .txt/.md/.docx/.epub/.html
Importer.createFromDoc(doc, { title, author, bookId })  // cria/atualiza via Store
Importer.preview(doc, fileName)
```
A importação **reaproveita** `Store`, `Content` e `Autor.zip` (para descompactar
`.docx`/`.epub`). O `doc` produzido tem a mesma forma do backup `{ title, chapters }`, então
pode ser criado como obra nova ou anexado a uma existente.

### 9.6 `Sync` (`js/sync.js`)
```js
Sync.providers                   // mapa id → provider (webdav, gist)
Sync.provider()                  // provider ativo (objeto com id/label/fields) ou null
Sync.configured()                // true se o provider ativo tem o necessário
Sync.status()                    // { provider, providerLabel, configured, lastAt, lastResult }
Sync.now(opts?)                  // → Promise<stats>; faz pull+merge+push
```
Provedores suportados: **WebDAV** (Nextcloud/ownCloud…) e **GitHub Gist**. Toda a
reconciliação é feita por `Autor.merge.mergeDoc` sobre o documento `snapshot()`. Segredos
(`webdavPass`, `gistToken`) ficam em `Settings` e **nunca** vão para o backup.

---

## 10. Convenções de código

- **IIFE + `'use strict'`** por módulo; registre o global explicitamente
  (`window.X = api`) e também em `window.Autor`.
- **Sem comentários supérfluos.** Comente só a intenção/decisão (o "porquê"), como nos
  módulos existentes. Cabeçalho de arquivo curto explicando a responsabilidade.
- **pt-BR** em textos de UI, toasts, labels e mensagens; nomes de código em inglês são
  aceitáveis, mas siga o estilo do arquivo.
- **`esc()` sempre** que interpolar conteúdo do usuário em HTML.
- **Módulos "profundos":** interface pequena escondendo complexidade (ver `Ui`, `Img`,
  `Content`, `persistence`). Antes de criar um módulo novo, pergunte se ele aprofunda
  alguma abstração ou só move código.
- **Idempotência/back-compat dos dados:** mudanças de formato de dados precisam migrar ou
  tolerar registros antigos.
- Evite estado global novo; prefira registrar em `Autor.views`/`Autor`.

---

## 11. Armadilhas conhecidas (gotchas)

1. **`const` de script clássico é compartilhado entre `<script>`s, mas não vira
   propriedade de `window`.** Por isso cada módulo atribui `window.X` explicitamente.
   Não dependa de `const` cru de outro arquivo sem o alias.
2. **Esquecer `sw.js`.** Ao adicionar/renomear um arquivo: atualize `ASSETS` **e** suba
   `const CACHE = 'autor-vNN'`. Sem o bump, usuários ficam com a versão antiga em cache.
3. **Ordem dos scripts** (seção 4.2). Trocar a ordem pode quebrar o load.
4. **Testes em `node:vm` têm outro realm:** arrays/objetos criados dentro do sandbox têm
   protótipo diferente e `deepStrictEqual` falha mesmo com conteúdo igual. Use o helper
   `plain(v) = JSON.parse(JSON.stringify(v))` (já usado nos testes).
5. **`indexedDB` ausente no sandbox de teste** é intencional: força o adaptador `ls`.
   Não "conserte" isso.
6. **Guardar conteúdo cru no HTML** quebra o alinhamento/segurança: use `Content.*` e `esc()`.
7. **`Chapters.save` de capítulo órfão não grava** (invariante). Se um fluxo novo depender
   de gravar capítulo sem livro, ele está errado.
8. **Autosave do editor** agenda gravação com debounce; ao sair da tela use
   `Editor.flush()`. `visibilitychange` também grava. Não leia `App.chapter` assumindo que
   já foi persistido sem `flush`.
9. **`Ui.cover` / capas são data URLs JPEG** — não são URLs de servidor; não tente
   "carregar" por `fetch`.
10. **`file://` não tem service worker** e o armazenamento pode variar; sempre valide o
    caminho de reserva (`localStorage`) quando mexer em persistência.
11. **Não edite `#modal-root` à mão**; use `Ui.openModal` (foco preso/ARIA/close).

---

## 12. Checklist de mudança (Definition of Done)

1. [ ] Alterei/criei o(s) arquivo(s) seguindo as convenções (seção 10).
2. [ ] Se criei/renomeei arquivo JS: atualizei `index.html` (ordem correta) **e** `sw.js`
       (`ASSETS`) **e** subi `CACHE` (`autor-vNN`).
3. [ ] Se mudei o formato de dados: mantive back-compat (ou migrei).
4. [ ] `node --check <arquivos alterados>` sem erro.
5. [ ] `node --test` verde (60 testes; adicionei testes para lógica pura nova).
6. [ ] Smoke test no navegador (seção 12.1), incluindo reload e, quando relevante, o modo
       `localStorage` de reserva.
7. [ ] Textos em pt-BR e conteúdo do usuário escapado.
8. [ ] Sem novas dependências de runtime; `file://` continua funcionando.

### 12.1 Checklist de smoke test no navegador

Sirva localmente (`python -m http.server`) e verifique:

- [ ] Prateleira: criar livro (com capa), filtro por status, busca local, card "continuar".
- [ ] Tela do livro: editar livro, trocar status, adicionar capítulo.
- [ ] Editor: digitar, Enter (novo parágrafo), colar, alinhar, desfazer/refazer, Ctrl+S
      (autosave), sair e voltar (dados persistem). Modo foco, sumário do livro (TOC),
      meta de escrita e navegação entre capítulos.
- [ ] Capítulos: mover ↑/↓, duplicar, mudar status, excluir (vai para a lixeira).
- [ ] Reader: abrir livro/capítulo, fonte ±, tema, voltar; sumário, busca no texto e
      leitura em voz alta (TTS) quando o navegador suportar.
- [ ] Exportar: TXT, DOC, PDF (impressão), **Markdown**, **EPUB** e **backup JSON**;
      **importar** backup e **importar manuscrito** (.txt/.md/.docx/.epub/.html).
- [ ] Revisão: regras offline ligar/desligar, dicionário pessoal suprime falsos positivos.
- [ ] Assistente de escrita (IA): continuar/resumir com chave configurada; sem chave, abre o
      atalho para as configurações.
- [ ] Sincronização: configurar WebDAV/Gist, "Testar conexão" e "Sincronizar agora".
- [ ] Busca global (Ctrl+K), lixeira (restaurar e esvaziar), tema claro/escuro,
      configurações (IA, regras, dicionário, TTS, sync, backup).
- [ ] Atalhos de teclado (tecla `?`).
- [ ] Recarregar a página: dados persistem (IndexedDB). Sem erros no console.
- [ ] (Quando aplicável) modo reserva `localStorage` funcionando.

---

## 13. Roadmap e pontos de extensão

Objetivo do trabalho em curso: **facilitar a integração de novas ferramentas e polir o
código**. Estado atual e onde novas extensões encaixam:

| Ferramenta/recurso | Onde plugar | Estado |
|--------------------|-------------|--------|
| EPUB | `js/export.js` (`Exporter.buildEpub`) + `Autor.zip` | feito |
| Markdown | `js/export.js` (`bookToMarkdown`/`chapterToMarkdown`) | feito |
| Importar manuscrito (.txt/.md/.docx/.epub/.html) | `js/import.js` (`Importer.parseFile`) | feito |
| Sync/nuvem (WebDAV/Gist) | `js/sync.js` + `Autor.merge` (não fura a persistência) | feito |
| Reader: sumário (TOC), busca, TTS | `js/reader.js` (+ `Settings`) | feito |
| Assistente de escrita com IA | `js/views/assistant.js` + `Autor.ai` | feito |
| DOCX "de verdade" (OOXML) | `js/export.js` (novo formato; `.doc` HTML já existe) | pendente |
| Rich text (negrito/itálico inline) | `Content.Block` (`js/core/content.js`) é o ponto de extensão; afeta editor, reader, export e busca | pendente |
| Imagens inline | mesmo ponto do rich text + `Autor.image`/`Img` | pendente |
| Reader: bookmarks | `js/reader.js` (+ `Settings`) | pendente |
| sync por pasta local (File System Access) | exigiria persistir o handle (fora do seam de persistência) | pendente |
| novo backend de persistência | novo adaptador em `js/core/persistence.js` (seção 6.1) | — |

**Limitações conhecidas da sincronização:** a reconciliação usa `updatedAt`/`id` e a lixeira
como *tombstone*. Restaurar um item localmente e depois sincronizar a partir de um remoto
antigo pode re-podar o item (o remoto ainda o considera excluído). Sincronizações
concorrentes entre dispositivos sem um relógio comum podem escolher a versão "errada" do
empate; a resolução é sempre determinística (prefere a mais recente, desempata pelo local).

Princípios para novas ferramentas:

- Mantenha os **seams** existentes: não fure a camada de persistência, não chame
  IndexedDB direto, não manipule modal/DOM fora de `Ui`/`Dom`.
- Cada ferramenta nova deve poder ser testada isoladamente quando a lógica for pura
  (como `Content` e `Img.fit`).
- Prefira evoluir formatos **sem** quebrar os dados já salvos.

---

## 14. Índice de ADRs (`docs/adr/`)

- **ADR-0001 — Content model.** Extrai o modelo de conteúdo (`Content`) e os módulos
  `dom`/`ui`; marcadores de alinhamento e invariantes do texto.
- **ADR-0002 — Persistence seam.** Adaptadores `idb()`/`ls()` atrás de uma interface
  única; repositórios desacoplados; guarda de invariante em `Chapters.save`.
- **ADR-0003 — Image module.** `Autor.image` (`pick`/`fromFile`/`resize`/`fit`) + widget
  `Ui.cover` reutilizável no livro e no capítulo.
- **ADR-0004 — View modules.** Telas em `js/views/*`; `app.js` reduzido a raiz de
  composição.
- **ADR-0005 — Extensões (IA, importação, EPUB/Markdown, sync).** `Autor.ai` como cliente
  único de IA; lógica de merge/segredos pura em `Autor.merge`; `Autor.zip` sem dependências;
  `Sync` como motor separado sobre o snapshot; configuração nova em `Settings` (sem novo
  store/`DB_VERSION`).

> Ao tomar uma decisão arquitetural relevante, escreva um novo ADR (`ADR-000N-titulo.md`)
> seguindo o formato dos existentes.

---

## 15. Glossário rápido

- **Obra / Book** — um livro.
- **Capítulo / Chapter** — unidade do livro; tem `content` no Content model.
- **Bloco / Block** — um parágrafo (`{type, align, text}`); pode ser `para` ou `rule`
  (quebra de página `---`).
- **Adaptador / Adapter** — implementação concreta de persistência (`idb`, `ls`, futuro
  `remote`).
- **Repositório** — `Books`/`Chapters`/`Trash`/`Settings` em `storage.js`.
- **Seam** — fronteira substituível entre partes do sistema (ex.: persistência, imagem).
- **Fallback mode** — quando o app usa `localStorage` em vez de IndexedDB.
- **Snapshot** — documento JSON com `{ app, version, exportedAt, books, chapters, trash,
  settings }`, sem segredos; base do backup e da sincronização.
- **Tombstone** — item da lixeira usado para marcar um id como excluído no merge.
- **TTS** — *text-to-speech*; leitura em voz alta no modo leitura (Web Speech API).
- **EPUB / OPF** — formato de livro digital; o OPF descreve metadados e a ordem (spine).

Veja também `GLOSSARY.md`.

---

## 16. Se algo não estiver claro

- Leia os ADRs (seção 14) e os cabeçalhos dos módulos — eles explicam o "porquê".
- Em caso de dúvida sobre uma decisão de dados, **preserve os dados do usuário** e a
  back-compat.
- Mudanças grandes: proponha um ADR antes de implementar.
