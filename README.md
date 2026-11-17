# Autor

App pessoal de escrita e planejamento de livros — local-first, offline, sem conta.

## Revisão mobile-first

O app foi redesenhado de dentro para fora com o celular como plataforma principal, mantendo
o desktop confortável. Continua sendo a mesma base local-first: **nenhum backend, nenhuma
conta**, dados no IndexedDB do navegador.

### Decisões

| Tema | Decisão |
|---|---|
| Plataforma | PWA instalável no iOS/Android; offline após o primeiro carregamento |
| Layout | Coluna única no celular, barra inferior fixa; rail lateral a partir de `lg` |
| Temas | 12 paletas editoriais em OKLCH — 6 claras e 6 escuras, escolhidas em lista |
| Configurações | Divididas em **Geral** (o essencial) e **Dados**; o resto fica em "Avançado" |
| Dados antigos | Importação pelos arquivos exportados pelo app original (backup JSON e pacote de projeto) |
| Movimento | Animações CSS curtas, desligáveis; sem som e sem biblioteca de animação |

### Temas

- **Claros:** Papel, Marfim, Névoa, Terra, Oliva, Lavanda
- **Escuros:** Tinta, Grafite, Meia-noite, Ameixa, Oceano, Musgo

Cada tema tem sua própria paleta completa (fundo, cartões, texto, primária, bordas e sidebar).
A escolha fica em **Configurações → Aparência**, em uma lista vertical com amostra da paleta,
nome, descrição curta e marcação do ativo; a lista alterna entre as claras e as escuras
conforme o tema. Valores antigos (Padrão, Sépia, Areia, Floresta) são migrados automaticamente.

### Navegação e telas

- Celular: barra inferior flutuante **Escrever · Personagens · Mundo · Notas** + menu de três linhas (seletor de projeto, busca e demais seções), com safe areas do iOS.
- Desktop: topbar no topo e rail lateral; não há menu hambúrguer escondido.
- Ações de página ficam numa barra flutuante centralizada, também no desktop. O tema mora apenas em Configurações.
- Todas as 14 telas foram redesenhadas com tipografia editorial (Fraunces para títulos e
  leitura, Inter para interface), respeitando 390×844 sem rolagem horizontal.

### Configurações

- **Geral:** tema e paleta, fonte e tamanho do editor, meta diária, animações,
  destaques de nomes, menções, expiração da lixeira e busca.
- **Dados:** exportar (Markdown/Word/PDF), importar capítulos, backup JSON completo,
  restauração e importação de pacote de projeto.
- Prompts longos mantêm **editar/excluir** acessíveis no celular; selects truncam em vez
  de estourar o cartão.

### Exclusão

Toda ação destrutiva usa o mesmo padrão: ícone de lixeira + rótulo **Excluir** (com
"Excluir todas" / "Excluir histórico" quando for em lote), confirmação quando irreversível
e toast com **Desfazer** quando dá para restaurar.

### Qualidade

- Suíte E2E adaptada ao novo shell, com specs de celular em 390×844 (prompt, tag e nome de
  projeto muito longos; diálogo de revisão; nenhuma tela estoura a largura).
- Importação do app original coberta por testes de backup JSON e pacote de projeto.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (animações em CSS, sem biblioteca de movimento)
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
- Os dados ficam no IndexedDB de cada navegador; para levar conteúdo entre dispositivos use **Configurações → Dados** (backup JSON) e importe no outro.

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
- Editor Tiptap em tela cheia: título no topo, autosave (800ms), sidebar flutuante de ações e formatação na sidebar da seleção.
- Retomar escrita: abrir o app volta ao capítulo e ao ponto exatos da última edição.
- Versionamento: snapshots automáticos (5 min) e manuais, restaurar via diálogo.
- Exclusão suave + restaurar (projetos, capítulos) com "Desfazer" no toast e página de lixeira.
- Atalhos: Ctrl/Cmd+K paleta de comandos; tema claro/escuro.

