import type { EntityId, Json, Version } from "@/shared/types/database";

export interface VersionCreateInput {
  entityType: Version["entityType"];
  entityId: EntityId;
  snapshot: Json;
  label?: string;
  auto: boolean;
}

export interface VersionRepository {
  create(input: VersionCreateInput): Promise<Version>;
  /** Versions of one entity, most recent first. */
  listByEntity(entityId: EntityId): Promise<Version[]>;
  delete(id: string): Promise<void>;
}
