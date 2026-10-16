---
name: Autor
description: Sistema de design do "Autor" — uma oficina de imprensa fina para escrever livros offline.
colors:
  # papel (superfícies e tinta)
  bg: "#eef0e7"
  bg-soft: "#e7eadd"
  surface: "#fbfbf6"
  surface-2: "#f4f5ec"
  text: "#191f19"
  muted: "#5a6558"
  muted-strong: "#3f4941"
  border: "#d6dac6"
  border-strong: "#bcc2a9"
  # latão (acento)
  accent: "#7d5f18"
  accent-strong: "#634b12"
  accent-soft: "#f0e8cf"
  accent-contrast: "#fdfcf7"
  # tinta de prensa (shell da barra superior)
  shell: "#12362b"
  shell-2: "#0e2b22"
  shell-text: "#ece5d2"
  shell-muted: "#a7b7aa"
  shell-rule: "#26503f"
  shell-accent: "#d9b866"
  # semânticos
  danger: "#9c2b21"
  danger-soft: "#f7e7e3"
  danger-contrast: "#fdfcf7"
  ok: "#2f6a4c"
  ok-soft: "#e2efe6"
  warn: "#8a5a12"
  warn-soft: "#f5ecda"
  mark: "#ead77f"
  # leitor: temas alternativos (sépia e escuro de tinta)
  reader-sepia-bg: "#f5ecd6"
  reader-sepia-text: "#3c3020"
  reader-sepia-muted: "#6f5c3d"
  reader-sepia-border: "#ddcca6"
  reader-dark-bg: "#0a100c"
  reader-dark-text: "#ddd9cc"
  reader-dark-border: "#2b3d33"
  # escuro
  dark-bg: "#0b120e"
  dark-surface: "#121d18"
  dark-surface-2: "#17241d"
  dark-text: "#e8e5d8"
  dark-muted: "#95a496"
  dark-border: "#24352c"
  dark-accent: "#cdaa63"
  dark-accent-strong: "#e0c078"
  dark-accent-soft: "#2a2617"
  dark-shell: "#0e2b22"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.85rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.775rem"
    fontWeight: 650
    letterSpacing: "0.08em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  read:
    fontFamily: "'Literata', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"
    fontSize: "17.5px"
    fontWeight: 400
    lineHeight: 1.78
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
  full: "999px"
spacing:
  2xs: "4px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "14px"
  2xl: "20px"
  3xl: "30px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge:
    backgroundColor: "{colors.bg-soft}"
    textColor: "{colors.muted-strong}"
    rounded: "{rounded.full}"
    padding: "3px 9px"
  shelf-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "15px 12px 15px 10px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "30px 34px"
---

# Design System: Autor

## Overview

**Creative North Star: "O Colofão"**

O *Autor* é uma oficina de imprensa fina onde uma só pessoa compõe o próprio livro. O colofão — a marca do impressor no fim de um volume — é a metáfora do mundo inteiro: um app que se assume artesanal e datado no melhor sentido, feito para quem escreve devagar e relê. A tela não é uma planilha de arquivos; é uma bancada de trabalho tipográfico. Papel levemente esverdeado, tinta preta-esverdeada, filetes de latão e réguas de 1px substituem sombras e cartões flutuantes.

O cromo (a barra superior) carrega o mundo: verde-garrafa de tinta de prensa, com o título em Archivo em versalete espacejado e um dispositivo do impressor desenhado à mão. O miolo é papel pautado: a prateleira é um *índice* regrado linha a linha, não uma grade de cartões. O único acento é o latão, gasto com parcimônia em ação primária, foco e estado ativo — nunca como fundo de página. O texto é o protagonista em todo lugar: a leitura usa Literata, uma serifada desenhada para fôlego longo.

O movimento é o de uma prensa: mecânico e rápido, nunca elástico. Transições só de `transform`/`opacity`, com um momento autoral — o dispositivo do colofão que se *desenha* ao abrir cada tela e *carimba* ao concluir uma obra. Claro e escuro têm paridade total.

