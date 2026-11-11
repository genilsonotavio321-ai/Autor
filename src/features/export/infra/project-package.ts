import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, Project, VersionEntityType } from "@/shared/types/database";

import {
  deserializeBlob,
  isSerializedBlob,
  serializeBlob,
} from "./serialized-blob";

const PROJECT_DATA_TABLES = [
  "projects",
  "chapters",
  "scenes",
  "characters",
  "locations",
  "loreEntries",
  "plotBeats",
  "timelineEvents",
  "storyArcs",
  "structureSections",
  "notes",
  "tags",
  "snippets",
  "attachments",
  "versions",
  "ideaCards",
  "ideaGroups",
  "ideaBoards",
  "folders",
] as const;

type ProjectDataTable = (typeof PROJECT_DATA_TABLES)[number];
type PackageRecord = Record<string, unknown>;
type ProjectPackageTables = Record<ProjectDataTable, PackageRecord[]>;

interface ProjectPackage {
  app: "autor";
  kind: "project";
  formatVersion: 1;
  exportedAt: string;
  tables: ProjectPackageTables;
}

const VERSION_TABLE_BY_TYPE: Record<VersionEntityType, ProjectDataTable> = {
  project: "projects",
  chapter: "chapters",
  scene: "scenes",
  character: "characters",
  location: "locations",
  loreEntry: "loreEntries",
  plotBeat: "plotBeats",
  timelineEvent: "timelineEvents",
  note: "notes",
};

const ATTACHMENT_TABLE_BY_TYPE: Record<string, ProjectDataTable> = {
  note: "notes",
  character: "characters",
  location: "locations",
  lore: "loreEntries",
  event: "timelineEvents",
};

const SNAPSHOT_ID_FIELDS = new Set([
  "projectId",
  "chapterId",
  "sceneId",
  "povCharacterId",
  "locationId",
  "targetId",
  "folderId",
  "parentId",
  "initialOwnerId",
  "linkedChapterId",
  "linkedSceneId",
  "sectionId",
  "arcId",
  "beatId",
  "entityId",
  "itemId",
  "characterId",
  "refId",
  "sentSceneId",
  "groupId",
]);

const SNAPSHOT_ID_LIST_FIELDS = new Set([
  "tags",
  "linkedIds",
  "characterIds",
  "arcIds",
  "links",
]);

function isRecord(value: unknown): value is PackageRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidProjectPackage(): never {
  throw new Error("Arquivo de projeto inválido.");
}

