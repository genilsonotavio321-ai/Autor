"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, SearchX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { ensureDbReady } from "@/infra/db/ready";

import { createSearchIndex, searchDocs } from "../application/search-service";
import {
  buildSearchDocs,
  SEARCH_TYPE_LABELS,
  type SearchDocSource,
} from "../domain/search-doc";

export function SearchPage() {
  const [query, setQuery] = useState("");

  const source = useLiveQuery(async (): Promise<SearchDocSource> => {
    await ensureDbReady();
    const projects = await projectRepository.listActive();
    const empty: SearchDocSource = {
      projects,
      chapters: [],
      scenes: [],
      characters: [],
      locations: [],
      loreEntries: [],
      notes: [],
    };
    for (const project of projects) {
      const [chapters, scenes, characters, locations, loreEntries, notes] =
        await Promise.all([
          chapterRepository.listByProject(project.id),
          sceneRepository.listByProject(project.id),
          characterRepository.listByProject(project.id),
          locationRepository.listByProject(project.id),
          loreEntryRepository.listByProject(project.id),
          noteRepository.listByProject(project.id),
        ]);
      empty.chapters.push(...chapters);
      empty.scenes.push(...scenes);
      empty.characters.push(...characters);
      empty.locations.push(...locations);
      empty.loreEntries.push(...loreEntries);
      empty.notes.push(...notes);
    }
    return empty;
  }, []);

  const docs = useMemo(
    () => (source ? buildSearchDocs(source) : []),
    [source],
  );
  const index = useMemo(() => createSearchIndex(docs), [docs]);
  const results = searchDocs(index, query);
  const trimmed = query.trim();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Buscar</h1>
        <p className="text-sm text-muted-foreground">
          Procure em capítulos, cenas, personagens, locais, lore e notas de
          todos os projetos.
        </p>
      </header>

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
          autoFocus
        />
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {trimmed.length === 0
          ? "Digite ao menos uma palavra para buscar."
          : `${results.length} resultado(s) para “${trimmed}”.`}
      </p>

      {trimmed.length > 0 && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
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
