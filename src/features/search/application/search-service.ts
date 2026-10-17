import { Document } from "flexsearch";

import { foldForSearch } from "@/shared/lib/text";
import type { EntityId } from "@/shared/types/database";

import type { SearchDoc } from "../domain/search-doc";

export interface SearchIndex {
  index: Document;
  docs: Map<EntityId, SearchDoc>;
}

export interface SearchResult {
  doc: SearchDoc;
  /** true when the query matched the title field. */
  matchedTitle: boolean;
}

const RESULT_LIMIT = 50;

/**
 * Builds an in-memory FlexSearch index over the given documents.
 * Both query and indexed text are accent/case folded ("dragao" ~ "Dragão").
 */
export function createSearchIndex(docs: SearchDoc[]): SearchIndex {
  const index = new Document({
    document: {
      id: "id",
      index: ["title", "content"],
    },
  });

  const map = new Map<EntityId, SearchDoc>();
  for (const doc of docs) {
    map.set(doc.id, doc);
    index.add({
      id: doc.id,
      title: foldForSearch(doc.title),
      content: foldForSearch(doc.searchText),
    });
  }
  return { index, docs: map };
}

function idsFromField(
  results: unknown,
  field: string,
): string[] {
  if (!Array.isArray(results)) return [];
  const entry = results.find(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      (item as { field?: unknown }).field === field,
  ) as { result?: unknown } | undefined;
  if (!entry) return [];
  const raw = entry.result;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id));
}

/**
 * Queries the index. Title matches are ranked before content-only matches.
 * Returns plain `SearchDoc`s, capped at `limit`.
 */
export function searchDocs(
  wrapped: SearchIndex | null,
  query: string,
  limit = RESULT_LIMIT,
): SearchResult[] {
  const trimmed = query.trim();
  if (!wrapped || !trimmed) return [];

  const results = wrapped.index.search(foldForSearch(trimmed));
  const seen = new Set<EntityId>();
  const out: SearchResult[] = [];

  for (const [field, matchedTitle] of [
    ["title", true],
    ["content", false],
  ] as const) {
    for (const id of idsFromField(results, field)) {
      if (seen.has(id)) continue;
      const doc = wrapped.docs.get(id as EntityId);
      if (!doc) continue;
      seen.add(id);
      out.push({ doc, matchedTitle });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
