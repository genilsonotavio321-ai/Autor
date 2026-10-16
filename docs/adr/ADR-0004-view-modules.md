# ADR-0004 — View modules and a composition root

- Status: Accepted
- Date: 2026-10-15
- Context: Architecture review of `projeto01` (candidate #5).

## Context

After Phases 0-4, `js/app.js` was still a ~680-line module mixing four
unrelated concerns:

1. Composition root: `App` namespace, shared UI aliases, `navigate`, theme,
   `bindEvents`, `setupPWA`, boot.
2. The shelf view (list, filter, stats, book cards).
3. The book view (book screen, chapter list and its actions, book form,
   chapter-status modal).
4. The global search, trash and settings modals.

Because everything lived in one IIFE, changing a screen meant reading the
whole file, and cross-screen coupling was invisible.

## Decision

Split the screens into `js/views/` modules, leaving `js/app.js` as the
composition root:

- `js/views/shelf.js` → `App.renderShelf` (+ card/stats helpers).
- `js/views/book.js` → `App.openBook`, `renderChapters`, `addChapter`,
  `openChapter`, `bookFormModal`, `chapterStatusModal`.
- `js/views/search.js` → `App.searchModal`.
- `js/views/trash.js` → `App.trashModal`.
- `js/views/settings.js` → `App.settingsModal`.
- `js/app.js` keeps only: the `App` object, `STATUS`, `readTime`, the
  `Dom`/`Ui`/`Img` aliases, `navigate`, `applyTheme`, `bindEvents`,
  `setupPWA` and boot (`DOMContentLoaded`).

Each view module is a classic-script IIFE that registers its API on `App`
(thin delegators, so `editor`/`review`/`export`/`reader` are unchanged) and
on `window.Autor.views.<name>`. Views load after `app.js`; nothing depends
on them at load time (the boot handler runs on `DOMContentLoaded`, after
all scripts are present).

## Consequences

- Adding a screen is a new file plus a `bindEvents` hook, not a surgery in
  `app.js`.
- The composition root stays small and readable; routing, theme and event
  wiring have a single home.
- Fixed a latent bug found while verifying the split: the trash modal
  re-rendered by opening a *new* modal without closing the previous one,
  stacking overlays. It now closes before re-rendering, and reopens only
  after a real change (restore / permanent delete / empty).

## Related

- ADR-0001 (content model), ADR-0002 (persistence seam),
  ADR-0003 (image module).
