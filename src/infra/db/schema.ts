import Dexie, { type EntityTable } from "dexie";

import type {
  Chapter,
  Character,
  Location,
  LoreEntry,
  Note,
  PlotBeat,
  Project,
  Scene,
  Setting,
  Snippet,
  Tag,
  Template,
  TimelineEvent,
  Version,
} from "@/shared/types/database";

/**
 * Dexie schema for Autor (plan §5, Fase 0).
 * Every migration that changes `.stores()` bumps the version below;
 * data upgrades live in ./migrations.ts and run before first write.
 */
export class AutorDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  chapters!: EntityTable<Chapter, "id">;
  scenes!: EntityTable<Scene, "id">;
  characters!: EntityTable<Character, "id">;
  locations!: EntityTable<Location, "id">;
  loreEntries!: EntityTable<LoreEntry, "id">;
  plotBeats!: EntityTable<PlotBeat, "id">;
  timelineEvents!: EntityTable<TimelineEvent, "id">;
  notes!: EntityTable<Note, "id">;
  tags!: EntityTable<Tag, "id">;
  snippets!: EntityTable<Snippet, "id">;
  templates!: EntityTable<Template, "id">;
  versions!: EntityTable<Version, "id">;
  settings!: EntityTable<Setting, "key">;

  constructor() {
    super("autor");

    this.version(1).stores({
      projects: "id, title, status, createdAt, updatedAt, deletedAt",
      chapters: "id, projectId, title, order, status, updatedAt, deletedAt",
      scenes: "id, chapterId, title, order, status, deletedAt",
      characters: "id, projectId, name, role, updatedAt, deletedAt",
      locations: "id, projectId, name, type",
      loreEntries: "id, projectId, title, category",
      plotBeats: "id, projectId, structure, order",
      timelineEvents: "id, projectId, date, title",
      notes: "id, projectId, title, pinned, updatedAt, deletedAt",
      tags: "id, projectId, name",
      snippets: "id, projectId, title, createdAt",
      templates: "id, name, scope, builtin",
      versions: "id, [entityType+entityId], createdAt",
      settings: "key",
    });
  }
}
