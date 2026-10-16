# GLOSSARY

Vocabulary used in codebase architecture decisions (following `codebase-design` skill):

## Module layout (after ADR-0001)
- `Autor` — single global namespace for all modules (`window.Autor`).
  Legacy globals (`Content`, `Store`, `App`, `Editor`, `Review`, `Exporter`,
  `Reader`, `Dom`, `Ui`) remain as aliases so classic-script callers keep working.
- `Autor.dom` (`js/core/dom.js`) — pure DOM helpers: `el`, `esc`, `icon`, `$`, `qsa`.
- `Autor.content` (`js/core/content.js`) — the Content model (deep module).
- `Autor.ui` (`js/core/ui.js`) — UI primitives: `toast`, `openModal`, `confirm`.
- `Autor.store` (`js/storage.js`) — persistence (IndexedDB + localStorage fallback).
- `Autor.app` (`js/app.js`) — boot, router (`navigate`), composition root.
- `Autor.ai` (`js/core/ai.js`) — single AI client (OpenAI-compatible).
- `Autor.zip` (`js/core/zip.js`) — dependency-free ZIP reader/writer (EPUB, .docx/.epub).
- `Autor.merge` (`js/core/merge.js`) — pure merge/tombstone/secret logic (backup + sync).
- `Autor.views.*` (`js/views/*.js`) — screens (shelf/book/search/trash/settings/help/assistant).
- `Autor.editor` / `Autor.review` / `Autor.importer` / `Autor.exporter` / `Autor.sync` /
  `Autor.reader` — feature modules.

## Terms
- **module**: A cohesive unit of implementation (file or folder) with a clear responsibility.
- **interface**: The public surface of a module (functions/methods exposed). The interface is the test surface.
- **depth**: A module is deep if its interface is much smaller than its implementation; it hides many decisions.
- **seam**: A point where behavior can be substituted (in-process) without changing callers. One hypothetical adapter ≠ real seam; two+ plausible adapters suggest a real seam.
- **adapter**: A concrete implementation behind an interface that plugs into a seam.
- **leverage**: Value created by putting logic in one place so many callers benefit from a single fix/change.
- **locality**: Ease of changing behavior by editing code in one place with minimal ripple.
- **deletion test**: If removing/isolating a module reveals few or trivial callers, it's probably deep/cohesive.

## Project-specific terms
- **Content model** (`Autor.content`): The module that owns paragraph/block representation and formatting markers (⟦e⟧/⟦c⟧/⟦d⟧/⟦j⟧). It hides marker syntax from consumers (`editor.js`, `reader.js`, `export.js`, `app.js`). Interface: `parse`, `serialize`, `toDisplay`, `toExport`, `strip`, `stripParaMarker`, `paraAlign`, `countWords`, `ALIGN`.
- **paragraph/block model**: The editor's internal representation (one DOM block per paragraph) separate from the persisted string format. `Content.Block = { type: 'para'|'rule', align, text }` is the extension point for rich text and new export formats.
- **ui module** (`Autor.ui`): Deep module owning toast/modal/confirm, focus trapping and ARIA, so `app.js` and feature modules never touch `#modal-root` directly.
- **persistence seam**: Planned seam around storage (IndexedDB + localStorage fallback) with adapters and a minimal storage interface.
- **view module**: A module that owns a screen/view (shelf/book/editor-coordinator) to shrink `app.js`.
- **snapshot**: The JSON document `{ app, version, exportedAt, books, chapters, trash, settings }` produced by `Exporter.snapshot()` (secrets stripped). The shared format of backup and sync.
- **tombstone**: A `trash` entry used as a deletion marker during merge; prevents a deleted item from being resurrected by a remote copy.
- **sync engine** (`Autor.sync`): A separate reconciler over the snapshot with pluggable providers (WebDAV, GitHub Gist). It does not touch the persistence adapters.
- **personal dictionary**: `Settings.personalDict`, a list of terms that suppress offline rule false positives and are appended to the AI review prompt.

## Decisions
- ADR-0001: Candidate #1 (Content model) prioritized: centralize parsing/serialization/stripping of alignment markers. Consumers depend on `Content.*`, not raw regexes over the string format. Legacy fallbacks removed.
- ADR-0001 (candidate #2): UI primitives (modal/toast/confirm) extracted to `Autor.ui`; DOM helpers to `Autor.dom`.
- Formatting markers are part of persisted `chapter.content` format. The seam prevents spreading marker logic across modules.