## Recursos (Fase 2)

- Estrutura (`/outline`): roteiro de capítulos e cenas reordenáveis por arrasto **e teclado** (dnd-kit), cenas em lista ou kanban e beats — tudo filtrado pelo projeto selecionado.
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

- Painel: estatísticas reais (projetos, capítulos, palavras, tempo estimado de leitura), meta diária com barra de progresso, palavras na semana, sequência de dias e lista de projetos recentes; card de primeiros passos quando não há projetos.
- Configurações (`/settings`): tema (claro/escuro/sistema), fonte e tamanho do editor, meta diária, lista de atalhos e acesso ao backup.
- Produtividade: log de escrita por dia (`settings`), base das estatísticas do painel.
- Tags: gestão por projeto (criar, renomear, recolorir, mesclar, excluir com limpeza de referências) e marcação de personagens; filtros de personagens por papel e tag.
- Modo leitura (`/read?project=&chapter=`): preview do manuscrito com tipografia confortável e estimativa de leitura; a barra flutuante traz grifar a seleção, revelar grifados, escolher capítulo e editar.
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
- Projetos (`/projects`) sem abas: os arquivados ficam numa lista oculta atrás de "Mostrar arquivados", sem se misturar aos ativos.
- Importar notas: a página de notas importa `.md` (`## Título` por nota) ou `.txt` (blocos separados por linha em branco).
- Limpar histórico de versões: o diálogo de versões do editor ganhou o botão "Limpar", que apaga definitivamente todas as versões do capítulo (com confirmação).
- Atalhos de teclado atualizados em Configurações, e reordenação por teclado (Espaço + setas) agora funciona também em personagens, locais, lore e notas.
- Tags com seletor de cor livre: além dos tons predefinidos, o seletor RGB nativo permite qualquer cor.
- `---` sozinho na linha vira uma quebra de parágrafo visível (linha horizontal) no editor, no modo leitura e nos PDFs e DOCX exportados.
- Alinhamento (esquerda, centro, direita e justificado) preservado no modo leitura e nos PDFs exportados; o botão na barra da seleção alterna o modo a cada clique e vale para os parágrafos selecionados. Citações ganham recuo e barra lateral, e listas aninhadas mantêm o recuo no PDF.
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

## Recursos (Fase 10 — Estrutura e linha do tempo conectadas)

- Aba **Estrutura** (`/outline`): a seção de beats flat virou um quadro de **seções → beats**. Escolha uma teoria no catálogo (Três atos, Jornada do herói, Save the Cat, Kishōtenketsu, os 7 enredos de Christopher Booker e as 31 funções de Propp em esferas) ou crie uma **estrutura própria** (só nomear as seções). Beats podem ser arrastados dentro e entre seções.
- **Arcos como tramas paralelas**: escolha o escopo (Trama principal ou um arco narrativo) para dar beats próprios a cada subtrama; os arcos continuam aparecendo como faixas na linha do tempo.
- **Catálogos dramáticos classificatórios**: as 36 situações de Georges Polti e as 6 funções dramáticas de Etienne Souriau nomeiam a situação de um beat (não são esqueletos de atos). Souriau permite atribuir personagens às seis funções (Leão, Sol, Terra, Marte, Balança, Lua).
- **Cena como ponte**: cada cena pode pertencer a um beat (`Scene.beatId`), e é isso que conecta estrutura e linha do tempo — o beat mostra as cenas vinculadas e quantos eventos elas têm; o evento mostra o beat correspondente com link "Estrutura".
- Aba **Cenas**: lista e kanban viraram visões alternáveis da mesma coleção (antes eram abas separadas). A aba **Roteiro** mantém a árvore de capítulos/cenas.
- **Migração automática**: os beats antigos viram seções do template equivalente (com vínculo de capítulo preservado e `linkedSceneId` migrado para `scene.beatId`), com backup pré-migração de praxe (`dataVersion`).

## Recursos (Fase 11 — Barra de ações e seleção)

