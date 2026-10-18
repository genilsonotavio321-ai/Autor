# Autor

App pessoal de escrita e planejamento de livros — local-first, offline, sem conta.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui + Framer Motion
- Zustand + React Query · Dexie (IndexedDB) · Tiptap · FlexSearch
- Vitest + Playwright · Serwist (PWA/offline)

## Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run lint       # ESLint
npm run typecheck  # TypeScript (tsc --noEmit)
npm test           # Vitest (unidade/componentes)
npm run test:e2e   # Playwright (E2E)
npm run test:e2e:offline  # Playwright (E2E offline: build + service worker)
```

## Deploy

O app é local-first: não há backend nem variáveis de ambiente. O deploy só precisa servir o Next.js.

- **Vercel (recomendado, definido no plano)**: importe o repositório na Vercel; o framework é detectado automaticamente (`next build`). Cada push na `main` gera um deploy de produção e cada PR, um deploy de preview. O service worker (Serwist) é gerado no build.
- Versão do Node fixada via `engines` no `package.json` (24.x), igual à do CI.
- CI: `.github/workflows/ci.yml` roda lint, typecheck, testes unitários, build e E2E (Playwright/chromium) em cada push e PR para `main`.
- No celular, abra a URL de produção e use "Adicionar à tela inicial" para instalar como PWA e usar offline.
- Os dados ficam no IndexedDB de cada navegador; para levar conteúdo entre dispositivos use `/export` (backup JSON) e importe no outro.

## Estrutura

```
src/
  app/            rotas (App Router, route group (app) = shell autenticado-sem-conta)
  components/     componentes compartilhados (layout/, ui/ shadcn)
  features/       módulos por domínio (fases 1+)
  infra/          db (Dexie, migrações, multi-aba) e storage (quota)
  shared/         types, store (Zustand), ui helpers
```

## Recursos (Fase 1)

- Projetos: criar/editar, status, capítulos com ordenação automática.
- Editor Tiptap: toolbar, contagem de palavras, autosave (800ms), modo foco (Esc sai).
- Retomar escrita: botão "Continuar escrevendo" no painel volta ao capítulo/posição exatos.
- Versionamento: snapshots automáticos (5 min) e manuais, restaurar via diálogo.
- Exclusão suave + restaurar (projetos, capítulos) com "Desfazer" no toast e página de lixeira.
- Atalhos: Ctrl/Cmd+K paleta de comandos; tema claro/escuro.

## Recursos (Fase 2)

- Estrutura (`/outline`): outline com capítulos e cenas reordenáveis por arrasto **e teclado** (dnd-kit), beat sheets por estrutura (Três atos, Jornada do herói, Save the Cat, Kishōtenketsu), corkboard de cenas e kanban de status — tudo filtrado pelo projeto selecionado.
- Linha do tempo (`/timeline`): eventos ordenados por data, vínculo com capítulos.
- Notas (`/notes`): criar, editar, fixar (aparecem primeiro), exclusão suave com "Desfazer"; restauração na lixeira.
- Seletor de projeto global persistido (usado em Estrutura, Linha do tempo, Notas e Lixeira).

## Recursos (Fase 3)

- Personagens (`/characters`): ficha com papel (protagonista/antagonista/secundário/menor), descrição, história, objetivos, medos, traços (tags livres) e relações (tipo + nota) com outros personagens do projeto.
- Mundo (`/world`): locais (nome, tipo com sugestões, descrição) e entradas de lore (categoria, conteúdo, vínculos com personagens/locais) em abas separadas.
- Lixeira ampliada: seções para projetos, notas, personagens, locais e lore, todas com restauração.

## Recursos (Fase 4)

- Busca global (`/search`, Ctrl/Cmd+K → "Buscar no acervo"): FlexSearch in-memory insensível a acentos ("dragao" encontra "Dragão") sobre capítulos, cenas, personagens, locais, lore e notas; resultados com tipo, projeto e prévia.
- Exportar (`/export`): projeto inteiro em Markdown, Word (DOCX) ou PDF, com título, autor e quebras de capítulo.
- Importar: arquivos `.md` com front matter viram capítulos do projeto selecionado (round-trip com o Markdown exportado).
- Backup: exportação JSON completa do banco e restauração com confirmação (substitui todos os dados).

## Recursos (Fase 5)

- Painel: estatísticas reais (projetos, capítulos, palavras, tempo estimado de leitura), meta diária com barra de progresso, palavras na semana, sequência de dias, "Continuar de onde parou" e lista de projetos recentes; card de primeiros passos quando não há projetos.
- Configurações (`/settings`): tema (claro/escuro/sistema), fonte e tamanho do editor, meta diária, duração do sprint, tempo do botão "Continuar", lista de atalhos e acesso ao backup.
- Produtividade: sprint timer no editor (com registro de sessões) e log de escrita por dia (`settings`), base das estatísticas do painel.
- Tags: gestão por projeto (criar, renomear, recolorir, mesclar, excluir com limpeza de referências) e marcação de personagens; filtros de personagens por papel e tag.
- Modo leitura (`/read`): preview do manuscrito do capítulo com tipografia confortável, navegação anterior/próximo e estimativa de leitura.
- PWA/offline: service worker (Serwist), manifest e ícones; o app funciona offline após o primeiro carregamento.
- Desempenho: editor Tiptap carregado sob demanda (`next/dynamic`) — `/write/[chapterId]` caiu de ~346 kB para ~214 kB (First Load JS).

## Recursos (Fase 6 — Refinamentos de UX)

- Painel: estatísticas **separadas por projeto** em uma tabela (capítulos, palavras e tempo estimado de leitura), substituindo a antiga lista de projetos recentes.
- Projetos (`/projects`): seletor de ordenação (alterados recentemente, mais recentes, mais antigos, A–Z, mais palavras, maior tempo de leitura) e alternância de disposição entre caixas e lista compacta; cada item mostra capítulos, palavras e leitura estimada. Preferências persistidas (`autor-ui`).
- Capítulos: reordenação por arrasto **e teclado** direto na página do projeto; o status passou a ter um **único** seletor colorido por estado (A fazer, Rascunho, Revisão, Concluído) — corrige a duplicação de status (badge + select).
- Destaques no texto: nomes de personagens e locais do projeto são coloridos e clicáveis no editor (Ctrl/Cmd+clique abre a ficha) e no modo leitura (clique simples). Cores e ligar/desligar em Configurações (`/settings`, cartão "Destaques no texto"). Destaques são apenas visuais (decorações), não entram no texto salvo nem na exportação.

## Notas

- Banco IndexedDB `autor` com schema versionado (Dexie) e migrações de dados com backup pré-migracao (`src/infra/db/migrations.ts`).
- Multi-aba via `broadcast-channel` (`src/infra/db/multi-tab.ts`).
- `next@15` mantido por compatibilidade com o plano; `npm audit` reporta vulnerabilidade em `postcss` resolvida apenas em `next@16` (migração futura).
- Service worker gerado pelo Serwist em `public/sw.js` (fora do versionamento); fica desabilitado em `next dev`.
- Preferências de UI (tema do editor, metas, sprint) ficam no `zustand/persist` (`autor-ui`); o log de escrita do dia é o único que usa a tabela `settings` do IndexedDB (para aparecer no painel via `useLiveQuery`).