function parseProjectPackage(raw: unknown): ProjectPackage {
  if (
    !isRecord(raw) ||
    raw.app !== "autor" ||
    raw.kind !== "project" ||
    raw.formatVersion !== 1 ||
    typeof raw.exportedAt !== "string" ||
    !isRecord(raw.tables)
  ) {
    return invalidProjectPackage();
  }

  const tables = {} as ProjectPackageTables;
  for (const tableName of PROJECT_DATA_TABLES) {
    // Pacotes anteriores à v8 não têm structureSections: importa vazio.
    const rows =
      raw.tables[tableName] ??
      (tableName === "structureSections" ? [] : undefined);
    if (!Array.isArray(rows) || !rows.every(isRecord)) {
      return invalidProjectPackage();
    }
    tables[tableName] = rows;
  }

  if (tables.projects.length !== 1) return invalidProjectPackage();
  const project = tables.projects[0];
  const sourceProjectId = project?.id;
  if (
    typeof sourceProjectId !== "string" ||
    !sourceProjectId ||
    typeof project.title !== "string" ||
    !project.title.trim() ||
    !["draft", "active", "completed", "archived"].includes(
      project.status as string,
    )
  ) {
    return invalidProjectPackage();
  }

  const ids = new Set<string>();
  for (const tableName of PROJECT_DATA_TABLES) {
    for (const row of tables[tableName]) {
      if (typeof row.id !== "string" || !row.id || ids.has(row.id)) {
        return invalidProjectPackage();
      }
      ids.add(row.id);
      if (
        tableName !== "projects" &&
        tableName !== "scenes" &&
        tableName !== "versions" &&
        row.projectId !== sourceProjectId
      ) {
        return invalidProjectPackage();
      }
    }
  }

  const chapterIds = new Set(tables.chapters.map((chapter) => chapter.id));
  if (
    tables.scenes.some(
      (scene) =>
        typeof scene.chapterId !== "string" || !chapterIds.has(scene.chapterId),
    )
  ) {
    return invalidProjectPackage();
  }

  const idsByTable = new Map<ProjectDataTable, Set<string>>(
    PROJECT_DATA_TABLES.map((tableName) => [
      tableName,
      new Set(tables[tableName].map((row) => row.id as string)),
    ]),
  );
  for (const version of tables.versions) {
    const targetTable =
      typeof version.entityType === "string" &&
      version.entityType in VERSION_TABLE_BY_TYPE
        ? VERSION_TABLE_BY_TYPE[version.entityType as VersionEntityType]
        : undefined;
    if (
      !targetTable ||
      typeof version.entityId !== "string" ||
      !idsByTable.get(targetTable)?.has(version.entityId)
    ) {
      return invalidProjectPackage();
    }
  }
  for (const attachment of tables.attachments) {
    const targetTable =
      typeof attachment.entityType === "string"
        ? ATTACHMENT_TABLE_BY_TYPE[attachment.entityType]
        : undefined;
    if (
      !targetTable ||
      typeof attachment.entityId !== "string" ||
      !idsByTable.get(targetTable)?.has(attachment.entityId)
    ) {
      return invalidProjectPackage();
    }
  }

  if (project.coverBlob !== undefined && !isSerializedBlob(project.coverBlob)) {
    return invalidProjectPackage();
  }
  if (
    tables.characters.some(
      (character) =>
        character.avatarBlob !== undefined &&
        !isSerializedBlob(character.avatarBlob),
    )
  ) {
    return invalidProjectPackage();
  }

  return {
    app: "autor",
    kind: "project",
    formatVersion: 1,
    exportedAt: raw.exportedAt,
    tables,
  };
}

function remapOptionalId(
  row: PackageRecord,
  field: string,
  idMap: Map<string, string>,
): void {
  const value = row[field];
  if (typeof value !== "string") return;
  const remapped = idMap.get(value);
  if (remapped) row[field] = remapped;
  else delete row[field];
}

function remapIdList(
  row: PackageRecord,
  field: string,
  idMap: Map<string, string>,
): void {
  const ids = row[field];
  if (!Array.isArray(ids)) return;
  row[field] = ids.flatMap((id) => {
    const remapped = typeof id === "string" ? idMap.get(id) : undefined;
    return remapped ? [remapped] : [];
  });
}

function remapSnapshot(value: unknown, idMap: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => remapSnapshot(item, idMap));
  }
  if (!isRecord(value)) return value;

  const remapped: PackageRecord = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (SNAPSHOT_ID_LIST_FIELDS.has(field) && Array.isArray(fieldValue)) {
      remapped[field] = fieldValue.flatMap((id) => {
        const mapped = typeof id === "string" ? idMap.get(id) : undefined;
        return mapped ? [mapped] : [];
      });
    } else if (SNAPSHOT_ID_FIELDS.has(field) && typeof fieldValue === "string") {
      const mapped = idMap.get(fieldValue);
      if (mapped) remapped[field] = mapped;
    } else if (
      field === "id" &&
      typeof fieldValue === "string" &&
      idMap.has(fieldValue)
    ) {
      remapped[field] = idMap.get(fieldValue);
    } else {
      remapped[field] = remapSnapshot(fieldValue, idMap);
    }
  }
  return remapped;
}

