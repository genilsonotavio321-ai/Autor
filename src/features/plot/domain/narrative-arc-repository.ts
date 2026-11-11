import type { EntityId, NarrativeArc } from "@/shared/types/database";

export interface NarrativeArcCreateInput {
  projectId: EntityId;
  name: string;
  description?: string;
  color?: string;
}

export interface NarrativeArcUpdateInput {
  name?: string;
  description?: string | null;
  color?: string | null;
}

export interface NarrativeArcRepository {
  create(input: NarrativeArcCreateInput): Promise<NarrativeArc>;
  getById(id: EntityId): Promise<NarrativeArc | undefined>;
  listByProject(projectId: EntityId): Promise<NarrativeArc[]>;
  update(id: EntityId, patch: NarrativeArcUpdateInput): Promise<NarrativeArc>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<NarrativeArc[]>;
}