**Key Characteristics:**
- Cromo verde-garrafa (`--shell #12362b`) com filete de latão; miolo em papel esverdeado (`--bg #eef0e7`).
- Acento único de latão (`--accent #7d5f18`), usado em ≤10% da tela.
- Três vozes de tipo: **Archivo** (imprensa: marca, títulos, rótulos em versalete), sans do sistema (UI, dados), **Literata** (leitura).
- Gramática de filetes de 1px em vez de sombras; cantos sóbrios (2–8px).
- Assinatura: o **dispositivo do colofão** — SVG que se desenha (abrir) e carimba (concluir).
- Movimento só de `transform`/`opacity`, com `prefers-reduced-motion` honrado (mais discreto, não zero).

## Colors

Paleta de baixa saturação, quente e levemente esverdeada — papel, tinta e latão — com um shell escuro de tinta de prensa que enquadra tudo.

### Primary
- **Latão de ação** (`#7d5f18`): botão primário, foco visível, item ativo, régua de destaque sob o `h1`, barra de meta, cabeçalho de estado. É cor de *marca do impressor*: pequena, precisa, cara. No escuro sobe para `#cdaa63` para manter contraste.
- **Latão aceso** (`#634b12` / escuro `#e0c078`): apenas o `:hover` do primário.
- **Latão pálido** (`#f0e8cf` / escuro `#2a2617`): véu de fundo do cartão "continuar" e realces suaves — nunca texto.
- **Tinta sobre latão** (`#fdfcf7` / escuro `#17130a`): texto sobre superfícies de latão.

### Neutral
- **Tinta de texto** (`#191f19`) sobre **papel** (`#eef0e7`): corpo e títulos.
- **Papel recuado** (`#e7eadd`): faixas de cabeçalho, fundo de badge e inputs desabilitados.
- **Folha** (`#fbfbf6`): superfície de cartões, modais, folha do editor.
- **Folha 2** (`#f4f5ec`): hover de linha e superfícies alternadas.
- **Tinta apagada** (`#5a6558`): texto secundário (AA sobre papel — 5.31:1).
- **Tinta forte** (`#3f4941`): rótulos de badge e metadados que precisam de mais peso.
- **Filete** (`#d6dac6`) e **filete forte** (`#bcc2a9`): bordas, divisores e réguas de 1px — a profundidade principal do sistema.

### Secondary
- **Tinta de prensa** (`#12362b` / escuro `#0e2b22`): o shell da barra superior e o tema "escuro" do leitor. Texto creme `#ece5d2`, texto apagado `#a7b7aa`, régua `#26503f`, latão do shell `#d9b866`.

### Semânticos
- **Perigo** (`#9c2b21`), **OK** (`#2f6a4c`), **Aviso** (`#8a5a12`), **Marca** (`#ead77f`), cada um com um par `-soft` de fundo. Texto sobre perigo usa `--danger-contrast` (`#fdfcf7` no claro, `#2b1613` no escuro) — nunca branco cru (o perigo do escuro é claro).

### Temas do leitor
O modo leitura tem três temas que só trocam as variáveis de papel do `#view-reader`:
- **Claro**: herda o papel do app.
- **Sépia** (`#f5ecd6`, texto `#3c3020`): leitura longa, tom de papel envelhecido.
- **Escuro de tinta** (`#0a100c`, texto `#ddd9cc`): fundo quase preto-esverdeado, distinto do escuro do app.

### Named Rules
**A Regra do Latão Escasso.** O latão aparece em ≤10% de qualquer tela. Sua raridade é o que o torna uma marca — nunca é fundo de página, nunca é decoração em série.

**A Regra do Filete.** Profundidade se faz com filetes de 1px, não com sombras. Se um contorno não resolve, o problema é hierarquia, não falta de sombra.

## Typography

**Display Font:** Archivo (com `system-ui`, `Segoe UI`) — a voz de imprensa.
**Body Font:** sans do sistema (UI e dados).
**Read Font:** Literata (com Iowan Old Style, Palatino, Georgia) — o texto do autor.

**Character:** Archivo, usada em caixa alta com espacejamento nos rótulos, dá ao app a voz de um cabeçalho de jornal — autoritária e gráfica. A sans do sistema mantém os controles neutros e legíveis. Literata é a única serifada do sistema e só aparece onde há leitura longa (editor e leitor), sinalizando "aqui é o livro".