function remapRelationships(
  row: PackageRecord,
  idMap: Map<string, string>,
): void {
  if (!Array.isArray(row.relationships)) return;
  row.relationships = row.relationships
    .filter(isRecord)
    .map((relationship) => {
      const remapped = { ...relationship };
      remapOptionalId(remapped, "targetId", idMap);
      return remapped;
    })
    .filter((relationship) => typeof relationship.targetId === "string");
}

function remapStateChanges(
  row: PackageRecord,
  idMap: Map<string, string>,
): void {
  if (!Array.isArray(row.stateChanges)) return;
  row.stateChanges = row.stateChanges
    .filter(isRecord)
    .flatMap((change) => {
      const remapped = { ...change };
      if (remapped.kind === "character") {
        remapOptionalId(remapped, "characterId", idMap);
        return typeof remapped.characterId === "string" ? [remapped] : [];
      }
      if (remapped.kind !== "item") return [];
      remapOptionalId(remapped, "itemId", idMap);
      remapOptionalId(remapped, "characterId", idMap);
      if (typeof remapped.itemId !== "string") return [];
      if (
        ["acquire", "transfer", "use"].includes(remapped.action as string) &&
        typeof remapped.characterId !== "string"
      ) {
        return [];
      }
      return [remapped];
    });
}

function remapLastEdit(row: PackageRecord, idMap: Map<string, string>): void {
  if (!isRecord(row.lastEdit)) return;
  const lastEdit = { ...row.lastEdit };
  remapOptionalId(lastEdit, "chapterId", idMap);
  remapOptionalId(lastEdit, "sceneId", idMap);
  if (typeof lastEdit.chapterId !== "string") delete row.lastEdit;
  else row.lastEdit = lastEdit;
}

function packageRecords<T extends object>(rows: T[]): PackageRecord[] {
  return rows.map((row) => ({ ...row }) as PackageRecord);
}

function remapProjectRow(
  tableName: ProjectDataTable,
  source: PackageRecord,
  idMap: Map<string, string>,
  newProjectId: string,
  importedAt: string,
): PackageRecord {
  const row: PackageRecord = { ...source, id: idMap.get(source.id as string)! };
  if (tableName === "projects") {
    row.createdAt = importedAt;
    row.updatedAt = importedAt;
    delete row.deletedAt;
    remapLastEdit(row, idMap);
    return row;
  }

  if (tableName !== "scenes" && tableName !== "versions") {
    row.projectId = newProjectId;
  }

  switch (tableName) {
    case "scenes":
      remapOptionalId(row, "chapterId", idMap);
      remapOptionalId(row, "povCharacterId", idMap);
      remapOptionalId(row, "locationId", idMap);
      remapOptionalId(row, "beatId", idMap);
      break;
    case "characters":
      remapRelationships(row, idMap);
      remapIdList(row, "tags", idMap);
      remapOptionalId(row, "folderId", idMap);
      break;
    case "locations":
      remapOptionalId(row, "parentId", idMap);
      remapIdList(row, "tags", idMap);
      remapOptionalId(row, "folderId", idMap);
      break;
    case "loreEntries":
      remapIdList(row, "tags", idMap);
      remapIdList(row, "linkedIds", idMap);
      remapOptionalId(row, "initialOwnerId", idMap);
      remapOptionalId(row, "folderId", idMap);
      break;
    case "plotBeats":
      remapOptionalId(row, "linkedChapterId", idMap);
      remapOptionalId(row, "sectionId", idMap);
      remapOptionalId(row, "arcId", idMap);
      break;
    case "structureSections":
      remapOptionalId(row, "arcId", idMap);
      break;
    case "timelineEvents":
      remapIdList(row, "characterIds", idMap);
      remapOptionalId(row, "locationId", idMap);
      remapOptionalId(row, "linkedChapterId", idMap);
      remapOptionalId(row, "linkedSceneId", idMap);
      remapIdList(row, "arcIds", idMap);
      remapStateChanges(row, idMap);
      remapIdList(row, "tags", idMap);
      break;
    case "notes":
      remapIdList(row, "tags", idMap);
      remapOptionalId(row, "folderId", idMap);
      break;
    case "attachments":
    case "versions":
      remapOptionalId(row, "entityId", idMap);
      if (tableName === "versions") {
        row.snapshot = remapSnapshot(row.snapshot, idMap);
      }
      break;
    case "ideaCards":
      remapOptionalId(row, "sentSceneId", idMap);
      remapIdList(row, "links", idMap);
      remapOptionalId(row, "groupId", idMap);
      remapOptionalId(row, "refId", idMap);
      break;
    case "ideaBoards":
      if (Array.isArray(row.items)) {
        row.items = row.items.filter(isRecord).map((item) => {
          const remapped = { ...item };
          remapOptionalId(remapped, "refId", idMap);
          return remapped;
        });
      }
      break;
    case "folders":
      remapOptionalId(row, "parentId", idMap);
      break;
    default:
      break;
  }

  return row;
}

