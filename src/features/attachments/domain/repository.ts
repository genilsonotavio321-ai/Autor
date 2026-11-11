import type {
  Attachment,
  AttachmentEntityType,
  EntityId,
} from "@/shared/types/database";

export interface AttachmentCreateInput {
  projectId: EntityId;
  entityType: AttachmentEntityType;
  entityId: EntityId;
  dataUrl: string;
  name?: string;
}

export interface AttachmentRepository {
  listByEntity(
    entityType: AttachmentEntityType,
    entityId: EntityId,
  ): Promise<Attachment[]>;
  listByProject(projectId: EntityId): Promise<Attachment[]>;
  add(input: AttachmentCreateInput): Promise<Attachment>;
  remove(id: EntityId): Promise<void>;
  /** Removes every attachment of an entity (UUIDs are global, like versions). */
  removeByEntityId(entityId: EntityId): Promise<void>;
  removeByProject(projectId: EntityId): Promise<void>;
}
