"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import type { EntityId } from "@/shared/types/database";

import { buildMentionIndex, type MentionEntity } from "../domain/entity-index";

/**
 * Indexed character and location names for a project, ready to feed the
 * `EntityHighlight` extension. Re-renders when either table changes.
 */
export function useMentionEntities(projectId: EntityId | null): MentionEntity[] {
  return (
    useLiveQuery(async () => {
      if (!projectId) return [];
      const [characters, locations] = await Promise.all([
        characterRepository.listByProject(projectId),
        locationRepository.listByProject(projectId),
      ]);
      return buildMentionIndex([
        ...characters.map(
          (character): MentionEntity => ({
            id: character.id,
            type: "character",
            name: character.name,
          }),
        ),
        ...locations.map(
          (location): MentionEntity => ({
            id: location.id,
            type: "location",
            name: location.name,
          }),
        ),
      ]);
    }, [projectId]) ?? []
  );
}
