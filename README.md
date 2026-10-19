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

## Recursos (Fase 7)

- Lixeira ampliada: agora cobre também capítulos, cenas, eventos da linha do tempo e beats (além de projetos, notas, personagens, locais e lore). Restauração em cascata: uma cena órfã de um capítulo excluído restaura o capítulo junto, para não sumir da visualização.
- Restauração segura: exclusões em `/timeline` e na lista de beats ganharam o toast com "Desfazer", igual às demais telas.
- Diff de versões: o diálogo de versões do editor mostra um **preview das diferenças** (parágrafo a parágrafo, com linhas removidas/adicionadas destacadas) antes de restaurar — nada mais é restaurado às cegas.
- Importar Word (`.docx`): round-trip com a exportação DOCX existente (`/export` → "Importar projeto"). Lê um capítulo por título (reconhece títulos grandes em negrito do arquivo do Autor e estilos de título do Word) e listas, blocos de citação e código.
- Gráfico de atividade no Painel: mapa de calor dos últimos 12 semanas (estilo GitHub) ao lado da meta diária, lendo o log de escrita por dia já registrado.

## Recursos (Fase 8)

- Status de projeto "Concluído": o projeto passa a ter quatro estados (Rascunho, Ativo, Concluído, Arquivado); o Badge de "Concluído" tem tom esmeralda.
- Projetos (`/projects`) com abas **Ativos** (rascunho, ativo e concluído) e **Arquivados** — os arquivados ficam guardados na própria aba, sem se misturar aos ativos.
- Importar notas: no menu (⋯) da página de notas, importa `.md` (`## Título` por nota) ou `.txt` (blocos separados por linha em branco); exportar e limpar também migraram para o mesmo menu.
- Limpar histórico de versões: o diálogo de versões do editor ganhou o botão "Limpar", que apaga definitivamente todas as versões do capítulo (com confirmação).
- Atalhos de teclado atualizados em Configurações, e reordenação por teclado (Espaço + setas) agora funciona também em personagens, locais, lore e notas.
- Tags com seletor de cor livre: além dos tons predefinidos, o seletor RGB nativo permite qualquer cor.
- `---` sozinho na linha vira uma quebra de parágrafo visível (linha horizontal) no editor, no modo leitura e nos PDFs e DOCX exportados.
- Alinhamento (esquerda, centro, direita e justificado) preservado no modo leitura e nos PDFs exportados; citações ganham recuo e barra lateral, e listas aninhadas mantêm o recuo no PDF.
- Ficha in-place no editor: Ctrl/Cmd+clique em um nome destacado abre a ficha sobre o texto, com o pop-up "Voltar ao texto" que devolve o cursor e a rolagem ao ponto exato de escrita; comportamento configurável em Configurações (`/settings`, cartão "Destaques no texto").
- Aba **Dados** (antes "Exportar"): exportar o projeto em Markdown, Word ou PDF (Memória), importar capítulos `.md`/`.docx`, restaurar um backup completo `.json` (Restaurar dados) e baixar o backup dos dados.

## Recursos (Fase 9 — Celular e PDF)

- Correção do autosave do título: renomear um capítulo não perde mais a última letra digitada (o agendamento da salva agora recebe o valor fresco do campo).
- Cards de personagem compactos no celular: chips de traços e tags truncam em vez de estourar a tela, cabeçalho com "Novo personagem" quebra linha e o avatar/box ficam menores (390×844 sem rolagem horizontal).
- Diálogo "Revisar" adaptado ao celular: ocorrências empilham (chega + botões em linha) e a fileira de ações quebra linha; `overflow-x-hidden` evita sair da tela.
- Espaçamento entre cards aumentado no celular em personagens, notas, mundo e corkboard (`gap-4` no celular, `gap-3` no desktop).
- Linha de capítulo reorganizada em três faixas (título / contagem de palavras / rodapé "atualizado há X" + seletor de status), dentro e fora do modo outline.
- Lista de projetos em modo "empilhada" não estoura mais: `overflow-hidden`, `min-w-0`, `flex-wrap` e badge encolhível.
- Itens arrastáveis (estrutura, beats, corkboard, kanban): `touch-none` no pega de arraste e guard contra o clique-fantasma — soltar o arraste não abre o diálogo de edição nem o teclado, mas o toque simples ainda abre. Diálogos de cena/beat abrem sem foco automático (sem teclado no celular).
- PDF com **negrito, itálico e negrito-itálico** reais (runs estilizados → fontes Times-Roman/Bold/Italic/BoldItalic) e alinhamento (esquerda, centro, direita, justificado) calculado linha a linha — justificado estica os espaços das linhas não finais.
- Testes E2E novos: `e2e/fase9.spec.ts` (renomear capítulo, arraste na estrutura, PDF com marcas e alinhamento) e `e2e/mobile.spec.ts` (nenhuma tela estoura 390px; diálogo Revisar no celular).

## Notas

- Banco IndexedDB `autor` com schema versionado (Dexie) e migrações de dados com backup pré-migracao (`src/infra/db/migrations.ts`).
- Multi-aba via `broadcast-channel` (`src/infra/db/multi-tab.ts`).
- `next@15` mantido por compatibilidade com o plano; `npm audit` reporta vulnerabilidade em `postcss` resolvida apenas em `next@16` (migração futura).
- Service worker gerado pelo Serwist em `public/sw.js` (fora do versionamento); fica desabilitado em `next dev`.
- Preferências de UI (tema do editor, metas, sprint) ficam no `zustand/persist` (`autor-ui`); o log de escrita do dia é o único que usa a tabela `settings` do IndexedDB (para aparecer no painel via `useLiveQuery`).
