"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageActionBar } from "@/components/layout/action-bar";
import { useProjectReady } from "@/features/projects/application/use-project-ready";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { resolveFolderDragEnd } from "@/features/folders/application/folder-drag";
import {
  deleteFolderCascade,
} from "@/features/folders/application/folder-service";
import {
  directCounts,
  effectiveParentId,
  itemsInFolder,
  rootItems,
} from "@/features/folders/domain/folder-tree";
import { folderRepository } from "@/features/folders/infra/dexie-folder-repository";
import { useFolderDragHint } from "@/features/folders/ui/drag-hint";
import { FolderCard } from "@/features/folders/ui/folder-card";
import { NewFolderButton } from "@/features/folders/ui/new-folder-button";
import type {
  EntityId,
  Folder,
  Location,
  LoreEntry,
} from "@/shared/types/database";

import { characterRepository } from "@/features/characters/infra/dexie-character-repository";

import { locationRepository } from "../infra/dexie-location-repository";
import { loreEntryRepository } from "../infra/dexie-lore-entry-repository";
import { partitionLoreEntries } from "../domain/lore-entry-collections";

import { LocationDialog } from "./location-dialog";
import { LoreDialog } from "./lore-dialog";
import { WorldFolderBoard } from "./world-folder-board";
import { LocationViewDialog, LoreViewDialog } from "./world-view-dialogs";

