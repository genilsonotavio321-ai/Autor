# ADR-0003 — Image module and a reusable cover picker

- Status: Accepted
- Date: 2026-10-15
- Context: Architecture review of `projeto01` (candidate #4).

## Context

Cover handling was duplicated and tangled with UI:

- `App.pickImage` in `js/app.js` opened a file input, read it, decoded
  it, drew it on a canvas, resized it and produced a data URL — all
  inline, with resize rules and error toasts mixed together.
- The book form and the chapter-cover modal each re-implemented the same
  preview + "choose"/"remove" markup, wiring and `sync()` logic.
- The resize limits (400x600 / 600x400, quality 0.9) lived as loose
  constants inside `pickImage`, with no seam to change or test them.

## Decision

Split the concern into a deep module plus a reusable widget:

- New `js/core/image.js` (`Autor.image`, global `Img`) with a small
  interface:
  - `fit(w, h, opts)` -> pure sizing math (proportion preserved, no
    upscaling, orientation-based box). Testable without a browser.
  - `resize(image, opts)` -> data URL JPEG via canvas.
  - `fromFile(file, opts)` -> Promise<data URL|null>.
  - `pick(opts)` -> Promise<data URL|null>; opens the file dialog.
  - `DEFAULT` -> `{ portrait: 400x600, landscape: 600x400, quality: 0.9 }`.
  - Errors are reported via `opts.onError`, falling back to `Ui.toast`.
- `App.pickImage` becomes a thin alias (`Img.pick`), preserving existing
  callers.
- New `Ui.cover(opts)` widget returns `{ element, get(), set(value) }` and
  owns the preview markup, the choose/remove buttons and the hint. Both
  the book form (`app.js`) and the chapter modal (`editor.js`) now use it,
  removing the duplicated markup and `sync()` copies.

## Consequences

- Changing the resize policy (e.g. new target sizes or WebP) is a local
  edit in one module.
- `fit` is covered by `tests/image.test.mjs`; the canvas/file paths stay
  manual browser checks (as with the rest of the UI).
- The cover markup now has a single source of truth; the previous per-view
  element ids (`bf-cover-*`, `cc-*`) are gone (only class-based CSS is
  used, so styling is unaffected).

## Related

- ADR-0002 (persistence seam), ADR-0001 (content model).
- Planned: view modules (candidate #5).
