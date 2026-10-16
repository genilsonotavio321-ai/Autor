# ADR-0001 — Content model owns the formatting notation

- Status: Accepted
- Date: 2026-10-15
- Context: Architecture review of `projeto01` (candidates #1 and #2).

## Context

Chapter content is persisted as a plain string where paragraphs are
separated by a blank line and paragraph-level alignment is encoded with a
marker at the start of a paragraph (`⟦e⟧`/`⟦c⟧`/`⟦d⟧`/`⟦j⟧`).

Before this decision, the marker syntax leaked across modules:

- `app.js` held `ALIGN_LABEL`/`ALIGN_CSS`/`ALIGN_KEYS` plus a duplicated
  `stripAlignMarkers`/`paraAlign`/`stripParaMarker` fallback.
- `editor.js` redefined the marker regex (`PARA_MARK`) and a marker length.
- `reader.js` and `export.js` each carried an `if (window.Content) … else`
  path with a second copy of the parsing rules.

Any change to the notation (add a marker, change spacing, richer blocks)
would require editing four files consistently.

## Decision

1. Introduce a single deep module, **`Autor.content`** (`js/core/content.js`),
   as the only owner of the content representation and marker syntax.
2. Its interface is small and hides the notation:
   `parse`, `serialize`, `toDisplay`, `toExport`, `strip`,
   `stripParaMarker`, `paraAlign`, `countWords`, plus alignment metadata
   (`ALIGN`, `ALIGN_KEYS`, `DEFAULT_ALIGN`, `css`, `label`).
3. Consumers depend on `Content.*` only; all `window.Content` guards and
   duplicate regexes were removed.
4. The `Block[]` model (`{ type: 'para'|'rule', align, text }`) is the
   designated extension point for **rich text** (later: inline runs) and
   for **new export formats** (Markdown/EPUB/DOCX) built from blocks.

## Consequences

- Formatting changes now touch one file (`content.js`) — locality.
- Every consumer benefits from one fix — leverage.
- The content model is unit-testable through its interface, without DOM.
- `App.ALIGN_*` and the `App.strip*`/`App.paraAlign`/`App.countWords`
  shims were removed; callers use `Content.*` directly.

## Related

- ADR-0002 (planned): persistence seam with adapters and repositories —
  sets up sync/cloud.
- ADR-0003 (planned): `Autor.ui` extraction (modal/toast/confirm) — done
  alongside this ADR as candidate #2.
