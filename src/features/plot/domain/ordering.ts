import type { Chapter, EntityId, Scene } from "@/shared/types/database";

import type { SceneMoveUpdate } from "./repository";

/** Immutable array move (dnd-kit style): item at `from` lands at `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

/** Renumber items to 1..n, preserving their relative order. */
export function renumber<T extends { id: EntityId }>(
  items: T[],
): { id: EntityId; order: number }[] {
  return items.map((item, index) => ({ id: item.id, order: index + 1 }));
}

/**
 * New orders for every chapter after dragging `activeId` onto `overId`.
 * Returns an empty list when either id is unknown.
 */
export function computeChapterOrder(
  chapters: Chapter[],
  activeId: EntityId,
  overId: EntityId,
): { id: EntityId; order: number }[] {
  const from = chapters.findIndex((chapter) => chapter.id === activeId);
  const to = chapters.findIndex((chapter) => chapter.id === overId);
  if (from === -1 || to === -1 || from === to) return [];
  return renumber(moveItem(chapters, from, to));
}

/**
 * Full move/reorder plan for scenes across chapters.
 *
 * - `scenesByChapter` holds the currently visible (non-deleted) scenes.
 * - Dropping on a chapter appends to the end of that chapter.
 * - Dropping on a scene inserts before/after it (dnd-kit passes the
 *   collision index via `toIndex`, computed by the UI layer).
 * - Chapters affected by the move get their scene orders renumbered 1..n.
 */
export function computeSceneMove(
  scenesByChapter: Map<EntityId, Scene[]>,
  sceneId: EntityId,
  toChapterId: EntityId,
  toIndex: number,
): SceneMoveUpdate[] {
  let moved: Scene | undefined;
  for (const scenes of scenesByChapter.values()) {
    for (const scene of scenes) {
      if (scene.id === sceneId) moved = scene;
    }
  }

  const touched = new Set<EntityId>([toChapterId]);
  if (moved && moved.chapterId !== toChapterId) touched.add(moved.chapterId);
  if (!moved) return [];

  const updates: SceneMoveUpdate[] = [];

  for (const chapterId of touched) {
    const current =
      chapterId === moved.chapterId
        ? (scenesByChapter.get(chapterId) ?? []).filter((s) => s.id !== sceneId)
        : [...(scenesByChapter.get(chapterId) ?? [])];

    if (chapterId === toChapterId) {
      const index = Math.max(0, Math.min(toIndex, current.length));
      current.splice(index, 0, { ...moved, chapterId });
    }

    for (const [position, scene] of current.entries()) {
      updates.push({ id: scene.id, chapterId, order: position + 1 });
    }
  }

  return updates;
}
