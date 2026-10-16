# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Autor solo: uma pessoa escrevendo livros e histórias sozinha, no próprio
dispositivo (computador ou celular), em sessões longas de escrita e revisão.
Não existe equipe, conta nem servidor do lado do app.

## Product Purpose

Escrever, revisar e exportar livros e histórias com ferramentas completas
(editor por parágrafos, revisão, assistente de IA opcional, exportação e
importação), funcionando offline a partir do duplo clique ou de um host
estático. Sucesso é: o autor abre o app, escreve sem atrito, encontra
qualquer coisa, revisou e exportou — e recarregou sem perder nada.

## Positioning

O mecanismo que um vizinho não pode copiar com honestidade: **sem backend,
sem conta, sem telemetria**. Todos os dados ficam no dispositivo do autor
(IndexedDB com reserva em localStorage); a sincronização opcional usa a
própria nuvem do autor (WebDAV/GitHub Gist), nunca um servidor do app.
Offline-first e instalável (PWA), audível e exportável a qualquer momento
(TXT, DOC, PDF, Markdown, EPUB, backup JSON).

## Operating Context

- Escrita em sessões repetidas ao longo de dias/semanas; retomar de onde parou.
- Modo foco para produção; revisão em lote; leitura (reader) para conferir o texto.
- Publicado via GitHub Pages e também usado por duplo clique em `file://`.
- App clássico de JavaScript sem build: `<script src>` em `index.html`,
  zero dependências em runtime, zero CDN.
- Dispositivos pequenos e touch; é um PWA instalável.

## Capabilities and Constraints

- **Modelo de dados:** `books`, `chapters`, `trash`, `settings` — chaves já
  salvas nunca mudam (back-compat obrigatória).
- **Seam de persistência:** só via `Autor.persistence` (`idb()`/`ls()`); nunca
  IndexedDB direto.
- **Contratos técnicos (AGENTS.md C1..C8):** JS clássico sem ES modules/build;
  funciona em `file://` e http(s); sem dependências em runtime; UI em pt-BR;
  conteúdo do usuário sempre por `esc()`; ao mexer em JS atualizar
  `index.html` + `sw.js` (`ASSETS`) e subir o `CACHE`; manter todos os aliases
  globais (`App.*`, `window.Content`, `window.Store`, `window.Ui`, …).
- **Conteúdo:** texto como parágrafos com marcadores de alinhamento
  (`Content`); qualquer coisa que exporte/exiba fora do editor usa `toExport`.
- **IA:** opcional, API compatível com OpenAI lida por `Autor.ai`; revisão
  offline e dicionário pessoal funcionam sem chave.
- **Decidido, sem inventar:** o app não tem backend nem conta — qualquer futuro
  recurso que exija servidor está fora do escopo por enquanto.

## Brand Commitments

- O **nome "Autor"** é vinculante: não é renomeado neste trabalho.
- Toda a interface é **pt-BR**; nomes de código em inglês são aceitáveis.
- Expressão visual (símbolo, cores, tipografia, motion) **não** é compromisso:
  pode ser substituída integralmente.

## Evidence on Hand

- `AGENTS.md`, `GLOSSARY.md`, `docs/adr/*` — verdade de produto e arquitetura.
- Código executável com 60 testes verdes (`node --test`).
- Ícones PWA em `icons/`; nenhum logótipo proprietário, nenhuma imagem de marca.
- **Ausências que o trabalho não deve fabricar:** não há clientes, depoimentos,
  métricas de uso, preço, imprensa nem casos de sucesso; nenhum conteúdo
  ilustrativo pode se passar por dado real do usuário.

## Product Principles

1. O texto do autor é o produto: tudo mais existe para reduzir atrito na
   escrita e nunca atrasa o autosave.
2. Privacidade por arquitetura: dado fora do dispositivo é só o que o autor
   enviar de propósito.
3. Offline-first e sem build: o app abre em qualquer lugar, inclusive por
   duplo clique.
4. Consistência entre telas: mesma gramática de ações, estados e mensagens.
5. Funcionalidade opcional não pode punir quem não usa (IA e sync fora do
   caminho feliz).

## Accessibility & Inclusion

- Contraste AA mínimo (texto ≥4.5:1); foco de teclado visível em todo controle.
- `prefers-reduced-motion` deve deixar o app inteiro utilizável.
- Leitores de tela: ARIA em modais (foco preso), `aria-live` em toasts e
  indicadores; `lang="pt-BR"` e spellcheck nativo em português.
- Uso touch em PWA: alvos confortáveis e sem zoom automático ao focar campos.
