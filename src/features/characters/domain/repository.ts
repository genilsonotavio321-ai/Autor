import type {
  Character,
  CharacterGender,
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

export const CHARACTER_GENDER_LABELS: Record<CharacterGender, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  outro: "Outro",
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
  gender?: CharacterGender;
  description?: string;
  backstory?: string;
  goals?: string;
  fears?: string;
  traits?: string[];
  relationships?: Relationship[];
  tags?: EntityId[];
}

export interface CharacterUpdateInput {
  name?: string;
  role?: CharacterRole;
  gender?: CharacterGender;
  description?: string;
  backstory?: string;
  goals?: string;
  fears?: string;
  traits?: string[];
  relationships?: Relationship[];
  tags?: EntityId[];
}

export interface CharacterRepository {
  create(input: CharacterCreateInput): Promise<Character>;
  getById(id: EntityId): Promise<Character | undefined>;
  listByProject(projectId: EntityId): Promise<Character[]>;
  update(id: EntityId, patch: CharacterUpdateInput): Promise<Character>;
  /** Persists the manual order of a drag-and-drop reorder. */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<Character[]>;
}
