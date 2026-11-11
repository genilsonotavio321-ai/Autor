import {
  getStructureTemplate,
  sectionKeyForBeatIndex,
} from "@/features/plot/domain/structure-catalog";
import { createId } from "@/shared/lib/id";
import type {
  PlotBeat,
  Setting,
  StructureSection,
  StructureTemplateId,
} from "@/shared/types/database";

import { getDatabase } from "./index";
import type { AutorDatabase } from "./schema";

export interface Migration {
  /** Must match a Dexie `.version(n)` that changed the schema. */
  version: number;
  description: string;
  upgrade: (db: AutorDatabase) => Promise<void>;
}

/**
 * Data-migration registry (plan: versioned migrations + pre-migration backup).
 * Schema changes go into schema.ts; row-level rewrites are registered here.
 */
/** Estrutura antiga gravada em cada beat (removida pela migração). */
function legacyStructure(beat: PlotBeat): string | undefined {
  const value = (beat as PlotBeat & { structure?: unknown }).structure;
  return typeof value === "string" ? value : undefined;
}

export const migrations: Migration[] = [
  {
    version: 1,
    description:
      "Estrutura em seções (atos/estágios/esferas) e cena como ponte do beat",
    upgrade: async (db) => {
      const now = new Date().toISOString();
      const projects = await db.projects.toArray();

      for (const project of projects) {
        const beats = (
          await db.plotBeats.where("projectId").equals(project.id).toArray()
        ).sort((a, b) => a.order - b.order);
        const legacyBeats = beats.filter(
          (beat) => legacyStructure(beat) !== undefined,
        );
        if (legacyBeats.length === 0) continue;

        // Estrutura dominante do projeto (a que a maioria dos beats usava).
        const counts = new Map<string, number>();
        for (const beat of beats) {
          const structure = legacyStructure(beat);
          if (structure) {
            counts.set(structure, (counts.get(structure) ?? 0) + 1);
          }
        }
        let dominant: string | undefined;
        let max = 0;
        for (const [structure, count] of counts) {
          if (count > max) {
            max = count;
            dominant = structure;
          }
        }
        const template = dominant
          ? getStructureTemplate(dominant as StructureTemplateId)
          : undefined;

        const sections: StructureSection[] = template
          ? template.sections.map((section, index) => ({
              id: createId(),
              projectId: project.id,
              scope: "main",
              templateKey: section.key,
              title: section.title,
              description: section.description,
              order: index + 1,
              createdAt: now,
              updatedAt: now,
            }))
          : [
              {
                id: createId(),
                projectId: project.id,
                scope: "main",
                title: "Beats",
                order: 1,
                createdAt: now,
                updatedAt: now,
              },
            ];
        const fallbackSection = sections[0];
        if (!fallbackSection) continue;
        await db.structureSections.bulkAdd(sections);

        for (const [index, beat] of beats.entries()) {
          const sectionKey = template
            ? sectionKeyForBeatIndex(template, index)
            : undefined;
          const section =
            sections.find((item) => item.templateKey === sectionKey) ??
            fallbackSection;

          const linkedSceneId = (
            beat as PlotBeat & { linkedSceneId?: string }
          ).linkedSceneId;
          if (linkedSceneId) {
            await db.scenes
              .where("id")
              .equals(linkedSceneId)
              .modify({ beatId: beat.id });
          }

          await db.plotBeats
            .where("id")
            .equals(beat.id)
            .modify((row) => {
              row.scope = "main";
              row.sectionId = section.id;
              delete (row as PlotBeat & { structure?: string }).structure;
              delete (row as PlotBeat & { linkedSceneId?: string }).linkedSceneId;
            });
        }

        await db.projects
          .where("id")
          .equals(project.id)
          .modify((row) => {
            row.settings = {
              ...row.settings,
              structureTemplateId: template ? template.id : "custom",
            };
          });
      }
    },
  },
];

const DATA_VERSION_KEY = "dataVersion";

/** Every table in the database, in a stable order. */
export const TABLE_NAMES = [
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
  "templates",
  "versions",
  "settings",
  "attachments",
  "ideaCards",
  "ideaGroups",
  "ideaBoards",
  "promptItems",
  "folders",
] as const;

/** Full JSON dump of every table — stored before any migration runs. */
export async function dumpDatabase(): Promise<Record<string, unknown[]>> {
  const db = getDatabase();

  const dump: Record<string, unknown[]> = {};
  for (const table of TABLE_NAMES) {
    dump[table] = await db.table(table).toArray();
  }
  return dump;
}

async function readDataVersion(db: AutorDatabase): Promise<number> {
  const row = await db.settings.get(DATA_VERSION_KEY);
  return typeof row?.value === "number" ? row.value : 0;
}

async function writeDataVersion(
  db: AutorDatabase,
  version: number,
): Promise<void> {
  const existing: Setting = { key: DATA_VERSION_KEY, value: version };
  await db.settings.put(existing);
}

/**
 * Applies pending data migrations, taking a full JSON backup first.
 * Returns the list of migration descriptions that ran.
 */
export async function runMigrations(): Promise<string[]> {
  const db = getDatabase();
  const current = await readDataVersion(db);
  const pending = migrations
    .filter((migration) => migration.version > current)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) return [];

  await dumpDatabase(); // pre-migration backup (kept in memory; persisted by Fase 4 backup feature)

  const applied: string[] = [];
  for (const migration of pending) {
    await migration.upgrade(db);
    await writeDataVersion(db, migration.version);
    applied.push(migration.description);
  }
  return applied;
}
