"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { resolveTagColor } from "@/features/tags/domain/repository";
import { tagRepository } from "@/features/tags/infra/dexie-tag-repository";
import type { Character, CharacterRole } from "@/shared/types/database";

import { CHARACTER_ROLE_LABELS } from "../domain/repository";
import { characterRepository } from "../infra/dexie-character-repository";

import { CharacterDialog } from "./character-dialog";

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

  // Open a ficha directly when navigated with ?character=<id> (mentions).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("character");
    if (!id) return;
    setPendingId(id);
    window.history.replaceState({}, "", "/characters");
  }, []);

  useEffect(() => {
    if (!pendingId) return;
    const found = characters.find((character) => character.id === pendingId);
    if (!found) return;
    setDialog({ open: true, character: found });
    setPendingId(null);
  }, [pendingId, characters]);

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

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Personagens</h1>
        <div className="flex items-center gap-2">
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
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((character) => {
            const characterTags = character.tags
              .map((id) => tags.find((tag) => tag.id === id))
              .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
            return (
              <li
                key={character.id}
                className="flex flex-col rounded-lg border bg-card p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-serif text-lg text-primary"
                  >
                    {character.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setDialog({ open: true, character })}
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
                    onClick={() => void remove(character)}
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
                    <Badge key={trait} variant="outline">
                      {trait}
                    </Badge>
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
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: resolveTagColor(tag.color) }}
                        />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(character.updatedAt)}</span>
                  {character.relationships.length > 0 ? (
                    <Badge variant="secondary">
                      {character.relationships.length}{" "}
                      {character.relationships.length === 1
                        ? "relação"
                        : "relações"}
                    </Badge>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

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
