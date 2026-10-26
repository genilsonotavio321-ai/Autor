import { versionRepository } from "@/features/editor/infra/dexie-version-repository";
import { attachmentRepository } from "@/features/attachments/infra/dexie-attachment-repository";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { ideaCardRepository } from "@/features/creativity/infra/dexie-idea-card-repository";
import { folderRepository } from "@/features/folders/infra/dexie-folder-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import { plotBeatRepository } from "@/features/plot/infra/dexie-plot-beat-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { snippetRepository } from "@/features/snippets/infra/dexie-snippet-repository";
import { tagRepository } from "@/features/tags/infra/dexie-tag-repository";
import { timelineEventRepository } from "@/features/plot/infra/dexie-timeline-event-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import type { EntityId } from "@/shared/types/database";

import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";

/** Kinds of rows shown in the trash page, one section each. */
export type TrashItemKind =
  | "project"
  | "note"
  | "character"
  | "location"
  | "lore"
  | "chapter"
  | "scene"
  | "event"
  | "beat"
  | "ideaCard"
  | "folder";

interface HardDeletable {
  hardDelete(id: EntityId): Promise<void>;
}

interface ListDeleted<T> {
  listDeleted(): Promise<T[]>;
}

interface ProjectOwned extends HardDeletable, ListDeleted<{ id: EntityId; projectId: EntityId }> {
  listByProject(projectId: EntityId): Promise<{ id: EntityId; projectId: EntityId }[]>;
}

/**
 * Permanently deletes an entity plus its derived data: version snapshots and
 * image attachments. Both are stored per entityId (UUIDs are global), so no
 * entityType filter is needed to find them.
 */
async function purgeEntity(
  repo: HardDeletable,
  id: EntityId,
): Promise<void> {
  const versions = await versionRepository.listByEntity(id);
  for (const version of versions) {
    await versionRepository.delete(version.id);
  }
  await attachmentRepository.removeByEntityId(id);
  await repo.hardDelete(id);
}

async function purgeRows(
  repo: HardDeletable,
  rows: { id: EntityId }[],
): Promise<void> {
  for (const row of rows) {
    await purgeEntity(repo, row.id);
  }
}

/** Active + trashed rows of a project-owned repository. */
async function projectRows<T extends { id: EntityId; projectId: EntityId }>(
  repo: ProjectOwned,
  projectId: EntityId,
): Promise<T[]> {
  const [active, deleted] = await Promise.all([
    repo.listByProject(projectId),
    repo.listDeleted(),
  ]);
  return [
    ...(active as T[]),
    ...(deleted.filter((row) => row.projectId === projectId) as T[]),
  ];
}

/** Permanently deletes a chapter and every scene that points at it. */
async function purgeChapter(chapterId: EntityId): Promise<void> {
  const [active, deleted] = await Promise.all([
    sceneRepository.listByChapter(chapterId),
    sceneRepository.listDeleted(),
  ]);
  const scenes = [
    ...active,
    ...deleted.filter((scene) => scene.chapterId === chapterId),
  ];
  await purgeRows(sceneRepository, scenes);
  await purgeEntity(chapterRepository, chapterId);
}

/**
 * Permanently deletes a project and its whole content tree: chapters (with
 * scenes), characters, locations, lore, beats, timeline events and notes —
 * both active and already in the trash.
 */
async function purgeProject(projectId: EntityId): Promise<void> {
  const chapters = await projectRows(chapterRepository, projectId);
  for (const chapter of chapters) {
    await purgeChapter(chapter.id);
  }

  const ownedRepos: ProjectOwned[] = [
    characterRepository,
    locationRepository,
    loreEntryRepository,
    plotBeatRepository,
    timelineEventRepository,
    noteRepository,
    ideaCardRepository,
    folderRepository,
  ];
  for (const repo of ownedRepos) {
    const rows = await projectRows(repo, projectId);
    await purgeRows(repo, rows);
  }

  // Tags e snippets são escopados pelo projeto e não entram em `ownedRepos`
  // (tags não têm `deletedAt`; snippets ainda não têm UI) — apaga por projectId.
  await Promise.all([
    tagRepository.deleteByProject(projectId),
    snippetRepository.deleteByProject(projectId),
  ]);

  // Rede de segurança: anexos órfãos (entidade já apagada) também caem aqui.
  await attachmentRepository.removeByProject(projectId);

  await purgeEntity(projectRepository, projectId);
}

async function purgeDeleted(repo: HardDeletable & ListDeleted<{ id: EntityId }>): Promise<void> {
  const rows = await repo.listDeleted();
  await purgeRows(repo, rows);
}

/** Permanently deletes one row of the trash (kind comes from its section). */
export async function purgeTrashItem(
  kind: TrashItemKind,
  id: EntityId,
): Promise<void> {
  switch (kind) {
    case "project":
      await purgeProject(id);
      return;
    case "chapter":
      await purgeChapter(id);
      return;
    case "note":
      await purgeEntity(noteRepository, id);
      return;
    case "character":
      await purgeEntity(characterRepository, id);
      return;
    case "location":
      await purgeEntity(locationRepository, id);
      return;
    case "lore":
      await purgeEntity(loreEntryRepository, id);
      return;
    case "scene":
      await purgeEntity(sceneRepository, id);
      return;
    case "event":
      await purgeEntity(timelineEventRepository, id);
      return;
    case "beat":
      await purgeEntity(plotBeatRepository, id);
      return;
    case "ideaCard":
      await purgeEntity(ideaCardRepository, id);
      return;
    case "folder":
      await purgeEntity(folderRepository, id);
      return;
  }
}

/**
 * Permanently deletes every trashed row across all tables. Projects and
 * chapters are purged first (with their cascades); the remaining tables are
 * emptied of whatever is still in their own trash.
 */
export async function emptyTrash(): Promise<void> {
  for (const project of await projectRepository.listDeleted()) {
    await purgeProject(project.id);
  }
  for (const chapter of await chapterRepository.listDeleted()) {
    await purgeChapter(chapter.id);
  }

  await purgeDeleted(noteRepository);
  await purgeDeleted(characterRepository);
  await purgeDeleted(locationRepository);
  await purgeDeleted(loreEntryRepository);
  await purgeDeleted(sceneRepository);
  await purgeDeleted(timelineEventRepository);
  await purgeDeleted(plotBeatRepository);
  await purgeDeleted(ideaCardRepository);
  await purgeDeleted(folderRepository);
}
