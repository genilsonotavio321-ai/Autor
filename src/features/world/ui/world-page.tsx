"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import type { Location, LoreEntry } from "@/shared/types/database";

import { characterRepository } from "@/features/characters/infra/dexie-character-repository";

import { locationRepository } from "../infra/dexie-location-repository";
import { loreEntryRepository } from "../infra/dexie-lore-entry-repository";

import { LocationDialog } from "./location-dialog";
import { LoreDialog } from "./lore-dialog";

export function WorldPage() {
  const { projectId } = useSelectedProject();
  const liveLocations = useLiveQuery(
    () => (projectId ? locationRepository.listByProject(projectId) : []),
    [projectId],
  );
  const locations = useMemo(() => liveLocations ?? [], [liveLocations]);
  const loreEntries =
    useLiveQuery(
      () => (projectId ? loreEntryRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const characters =
    useLiveQuery(
      () => (projectId ? characterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];

  const [locationDialog, setLocationDialog] = useState<{
    open: boolean;
    location?: Location | null;
  }>({ open: false });
  const [loreDialog, setLoreDialog] = useState<{
    open: boolean;
    entry?: LoreEntry | null;
  }>({ open: false });
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Open a location directly when navigated with ?location=<id> (mentions).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("location");
    if (!id) return;
    setPendingId(id);
    window.history.replaceState({}, "", "/world");
  }, []);

  useEffect(() => {
    if (!pendingId) return;
    const found = locations.find((location) => location.id === pendingId);
    if (!found) return;
    setLocationDialog({ open: true, location: found });
    setPendingId(null);
  }, [pendingId, locations]);

  async function removeLocation(location: Location) {
    await locationRepository.softDelete(location.id);
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
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Mundo</h1>
        <ProjectPicker />
      </header>

      {projectId === null ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Crie um projeto para mapear locais e o lore da sua história.
          </p>
        </div>
      ) : (
        <Tabs defaultValue="locations">
          <TabsList>
            <TabsTrigger value="locations">
              Locais{" "}
              <Badge variant="secondary" className="ml-2">
                {locations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="lore">
              Lore{" "}
              <Badge variant="secondary" className="ml-2">
                {loreEntries.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="locations" className="mt-4 grid gap-4">
            <div className="flex justify-end">
              <Button onClick={() => setLocationDialog({ open: true })}>
                <Plus aria-hidden />
                Novo local
              </Button>
            </div>
            {locations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                Nenhum local ainda. Registre cidades, castelos e paisagens do
                seu universo.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {locations.map((location) => (
                  <li
                    key={location.id}
                    className="flex flex-col rounded-lg border bg-card p-4"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLocationDialog({ open: true, location })
                        }
                        className="min-w-0 flex-1 text-left font-medium hover:underline"
                      >
                        {location.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${location.name}`}
                        onClick={() => void removeLocation(location)}
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
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="lore" className="mt-4 grid gap-4">
            <div className="flex justify-end">
              <Button onClick={() => setLoreDialog({ open: true })}>
                <Plus aria-hidden />
                Nova entrada
              </Button>
            </div>
            {loreEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
                Nenhuma entrada de lore. Documente história, mitologia e regras
                do seu mundo.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {loreEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col rounded-lg border bg-card p-4"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setLoreDialog({ open: true, entry })}
                        className="min-w-0 flex-1 text-left font-medium hover:underline"
                      >
                        {entry.title}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir ${entry.title}`}
                        onClick={() => void removeLore(entry)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-1">
                      <Badge variant="outline">{entry.category}</Badge>
                      {entry.linkedIds.length > 0 ? (
                        <Badge variant="secondary">
                          {entry.linkedIds.length}{" "}
                          {entry.linkedIds.length === 1
                            ? "vínculo"
                            : "vínculos"}
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
                ))}
              </ul>
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
      />
      <LoreDialog
        open={loreDialog.open}
        onOpenChange={(open) => setLoreDialog((state) => ({ ...state, open }))}
        entry={loreDialog.entry ?? null}
        projectId={projectId}
        characters={characters}
        locations={locations}
      />
    </div>
  );
}
