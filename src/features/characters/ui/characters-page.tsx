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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/shared/lib/dates";
import { EntityViewDialog } from "@/shared/ui/entity-view-dialog";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { resolveTagColor } from "@/features/tags/domain/repository";
import { tagRepository } from "@/features/tags/infra/dexie-tag-repository";
import type { Character, CharacterRole, Tag } from "@/shared/types/database";

import { CHARACTER_ROLE_LABELS } from "../domain/repository";
import { characterRepository } from "../infra/dexie-character-repository";

import { CharacterDialog } from "./character-dialog";
import { buildCharacterSections } from "./character-sections";

const ROLE_BADGE_VARIANT: Record<
  Character["role"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  protagonist: "default",
  antagonist: "destructive",
  supporting: "secondary",
  minor: "outline",
};

const ALL = "all";

export function CharactersPage() {
  const { projectId } = useSelectedProject();
  const liveCharacters = useLiveQuery(
    () => (projectId ? characterRepository.listByProject(projectId) : []),
    [projectId],
  );
  const characters = useMemo(() => liveCharacters ?? [], [liveCharacters]);
  const tags =
    useLiveQuery(
      () => (projectId ? tagRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const [roleFilter, setRoleFilter] = useState<CharacterRole | typeof ALL>(ALL);
  const [tagFilter, setTagFilter] = useState<string>(ALL);
  const [dialog, setDialog] = useState<{
    open: boolean;
    character?: Character | null;
  }>({ open: false });
  const [pendingId, setPendingId] = useState<string | null>(null);
  // `?character=<id>&view=1` (search) opens the read-only view instead of the form.
  const [pendingView, setPendingView] = useState(false);
  const [viewCharacter, setViewCharacter] = useState<Character | null>(null);
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
    for (const character of characters) map.set(character.id, character.name);
    return map;
  }, [characters]);

  const announcements = useMemo<Announcements>(() => {
    const labelFor = (id: UniqueIdentifier) => titlesById.get(id) ?? "personagem";
    return {
      onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragEnd: ({ over }) =>
        over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragCancel: () => "Arraste cancelado.",
    };
  }, [titlesById]);

  // Open a ficha directly when navigated with ?character=<id> (mentions).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("character");
    if (!id) return;
    setPendingId(id);
    setPendingView(params.get("view") === "1");
    window.history.replaceState({}, "", "/characters");
  }, []);

  useEffect(() => {
    if (!pendingId) return;
    const found = characters.find((character) => character.id === pendingId);
    if (!found) return;
    if (pendingView) setViewCharacter(found);
    else setDialog({ open: true, character: found });
    setPendingId(null);
  }, [pendingId, pendingView, characters]);

  const visible = characters.filter(
    (character) =>
      (roleFilter === ALL || character.role === roleFilter) &&
      (tagFilter === ALL || character.tags.includes(tagFilter)),
  );

  async function remove(character: Character) {
    await characterRepository.softDelete(character.id);
    toast(`"${character.name}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void characterRepository.restore(character.id);
        },
      },
    });
  }

  function handleDragStart() {
    suppressClick.current = true;
  }

  function handleDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visible.map((character) => character.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    void characterRepository
      .applyMoves(reordered.map((id, order) => ({ id, order })))
      .catch(() => toast.error("Falha ao reordenar"));
  }

  function handleDragCancel() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  function editCharacter(character: Character) {
    setViewCharacter(null);
    setDialog({ open: true, character });
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Personagens</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectPicker />
          <Button onClick={() => setDialog({ open: true })} disabled={!projectId}>
            <Plus aria-hidden />
            Novo personagem
          </Button>
        </div>
      </header>

      {projectId !== null && characters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={roleFilter}
            onValueChange={(value) =>
              setRoleFilter(value as CharacterRole | typeof ALL)
            }
          >
            <SelectTrigger className="h-9 w-40" aria-label="Filtrar por papel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os papéis</SelectItem>
              {Object.entries(CHARACTER_ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tags.length > 0 ? (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-9 w-40" aria-label="Filtrar por tag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {visible.length} de {characters.length}
          </span>
        </div>
      ) : null}

      {projectId === null ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Crie um projeto para cadastrar seus personagens.
          </p>
        </div>
      ) : characters.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum personagem ainda. Registre protagonistas, antagonistas e
          personagens de apoio com seus objetivos e relações.
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhum personagem corresponde aos filtros.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={visible.map((character) => character.id)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {visible.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  tags={tags}
                  suppressClick={suppressClick}
                  onView={setViewCharacter}
                  onRemove={remove}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <EntityViewDialog
        open={viewCharacter !== null}
        title={viewCharacter?.name ?? ""}
        subtitle={
          viewCharacter
            ? `Atualizado ${formatRelativeTime(viewCharacter.updatedAt)}`
            : undefined
        }
        sections={
          viewCharacter
            ? buildCharacterSections(viewCharacter, { characters, tags })
            : []
        }
        onEdit={() => {
          if (viewCharacter) editCharacter(viewCharacter);
        }}
        onOpenChange={(open) => {
          if (!open) setViewCharacter(null);
        }}
      />

      <CharacterDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        character={dialog.character ?? null}
        projectId={projectId}
        characters={characters}
        tags={tags}
      />
    </div>
  );
}

interface CharacterCardProps {
  character: Character;
  tags: Tag[];
  suppressClick: RefObject<boolean>;
  onView: (character: Character) => void;
  onRemove: (character: Character) => void;
}

function CharacterCard({
  character,
  tags,
  suppressClick,
  onView,
  onRemove,
}: CharacterCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: character.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const characterTags = character.tags
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));

  function openView() {
    if (suppressClick.current) return;
    onView(character);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
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
      className={`flex cursor-pointer touch-none select-none flex-col rounded-lg border bg-card p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-4 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="mb-2 flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-lg text-primary sm:size-10"
        >
          {character.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onView(character);
            }}
            className="block truncate text-left font-medium hover:underline"
          >
            {character.name}
          </button>
          <Badge variant={ROLE_BADGE_VARIANT[character.role]}>
            {CHARACTER_ROLE_LABELS[character.role]}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${character.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove(character);
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {character.description ? (
        <p className="mb-3 line-clamp-2 flex-1 text-sm text-muted-foreground">
          {character.description}
        </p>
      ) : (
        <p className="mb-3 flex-1 text-sm italic text-muted-foreground/60">
          Sem descrição
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {character.traits.slice(0, 3).map((trait) => (
          <span
            key={trait}
            className="inline-block max-w-full truncate rounded-md border px-2 py-0.5 text-xs text-muted-foreground"
          >
            {trait}
          </span>
        ))}
        {character.traits.length > 3 ? (
          <span className="text-xs text-muted-foreground">
            +{character.traits.length - 3}
          </span>
        ) : null}
      </div>
      {characterTags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {characterTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: resolveTagColor(tag.color) }}
              />
              <span className="truncate">{tag.name}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{formatRelativeTime(character.updatedAt)}</span>
        {character.relationships.length > 0 ? (
          <Badge variant="secondary">
            {character.relationships.length}{" "}
            {character.relationships.length === 1 ? "relação" : "relações"}
          </Badge>
        ) : null}
      </div>
    </li>
  );
}
