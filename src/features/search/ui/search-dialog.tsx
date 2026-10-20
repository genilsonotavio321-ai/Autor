"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { playUiSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";

import { createSearchIndex, searchDocs } from "../application/search-service";
import { useSearchDocs } from "../application/use-search-docs";
import { SEARCH_TYPE_LABELS, type SearchDoc } from "../domain/search-doc";

/**
 * Popup de busca (item 2): abre em qualquer seção, setas cima/baixo navegam
 * e Enter seleciona (cmdk ativa o primeiro item automaticamente).
 */
export function SearchDialog() {
  const router = useRouter();
  const open = useUiStore((state) => state.searchOpen);
  const closeSearch = useUiStore((state) => state.closeSearch);
  const [query, setQuery] = useState("");
  const docs = useSearchDocs();
  const index = useMemo(() => createSearchIndex(docs), [docs]);
  const results = query.trim() ? searchDocs(index, query) : [];

  // Abre/fecha por estado externo (botão, Ctrl+K, select) — Radix não emite
  // onOpenChange nessas transições, então observamos o próprio `open`.
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    playUiSound(open ? "open" : "close");
  }, [open]);

  const select = (doc: SearchDoc) => {
    if (doc.projectId) {
      useUiStore.getState().setSelectedProjectId(doc.projectId);
    }
    closeSearch();
    setQuery("");
    router.push(doc.href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeSearch();
          setQuery("");
        }
      }}
      title="Buscar"
      description="Busque no acervo e nas seções do app"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Personagens, capítulos, configurações..."
        />
        <CommandList>
          <CommandEmpty>
            {query.trim()
              ? "Nenhum resultado encontrado."
              : "Digite ao menos uma palavra para buscar."}
          </CommandEmpty>
          <CommandGroup heading="Resultados">
            {results.map(({ doc, matchedTitle }) => (
              <CommandItem
                key={doc.id}
                value={doc.id}
                onSelect={() => select(doc)}
              >
                <span className="text-xs text-muted-foreground">
                  {SEARCH_TYPE_LABELS[doc.type]}
                </span>
                <span className="truncate font-medium">{doc.title}</span>
                {matchedTitle && (
                  <span className="text-xs text-muted-foreground">
                    (no título)
                  </span>
                )}
                {doc.projectTitle && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {doc.projectTitle}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
