import type { EntityId, PlotStructure } from "@/shared/types/database";

import { getBeatTemplate } from "../domain/beat-templates";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";

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