function remapProjectPackage(
  projectPackage: ProjectPackage,
  importedAt: string,
): ProjectPackage {
  const idMap = new Map<string, string>();
  for (const tableName of PROJECT_DATA_TABLES) {
    for (const row of projectPackage.tables[tableName]) {
      idMap.set(row.id as string, createId());
    }
  }

  const newProjectId = idMap.get(projectPackage.tables.projects[0]!.id as string)!;
  const tables = {} as ProjectPackageTables;
  for (const tableName of PROJECT_DATA_TABLES) {
    tables[tableName] = projectPackage.tables[tableName].map((row) =>
      remapProjectRow(tableName, row, idMap, newProjectId, importedAt),
    );
  }
  return { ...projectPackage, tables };
}

function decodeProjectBlobs(projectPackage: ProjectPackage): void {
  const project = projectPackage.tables.projects[0]!;
  if (isSerializedBlob(project.coverBlob)) {
    try {
      project.coverBlob = deserializeBlob(project.coverBlob);
    } catch {
      return invalidProjectPackage();
    }
  }
  for (const character of projectPackage.tables.characters) {
    if (isSerializedBlob(character.avatarBlob)) {
      try {
        character.avatarBlob = deserializeBlob(character.avatarBlob);
      } catch {
        return invalidProjectPackage();
      }
    }
  }
}

