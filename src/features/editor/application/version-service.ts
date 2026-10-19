import type { EntityId, Json, Version } from "@/shared/types/database";

import { versionRepository } from "../infra/dexie-version-repository";

/** Auto-snapshots are taken at most once per interval while editing. */
export const AUTO_VERSION_INTERVAL_MS = 5 * 60 * 1000;

export function createManualVersion(
  entityId: EntityId,
  snapshot: Json,
  label?: string,
): Promise<Version> {
  return versionRepository.create({
    entityType: "chapter",
    entityId,
    snapshot,
    label,
    auto: false,
  });
}

export function listVersions(entityId: EntityId): Promise<Version[]> {
  return versionRepository.listByEntity(entityId);
}

/** Permanently removes every saved version of a chapter. */
export function clearVersions(entityId: EntityId): Promise<void> {
  return versionRepository.deleteByEntity(entityId);
}

/**
 * Snapshots `previousSnapshot` if the auto interval elapsed.
 * Returns the (possibly updated) last auto timestamp to keep in state.
 */
export async function maybeCreateAutoVersion(
  entityId: EntityId,
  previousSnapshot: Json,
  lastAutoAt: number | null,
): Promise<number> {
  const now = Date.now();
  if (lastAutoAt !== null && now - lastAutoAt < AUTO_VERSION_INTERVAL_MS) {
    return lastAutoAt;
  }
  await versionRepository.create({
    entityType: "chapter",
    entityId,
    snapshot: previousSnapshot,
    auto: true,
  });
  return now;
}
