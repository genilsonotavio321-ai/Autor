"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import { plotBeatRepository } from "@/features/plot/infra/dexie-plot-beat-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { timelineEventRepository } from "@/features/plot/infra/dexie-timeline-event-repository";
import { formatDateTime } from "@/shared/lib/dates";
import { playUiSound } from "@/shared/lib/sound";
import type { EntityId } from "@/shared/types/database";
import { ideaCardRepository } from "@/features/creativity/infra/dexie-idea-card-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";

import { restoreProject } from "../application/project-service";
import { emptyTrash, purgeTrashItem } from "../application/trash-service";
import { chapterRepository } from "../infra/dexie-chapter-repository";
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
  /** Permanently deletes one item (with its cascade when applicable). */
  onPurge: (item: TrashItem) => Promise<void>;
  /** Adds a cascade warning to the confirmation dialog (projects/chapters). */
  purgeCascades?: boolean;
}

function TrashSection({
  headingId,
  title,
  items,
  onRestore,
  onPurge,
  purgeCascades = false,
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  aria-label={`Excluir definitivamente ${item.title}`}
                >
                  <Trash2 aria-hidden />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Excluir &quot;{item.title}&quot; definitivamente?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    O item será apagado permanentemente. Isso não pode ser
                    desfeito.
                    {purgeCascades
                      ? " Todo o conteúdo interno também será apagado."
                      : ""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      void onPurge(item).catch(() => {
                        toast.error("Falha ao excluir o item");
                      })
                    }
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
  const deletedChapters = useLiveQuery(
    () => chapterRepository.listDeleted(),
    [],
  );
  const deletedScenes = useLiveQuery(() => sceneRepository.listDeleted(), []);
  const deletedEvents = useLiveQuery(
    () => timelineEventRepository.listDeleted(),
    [],
  );
  const deletedBeats = useLiveQuery(
    () => plotBeatRepository.listDeleted(),
    [],
  );
  const deletedIdeaCards = useLiveQuery(
    () => ideaCardRepository.listDeleted(),
    [],
  );

  const sections = [
    {
      headingId: "trash-projects",
      title: "Projetos",
      items: (deletedProjects ?? []) as TrashItem[],
      purgeCascades: true,
      onRestore: async (item: TrashItem) => {
        await restoreProject(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurado`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("project", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluído permanentemente`);
      },
    },
    {
      headingId: "trash-notes",
      title: "Notas",
      items: (deletedNotes ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await noteRepository.restore(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurada`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("note", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluída permanentemente`);
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
        playUiSound("restore");
        toast.success(`"${item.title}" restaurado`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("character", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluído permanentemente`);
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
        playUiSound("restore");
        toast.success(`"${item.title}" restaurado`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("location", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluído permanentemente`);
      },
    },
    {
      headingId: "trash-lore",
      title: "Entradas de lore",
      items: (deletedLore ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await loreEntryRepository.restore(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurada`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("lore", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluída permanentemente`);
      },
    },
    {
      headingId: "trash-chapters",
      title: "Capítulos",
      items: (deletedChapters ?? []) as TrashItem[],
      purgeCascades: true,
      onRestore: async (item: TrashItem) => {
        await chapterRepository.restore(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurado`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("chapter", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluído permanentemente`);
      },
    },
    {
      headingId: "trash-scenes",
      title: "Cenas",
      items: (deletedScenes ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        // Cenas nunca são apagadas em cascata com o capítulo, mas uma cena
        // órfã de capítulo na lixeira ficaria invisível — restaura o pai junto.
        const scene = await sceneRepository.getById(item.id);
        await sceneRepository.restore(item.id);
        const chapter =
          scene !== undefined
            ? await chapterRepository.getById(scene.chapterId)
            : undefined;
        if (chapter?.deletedAt) {
          await chapterRepository.restore(chapter.id);
          playUiSound("restore");
          toast.success(
            `"${item.title}" restaurada com o capítulo "${chapter.title}"`,
          );
          return;
        }
        playUiSound("restore");
        toast.success(`"${item.title}" restaurada`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("scene", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluída permanentemente`);
      },
    },
    {
      headingId: "trash-timeline-events",
      title: "Eventos (linha do tempo)",
      items: (deletedEvents ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await timelineEventRepository.restore(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurado`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("event", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluído permanentemente`);
      },
    },
    {
      headingId: "trash-beats",
      title: "Beats",
      items: (deletedBeats ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await plotBeatRepository.restore(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurado`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("beat", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluído permanentemente`);
      },
    },
    {
      headingId: "trash-idea-cards",
      title: "Ideias (canvas)",
      items: (deletedIdeaCards ?? []) as TrashItem[],
      onRestore: async (item: TrashItem) => {
        await ideaCardRepository.restore(item.id);
        playUiSound("restore");
        toast.success(`"${item.title}" restaurada`);
      },
      onPurge: async (item: TrashItem) => {
        await purgeTrashItem("ideaCard", item.id);
        playUiSound("delete");
        toast.success(`"${item.title}" excluída permanentemente`);
      },
    },
  ];

  const loading =
    deletedProjects === undefined ||
    deletedNotes === undefined ||
    deletedCharacters === undefined ||
    deletedLocations === undefined ||
    deletedLore === undefined ||
    deletedChapters === undefined ||
    deletedScenes === undefined ||
    deletedEvents === undefined ||
    deletedBeats === undefined ||
    deletedIdeaCards === undefined;
  const empty = sections.every((section) => section.items.length === 0);

  async function handleEmptyTrash() {
    try {
      await emptyTrash();
      toast.success("Lixeira esvaziada");
    } catch {
      toast.error("Falha ao esvaziar a lixeira");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Lixeira</h1>
          <p className="text-sm text-muted-foreground">
            Itens excluídos ficam aqui: restaure-os ou exclua-os
            permanentemente.
          </p>
        </div>
        {!loading && !empty ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 aria-hidden />
                Esvaziar lixeira
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Esvaziar a lixeira?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os itens serão apagados permanentemente, junto com todo
                  o conteúdo interno. Isso não pode ser desfeito.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    playUiSound("warn");
                    void handleEmptyTrash();
                  }}
                >
                  Esvaziar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
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
            onPurge={section.onPurge}
            purgeCascades={section.purgeCascades ?? false}
          />
        ))
      )}
    </div>
  );
}