### Hierarchy
- **Display** (700, `2.5rem`, 1.05, −0.02em): a manchete da tela do livro (título da obra).
- **Title** (700, `1.85rem`, 1.12): título de tela (`h1` da prateleira e de vistas).
- **Headline** (700, `1.35rem`, 1.2): `h2` de seção e nome do capítulo aberto.
- **Title/Label Archivo** (650–700, `.775–.85rem`, versalete, espacejamento .08em): cabeçalhos de coluna do índice, badges de estado, botões.
- **Body** (400, `.9375rem`, 1.5): corpo de UI, formulários, descrições (linha contida, ≤72ch).
- **Read** (400, `17.5px`, 1.78): parágrafos do editor e do leitor; medida ~66ch.

### Named Rules
**A Regra da Serifada Única.** Literata só existe onde há leitura de livro. Nenhuma UI, botão ou rótulo a usa — se aparecer, é texto do autor.

**A Regra da Versalete.** Todo rótulo em Archivo é caixa alta com `letter-spacing: .08em`. Nunca se usa caixa alta em Archivo sem espacejamento.

## Layout

- **Container**: central, `max-width: 1120px`, padding lateral 32px (24px ≤940px, 16px ≤640px).
- **Prateleira = índice pautado**: em vez de grade de cartões, uma lista vertical (`flex-column`) onde cada obra é uma **linha** com filete de 1px embaixo, em `grid` de três colunas — `76px | 1fr | auto` (capa, título/autor/descrição, metadados). Uma marca de índice de 1px surge na lateral no hover, no lugar de elevar o cartão.
- **Cartão "continuar"**: placa única no topo do índice, com fundo em degradê de latão pálido → folha e borda de 1px tingida de latão.
- **Editor/leitor**: altura `calc(100dvh − topbar − 48px)`; a **folha** (`#chapter-content`) é uma superfície única de `border: 1px` com filete de latão no topo, padding `30px 34px`.
- **Painéis laterais**: revisão 390px, sumário 300px; em ≤940px viram sobreposição fixa que desliza.
- **Barra superior**: 60px de altura, sticky, **opaca** (sem `backdrop-filter`), com filete de latão na base. Em modo foco recolhe para 48px.
- **Ritmo de espaçamento**: micro-escala apertada de 4/6/8/10/12/14px (trabalho tipográfico) e saltos maiores de 20/30px entre blocos.

## Elevation & Depth

O sistema é **chapado por princípio**. Profundidade se comunica por filetes de 1px e por mudança tonal entre papel, folha e tinta de prensa — não por sombras. As três sombras existentes são reservadas ao que *flutua de verdade* sobre o papel, e são escuras e contidas (não difusas).

### Shadow Vocabulary
- **`--shadow-sm`** (`0 1px 1px rgba(26,33,27,.04)`): repouso de pastilhas e chips elevados.
- **`--shadow-md`** (`0 2px 6px rgba(26,33,27,.07)`): separação sutil de controle segmentado e menus.
- **`--shadow-lg`** (`0 14px 34px rgba(18,30,23,.2)`): só o que realmente flutua — modal, toast, painel do sumário no celular e a placa de capa.

### Named Rules
**A Regra do Chão Chapado.** Nenhuma superfície de página tem sombra em repouso. Sombra só existe em resposta a estado (hover, foco) ou porque o elemento flutua sobre o resto (modal, toast).

**A Regra do Filete de Latão.** O cromo nunca usa `backdrop-filter`. A barra é opaca e se separa do miolo por um filete de latão de 1px — vidro fosco é linguagem de outro mundo.

## Shapes

Cantos **sóbrios e de trabalho tipográfico**, em contraste deliberado com a maciez de 12–16px típica de dashboards. Escala de 2/3/4/6/8px (`--r-xs…--r-xl`), com `999px` (pill) reservado **apenas** a badges/chips de estado. Bordas são sempre de 1px; nenhuma borda colorida unilateral com mais de 1px (um filete grosso de um lado só parece um erro de layout, não uma decisão).

A silhueta recorrente do mundo é o **filete**: a régua de 1px que separa, sublinha e indexa. A peça de forma mais marcante é o **dispositivo do colofão** — um selo circular com losango e dois *ticks*, desenhado em SVG (`.brand .device`).

