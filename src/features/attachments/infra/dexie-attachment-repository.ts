import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type {
  Attachment,
  AttachmentEntityType,
  EntityId,
} from "@/shared/types/database";

import type {
  AttachmentCreateInput,
  AttachmentRepository,
} from "../domain/repository";

export class DexieAttachmentRepository implements AttachmentRepository {
  async add(input: AttachmentCreateInput): Promise<Attachment> {
    await ensureDbReady();
    const attachment: Attachment = {
      id: createId(),
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      name: input.name,
      dataUrl: input.dataUrl,
      createdAt: new Date().toISOString(),
    };
    await getDatabase().attachments.add(attachment);
    return attachment;
  }

  async listByEntity(
    entityType: AttachmentEntityType,
    entityId: EntityId,
  ): Promise<Attachment[]> {
    await ensureDbReady();
    const rows = await getDatabase()
      .attachments.where("[entityType+entityId]")
      .equals([entityType, entityId])
      .toArray();
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listByProject(projectId: EntityId): Promise<Attachment[]> {
    await ensureDbReady();
    return getDatabase()
      .attachments.where("projectId")
      .equals(projectId)
      .toArray();
  }

  async remove(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().attachments.delete(id);
  }

  async removeByEntityId(entityId: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase()
      .attachments.where("entityId")
      .equals(entityId)
      .delete();
  }

  async removeByProject(projectId: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase()
      .attachments.where("projectId")
      .equals(projectId)
      .delete();
  }
}

export const attachmentRepository: AttachmentRepository =
  new DexieAttachmentRepository();
