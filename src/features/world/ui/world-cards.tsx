import type { RefObject } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/shared/lib/dates";
import { dragOpacity, useCardSortable } from "@/shared/lib/sortable";
import type { EntityId, Location, LoreEntry } from "@/shared/types/database";

import { MAX_LOCATION_DEPTH } from "../domain/repository";

export interface LocationCardProps {
  location: Location;
  /** Filhos por ficha-mãe (item 7) — usados na renderização recursiva. */
  childrenByParent: Map<EntityId, Location[]>;
  suppressClick: RefObject<boolean>;
  /** A drop no centro deste card criaria uma pasta (ring + aviso visível). */
  folderDropActive: boolean;
  onView: (location: Location) => void;
  onRemove: (location: Location) => void;
  onNewChild: (location: Location) => void;
}

interface DragCardProps {
  id: EntityId;
  folderDropActive: boolean;
  title: string;
  onOpen: () => void;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Casca comum dos cards arrastáveis do mundo: sortable, abertura por clique
 * ou teclado e o realce de "drop no centro cria pasta".
 */
function DragCard({
  id,
  folderDropActive,
  title,
  onOpen,
  actions,
  className = "",
  children,
}: DragCardProps) {
  const { setNodeRef, dragProps, style, isDragging, isOver } =
    useCardSortable(id);
  const highlight = isOver && folderDropActive;

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      {...dragProps}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${dragOpacity(
        isDragging,
      )} ${highlight ? "ring-2 ring-primary bg-primary/5" : ""} ${className}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="min-w-0 flex-1 text-left font-medium hover:underline"
        >
          {title}
        </button>
        {actions}
      </div>
      {children}
    </li>
  );
}

function DangerButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Trash2 aria-hidden />
    </Button>
  );
}

export function LocationCard({
  location,
  childrenByParent,
  suppressClick,
  folderDropActive,
  onView,
  onRemove,
  onNewChild,
}: LocationCardProps) {
  const children = childrenByParent.get(location.id);

  function openView() {
    if (suppressClick.current) return;
    onView(location);
  }

  return (
    <DragCard
      id={location.id}
      folderDropActive={folderDropActive}
      title={location.name}
      onOpen={openView}
      actions={
        <>
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
          <DangerButton
            label={`Excluir ${location.name}`}
            onClick={() => onRemove(location)}
          />
        </>
      }
    >
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
      {children ? (
        <ul className="mt-3 flex flex-col gap-1 border-l-2 border-border pl-3">
          {children.map((child) => (
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
    </DragCard>
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
  /** A drop no centro deste card criaria uma pasta (ring + aviso visível). */
  folderDropActive: boolean;
  onView: (entry: LoreEntry) => void;
  onRemove: (entry: LoreEntry) => void;
}

export function LoreCard({
  entry,
  suppressClick,
  folderDropActive,
  onView,
  onRemove,
}: LoreCardProps) {
  function openView() {
    if (suppressClick.current) return;
    onView(entry);
  }

  return (
    <DragCard
      id={entry.id}
      folderDropActive={folderDropActive}
      title={entry.title}
      onOpen={openView}
      actions={
        <DangerButton
          label={`Excluir ${entry.title}`}
          onClick={() => onRemove(entry)}
        />
      }
    >
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
    </DragCard>
  );
}

interface TrackableItemCardProps {
  item: LoreEntry;
  ownerName: string;
  suppressClick: RefObject<boolean>;
  folderDropActive: boolean;
  onEdit: (item: LoreEntry) => void;
  onRemove: (item: LoreEntry) => void;
}

export function TrackableItemCard({
  item,
  ownerName,
  suppressClick,
  folderDropActive,
  onEdit,
  onRemove,
}: TrackableItemCardProps) {
  function edit() {
    if (suppressClick.current) return;
    onEdit(item);
  }

  return (
    <DragCard
      id={item.id}
      folderDropActive={folderDropActive}
      title={item.title}
      onOpen={edit}
      actions={
        <DangerButton
          label={`Excluir ${item.title}`}
          onClick={() => onRemove(item)}
        />
      }
    >
      {typeof item.content === "string" && item.content ? (
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {item.content}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Possuidor inicial: {ownerName}
      </p>
    </DragCard>
  );
}
