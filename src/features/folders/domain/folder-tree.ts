import type { EntityId, Folder } from "@/shared/types/database";

/** Ids da pasta raiz e de todas as descendentes (inclusive aninhadas). */
export function collectSubtreeIds(
  folders: Folder[],
  rootId: EntityId,
): EntityId[] {
  const childrenByParent = new Map<EntityId, Folder[]>();
  for (const folder of folders) {
    if (!folder.parentId) continue;
    const list = childrenByParent.get(folder.parentId) ?? [];
    list.push(folder);
    childrenByParent.set(folder.parentId, list);
  }
  const out: EntityId[] = [];
  const walk = (id: EntityId) => {
    out.push(id);
    for (const child of childrenByParent.get(id) ?? []) walk(child.id);
  };
  walk(rootId);
  return out;
}

/** Pai de exibição: pasta cuja mãe morreu (lixeira) sobe para a raiz. */
export function effectiveParentId(
  folder: Folder,
  liveFolderIds: Set<EntityId>,
): EntityId | null {
  return folder.parentId && liveFolderIds.has(folder.parentId)
    ? folder.parentId
    : null;
}

/** Fichas visíveis na raiz: sem pasta ou cuja pasta não existe mais
 * (mesma regra de órfãos das subfichas de locais — locationIds). */
export function rootItems<T extends { folderId?: EntityId }>(
  items: T[],
  liveFolderIds: Set<EntityId>,
): T[] {
  return items.filter(
    (item) => !item.folderId || !liveFolderIds.has(item.folderId),
  );
}

/** Fichas diretas de uma pasta. */
export function itemsInFolder<T extends { folderId?: EntityId }>(
  items: T[],
  folderId: EntityId,
): T[] {
  return items.filter((item) => item.folderId === folderId);
}

/** Contagem direta por pasta (badge do card): fichas + pastas filhas. */
export function directCounts(
  folders: Folder[],
  items: { folderId?: EntityId }[],
): Map<EntityId, number> {
  const counts = new Map<EntityId, number>();
  const bump = (id: EntityId | undefined) => {
    if (!id) return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (const folder of folders) bump(folder.parentId);
  for (const item of items) bump(item.folderId);
  return counts;
}
