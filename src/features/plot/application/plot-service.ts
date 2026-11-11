import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type {
  EntityId,
  PlotBeat,
  StructureSection,
  StructureTemplateId,
} from "@/shared/types/database";

import { computeSceneMove } from "../domain/ordering";
import { getStructureTemplate } from "../domain/structure-catalog";
import { sceneRepository } from "../infra/dexie-scene-repository";

export interface ApplyStructureResult {
  /** Seções criadas. */
  sections: number;
  /** Beats sugeridos criados. */
  beats: number;
  /** Beats anteriores soft-deleted (lixeira) por `replaceExisting`. */
  replaced: number;
}

export interface CustomSectionInput {
  title: string;
  description?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function setMainTemplateId(
  projectId: EntityId,
  templateId: StructureTemplateId,
): Promise<void> {
  const db = getDatabase();
  await db.projects.where("id").equals(projectId).modify((project) => {
    project.settings = { ...project.settings, structureTemplateId: templateId };
  });
}

/**
 * Aplica um template sequencial à trama principal: substitui as seções e,
 * (opcionalmente) os beats existentes, criando os beats sugeridos.
 */
export async function applyStructureTemplate(
  projectId: EntityId,
  templateId: Exclude<StructureTemplateId, "custom">,
  options: { replaceExisting: boolean },
): Promise<ApplyStructureResult> {
  const template = getStructureTemplate(templateId);
  if (!template) {
    throw new Error(`No structure template for id: ${templateId}`);
  }
  await ensureDbReady();
  const db = getDatabase();
  const now = nowIso();
  let replaced = 0;
  let beatCount = 0;
  // Ordem global (para listagens determinísticas); o quadro agrupa por seção.
  let globalBeatOrder = 0;

  await db.transaction(
    "rw",
    [db.plotBeats, db.structureSections, db.projects],
    async () => {
      await db.structureSections
        .filter(
          (section) =>
            section.projectId === projectId && section.scope === "main",
        )
        .delete();

      if (options.replaceExisting) {
        const existing = await db.plotBeats
          .filter(
            (beat) =>
              beat.projectId === projectId &&
              beat.scope === "main" &&
              !beat.deletedAt,
          )
          .toArray();
        for (const beat of existing) {
          await db.plotBeats.update(beat.id, {
            deletedAt: now,
            updatedAt: now,
          });
          replaced += 1;
        }
      }

      for (const [sectionIndex, section] of template.sections.entries()) {
        const sectionRow: StructureSection = {
          id: createId(),
          projectId,
          scope: "main",
          templateKey: section.key,
          title: section.title,
          description: section.description,
          order: sectionIndex + 1,
          createdAt: now,
          updatedAt: now,
        };
        await db.structureSections.add(sectionRow);

        for (const beat of section.beats) {
          globalBeatOrder += 1;
          const beatRow: PlotBeat = {
            id: createId(),
            projectId,
            scope: "main",
            sectionId: sectionRow.id,
            title: beat.title,
            description: beat.description,
            order: globalBeatOrder,
            createdAt: now,
            updatedAt: now,
          };
          await db.plotBeats.add(beatRow);
          beatCount += 1;
        }
      }
    },
  );

  await setMainTemplateId(projectId, templateId);
  return { sections: template.sections.length, beats: beatCount, replaced };
}

/**
 * Cria/atualiza uma estrutura personalizada: o autor define as seções e os
 * beats já existentes são redistribuídos entre elas, sem perder conteúdo.
 */
export async function applyCustomStructure(
  projectId: EntityId,
  sections: CustomSectionInput[],
): Promise<{ sections: number }> {
  const cleaned = sections
    .map((section) => ({
      title: section.title.trim(),
      description: section.description?.trim() || undefined,
    }))
    .filter((section) => section.title.length > 0);
  if (cleaned.length === 0) {
    throw new Error("A estrutura precisa de pelo menos uma seção.");
  }
  await ensureDbReady();
  const db = getDatabase();
  const now = nowIso();

  await db.transaction(
    "rw",
    [db.plotBeats, db.structureSections, db.projects],
    async () => {
      await db.structureSections
        .filter(
          (section) =>
            section.projectId === projectId && section.scope === "main",
        )
        .delete();

      const rows: StructureSection[] = cleaned.map((section, index) => ({
        id: createId(),
        projectId,
        scope: "main",
        title: section.title,
        description: section.description,
        order: index + 1,
        createdAt: now,
        updatedAt: now,
      }));
      await db.structureSections.bulkAdd(rows);

      const beats = (
        await db.plotBeats
          .filter(
            (beat) =>
              beat.projectId === projectId &&
              beat.scope === "main" &&
              !beat.deletedAt,
          )
          .toArray()
      ).sort((a, b) => a.order - b.order);
      if (beats.length === 0) return;

      for (const [index, beat] of beats.entries()) {
        const sectionIndex = Math.min(
          Math.floor((index * rows.length) / beats.length),
          rows.length - 1,
        );
        await db.plotBeats.update(beat.id, {
          sectionId: rows[sectionIndex]?.id,
          updatedAt: now,
        });
      }
    },
  );

  await setMainTemplateId(projectId, "custom");
  return { sections: cleaned.length };
}

/** Move a scene to the end of another chapter (or its own, to push last). */
export async function moveSceneToChapterEnd(
  sceneId: EntityId,
  toChapterId: EntityId,
): Promise<void> {
  const scene = await sceneRepository.getById(sceneId);
  if (!scene) throw new Error(`Scene not found: ${sceneId}`);

  const fromScenes = await sceneRepository.listByChapter(scene.chapterId);
  const toScenes =
    scene.chapterId === toChapterId
      ? fromScenes
      : await sceneRepository.listByChapter(toChapterId);

  const map = new Map([[scene.chapterId, fromScenes]]);
  if (toChapterId !== scene.chapterId) map.set(toChapterId, toScenes);

  await sceneRepository.applyMoves(
    computeSceneMove(map, sceneId, toChapterId, toScenes.length),
  );
}
