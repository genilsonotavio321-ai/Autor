"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/shared/lib/dates";
import { playUiSound } from "@/shared/lib/sound";
import { EntityViewDialog } from "@/shared/ui/entity-view-dialog";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import type { EntityId, Location, LoreEntry } from "@/shared/types/database";

import { characterRepository } from "@/features/characters/infra/dexie-character-repository";

import { locationRepository } from "../infra/dexie-location-repository";
import { loreEntryRepository } from "../infra/dexie-lore-entry-repository";
import { MAX_LOCATION_DEPTH } from "../domain/repository";

import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import { LocationDialog } from "./location-dialog";
import { LoreDialog } from "./lore-dialog";

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
  const loreEntries = useMemo(() => liveLoreEntries ?? [], [liveLoreEntries]);
  const characters =
    useLiveQuery(
      () => (projectId ? characterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];

  const [locationDialog, setLocationDialog] = useState<{
    open: boolean;
    location?: Location | null;
    parentId?: EntityId | null;
  }>({ open: false });
  const [loreDialog, setLoreDialog] = useState<{
    open: boolean;
    entry?: LoreEntry | null;
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
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const titlesById = useMemo(() => {
    const map = new Map<UniqueIdentifier, string>();
    for (const location of locations) map.set(location.id, location.name);
    for (const entry of loreEntries) map.set(entry.id, entry.title);
    return map;
  }, [locations, loreEntries]);

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
    const found = loreEntries.find((entry) => entry.id === pendingLoreId);
    if (!found) return;
    setWorldTab("lore");
    if (pendingView) setViewLore(found);
    else setLoreDialog({ open: true, entry: found });
    setPendingLoreId(null);
  }, [pendingLoreId, pendingView, loreEntries]);

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
    const ids = topLevelLocations.map((location) => location.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    void locationRepository
      .applyMoves(reordered.map((id, order) => ({ id, order })))
      .catch(() => toast.error("Falha ao reordenar"));
  }

  function handleLoreDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = loreEntries.map((entry) => entry.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    void loreEntryRepository
      .applyMoves(reordered.map((id, order) => ({ id, order })))
      .catch(() => toast.error("Falha ao reordenar"));
  }

  async function removeLocation(location: Location) {
    await locationRepository.softDelete(location.id);
    playUiSound("delete");
    toast(`"${location.name}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void locationRepository.restore(location.id);
        },
      },
    });
  }

  async function removeLore(entry: LoreEntry) {
    await loreEntryRepository.softDelete(entry.id);
    playUiSound("delete");
    toast(`"${entry.title}" movida para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void loreEntryRepository.restore(entry.id);
        },
      },
    });
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Mundo"
        count={
          locations.length + loreEntries.length > 0
            ? `${locations.length} ${locations.length === 1 ? "local" : "locais"} · ${loreEntries.length} ${loreEntries.length === 1 ? "entrada" : "entradas"}`
            : undefined
        }
      >
        {projectId !== null ? (
          worldTab === "locations" ? (
            <Button onClick={() => setLocationDialog({ open: true })}>
              <Plus aria-hidden />
              Novo local
            </Button>
          ) : (
            <Button onClick={() => setLoreDialog({ open: true })}>
              <Plus aria-hidden />
              Nova entrada
            </Button>
          )
        ) : null}
      </PageHeader>

      {projectId === null ? (
        <EmptyState className="p-10">
          <p>Crie um projeto para mapear locais e o lore da sua história.</p>
        </EmptyState>
      ) : (
        <Tabs value={worldTab} onValueChange={setWorldTab}>
          <TabsList>
            <TabsTrigger value="locations">Locais</TabsTrigger>
            <TabsTrigger value="lore">Lore</TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="mt-4 grid gap-4">
            {locations.length === 0 ? (
              <EmptyState>
                Nenhum local ainda. Registre cidades, castelos e paisagens do
                seu universo.
              </EmptyState>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{ announcements }}
                onDragStart={handleDragStart}
                onDragEnd={handleLocationDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={topLevelLocations.map((location) => location.id)}
                  strategy={rectSortingStrategy}
                >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                    {topLevelLocations.map((location) => (
                      <LocationCard
                        key={location.id}
                        location={location}
                        childrenByParent={locationChildren}
                        suppressClick={suppressClick}
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
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="lore" className="mt-4 grid gap-4">
            {loreEntries.length === 0 ? (
              <EmptyState>
                Nenhuma entrada de lore. Documente história, mitologia e regras
                do seu mundo.
              </EmptyState>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{ announcements }}
                onDragStart={handleDragStart}
                onDragEnd={handleLoreDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext
                  items={loreEntries.map((entry) => entry.id)}
                  strategy={rectSortingStrategy}
                >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                    {loreEntries.map((entry) => (
                      <LoreCard
                        key={entry.id}
                        entry={entry}
                        suppressClick={suppressClick}
                        onView={setViewLore}
                        onRemove={removeLore}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>
        </Tabs>
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
      />

      <EntityViewDialog
        open={viewLocation !== null}
        title={viewLocation?.name ?? ""}
        subtitle={
          viewLocation
            ? `Atualizado ${formatRelativeTime(viewLocation.updatedAt)}`
            : undefined
        }
        sections={
          viewLocation
            ? [
                { label: "Tipo", value: viewLocation.type },
                {
                  label: "Ficha-mãe",
                  value:
                    locations.find(
                      (item) => item.id === viewLocation.parentId,
                    )?.name ?? "",
                },
                { label: "Descrição", value: viewLocation.description ?? "" },
              ].filter((section) => section.value.length > 0)
            : []
        }
        onEdit={() => {
          if (!viewLocation) return;
          const location = viewLocation;
          setViewLocation(null);
          setLocationDialog({ open: true, location });
        }}
        onTrash={() => {
          if (!viewLocation) return;
          const location = viewLocation;
          setViewLocation(null);
          void removeLocation(location);
        }}
        onOpenChange={(open) => {
          if (!open) setViewLocation(null);
        }}
        gallery={
          <ImageAttachments
            readOnly
            entityType="location"
            entityId={viewLocation?.id}
          />
        }
      />

      <EntityViewDialog
        open={viewLore !== null}
        title={viewLore?.title ?? ""}
        subtitle={
          viewLore ? `Atualizada ${formatRelativeTime(viewLore.updatedAt)}` : undefined
        }
        sections={
          viewLore
            ? [
                { label: "Categoria", value: viewLore.category },
                {
                  label: "Conteúdo",
                  value:
                    typeof viewLore.content === "string" ? viewLore.content : "",
                },
              ].filter((section) => section.value.length > 0)
            : []
        }
        onEdit={() => {
          if (!viewLore) return;
          const entry = viewLore;
          setViewLore(null);
          setLoreDialog({ open: true, entry });
        }}
        onOpenChange={(open) => {
          if (!open) setViewLore(null);
        }}
        gallery={
          <ImageAttachments
            readOnly
            entityType="lore"
            entityId={viewLore?.id}
          />
        }
      />
    </div>
  );
}

interface LocationCardProps {
  location: Location;
  /** Filhos por ficha-mãe (item 7) — usados na renderização recursiva. */
  childrenByParent: Map<EntityId, Location[]>;
  suppressClick: RefObject<boolean>;
  onView: (location: Location) => void;
  onRemove: (location: Location) => void;
  onNewChild: (location: Location) => void;
}

function LocationCard({
  location,
  childrenByParent,
  suppressClick,
  onView,
  onRemove,
  onNewChild,
}: LocationCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: location.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function openView() {
    if (suppressClick.current) return;
    onView(location);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      {...attributes}
      {...listeners}
      onClick={openView}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openView();
        }
      }}
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onView(location);
          }}
          className="min-w-0 flex-1 text-left font-medium hover:underline"
        >
          {location.name}
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Nova subficha em ${location.name}`}
          title="Nova subficha"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onNewChild(location);
          }}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${location.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(location);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <Badge variant="outline" className="mb-2 w-fit">
        {location.type}
      </Badge>
      {location.description ? (
        <p className="line-clamp-3 flex-1 text-sm text-muted-foreground">
          {location.description}
        </p>
      ) : (
        <p className="flex-1 text-sm italic text-muted-foreground/60">
          Sem descrição
        </p>
      )}
      <span className="mt-2 text-xs text-muted-foreground">
        atualizado {formatRelativeTime(location.updatedAt)}
      </span>
      {childrenByParent.get(location.id) ? (
        <ul className="mt-3 flex flex-col gap-1 border-l-2 border-border pl-3">
          {(childrenByParent.get(location.id) ?? []).map((child) => (
            <LocationChildRow
              key={child.id}
              location={child}
              depth={2}
              childrenByParent={childrenByParent}
              suppressClick={suppressClick}
              onView={onView}
              onRemove={onRemove}
              onNewChild={onNewChild}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

interface LocationChildRowProps {
  location: Location;
  /** Nível da ficha na hierarquia (raiz = 1). */
  depth: number;
  childrenByParent: Map<EntityId, Location[]>;
  suppressClick: RefObject<boolean>;
  onView: (location: Location) => void;
  onRemove: (location: Location) => void;
  onNewChild: (location: Location) => void;
}

/**
 * Linha de subficha (display-only, sem dnd) com os filhos aninhados
 * recursivamente até MAX_LOCATION_DEPTH. Cada pai tem um único parentId,
 * então a travessia a partir de fichas de primeiro nível é uma árvore.
 */
function LocationChildRow({
  location,
  depth,
  childrenByParent,
  suppressClick,
  onView,
  onRemove,
  onNewChild,
}: LocationChildRowProps) {
  const children = childrenByParent.get(location.id) ?? [];
  const stop = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <li>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={stop}
          onClick={(event) => {
            stop(event);
            if (suppressClick.current) return;
            onView(location);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:underline"
        >
          <span className="truncate">{location.name}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {location.type}
          </span>
        </button>
        {depth < MAX_LOCATION_DEPTH ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Nova subficha em ${location.name}`}
            title="Nova subficha"
            onPointerDown={stop}
            onClick={(event) => {
              stop(event);
              onNewChild(location);
            }}
          >
            <Plus aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {depth > MAX_LOCATION_DEPTH ? (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
          Acima do limite de {MAX_LOCATION_DEPTH} níveis — não é possível criar
          novas subfichas aqui.
        </p>
      ) : null}
      {children.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1 border-l-2 border-border pl-3">
          {children.map((child) => (
            <LocationChildRow
              key={child.id}
              location={child}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              suppressClick={suppressClick}
              onView={onView}
              onRemove={onRemove}
              onNewChild={onNewChild}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

interface LoreCardProps {
  entry: LoreEntry;
  suppressClick: RefObject<boolean>;
  onView: (entry: LoreEntry) => void;
  onRemove: (entry: LoreEntry) => void;
}

function LoreCard({ entry, suppressClick, onView, onRemove }: LoreCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function openView() {
    if (suppressClick.current) return;
    onView(entry);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      {...attributes}
      {...listeners}
      onClick={openView}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openView();
        }
      }}
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onView(entry);
          }}
          className="min-w-0 flex-1 text-left font-medium hover:underline"
        >
          {entry.title}
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${entry.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(entry);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <Badge variant="outline">{entry.category}</Badge>
        {entry.linkedIds.length > 0 ? (
          <Badge variant="secondary">
            {entry.linkedIds.length}{" "}
            {entry.linkedIds.length === 1 ? "vínculo" : "vínculos"}
          </Badge>
        ) : null}
      </div>
      {typeof entry.content === "string" && entry.content ? (
        <p className="line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {entry.content}
        </p>
      ) : (
        <p className="flex-1 text-sm italic text-muted-foreground/60">
          Sem conteúdo
        </p>
      )}
      <span className="mt-2 text-xs text-muted-foreground">
        atualizada {formatRelativeTime(entry.updatedAt)}
      </span>
    </li>
  );
}
