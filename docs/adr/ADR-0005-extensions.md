# ADR-0005 — Extensions: AI client, import, EPUB/Markdown, sync

- Status: Accepted
- Date: 2026-10-15
- Context: Usability and integrations phase on top of Phases 0-5
  (`projeto01`).

## Context

The app had a solid core (content model, persistence seam, image module,
view modules) but four gaps that all consumers would otherwise re-implement:

1. Every AI feature (only AI review existed) built its own `fetch` against
   the OpenAI-compatible endpoint, with its own config and error handling.
2. There was no way to bring an existing manuscript (`.txt`, `.md`,
   `.docx`, `.epub`, `.html`) into the app, nor to export EPUB/Markdown.
3. Backup existed, but there was no way to reconcile two copies of the
   library (multi-device) — i.e. no sync.
4. Reading/editing conveniences (chapter TOC, in-text search, TTS, focus
   mode, word goal, writing assistant) were missing.

Constraints from `AGENTS.md` remained in force: classic scripts (no
modules/build), must work over `file://`, offline-first, no runtime
dependencies, `esc()` for user content, pt-BR UI, and the service worker
`ASSETS`/`CACHE` discipline. New state should live in `Settings` to avoid a
`DB_VERSION` migration.

## Decision

Add four new modules and two views, each with a small, deep interface:

- **`js/core/ai.js` (`Autor.ai`)** — the single AI client. Hides endpoint,
  key, model (from `Settings`) and HTTP-error translation. `review.js` and
  the assistant both depend on it; no other module calls an AI endpoint.
- **`js/core/zip.js` (`Autor.zip`)** — a dependency-free ZIP reader/writer.
  Writes entries with the *store* method; reads *store* and *deflate* via
  `DecompressionStream`. It is realm-agnostic (no `instanceof`) so it can be
  unit-tested in the Node `vm` sandbox. Enables EPUB export and
  `.docx`/`.epub` import.
- **`js/core/merge.js` (`Autor.merge`)** — pure reconciliation logic
  (merge by `id`/`updatedAt`, orphan pruning, trash tombstones, secret
  stripping). Shared by backup import and sync. Touches no DOM and no
  `Store`.
- **`js/import.js` (`Autor.importer`)** — parse `.txt`/`.md`/`.docx`/
  `.epub`/`.html` into the backup document shape and create/append via
  `Store`.
- **`js/views/assistant.js`** and **`js/views/help.js`** — the writing
  assistant modal and the shortcuts modal, following the ADR-0004 view
  pattern.
- **`js/sync.js` (`Autor.sync`)** — a separate reconciliation engine over
  `Exporter.snapshot()` with WebDAV and GitHub Gist providers. Secrets
  (`webdavPass`, `gistToken`) live in `Settings` and are never exported.

`Exporter` was extended with Markdown/EPUB builders and, importantly, with
`snapshot()`, `mergeImport()` and `replaceImport()` — the seam that sync
reuses instead of inventing its own document format. `Reader` gained
TOC/search/TTS; `Editor` gained focus mode, word goal, chapter nav and TOC.

New configuration (URLs, keys, rules map, personal dictionary, TTS rate,
sync bookmarks) is stored as JSON in `Settings`, so **no new object store
and no `DB_VERSION` bump** were needed.

## Consequences

- One place to change AI behavior; the assistant and review cannot drift.
- Import and sync share the same merge/tombstone semantics, and both are
  testable as pure logic (`tests/merge.test.mjs`, `tests/import.test.mjs`,
  `tests/zip.test.mjs`, `tests/export.test.mjs`).
- EPUB export is standards-compliant: `mimetype` first and uncompressed,
  `META-INF/container.xml`, `OEBPS/content.opf`, `nav.xhtml`.
- Secrets are excluded from every export path (`snapshot`,
  `exportBackup`, `replaceImport` via `SECRET_KEYS`).
- Known limitation: sync tombstones assume a single logical history; a
  restore followed by a sync from a stale remote can re-prune an item.
  Tie-breaks are deterministic (newest wins, local on equal `updatedAt`).
- File System Access (local folder) sync was deliberately **not**
  implemented, because persisting the directory handle would require
  bypassing the persistence seam (an IndexedDB store / `DB_VERSION` bump).

## Related

- ADR-0002 (persistence seam), ADR-0003 (image module),
  ADR-0004 (view modules).
