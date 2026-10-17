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

## Notas

- Banco IndexedDB `autor` com schema versionado (Dexie) e migrações de dados com backup pré-migracao (`src/infra/db/migrations.ts`).
- Multi-aba via `broadcast-channel` (`src/infra/db/multi-tab.ts`).
- `next@15` mantido por compatibilidade com o plano; `npm audit` reporta vulnerabilidade em `postcss` resolvida apenas em `next@16` (migração futura).