## Components

### Buttons
- **Shape:** filete de 1px + canto de 4px (`--r-md`); altura 36px, padding `7px 13px`; rótulo em Archivo (`--fs-sm`, versalete não, `600`), gap 7px para o ícone.
- **Primary:** fundo latão sólido, texto tinta-sobre-latão, borda da mesma cor. **Hover:** latão aceso. **Active:** `scale(.97)` em `--dur-1`.
- **Secondary (padrão):** fundo folha, borda filete, texto tinta. **Ghost:** sem fundo/borda, texto apagado. **Danger:** texto `--danger`, hover com `--danger-soft`; nunca vermelho sólido.
- **Em ponteiro grosso:** todo `.btn` e `.icon-btn` vai a ≥44px (alvo de toque).

### Chips / Badges
- **Style:** pill (`--r-full`), fundo papel recuado, borda de 1px, texto em Archivo caixa alta `.7rem` espacejado .08em. Cores de estado: rascunho neutro, revisão latão, concluído `--ok`.
- **Estado:** `revisao` e `concluido` tingem texto/borda; o badge é um alvo clicável no capítulo.

### Cards / Containers
- **Corner Style:** 4px (`--r-md`); pastilhas elevadas 6px.
- **Background:** folha (`--surface`) sobre papel (`--bg`).
- **Shadow Strategy:** ver *Elevation & Depth* — chapado, exceto o que flutua.
- **Border:** filete de 1px. A **linha do índice** (obra) usa só `border-bottom: 1px`.
- **Internal Padding:** `15px 12px 15px 10px` (linha do índice), `18px 20px` (cartão), `30px 34px` (folha do editor).
- **Hover (linha do índice):** fundo folha 2 + marca de índice de 1px na lateral — **sem** `translateY`.

### Inputs / Fields
- **Style:** folha, borda filete de 1px, canto 4px, padding `8px 12px`; rótulo associado.
- **Focus:** borda latão + anel `0 0 0 3px` latão 22% (`:focus-visible`).
- **Error:** borda e texto `--danger`; nunca só cor (acompanha mensagem).

### Navigation
- **Topbar:** shell verde-garrafa opaco, 60px, sticky, filete de latão na base. Marca = dispositivo do colofão + "Autor" em Archivo versalete creme; ações em `.icon-btn` creme sobre verde (`--shell-muted` → creme no hover).
- **Mobile/coarse:** alvos de toque ≥44px; ícones preservados.

### Dispositivo do colofão (assinatura)
- **O que é:** um selo SVG autoral (4 `<path>`: círculo, losango, dois *ticks*) em `.brand .device`, com `pathLength="1"`.
- **Comportamento:** `device-draw` (traço que se desenha, ~640ms, `--stagger` entre paths) dispara ao ativar cada tela (`App.colophon('draw')`); `device-stamp` (carimbo com leve escala) dispara ao concluir uma obra (`App.colophon('stamp')`).
- **Regra:** é o **único** momento decorativo permitido; anima só `stroke-dashoffset`/`transform`/`opacity` e desliga sob `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** comunicar profundidade com filetes de 1px e mudança tonal antes de recorrer a sombras.
- **Do** manter o latão em ≤10% da tela (A Regra do Latão Escasso).
- **Do** manter contraste AA (≥4.5:1) nos dois temas e honrar `prefers-reduced-motion` (mais discreto, não zero).
- **Do** usar Archivo só em versalete espacejado; Literata só em texto do autor (As Regras da Versalete e da Serifada Única).
- **Do** garantir alvos ≥44px em `pointer: coarse`.
- **Do** usar `esc()` para conteúdo do usuário em HTML.

### Don't:
- **Don't** usar `backdrop-filter`/vidro fosco — o cromo é opaco, separado por filete de latão.
- **Don't** animar propriedades de layout (`width`/`height`/`top`/`left`/`margin`); só `transform`/`opacity`.
- **Don't** usar bounce/elastic: o movimento é mecânico de prensa.
- **Don't** pôr borda colorida unilateral com mais de 1px, nem "cartão fantasma" decorativo.
- **Don't** usar o acento de latão como fundo de página.
- **Don't** introduzir dependências de runtime (o app precisa rodar em `file://`).