/** Builds a versioned JSON package containing one project's complete data. */
export async function buildProjectPackageBlob(
  projectId: EntityId,
): Promise<Blob> {
  await ensureDbReady();
  const db = getDatabase();
  const project = await db.projects.get(projectId);
  if (!project || project.deletedAt) {
    throw new Error("Projeto não encontrado.");
  }

  const [
    chapters,
    characters,
    locations,
    loreEntries,
    plotBeats,
    timelineEvents,
    storyArcs,
    structureSections,
    notes,
    tags,
    snippets,
    attachments,
    ideaCards,
    ideaGroups,
    ideaBoards,
    folders,
  ] = await Promise.all([
    db.chapters.where("projectId").equals(projectId).toArray(),
    db.characters.where("projectId").equals(projectId).toArray(),
    db.locations.where("projectId").equals(projectId).toArray(),
    db.loreEntries.where("projectId").equals(projectId).toArray(),
    db.plotBeats.where("projectId").equals(projectId).toArray(),
    db.timelineEvents.where("projectId").equals(projectId).toArray(),
    db.storyArcs.where("projectId").equals(projectId).toArray(),
    db.structureSections.where("projectId").equals(projectId).toArray(),
    db.notes.where("projectId").equals(projectId).toArray(),
    db.tags.where("projectId").equals(projectId).toArray(),
    db.snippets.where("projectId").equals(projectId).toArray(),
    db.attachments.where("projectId").equals(projectId).toArray(),
    db.ideaCards.where("projectId").equals(projectId).toArray(),
    db.ideaGroups.where("projectId").equals(projectId).toArray(),
    db.ideaBoards.where("projectId").equals(projectId).toArray(),
    db.folders.where("projectId").equals(projectId).toArray(),
  ]);

  const chapterIds = chapters.map((chapter) => chapter.id);
  const scenes = chapterIds.length
    ? await db.scenes.where("chapterId").anyOf(chapterIds).toArray()
    : [];

  const versionTargets: Record<string, Set<string>> = {
    project: new Set([project.id]),
    chapter: new Set(chapters.map((chapter) => chapter.id)),
    scene: new Set(scenes.map((scene) => scene.id)),
    character: new Set(characters.map((character) => character.id)),
    location: new Set(locations.map((location) => location.id)),
    loreEntry: new Set(loreEntries.map((entry) => entry.id)),
    plotBeat: new Set(plotBeats.map((beat) => beat.id)),
    timelineEvent: new Set(timelineEvents.map((event) => event.id)),
    note: new Set(notes.map((note) => note.id)),
  };
  const versions = await db.versions
    .filter((version) => versionTargets[version.entityType]?.has(version.entityId) ?? false)
    .toArray();
  const attachmentTargets: Record<string, Set<string>> = {
    note: new Set(notes.map((note) => note.id)),
    character: new Set(characters.map((character) => character.id)),
    location: new Set(locations.map((location) => location.id)),
    lore: new Set(loreEntries.map((entry) => entry.id)),
    event: new Set(timelineEvents.map((event) => event.id)),
  };
  const projectAttachments = attachments.filter(
    (attachment) =>
      attachmentTargets[attachment.entityType]?.has(attachment.entityId) ?? false,
  );

  const projectRecord: PackageRecord = { ...project };
  const encodedCover = await serializeBlob(project.coverBlob);
  if (encodedCover) projectRecord.coverBlob = encodedCover;
  else delete projectRecord.coverBlob;

  const encodedCharacters = await Promise.all(
    characters.map(async (character): Promise<PackageRecord> => {
      const record: PackageRecord = { ...character };
      const encodedAvatar = await serializeBlob(character.avatarBlob);
      if (encodedAvatar) record.avatarBlob = encodedAvatar;
      else delete record.avatarBlob;
      return record;
    }),
  );

  const packageFile: ProjectPackage = {
    app: "autor",
    kind: "project",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      projects: [projectRecord],
      chapters: packageRecords(chapters),
      scenes: packageRecords(scenes),
      characters: encodedCharacters,
      locations: packageRecords(locations),
      loreEntries: packageRecords(loreEntries),
      plotBeats: packageRecords(plotBeats),
      timelineEvents: packageRecords(timelineEvents),
      storyArcs: packageRecords(storyArcs),
      structureSections: packageRecords(structureSections),
      notes: packageRecords(notes),
      tags: packageRecords(tags),
      snippets: packageRecords(snippets),
      attachments: packageRecords(projectAttachments),
      versions: packageRecords(versions),
      ideaCards: packageRecords(ideaCards),
      ideaGroups: packageRecords(ideaGroups),
      ideaBoards: packageRecords(ideaBoards),
      folders: packageRecords(folders),
    },
  };

  return new Blob([JSON.stringify(packageFile, null, 2)], {
    type: "application/json",
  });
}

/** Imports a project package as a new project without replacing existing rows. */
export async function importProjectPackageJson(json: string): Promise<Project> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return invalidProjectPackage();
  }

  const importedAt = new Date().toISOString();
  const projectPackage = remapProjectPackage(
    parseProjectPackage(raw),
    importedAt,
  );
  decodeProjectBlobs(projectPackage);

  await ensureDbReady();
  const db = getDatabase();
  await db.transaction("rw", [...PROJECT_DATA_TABLES], async () => {
    for (const tableName of PROJECT_DATA_TABLES) {
      const rows = projectPackage.tables[tableName];
      if (rows.length > 0) {
        await db.table(tableName).bulkAdd(rows as never[]);
      }
    }
  });

  return projectPackage.tables.projects[0] as unknown as Project;
}
