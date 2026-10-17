"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import { formatDateTime } from "@/shared/lib/dates";
import type { EntityId } from "@/shared/types/database";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";

import { restoreProject } from "../application/project-service";
import { projectRepository } from "../infra/dexie-project-repository";

interface TrashItem {
  id: EntityId;
  title: string;
  deletedAt?: string;
}

interface TrashSectionProps {
  headingId: string;
  title: string;
  items: TrashItem[];
  onRestore: (item: TrashItem) => void | Promise<void>;
}

function TrashSection({
  headingId,
  title,
  items,
  onRestore,
}: TrashSectionProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="text-sm font-medium">
        {title}
      </h2>
      <ul className="divide-y rounded-lg border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                excluído em {formatDateTime(item.deletedAt ?? "")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onRestore(item)}
            >
              <RotateCcw aria-hidden />
              Restaurar
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrashPage() {
  const deletedProjects = useLiveQuery(
    () => projectRepository.listDeleted(),
    [],
  );
  const deletedNotes = useLiveQuery(() => noteRepository.listDeleted(), []);
  const deletedCharacters = useLiveQuery(
    () => characterRepository.listDeleted(),
    [],
  );
  const deletedLocations = useLiveQuery(
    () => locationRepository.listDeleted(),
    [],
  );
  const deletedLore = useLiveQuery(
    () => loreEntryRepository.listDeleted(),
    [],
  );

  const sections = [
    {
      headingId: "trash-projects",
      title: "Projetos",
      items: (deletedProjects ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await restoreProject(item.id);
        toast.success(`"${item.title}" restaurado`);
      },
    },
    {
      headingId: "trash-notes",
      title: "Notas",
      items: (deletedNotes ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await noteRepository.restore(item.id);
        toast.success(`"${item.title}" restaurada`);
      },
    },
    {
      headingId: "trash-characters",
      title: "Personagens",
      items: (deletedCharacters ?? []).map((character) => ({
        id: character.id,
        title: character.name,
        deletedAt: character.deletedAt,
      })),
      onRestore: async (item: TrashItem) => {
        await characterRepository.restore(item.id);
        toast.success(`"${item.title}" restaurado`);
      },
    },
    {
      headingId: "trash-locations",
      title: "Locais",
      items: (deletedLocations ?? []).map((location) => ({
        id: location.id,
        title: location.name,
        deletedAt: location.deletedAt,
      })),
      onRestore: async (item: TrashItem) => {
        await locationRepository.restore(item.id);
        toast.success(`"${item.title}" restaurado`);
      },
    },
    {
      headingId: "trash-lore",
      title: "Entradas de lore",
      items: (deletedLore ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await loreEntryRepository.restore(item.id);
        toast.success(`"${item.title}" restaurada`);
      },
    },
  ];

  const loading =
    deletedProjects === undefined ||
    deletedNotes === undefined ||
    deletedCharacters === undefined ||
    deletedLocations === undefined ||
    deletedLore === undefined;
  const empty = sections.every((section) => section.items.length === 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Lixeira</h1>
        <p className="text-sm text-muted-foreground">
          Itens excluídos ficam aqui e podem ser restaurados.
        </p>
      </header>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : empty ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          A lixeira está vazia.
        </div>
      ) : (
        sections.map((section) => (
          <TrashSection
            key={section.headingId}
            headingId={section.headingId}
            title={section.title}
            items={section.items}
            onRestore={section.onRestore}
          />
        ))
      )}
    </div>
  );
}
