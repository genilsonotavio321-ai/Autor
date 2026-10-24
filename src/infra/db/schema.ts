import Dexie, { type EntityTable } from "dexie";

import type {
  Attachment,
  Chapter,
  Character,
  CustomPrompt,
  IdeaBoard,
  IdeaCard,
  IdeaGroup,
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
  attachments!: EntityTable<Attachment, "id">;
  ideaCards!: EntityTable<IdeaCard, "id">;
  ideaGroups!: EntityTable<IdeaGroup, "id">;
  ideaBoards!: EntityTable<IdeaBoard, "id">;
  promptItems!: EntityTable<CustomPrompt, "id">;

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

    // v2: imagens anexadas a notas/fichas/eventos (Fase 2B).
    // Copia TODAS as tabelas do v1 — a Dexie apaga tabelas omitidas entre versões.
    this.version(2).stores({
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
      attachments: "id, projectId, entityId, [entityType+entityId]",
    });

    // v3: canvas de ideias (seção Criatividade). Copia TODAS as tabelas do v2.
    this.version(3).stores({
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
      attachments: "id, projectId, entityId, [entityType+entityId]",
      ideaCards: "id, projectId, deletedAt",
    });

    // v4: prompts customizados do gerador. Copia TODAS as tabelas do v3.
    this.version(4).stores({
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
      attachments: "id, projectId, entityId, [entityType+entityId]",
      ideaCards: "id, projectId, deletedAt",
      promptItems: "id, kind",
    });

    // v5: grupos e quadros salvos do canvas. Copia TODAS as tabelas do v4.
    this.version(5).stores({
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
      attachments: "id, projectId, entityId, [entityType+entityId]",
      ideaCards: "id, projectId, deletedAt",
      ideaGroups: "id, projectId",
      ideaBoards: "id, projectId, createdAt",
      promptItems: "id, kind",
    });
  }
}
