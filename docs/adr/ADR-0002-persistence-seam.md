# ADR-0002 — Persistence seam: adapters + repositories

- Status: Accepted
- Date: 2026-10-15
- Context: Architecture review of `projeto01` (candidate #3).

## Context

`js/storage.js` mixed three responsibilities in one module:

1. Low-level IndexedDB access (`openDB`, `idbReq`, object stores).
2. A localStorage fallback with its own copy of every operation, plus a
   `settings`-as-map special case leaking into `getAll/get/put/del`.
3. Domain repositories (`Books`, `Chapters`, `Trash`, `Settings`).

Swapping or adding a backend (the anticipated sync/cloud feature) meant
editing the single file end to end, and the repositories could not be
tested without a browser.

Two concrete backends already existed (IndexedDB and localStorage), so
the seam is real, not hypothetical.

## Decision

Introduce a small storage-adapter interface behind which any backend
can live (all async):

```
{ mode, open(), getAll(store), get(store, key), put(store, value),
  del(store, key), clear(store), byIndex(store, index, value) }
```

- New `js/core/persistence.js` (`Autor.persistence`) owns the two
  adapters: `idb()` (IndexedDB, lazy open) and `ls()` (localStorage
  fallback). The `settings`-as-map rule now lives inside the `ls`
  adapter.
- `js/storage.js` keeps only the repositories, which depend solely on
  the adapter interface. `Store.init()` selects the adapter (try
  IndexedDB + write probe, else localStorage). `Store.raw` remains a
  proxy to the active adapter for import/export.
- Repository invariant added: `Chapters.save` refuses to write a chapter
  whose book no longer exists. This closes a real bug where a late
  autosave "resurrected" a chapter after its book had been deleted.

## Consequences

- A third adapter (remote/sync) plugs into `Autor.persistence` without
  touching repositories — the extension point for cloud backup.
- Repositories become testable in Node with a fake `localStorage`
  (`tests/storage.test.mjs`), no browser required.
- The localStorage `settings` bug (an empty settings list serialised as
  `[]`, dropping keys) is fixed by defaulting to `{}` in the `ls`
  adapter.

## Related

- ADR-0001 (Content model) and the `Autor.ui`/`Autor.dom` extraction.
- Planned: `Autor.image` (candidate #4) and view modules (candidate #5).
