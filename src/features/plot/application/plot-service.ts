import type { EntityId, PlotStructure } from "@/shared/types/database";

import { getBeatTemplate } from "../domain/beat-templates";
import { computeSceneMove } from "../domain/ordering";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

export interface ApplyBeatTemplateResult {
  created: number;
  /** Beats soft-deleted because `replaceExisting` was set. */
  replaced: number;
}

/**
 * Populate the project's beat sheet from a builtin template.
 * With `replaceExisting`, current beats are soft-deleted first.
 */
export async function applyBeatTemplate(
  projectId: EntityId,
  structure: PlotStructure,
  options: { replaceExisting: boolean },
): Promise<ApplyBeatTemplateResult> {
  const template = getBeatTemplate(structure);
  if (!template) {
    throw new Error(`No beat template for structure: ${structure}`);
  }

  let replaced = 0;
  if (options.replaceExisting) {
    const existing = await plotBeatRepository.listByProject(projectId);
    for (const beat of existing) {
      await plotBeatRepository.softDelete(beat.id);
      replaced += 1;
    }
  }

  for (const [index, entry] of template.beats.entries()) {
    await plotBeatRepository.create({
      projectId,
      structure,
      title: `${index + 1}. ${entry.title}`,
      description: entry.description,
    });
  }

  return { created: template.beats.length, replaced };
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
