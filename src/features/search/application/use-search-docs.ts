"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { ensureDbReady } from "@/infra/db/ready";
import { useUiStore } from "@/shared/store/ui-store";

import { buildSearchDocs, type SearchDoc, type SearchDocSource } from "../domain/search-doc";
import { SECTION_DOCS } from "../domain/section-docs";

/** Carrega todas as entidades indexáveis (compartilhado por popup e home). */
export function useSearchDocs(): SearchDoc[] {
  const searchGlobalEnabled = useUiStore((state) => state.searchGlobalEnabled);

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

  const docs = useMemo(() => (source ? buildSearchDocs(source) : []), [source]);

  return useMemo(
    () => (searchGlobalEnabled ? [...docs, ...SECTION_DOCS] : docs),
    [docs, searchGlobalEnabled],
  );
}