export function WorldPage() {
  const { projectId } = useSelectedProject();
  const liveLocations = useLiveQuery(
    () => (projectId ? locationRepository.listByProject(projectId) : []),
    [projectId],
  );
  const locations = useMemo(() => liveLocations ?? [], [liveLocations]);
  const locationIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations],
  );
  // Item 7: hierarquia de locais — subfichas agrupadas sob a ficha-mãe.
  const locationChildren = useMemo(() => {
    const map = new Map<EntityId, Location[]>();
    for (const location of locations) {
      if (!location.parentId || !locationIds.has(location.parentId)) continue;
      const list = map.get(location.parentId) ?? [];
      list.push(location);
      map.set(location.parentId, list);
    }
    return map;
  }, [locations, locationIds]);
  const topLevelLocations = useMemo(
    () =>
      locations.filter(
        (location) => !location.parentId || !locationIds.has(location.parentId),
      ),
    [locations, locationIds],
  );
  const liveLoreEntries = useLiveQuery(
    () => (projectId ? loreEntryRepository.listByProject(projectId) : []),
    [projectId],
  );
  const allLoreEntries = useMemo(() => liveLoreEntries ?? [], [liveLoreEntries]);
  const { lore: loreEntries, items: trackableItems } = useMemo(
    () => partitionLoreEntries(allLoreEntries),
    [allLoreEntries],
  );
  const characters =
    useLiveQuery(
      () => (projectId ? characterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const liveFolders = useLiveQuery(
    () => (projectId ? folderRepository.listByProject(projectId) : []),
    [projectId],
  );
  useProjectReady(
    liveLocations !== undefined &&
      liveLoreEntries !== undefined &&
      liveFolders !== undefined,
    projectId,
  );
  // Uma árvore de pastas por aba: locais, lore e objetos são independentes.
  const locationFolders = useMemo(
    () =>
      (liveFolders ?? []).filter((folder) => folder.kind === "location"),
    [liveFolders],
  );
  const loreFolders = useMemo(
    () => (liveFolders ?? []).filter((folder) => folder.kind === "lore"),
    [liveFolders],
  );
  const itemFolders = useMemo(
    () => (liveFolders ?? []).filter((folder) => folder.kind === "item"),
    [liveFolders],
  );
  const liveLocationFolderIds = useMemo(
    () => new Set(locationFolders.map((folder) => folder.id)),
    [locationFolders],
  );
  const liveLoreFolderIds = useMemo(
    () => new Set(loreFolders.map((folder) => folder.id)),
    [loreFolders],
  );
  const liveItemFolderIds = useMemo(
    () => new Set(itemFolders.map((folder) => folder.id)),
    [itemFolders],
  );
  const [openLocationFolderId, setOpenLocationFolderId] =
    useState<EntityId | null>(null);
  const [openLoreFolderId, setOpenLoreFolderId] = useState<EntityId | null>(
    null,
  );
  const [openItemFolderId, setOpenItemFolderId] = useState<EntityId | null>(
    null,
  );
  const currentLocationFolder = useMemo(
    () =>
      openLocationFolderId
        ? (locationFolders.find((f) => f.id === openLocationFolderId) ?? null)
        : null,
    [locationFolders, openLocationFolderId],
  );
  const currentLoreFolder = useMemo(
    () =>
      openLoreFolderId
        ? (loreFolders.find((f) => f.id === openLoreFolderId) ?? null)
        : null,
    [loreFolders, openLoreFolderId],
  );
  const currentItemFolder = useMemo(
    () =>
      openItemFolderId
        ? (itemFolders.find((folder) => folder.id === openItemFolderId) ?? null)
        : null,
    [itemFolders, openItemFolderId],
  );
  const viewLocationFolders = useMemo(
    () =>
      locationFolders.filter(
        (folder) =>
          effectiveParentId(folder, liveLocationFolderIds) ===
          (openLocationFolderId ?? null),
      ),
    [locationFolders, liveLocationFolderIds, openLocationFolderId],
  );
  const viewLoreFolders = useMemo(
    () =>
      loreFolders.filter(
        (folder) =>
          effectiveParentId(folder, liveLoreFolderIds) ===
          (openLoreFolderId ?? null),
      ),
    [loreFolders, liveLoreFolderIds, openLoreFolderId],
  );
  const viewItemFolders = useMemo(
    () =>
      itemFolders.filter(
        (folder) =>
          effectiveParentId(folder, liveItemFolderIds) ===
          (openItemFolderId ?? null),
      ),
    [itemFolders, liveItemFolderIds, openItemFolderId],
  );
  const viewLocationFolderIds = useMemo(
    () => viewLocationFolders.map((folder) => folder.id),
    [viewLocationFolders],
  );
  const viewLoreFolderIds = useMemo(
    () => viewLoreFolders.map((folder) => folder.id),
    [viewLoreFolders],
  );
  const viewItemFolderIds = useMemo(
    () => viewItemFolders.map((folder) => folder.id),
    [viewItemFolders],
  );
  const locationFolderCounts = useMemo(
    () => directCounts(locationFolders, locations),
    [locationFolders, locations],
  );
  const loreFolderCounts = useMemo(
    () => directCounts(loreFolders, loreEntries),
    [loreFolders, loreEntries],
  );
  const itemFolderCounts = useMemo(
    () => directCounts(itemFolders, trackableItems),
    [itemFolders, trackableItems],
  );
  const locationHint = useFolderDragHint({
    viewFolderIds: viewLocationFolderIds,
  });
  const loreHint = useFolderDragHint({ viewFolderIds: viewLoreFolderIds });
  const itemHint = useFolderDragHint({ viewFolderIds: viewItemFolderIds });

  const [locationDialog, setLocationDialog] = useState<{
    open: boolean;
    location?: Location | null;
    parentId?: EntityId | null;
  }>({ open: false });
  const [loreDialog, setLoreDialog] = useState<{
    open: boolean;
    entry?: LoreEntry | null;
    isTrackableItem?: boolean;
  }>({ open: false });
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [pendingLoreId, setPendingLoreId] = useState<string | null>(null);
  // `&view=1` (search) opens the read-only view instead of the form.
  const [pendingView, setPendingView] = useState(false);
  const [viewLocation, setViewLocation] = useState<Location | null>(null);
  const [viewLore, setViewLore] = useState<LoreEntry | null>(null);
  const [worldTab, setWorldTab] = useState("locations");
  // Set while a card is being dragged, so the trailing click doesn't open it.
  const suppressClick = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 1000, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const titlesById = useMemo(() => {
    const map = new Map<UniqueIdentifier, string>();
    for (const folder of locationFolders)
      map.set(folder.id, `pasta ${folder.name}`);
    for (const folder of loreFolders)
      map.set(folder.id, `pasta ${folder.name}`);
    for (const folder of itemFolders)
      map.set(folder.id, `pasta ${folder.name}`);
    for (const location of locations) map.set(location.id, location.name);
    for (const entry of allLoreEntries) map.set(entry.id, entry.title);
    return map;
  }, [locations, allLoreEntries, locationFolders, loreFolders, itemFolders]);

  const announcements = useMemo<Announcements>(() => {
    const labelFor = (id: UniqueIdentifier) => titlesById.get(id) ?? "ficha";
    return {
      onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragEnd: ({ over }) =>
        over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragCancel: () => "Arraste cancelado.",
    };
  }, [titlesById]);

  // Open a location/lore entry directly when navigated with
  // ?location=<id> / ?lore=<id> (search results and mentions).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locationId = params.get("location");
    const loreId = params.get("lore");
    if (!locationId && !loreId) return;
    if (locationId) setPendingLocationId(locationId);
    if (loreId) setPendingLoreId(loreId);
    setPendingView(params.get("view") === "1");
    window.history.replaceState({}, "", "/world");
  }, []);

  useEffect(() => {
    if (!pendingLocationId) return;
    const found = locations.find((location) => location.id === pendingLocationId);
    if (!found) return;
    setWorldTab("locations");
    if (pendingView) setViewLocation(found);
    else setLocationDialog({ open: true, location: found });
    setPendingLocationId(null);
  }, [pendingLocationId, pendingView, locations]);

  useEffect(() => {
    if (!pendingLoreId) return;
    const found = allLoreEntries.find((entry) => entry.id === pendingLoreId);
    if (!found) return;
    setWorldTab(found.isTrackableItem ? "items" : "lore");
    if (pendingView) setViewLore(found);
    else setLoreDialog({ open: true, entry: found });
    setPendingLoreId(null);
  }, [pendingLoreId, pendingView, allLoreEntries]);

  // Pasta aberta morreu (excluída em cascata etc.) — volta à raiz em vez de
  // deixar a aba presa numa pasta fantasma.
  useEffect(() => {
    if (
      openLocationFolderId &&
      !locationFolders.some((folder) => folder.id === openLocationFolderId)
    ) {
      setOpenLocationFolderId(null);
    }
  }, [locationFolders, openLocationFolderId]);

  useEffect(() => {
    if (
      openLoreFolderId &&
      !loreFolders.some((folder) => folder.id === openLoreFolderId)
    ) {
      setOpenLoreFolderId(null);
    }
  }, [loreFolders, openLoreFolderId]);

  useEffect(() => {
    if (
      openItemFolderId &&
      !itemFolders.some((folder) => folder.id === openItemFolderId)
    ) {
      setOpenItemFolderId(null);
    }
  }, [itemFolders, openItemFolderId]);

  // Locais visíveis na aba: raiz = fichas-mãe sem pasta (ou de pasta morta);
  // dentro da pasta, os membros diretos dela.
  const visibleLocations = useMemo(
    () =>
      openLocationFolderId === null
        ? rootItems(topLevelLocations, liveLocationFolderIds)
        : itemsInFolder(topLevelLocations, openLocationFolderId),
    [topLevelLocations, liveLocationFolderIds, openLocationFolderId],
  );
  const viewLocationIds = useMemo(
    () => [
      ...viewLocationFolderIds,
      ...visibleLocations.map((location) => location.id),
    ],
    [viewLocationFolderIds, visibleLocations],
  );
  const visibleLoreEntries = useMemo(
    () =>
      openLoreFolderId === null
        ? rootItems(loreEntries, liveLoreFolderIds)
        : itemsInFolder(loreEntries, openLoreFolderId),
    [loreEntries, liveLoreFolderIds, openLoreFolderId],
  );
  const viewLoreIds = useMemo(
    () => [
      ...viewLoreFolderIds,
      ...visibleLoreEntries.map((entry) => entry.id),
    ],
    [viewLoreFolderIds, visibleLoreEntries],
  );
  const visibleTrackableItems = useMemo(
    () =>
      openItemFolderId === null
        ? rootItems(trackableItems, liveItemFolderIds)
        : itemsInFolder(trackableItems, openItemFolderId),
    [trackableItems, liveItemFolderIds, openItemFolderId],
  );
  const viewItemIds = useMemo(
    () => [
      ...viewItemFolderIds,
      ...visibleTrackableItems.map((item) => item.id),
    ],
    [viewItemFolderIds, visibleTrackableItems],
  );

  function handleDragStart() {
    suppressClick.current = true;
  }

  function handleDragCancel() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  function handleLocationDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    void resolveFolderDragEnd({
      kind: "location",
      projectId,
      folders: locationFolders,
      viewFolderIds: viewLocationFolderIds,
      openFolderId: openLocationFolderId,
      activeId,
      overId,
      activeRect: active.rect.current.translated,
      overRect: over.rect,
    })
      .then((outcome) => {
        if (outcome === "created") {
        } else if (outcome === "reorder") {
          reorderLocations(activeId, overId);
        }
      })
      .catch(() => undefined);
  }

  function handleLoreDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    void resolveFolderDragEnd({
      kind: "lore",
      projectId,
      folders: loreFolders,
      viewFolderIds: viewLoreFolderIds,
      openFolderId: openLoreFolderId,
      activeId,
      overId,
      activeRect: active.rect.current.translated,
      overRect: over.rect,
    })
      .then((outcome) => {
        if (outcome === "created") {
        } else if (outcome === "reorder") {
          reorderLoreEntries(activeId, overId);
        }
      })
      .catch(() => undefined);
  }

  function handleItemDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    void resolveFolderDragEnd({
      kind: "item",
      projectId,
      folders: itemFolders,
      viewFolderIds: viewItemFolderIds,
      openFolderId: openItemFolderId,
      activeId,
      overId,
      activeRect: active.rect.current.translated,
      overRect: over.rect,
    })
      .then((outcome) => {
        if (outcome === "created") {
        } else if (outcome === "reorder") {
          reorderItems(activeId, overId);
        }
      })
      .catch(() => undefined);
  }

  /** Reordenação de fichas (drop na borda do card) — pastas ficam de fora. */
  function reorderInView(
    activeId: string,
    overId: string,
    ids: string[],
    folderIds: string[],
    apply: (moves: { id: string; order: number }[]) => Promise<unknown>,
  ) {
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const folders = new Set(folderIds);
    const reordered = arrayMove(ids, oldIndex, newIndex).filter(
      (id) => !folders.has(id),
    );
    void apply(reordered.map((id, order) => ({ id, order }))).catch(() =>
      undefined,
    );
  }

  const reorderLocations = (activeId: string, overId: string) =>
    reorderInView(activeId, overId, viewLocationIds, viewLocationFolderIds, (moves) =>
      locationRepository.applyMoves(moves),
    );

  const reorderLoreEntries = (activeId: string, overId: string) =>
    reorderInView(activeId, overId, viewLoreIds, viewLoreFolderIds, (moves) =>
      loreEntryRepository.applyMoves(moves),
    );

  const reorderItems = (activeId: string, overId: string) =>
    reorderInView(activeId, overId, viewItemIds, viewItemFolderIds, (moves) =>
      loreEntryRepository.applyMoves(moves),
    );

  async function removeLocation(location: Location) {
    await locationRepository.softDelete(location.id);
  }

  async function removeLore(entry: LoreEntry) {
    await loreEntryRepository.softDelete(entry.id);
  }

  async function removeFolder(folder: Folder) {
    // Excluir a pasta aberta devolve para a pasta pai, não para a raiz.
    const parentId = effectiveParentId(
      folder,
      folder.kind === "lore"
        ? liveLoreFolderIds
        : folder.kind === "item"
          ? liveItemFolderIds
          : liveLocationFolderIds,
    );
    await deleteFolderCascade(folder);
    if (openLocationFolderId === folder.id) setOpenLocationFolderId(parentId);
    if (openLoreFolderId === folder.id) setOpenLoreFolderId(parentId);
    if (openItemFolderId === folder.id) setOpenItemFolderId(parentId);
  }

  async function renameFolder(folder: Folder, name: string) {
    try {
      await folderRepository.rename(folder.id, name);
    } catch {
    }
  }

  function exitFolder(
    current: Folder | null | undefined,
    liveIds: Set<string>,
    set: (id: string | null) => void,
  ) {
    set(current ? effectiveParentId(current, liveIds) : null);
  }

  const exitLocationFolder = () =>
    exitFolder(currentLocationFolder, liveLocationFolderIds, setOpenLocationFolderId);
  const exitLoreFolder = () =>
    exitFolder(currentLoreFolder, liveLoreFolderIds, setOpenLoreFolderId);
  const exitItemFolder = () =>
    exitFolder(currentItemFolder, liveItemFolderIds, setOpenItemFolderId);

  // Ação rápida da barra flutuante: pasta e ficha da categoria carregada.
  const tabKind = worldTab === "items" ? "item" : worldTab === "lore" ? "lore" : "location";
  const currentTabFolderId =
    worldTab === "locations"
      ? openLocationFolderId
      : worldTab === "items"
        ? openItemFolderId
        : openLoreFolderId;
  const tabCreateLabel =
    worldTab === "items"
      ? "Novo objeto"
      : worldTab === "lore"
        ? "Nova entrada de lore"
        : "Novo local";
  function createTabItem() {
    if (worldTab === "items") setLoreDialog({ open: true, isTrackableItem: true });
    else if (worldTab === "lore") setLoreDialog({ open: true });
    else setLocationDialog({ open: true });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Planejamento"
        title="Mundo"
        description="Locais, lore e objetos do universo da história."
        count={
          locations.length + allLoreEntries.length > 0
            ? `${locations.length} ${locations.length === 1 ? "local" : "locais"} · ${allLoreEntries.length} ${allLoreEntries.length === 1 ? "entrada" : "entradas"}`
            : undefined
        }
      />

      <PageActionBar>
        <NewFolderButton
          kind={tabKind}
          projectId={projectId}
          parentId={currentTabFolderId ?? undefined}
        />
        <Button
          size="icon"
          className="rounded-full"
          aria-label={tabCreateLabel}
          title={tabCreateLabel}
          disabled={projectId === null}
          onClick={createTabItem}
        >
          <Plus aria-hidden />
        </Button>
      </PageActionBar>

      {projectId === null ? (
        <EmptyState
          title="Nenhum projeto ativo"
          hint="Crie um projeto para mapear locais e o lore da sua história."
        />
      ) : (
        <>
          <div className="mt-6 flex justify-center">
            <Select
              value={worldTab}
              onValueChange={(value) => {
                setWorldTab(value);
                // Trocar de categoria volta para a raiz de pastas.
                setOpenLocationFolderId(null);
                setOpenLoreFolderId(null);
                setOpenItemFolderId(null);
              }}
            >
              <SelectTrigger className="h-9 w-48" aria-label="O que carregar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="locations">Locais</SelectItem>
                <SelectItem value="lore">Lore</SelectItem>
                <SelectItem value="items">Objetos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {worldTab === "locations" ? (
          <div className="mt-4 grid gap-3">
            {locations.length === 0 && locationFolders.length === 0 ? (
              <EmptyState
                title="Nenhum local ainda"
                hint="Registre cidades, castelos e paisagens do seu universo."
              />
            ) : (
              <WorldFolderBoard
                sensors={sensors}
                announcements={announcements}
                hint={locationHint}
                viewIds={viewLocationIds}
                currentFolder={currentLocationFolder}
                onExitFolder={exitLocationFolder}
                emptyFolderHint={
                  openLocationFolderId !== null &&
                  viewLocationFolders.length === 0 &&
                  visibleLocations.length === 0
                    ? "Pasta vazia. Arraste locais até aqui."
                    : undefined
                }
                onDragStart={handleDragStart}
                onDragEnd={handleLocationDragEnd}
                onDragCancel={handleDragCancel}
              >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                    {viewLocationFolders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        count={locationFolderCounts.get(folder.id) ?? 0}
                        suppressClick={suppressClick}
                        onOpen={(target) => setOpenLocationFolderId(target.id)}
                        onRename={renameFolder}
                        onDelete={removeFolder}
                      />
                    ))}
                    {visibleLocations.map((location) => (
                      <LocationCard
                        key={location.id}
                        location={location}
                        childrenByParent={locationChildren}
                        suppressClick={suppressClick}
                        folderDropActive={locationHint.mode === "create"}
                        onView={setViewLocation}
                        onRemove={removeLocation}
                        onNewChild={(parent) =>
                          setLocationDialog({
                            open: true,
                            parentId: parent.id,
                          })
                        }
                      />
                    ))}
                  </ul>
              </WorldFolderBoard>
            )}
          </div>
          ) : null}

          {worldTab === "lore" ? (
          <div className="mt-4 grid gap-3">
            {loreEntries.length === 0 && loreFolders.length === 0 ? (
              <EmptyState
                title="Nenhuma entrada de lore"
                hint="Documente história, mitologia e regras do seu mundo."
              />
            ) : (
              <WorldFolderBoard
                sensors={sensors}
                announcements={announcements}
                hint={loreHint}
                viewIds={viewLoreIds}
                currentFolder={currentLoreFolder}
                onExitFolder={exitLoreFolder}
                emptyFolderHint={
                  openLoreFolderId !== null &&
                  viewLoreFolders.length === 0 &&
                  visibleLoreEntries.length === 0
                    ? "Pasta vazia. Arraste entradas até aqui."
                    : undefined
                }
                onDragStart={handleDragStart}
                onDragEnd={handleLoreDragEnd}
                onDragCancel={handleDragCancel}
              >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                    {viewLoreFolders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        count={loreFolderCounts.get(folder.id) ?? 0}
                        suppressClick={suppressClick}
                        onOpen={(target) => setOpenLoreFolderId(target.id)}
                        onRename={renameFolder}
                        onDelete={removeFolder}
                      />
                    ))}
                    {visibleLoreEntries.map((entry) => (
                      <LoreCard
                        key={entry.id}
                        entry={entry}
                        suppressClick={suppressClick}
                        folderDropActive={loreHint.mode === "create"}
                        onView={setViewLore}
                        onRemove={removeLore}
                      />
                    ))}
                  </ul>
              </WorldFolderBoard>
            )}
          </div>
          ) : null}

          {worldTab === "items" ? (
          <div className="mt-4 grid gap-3">
            {trackableItems.length === 0 && itemFolders.length === 0 ? (
              <EmptyState
                title="Nenhum objeto rastreável"
                hint="Cadastre objetos para acompanhar posse e estado na linha do tempo."
              />
            ) : (
              <WorldFolderBoard
                sensors={sensors}
                announcements={announcements}
                hint={itemHint}
                viewIds={viewItemIds}
                currentFolder={currentItemFolder}
                onExitFolder={exitItemFolder}
                emptyFolderHint={
                  currentItemFolder &&
                  viewItemFolders.length === 0 &&
                  visibleTrackableItems.length === 0
                    ? "Pasta vazia. Arraste objetos até aqui."
                    : undefined
                }
                onDragStart={handleDragStart}
                onDragEnd={handleItemDragEnd}
                onDragCancel={handleDragCancel}
              >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                    {viewItemFolders.map((folder) => (
                      <FolderCard
                        key={folder.id}
                        folder={folder}
                        count={itemFolderCounts.get(folder.id) ?? 0}
                        suppressClick={suppressClick}
                        onOpen={(target) => setOpenItemFolderId(target.id)}
                        onRename={renameFolder}
                        onDelete={removeFolder}
                      />
                    ))}
                    {visibleTrackableItems.map((item) => (
                      <TrackableItemCard
                        key={item.id}
                        item={item}
                        ownerName={
                          characters.find(
                            (character) => character.id === item.initialOwnerId,
                          )?.name ?? "Não definido"
                        }
                        suppressClick={suppressClick}
                        folderDropActive={itemHint.mode === "create"}
                        onEdit={(entry) =>
                          setLoreDialog({ open: true, entry })
                        }
                        onRemove={removeLore}
                      />
                    ))}
                  </ul>
              </WorldFolderBoard>
            )}
          </div>
          ) : null}
        </>
      )}

      <LocationDialog
        open={locationDialog.open}
        onOpenChange={(open) =>
          setLocationDialog((state) => ({ ...state, open }))
        }
        location={locationDialog.location ?? null}
        projectId={projectId}
        locations={locations}
        defaultParentId={locationDialog.parentId ?? null}
      />
      <LoreDialog
        open={loreDialog.open}
        onOpenChange={(open) => setLoreDialog((state) => ({ ...state, open }))}
        entry={loreDialog.entry ?? null}
        projectId={projectId}
        characters={characters}
        locations={locations}
        isTrackableItemDefault={loreDialog.isTrackableItem ?? false}
      />

      <LocationViewDialog
        location={viewLocation}
        locations={locations}
        onEdit={(location) => {
          setViewLocation(null);
          setLocationDialog({ open: true, location });
        }}
        onTrash={(location) => {
          setViewLocation(null);
          void removeLocation(location);
        }}
        onClose={() => setViewLocation(null)}
      />

      <LoreViewDialog
        entry={viewLore}
        onEdit={(entry) => {
          setViewLore(null);
          setLoreDialog({ open: true, entry });
        }}
        onClose={() => setViewLore(null)}
      />
    </div>
  );
}

import {
  LocationCard,
  LoreCard,
  TrackableItemCard,
} from "./world-cards";

