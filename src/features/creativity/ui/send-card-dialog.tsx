"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import type { Chapter, IdeaCard } from "@/shared/types/database";

import { sendSceneToOutline } from "../application/send-to-outline";
import { ideaCardRepository } from "../infra/dexie-idea-card-repository";

interface SendCardDialogProps {
  card: IdeaCard | null;
  chapters: Chapter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Transforma o card em cena: escolhe o capítulo e envia para a Estrutura. */
export function SendCardDialog({
  card,
  chapters,
  open,
  onOpenChange,
}: SendCardDialogProps) {
  const [chapterId, setChapterId] = useState("");
  const [sending, setSending] = useState(false);
  const submitRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setChapterId(chapters[0]?.id ?? "");
  }, [open, chapters]);

  async function submit() {
    if (!card || !chapterId) return;
    setSending(true);
    try {
      const scene = await sendSceneToOutline({
        chapterId,
        title: card.title,
        summary: card.content || undefined,
      });
      await ideaCardRepository.update(card.id, { sentSceneId: scene.id });
      onOpenChange(false);
    } catch {
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          // Foco no botão de criar: Enter nativo nele submete.
          event.preventDefault();
          submitRef.current?.focus();
        }}
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>Transformar em cena</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            A ideia será enviada como cena para o capítulo escolhido na
            Estrutura.
          </p>
          <div className="grid gap-2">
            <Label>Capítulo</Label>
            <Select value={chapterId} onValueChange={setChapterId}>
              <SelectTrigger aria-label="Capítulo destino">
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            ref={submitRef}
            onClick={() => void submit()}
            disabled={sending || !chapterId}
          >
            Criar cena
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
