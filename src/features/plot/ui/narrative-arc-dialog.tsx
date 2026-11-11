"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import type { EntityId, NarrativeArc } from "@/shared/types/database";

import { narrativeArcRepository } from "../infra/dexie-narrative-arc-repository";

interface NarrativeArcDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: EntityId | null;
  arc: NarrativeArc | null;
  onSaved?: () => void;
}

export function NarrativeArcDialog({
  open,
  onOpenChange,
  projectId,
  arc,
  onSaved,
}: NarrativeArcDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#64748b");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(arc?.name ?? "");
    setDescription(arc?.description ?? "");
    setColor(arc?.color ?? "#64748b");
  }, [open, arc]);

  async function submit() {
    if (!projectId || !name.trim()) return;
    setSaving(true);
    try {
      if (arc) {
        await narrativeArcRepository.update(arc.id, {
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
        toast.success("Arco atualizado");
      } else {
        await narrativeArcRepository.create({
          projectId,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
        });
        toast.success("Arco criado");
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar o arco");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>{arc ? "Editar arco" : "Novo arco narrativo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="arc-name">Nome</Label>
            <Input
              id="arc-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Ex.: Jornada de Ana"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="arc-description">Descrição</Label>
            <Textarea
              id="arc-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="arc-color">Cor da faixa</Label>
            <Input
              id="arc-color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || !projectId || !name.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
