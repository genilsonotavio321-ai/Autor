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
import type { Character, EntityId, Location, LoreEntry } from "@/shared/types/database";

import { loreEntryRepository } from "../infra/dexie-lore-entry-repository";

interface LoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LoreEntry | null;
  projectId: EntityId | null;
  characters: Character[];
  locations: Location[];
}

export function LoreDialog({
  open,
  onOpenChange,
  entry,
  projectId,
  characters,
  locations,
}: LoreDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [linkedIds, setLinkedIds] = useState<EntityId[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(entry?.title === "Sem título" ? "" : (entry?.title ?? ""));
    setCategory(entry?.category === "Geral" ? "" : (entry?.category ?? ""));
    setContent(typeof entry?.content === "string" ? entry.content : "");
    setLinkedIds(entry?.linkedIds ?? []);
  }, [open, entry]);

  function toggleLinked(id: EntityId) {
    setLinkedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  async function submit() {
    if (!projectId) return;
    setSaving(true);
    try {
      if (entry) {
        await loreEntryRepository.update(entry.id, {
          title: title.trim() || "Sem título",
          category: category.trim() || "Geral",
          content,
          linkedIds,
        });
        toast.success("Entrada atualizada");
      } else {
        await loreEntryRepository.create({
          projectId,
          title: title.trim(),
          category: category.trim() || undefined,
          content,
          linkedIds,
        });
        toast.success("Entrada criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar a entrada de lore");
    } finally {
      setSaving(false);
    }
  }

  const hasLinks = characters.length > 0 || locations.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar entrada" : "Nova entrada de lore"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="lore-title">Título</Label>
            <Input
              id="lore-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: A Coroa Antiga"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lore-category">Categoria</Label>
            <Input
              id="lore-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Ex.: História, Mitologia, Política"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lore-content">Conteúdo</Label>
            <Textarea
              id="lore-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              placeholder="Escreva sobre essa entrada do universo da história..."
            />
          </div>
          {hasLinks ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Vincular a</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {characters.length > 0 ? (
                  <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Personagens</p>
                    {characters.map((character) => (
                      <label
                        key={character.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={linkedIds.includes(character.id)}
                          onChange={() => toggleLinked(character.id)}
                          className="size-4 accent-primary"
                        />
                        {character.name}
                      </label>
                    ))}
                  </div>
                ) : null}
                {locations.length > 0 ? (
                  <div className="grid gap-1">
                    <p className="text-xs text-muted-foreground">Locais</p>
                    {locations.map((location) => (
                      <label
                        key={location.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={linkedIds.includes(location.id)}
                          onChange={() => toggleLinked(location.id)}
                          className="size-4 accent-primary"
                        />
                        {location.name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </fieldset>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
