import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import type { EntityId, Scene, SceneStatus } from "@/shared/types/database";

export interface SceneDraftParts {
  goal?: string;
  conflict?: string;
  turn?: string;
}

/** Compõe objetivo/conflito/virada no resumo da cena (uma linha por eixo). */
export function composeSceneSummary(parts: SceneDraftParts): string | undefined {
  const lines = [
    parts.goal?.trim() ? `Objetivo: ${parts.goal.trim()}` : "",
    parts.conflict?.trim() ? `Conflito: ${parts.conflict.trim()}` : "",
    parts.turn?.trim() ? `Virada: ${parts.turn.trim()}` : "",
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export interface SendSceneToOutlineInput {
  chapterId: EntityId;
  title?: string;
  summary?: string;
  status?: SceneStatus;
  povCharacterId?: EntityId;
  locationId?: EntityId;
}

/**
 * Envia a cena finalizada direto para a área Outline da Estrutura:
 * cria a cena anexada ao capítulo (no fim da ordem dele).
 */
export async function sendSceneToOutline(
  input: SendSceneToOutlineInput,
): Promise<Scene> {
  return sceneRepository.create({
    chapterId: input.chapterId,
    title: input.title,
    summary: input.summary,
    status: input.status,
    povCharacterId: input.povCharacterId,
    locationId: input.locationId,
  });
}
