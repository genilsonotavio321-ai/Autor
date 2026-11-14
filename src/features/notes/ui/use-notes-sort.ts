"use client";

import { useEffect, useState } from "react";

import { NOTES_SORT_LABELS, type NotesSort } from "../domain/sort";

const SORT_STORAGE_KEY = "autor.notes.sort";

/** Critério de ordenação das notas, persistido no localStorage. */
export function useNotesSort() {
  const [sort, setSort] = useState<NotesSort>("updated");
  // Só persiste depois de ler: sem isso o efeito de escrita rodava antes de a
  // leitura aplicar e o critério salvo era sobrescrito pelo default.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(SORT_STORAGE_KEY);
    if (stored && stored in NOTES_SORT_LABELS) setSort(stored as NotesSort);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SORT_STORAGE_KEY, sort);
  }, [sort, hydrated]);

  return { sort, setSort };
}
