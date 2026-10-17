import type {
  Character,
  CharacterRole,
  EntityId,
  Relationship,
  RelationshipType,
} from "@/shared/types/database";

export const CHARACTER_ROLE_LABELS: Record<CharacterRole, string> = {
  protagonist: "Protagonista",
  antagonist: "Antagonista",
  supporting: "Secundário",
  minor: "Menor",
};

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  family: "Família",
  friend: "Amizade",
  enemy: "Inimizade",
  love: "Romance",
  mentor: "Mentoria",
  rival: "Rivalidade",
  ally: "Aliança",
  other: "Outro",
};

export interface CharacterCreateInput {
  projectId: EntityId;
  name: string;
  role?: CharacterRole;
  description?: string;
  backstory?: string;
  goals?: string;
  fears?: string;
  traits?: string[];
}

export interface CharacterUpdateInput {
  name?: string;
  role?: CharacterRole;
  description?: string;
  backstory?: string;
  goals?: string;
  fears?: string;
  traits?: string[];
  relationships?: Relationship[];
}

export interface CharacterRepository {
  create(input: CharacterCreateInput): Promise<Character>;
  getById(id: EntityId): Promise<Character | undefined>;
  listByProject(projectId: EntityId): Promise<Character[]>;
  update(id: EntityId, patch: CharacterUpdateInput): Promise<Character>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  listDeleted(): Promise<Character[]>;
}
