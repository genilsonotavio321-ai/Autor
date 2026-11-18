"use client";

import { useLiveQuery } from "dexie-react-hooks";

import type { Bookmark, EntityId } from "@/shared/types/database";

import { bookmarkRepository } from "../infra/dexie-bookmark-repository";

const EMPTY: Bookmark[] = [];

/** Marcadores do capítulo aberto, ordenados pela posição no texto. */
export function useChapterBookmarks(
  chapterId: EntityId | null | undefined,
): Bookmark[] {
  return (
    useLiveQuery(
      () => (chapterId ? bookmarkRepository.listByChapter(chapterId) : []),
      [chapterId],
      EMPTY,
    ) ?? EMPTY
  );
}
