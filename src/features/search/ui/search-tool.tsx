"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SearchX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/shared/store/ui-store";

import { createSearchIndex, searchDocs } from "../application/search-service";
import { useSearchDocs } from "../application/use-search-docs";
import { SEARCH_TYPE_LABELS } from "../domain/search-doc";

interface SearchToolProps {
  autoFocus?: boolean;
  /** Chamado após clicar num resultado (ex.: fechar o popup). */
  onSelect?: () => void;
}

/** Ferramenta de busca embutível (página inicial). */
export function SearchTool({ autoFocus, onSelect }: SearchToolProps) {
  const [query, setQuery] = useState("");
  const docs = useSearchDocs();
  const index = useMemo(() => createSearchIndex(docs), [docs]);
  const results = searchDocs(index, query);
  const trimmed = query.trim();

  const handleSelect = (projectId: string) => {
    if (projectId) {
      useUiStore.getState().setSelectedProjectId(projectId);
    }
    onSelect?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Personagens, capítulos, locais, notas..."
          aria-label="Buscar no acervo"
          className="pl-9"
          autoFocus={autoFocus}
        />
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {trimmed.length === 0
          ? "Digite ao menos uma palavra para buscar."
          : `${results.length} resultado(s) para “${trimmed}”.`}
      </p>

      {trimmed.length > 0 && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhum resultado encontrado.</p>
          <p className="text-sm text-muted-foreground">
            Tente outras palavras — a busca ignora acentos e maiúsculas.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {results.map(({ doc, matchedTitle }) => (
          <li key={doc.id}>
            <Link
              href={doc.href}
              onClick={() => handleSelect(doc.projectId)}
              className="flex flex-col gap-1 rounded-lg border bg-card p-3 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {SEARCH_TYPE_LABELS[doc.type]}
                </Badge>
                <span className="font-medium">{doc.title}</span>
                {matchedTitle && (
                  <span className="text-xs text-muted-foreground">
                    (no título)
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {doc.projectTitle}
                </span>
              </div>
              {doc.excerpt && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {doc.excerpt}
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
