import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, Version } from "@/shared/types/database";

import type {
  VersionCreateInput,
  VersionRepository,
} from "../domain/repository";

export class DexieVersionRepository implements VersionRepository {
  async create(input: VersionCreateInput): Promise<Version> {
    await ensureDbReady();
    const version: Version = {
      id: createId(),
      entityType: input.entityType,
      entityId: input.entityId,
      snapshot: input.snapshot,
      label: input.label,
      auto: input.auto,
      createdAt: new Date().toISOString(),
    };
    await getDatabase().versions.add(version);
    return version;
  }

  async listByEntity(entityId: EntityId): Promise<Version[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .versions.filter((version) => version.entityId === entityId)
      .toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<void> {
    await ensureDbReady();
    await getDatabase().versions.delete(id);
  }

  async deleteByEntity(entityId: EntityId): Promise<void> {
    await ensureDbReady();
    const ids = await getDatabase()
      .versions.filter((version) => version.entityId === entityId)
      .primaryKeys();
    if (ids.length > 0) {
      await getDatabase().versions.bulkDelete(ids);
    }
  }
}

export const versionRepository: VersionRepository = new DexieVersionRepository();
