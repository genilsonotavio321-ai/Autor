import type { Character, Tag } from "@/shared/types/database";
import type { EntityViewSection } from "@/shared/ui/entity-view-dialog";

import {
  CHARACTER_ROLE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "../domain/repository";

export interface CharacterSectionOptions {
  /** Demais personagens do projeto — resolvem os nomes das relações. */
  characters?: Character[];
  /** Tags do projeto — resolvem os nomes das tags. */
  tags?: Tag[];
}

/**
 * Monta as seções da ficha de leitura do personagem com tudo o que foi salvo
 * na ficha (papel, descrição, história, objetivos, medos, traços, relações e
 * tags). Seções sem conteúdo são omitidas.
 */
export function buildCharacterSections(
  character: Character,
  options: CharacterSectionOptions = {},
): EntityViewSection[] {
  const characters = options.characters ?? [];
  const tags = options.tags ?? [];
  const nameById = new Map(characters.map((item) => [item.id, item.name]));
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));

  const relationships = character.relationships
    .map((relation) => {
      const name = nameById.get(relation.targetId) ?? "Personagem";
      const label = RELATIONSHIP_TYPE_LABELS[relation.type];
      const note = relation.note?.trim();
      return note ? `${name} — ${label} (${note})` : `${name} — ${label}`;
    })
    .join("\n");

  const tagNames = character.tags
    .map((id) => tagNameById.get(id))
    .filter((name): name is string => Boolean(name))
    .join(", ");

  return [
    { label: "Papel", value: CHARACTER_ROLE_LABELS[character.role] },
    { label: "Descrição", value: character.description ?? "" },
    { label: "História", value: character.backstory ?? "" },
    { label: "Objetivos", value: character.goals ?? "" },
    { label: "Medos", value: character.fears ?? "" },
    { label: "Traços", value: character.traits.join(", ") },
    { label: "Relações", value: relationships },
    { label: "Tags", value: tagNames },
  ].filter((section) => section.value.trim().length > 0);
}
