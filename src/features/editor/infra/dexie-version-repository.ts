import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, Version } from "@/shared/types/database";

import type {
  VersionCreateInput,
  VersionRepository,
} from "../domain/repository";

/** Auto-snapshots kept per entity; older ones are pruned on write. */
export const AUTO_VERSION_KEEP = 20;

const VERSION_ENTITY_TYPES: readonly Version["entityType"][] = [
  "project",
  "chapter",
  "scene",
  "character",
  "location",
  "loreEntry",
  "plotBeat",
  "timelineEvent",
  "note",
];

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
    if (input.auto) await this.pruneAutoVersions(input);
    return version;
  }

  async listByEntity(entityId: EntityId): Promise<Version[]> {
    await ensureDbReady();
    const all = await this.rowsForEntity(entityId);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<void> {
    await ensureDbReady();
    await getDatabase().versions.delete(id);
  }

  async deleteByEntity(entityId: EntityId): Promise<void> {
    await ensureDbReady();
    const versions = await this.rowsForEntity(entityId);
    if (versions.length > 0) {
      await getDatabase().versions.bulkDelete(
        versions.map((version) => version.id),
      );
    }
  }

  /** Usa o índice [entityType+entityId] em vez de varrer a tabela inteira. */
  private async rowsForEntity(entityId: EntityId): Promise<Version[]> {
    const db = getDatabase();
    const perType = await Promise.all(
      VERSION_ENTITY_TYPES.map((entityType) =>
        db.versions
          .where("[entityType+entityId]")
          .equals([entityType, entityId])
          .toArray(),
      ),
    );
    return perType.flat();
  }

  /** Mantém só os snapshots automáticos mais novos de cada entidade. */
  private async pruneAutoVersions(input: VersionCreateInput): Promise<void> {
    const db = getDatabase();
    const rows = await db.versions
      .where("[entityType+entityId]")
      .equals([input.entityType, input.entityId])
      .toArray();
    const autoRows = rows
      .filter((version) => version.auto)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const stale = autoRows.slice(AUTO_VERSION_KEEP);
    if (stale.length > 0) {
      await db.versions.bulkDelete(stale.map((version) => version.id));
    }
  }
}

export const versionRepository: VersionRepository = new DexieVersionRepository();