- Alinhamento por atalho: o botão na barra da seleção do editor alterna esquerda → centro → direita → justificado a cada clique (o ícone mostra o modo atual) e vale para os parágrafos selecionados. O antigo submenu e a opção "Capítulo inteiro" saíram.
- Modo leitura: o botão **Grifar seleção** entrou na barra flutuante, ao lado de revelar grifados, escolher capítulo e editar; fica desabilitado sem texto selecionado e respeita o switch "Grifar na seleção (modo leitura)" das Configurações. A pílula flutuante sobre o texto deixou de existir.
- "Revelar grifados" ativo fica com fundo preenchido e ícone claro, para distinguir do estado inativo.
- Personagens: a **Ficha aleatória** deixou o cabeçalho e virou botão de dado (ícone) na barra de ações, junto de nova pasta e novo personagem.

## Recursos (Fase 12 — Sidebar de seleção)

- A barra horizontal que aparecia sobre o texto selecionado virou uma **sidebar vertical secundária**, encostada à esquerda da sidebar do capítulo: entra com slide-in ao selecionar texto e sai com slide-out ao esvaziar a seleção ou pressionar Esc. Os mesmos atalhos de formatação seguem nela (negrito, itálico, grifar, título, citação, listas e alinhamento).
- As duas sidebars são flutuantes (`fixed`), sem coluna própria e sem roubar largura do editor de forma permanente.
- A sidebar principal agora **minimiza** pelo primeiro botão da coluna: a coluna desliza para fora da tela, à direita, e uma aba sai da borda para reabrir. A preferência fica salva entre sessões.

## Recursos (Fase 13 — Navegação enxuta)

- Sidebars do editor: a coluna de formatação fica **ao lado** da principal em qualquer largura (nunca por cima dela) e assume a coluna dela quando está minimizada. Minimizar desliza a coluna para fora da tela e o botão de expandir entra pela borda direita.
- Status do capítulo: virou um **ponto colorido** na sidebar, abaixo do botão de ocultar; clicar abre o sub-menu com A fazer, Rascunho, Revisão e Concluído. O seletor do cabeçalho saiu.
- Modo leitura: texto sem espaços (URL, palavra colada) quebra dentro da coluna em vez de estourar a tela.
- Pastas: criar uma pasta vazia em Personagens ou Notas já mostra o card na hora — antes a lista só aparecia quando existia alguma ficha/nota.
- Notas: todas as ações foram para a sub-barra flutuante em ícones — nova nota (+), nova pasta, ordenação (menu com o critério atual), exportar, importar e excluir todas. O menu de três pontos deixou de existir.
- Menu "Mais" do celular: saíram os atalhos de Canvas, Ler, Mundo, Personagens e Início; o **Painel** entrou no lugar.
- Início (`/`) virou só três portas de entrada: **Nova história** (abre o formulário de projeto), **Novo capítulo** (escolhe o projeto — com arquivados numa região expansível — cria o capítulo e abre o editor) e **Localizar arquivos** (busca global). Os toggles de seções da Início e o card "Continuar de onde parou" saíram; a retomada automática continua, e cai em Início quando o capítulo salvo não pode mais ser aberto.

## Notas

- Banco IndexedDB `autor` com schema versionado (Dexie) e migrações de dados com backup pré-migracao (`src/infra/db/migrations.ts`).
- Multi-aba via `broadcast-channel` (`src/infra/db/multi-tab.ts`).
- `next@15` mantido por compatibilidade com o plano; `npm audit` reporta vulnerabilidade em `postcss` resolvida apenas em `next@16` (migração futura).
- Service worker gerado pelo Serwist em `public/sw.js` (fora do versionamento); fica desabilitado em `next dev`.
- Preferências de UI (tema do editor, metas, ordenação) ficam no `zustand/persist` (`autor-ui`); o log de escrita do dia é o único que usa a tabela `settings` do IndexedDB (para aparecer no painel via `useLiveQuery`).
