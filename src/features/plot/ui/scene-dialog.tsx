"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Chapter, EntityId, Scene, SceneStatus } from "@/shared/types/database";

import { SCENE_STATUS_LABELS } from "../domain/repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

import { moveSceneToChapterEnd } from "../application/plot-service";
import { docToSceneBody, sceneBodyToDoc } from "../domain/scene-body";

interface SceneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing scene when provided. */
  scene?: Scene | null;
  chapters: Chapter[];
  /** Pre-selected chapter (create mode from a chapter row). */
  defaultChapterId?: EntityId;
  onSaved?: (scene: Scene) => void;
}

/**
 * Create/edit dialog for scenes (corkboard, kanban and outline all reuse it).
 * Moving to another chapter re-appends the scene at the end of the target.
 */
export function SceneDialog({
  open,
  onOpenChange,
  scene,
  chapters,
  defaultChapterId,
  onSaved,
}: SceneDialogProps) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<SceneStatus>("todo");
  const [chapterId, setChapterId] = useState<EntityId>("");
  const [saving, setSaving] = useState(false);

  // Som de abrir/fechar via transição de estado (externa ao Radix).
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === open) return;
    prevOpen.current = open;
    playUiSound(open ? "open" : "close");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTitle(scene?.title ?? "");
    setSummary(scene?.summary ?? "");
    setBody(scene ? docToSceneBody(scene.content) : "");
    setStatus(scene?.status ?? "todo");
    setChapterId(scene?.chapterId ?? defaultChapterId ?? chapters[0]?.id ?? "");
  }, [open, scene, defaultChapterId, chapters]);

  async function submit() {
    if (!chapterId) return;
    setSaving(true);
    try {
      if (scene) {
        const updated = await sceneRepository.update(scene.id, {
          title: title.trim() || scene.title,
          summary,
          status,
          // Diálogo é o único editor do corpo — salvar sempre grava o texto.
          content: sceneBodyToDoc(body),
        });
        if (chapterId !== scene.chapterId) {
          await moveSceneToChapterEnd(scene.id, chapterId);
        }
        toast.success("Cena atualizada");
        onSaved?.(updated);
      } else {
        const created = await sceneRepository.create({
          chapterId,
          title: title.trim() || undefined,
          summary: summary || undefined,
          status,
          ...(body.trim() ? { content: sceneBodyToDoc(body) } : {}),
        });
        toast.success("Cena criada");
        onSaved?.(created);
      }
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar a cena");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!scene) return;
    await sceneRepository.softDelete(scene.id);
    playUiSound("delete");
    toast(`"${scene.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void sceneRepository.restore(scene.id);
        },
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>{scene ? "Editar cena" : "Nova cena"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="scene-title">Título</Label>
            <Input
              id="scene-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título da cena"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scene-summary">Resumo</Label>
            <Textarea
              id="scene-summary"
              className="max-h-32"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="O que acontece nesta cena?"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="scene-body">Corpo da cena</Label>
            <Textarea
              id="scene-body"
              // field-sizing-content cresce sem limite; o teto mantém o footer visível.
              className="max-h-[50dvh]"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Texto completo da cena — aparece no modo leitura. Uma linha equivale a um parágrafo."
              rows={8}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as SceneStatus)}
              >
                <SelectTrigger aria-label="Status da cena">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SCENE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Capítulo</Label>
              <Select
                value={chapterId}
                onValueChange={(value) => setChapterId(value)}
              >
                <SelectTrigger aria-label="Capítulo da cena">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {scene ? (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => void remove()}
              >
                <Trash2 aria-hidden />
                Excluir
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()} disabled={saving || !chapterId}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
