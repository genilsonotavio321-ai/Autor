# Autor

App pessoal de escrita e planejamento de livros — local-first, offline, sem conta.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui + Framer Motion
- Zustand + React Query · Dexie (IndexedDB) · Tiptap · FlexSearch
- Vitest + Playwright · Serwist PWA (fases futuras)

## Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run lint       # ESLint
npm run typecheck  # TypeScript (tsc --noEmit)
npm test           # Vitest (unidade/componentes)
npm run test:e2e   # Playwright (E2E)
```

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

## Notas

- Banco IndexedDB `autor` com schema versionado (Dexie) e migrações de dados com backup pré-migracao (`src/infra/db/migrations.ts`).
- Multi-aba via `broadcast-channel` (`src/infra/db/multi-tab.ts`).
- `next@15` mantido por compatibilidade com o plano; `npm audit` reporta vulnerabilidade em `postcss` resolvida apenas em `next@16` (migração futura).
