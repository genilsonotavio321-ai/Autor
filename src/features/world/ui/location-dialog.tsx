"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { handleDialogEnter } from "@/shared/lib/keyboard";
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
import type { EntityId, Location } from "@/shared/types/database";

import { LOCATION_TYPE_SUGGESTIONS, MAX_LOCATION_DEPTH, locationDepth, locationParentCandidates } from "../domain/repository";
import { renameMentionsInProject } from "@/features/mentions/application/rename-mentions-service";
import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import { locationRepository } from "../infra/dexie-location-repository";

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  projectId: EntityId | null;
  /** Todos os locais do projeto (para escolher a ficha-mãe). */
  locations?: Location[];
  /** Ficha-mãe pré-selecionada ao criar uma subficha. */
  defaultParentId?: EntityId | null;
}

export function LocationDialog({
  open,
  onOpenChange,
  location,
  projectId,
  locations = [],
  defaultParentId = null,
}: LocationDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<EntityId | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(location?.name ?? "");
    setType(location?.type === "Local" ? "" : (location?.type ?? ""));
    setDescription(location?.description ?? "");
    setParentId(location ? (location.parentId ?? null) : defaultParentId);
  }, [open, location, defaultParentId]);

  // Evita ciclos e ultrapassar o máximo de níveis na escolha do pai.
  const parentCandidates = locationParentCandidates(location, locations);

  async function submit() {
    if (!projectId) return;
    // Validação no limite de confiança: nunca gravar além de MAX_LOCATION_DEPTH.
    if (parentId) {
      const byId = new Map(locations.map((item) => [item.id, item]));
      const parent = byId.get(parentId);
      if (parent && locationDepth(parent, byId) >= MAX_LOCATION_DEPTH) {
        toast.error(
          `Hierarquia limitada a ${MAX_LOCATION_DEPTH} níveis: "${parent.name}" já está no nível máximo`,
        );
        return;
      }
    }
    setSaving(true);
    try {
      if (location) {
        const nextName = name.trim() || "Sem nome";
        await locationRepository.update(location.id, {
          name: nextName,
          type: type.trim() || "Local",
          description: description.trim() || undefined,
          parentId,
        });
        // Item 16: renomear a ficha reescreve as menções nos capítulos/cenas.
        let renamed = 0;
        if (location.name !== nextName) {
          try {
            renamed = await renameMentionsInProject(
              location.projectId,
              location.name,
              nextName,
            );
          } catch {
            toast.error("Não foi possível atualizar o nome nos capítulos");
          }
        }
        toast.success(
          renamed > 0
            ? `Local atualizado · ${renamed} ${renamed === 1 ? "trecho" : "trechos"} com o novo nome`
            : "Local atualizado",
        );
      } else {
        await locationRepository.create({
          projectId,
          name: name.trim(),
          type: type.trim() || undefined,
          description: description.trim() || undefined,
          parentId,
        });
        toast.success("Local criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar o local");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
      >
        <DialogHeader>
          <DialogTitle>{location ? "Editar local" : "Novo local"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="loc-name">Nome</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do local"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loc-type">Tipo</Label>
            <Input
              id="loc-type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              placeholder="Cidade, castelo, floresta..."
              list="location-type-suggestions"
            />
            <datalist id="location-type-suggestions">
              {LOCATION_TYPE_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loc-parent">Local pai</Label>
            <Select
              value={parentId ?? "none"}
              onValueChange={(value) =>
                setParentId(value === "none" ? null : value)
              }
            >
              <SelectTrigger id="loc-parent" className="w-full">
                <SelectValue placeholder="Nenhum (primeiro nível)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (primeiro nível)</SelectItem>
                {parentCandidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loc-description">Descrição</Label>
            <Textarea
              id="loc-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Como é esse lugar?"
            />
          </div>
          <ImageAttachments
            entityType="location"
            entityId={location?.id}
            projectId={location?.projectId ?? projectId}
          />
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
