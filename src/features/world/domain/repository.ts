import type { EntityId, Location, LoreEntry } from "@/shared/types/database";

/** Free-text location kinds shown as datalist suggestions in the UI. */
export const LOCATION_TYPE_SUGGESTIONS = [
  "Cidade",
  "Vila",
  "Castelo",
  "Floresta",
  "Montanha",
  "Mar",
  "Deserto",
  "Prisão",
  "Escola",
  "Outro",
] as const;

/** Máximo de níveis da hierarquia de locais: raiz → filho → neto. */
export const MAX_LOCATION_DEPTH = 3;

/**
 * Profundidade da ficha (raiz = 1). Ignora pais ausentes e é segura contra
 * ciclos (para de subir ao repetir um ancestral).
 */
export function locationDepth(
  location: Location,
  byId: Map<EntityId, Location>,
): number {
  let depth = 1;
  const seen = new Set<EntityId>([location.id]);
  let current = location;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    depth += 1;
    current = parent;
  }
  return depth;
}

/**
 * Candidatos a ficha-mãe: exclui a própria ficha e seus descendentes
 * (evita ciclos) e fichas cujo filho ultrapassaria MAX_LOCATION_DEPTH.
 * A ficha-mãe atual é sempre mantida, para editar dados pré-existentes.
 */
export function locationParentCandidates(
  location: Location | null,
  locations: Location[],
): Location[] {
  const byId = new Map(locations.map((item) => [item.id, item]));

  const blocked = new Set<EntityId>();
  if (location) {
    blocked.add(location.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of locations) {
        if (item.parentId && blocked.has(item.parentId) && !blocked.has(item.id)) {
          blocked.add(item.id);
          changed = true;
        }
      }
    }
  }

  return locations.filter((item) => {
    if (location && item.id === location.parentId) return true;
    if (blocked.has(item.id)) return false;
    return locationDepth(item, byId) < MAX_LOCATION_DEPTH;
  });
}

export interface LocationCreateInput {
  projectId: EntityId;
  name: string;
  type?: string;
  description?: string;
  /** Ficha-mãe quando criado como subficha. */
  parentId?: EntityId | null;
}

export interface LocationUpdateInput {
  name?: string;
  type?: string;
  description?: string;
  /** `null` desfaz a hierarquia (vira ficha de primeiro nível). */
  parentId?: EntityId | null;
}

export interface LocationRepository {
  create(input: LocationCreateInput): Promise<Location>;
  getById(id: EntityId): Promise<Location | undefined>;
  listByProject(projectId: EntityId): Promise<Location[]>;
  update(id: EntityId, patch: LocationUpdateInput): Promise<Location>;
  /** Persists the manual order of a drag-and-drop reorder. */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<Location[]>;
}

export const DEFAULT_LORE_CATEGORY = "Geral";

export interface LoreEntryCreateInput {
  projectId: EntityId;
  title: string;
  category?: string;
  /** Plain text (stored as Json string). */
  content?: string;
  linkedIds?: EntityId[];
}

export interface LoreEntryUpdateInput {
  title?: string;
  category?: string;
  content?: string;
  linkedIds?: EntityId[];
}

export interface LoreEntryRepository {
  create(input: LoreEntryCreateInput): Promise<LoreEntry>;
  getById(id: EntityId): Promise<LoreEntry | undefined>;
  listByProject(projectId: EntityId): Promise<LoreEntry[]>;
  update(id: EntityId, patch: LoreEntryUpdateInput): Promise<LoreEntry>;
  /** Persists the manual order of a drag-and-drop reorder. */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<LoreEntry[]>;
}
