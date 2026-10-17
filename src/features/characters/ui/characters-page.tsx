"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import type { Character } from "@/shared/types/database";

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

export function CharactersPage() {
  const { projectId } = useSelectedProject();
  const characters =
    useLiveQuery(
      () => (projectId ? characterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const [dialog, setDialog] = useState<{
    open: boolean;
    character?: Character | null;
  }>({ open: false });

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
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
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
          ))}
        </ul>
      )}

      <CharacterDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        character={dialog.character ?? null}
        projectId={projectId}
        characters={characters}
      />
    </div>
  );
}
