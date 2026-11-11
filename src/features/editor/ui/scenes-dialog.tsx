"use client";

import { ListTree, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MentionEntity } from "@/features/mentions/domain/entity-index";
import { SCENE_STATUS_LABELS } from "@/features/plot/domain/repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { ReadingDocument } from "@/features/read/ui/reading-document";
import type { Json, Scene } from "@/shared/types/database";

const NO_SCENES: Scene[] = [];

/** O corpo da cena nasce como EMPTY_SCENE_DOC: só renderiza prosa se sobrou algo. */
function sceneHasBody(content: Json): boolean {
  const nodes = (content as { content?: unknown[] } | null)?.content;
  if (!Array.isArray(nodes)) return false;
  return nodes.some(
    (node) =>
      Array.isArray((node as { content?: unknown[] }).content) ||
      ((node as { type?: string }).type ?? "paragraph") !== "paragraph",
  );
}

/** Lista/ler cenas do capítulo sem sair do editor (plano fase 2). */
export function ScenesDialog({
  open,
  onOpenChange,
  chapterId,
  mentions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  mentions?: MentionEntity[];
}) {
  const router = useRouter();
  const scenes =
    useLiveQuery(() => sceneRepository.listByChapter(chapterId), [
      chapterId,
    ]) ?? NO_SCENES;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scenes.find((scene) => scene.id === selectedId) ?? null;

  function nameOf(id?: string) {
    return id ? mentions?.find((mention) => mention.id === id)?.name : undefined;
  }

  const povName = nameOf(selected?.povCharacterId);
  const locationName = nameOf(selected?.locationId);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedId(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selected ? selected.title : "Cenas do capítulo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Leia as cenas do capítulo sem sair do editor.
          </DialogDescription>
        </DialogHeader>
        {selected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Status: {SCENE_STATUS_LABELS[selected.status]}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  router.push(`/outline?scene=${selected.id}`);
                }}
              >
                <Pencil aria-hidden className="size-3.5" />
                Editar
              </Button>
            </div>
            {selected.summary ? (
              <p className="text-sm text-muted-foreground">
                {selected.summary}
              </p>
            ) : null}
            {povName ? (
              <p className="text-xs text-muted-foreground">POV: {povName}</p>
            ) : null}
            {locationName ? (
              <p className="text-xs text-muted-foreground">
                Local: {locationName}
              </p>
            ) : null}
            {sceneHasBody(selected.content) ? (
              <div className="max-h-[50vh] overflow-y-auto">
                <ReadingDocument content={selected.content} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem texto no corpo da cena.
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedId(null)}
            >
              <ListTree aria-hidden className="size-3.5" />
              Voltar à lista
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma cena neste capítulo ainda.
              </p>
            ) : (
              scenes.map((scene) => (
                <Button
                  key={scene.id}
                  variant="ghost"
                  className="w-full justify-between"
                  onClick={() => setSelectedId(scene.id)}
                >
                  <span>
                    {scene.order}. {scene.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {SCENE_STATUS_LABELS[scene.status]}
                  </span>
                </Button>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
