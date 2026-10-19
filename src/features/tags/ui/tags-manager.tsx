"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntityId, Tag } from "@/shared/types/database";

import {
  DEFAULT_TAG_COLOR,
  resolveTagColor,
  TAG_COLOR_PALETTE,
} from "../domain/repository";
import { tagRepository } from "../infra/dexie-tag-repository";

export function TagsManager({ projectId }: { projectId: EntityId | null }) {
  const tags =
    useLiveQuery(
      () => (projectId ? tagRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR);

  async function create() {
    if (!projectId) return;
    if (!name.trim()) {
      toast.error("Dê um nome à tag.");
      return;
    }
    try {
      await tagRepository.create({ projectId, name, color });
      setName("");
      toast.success("Tag criada");
    } catch {
      toast.error("Falha ao criar a tag");
    }
  }

  if (projectId === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Selecione um projeto para gerenciar suas tags.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="grid min-w-40 flex-1 gap-2">
          <Label htmlFor="tag-name">Nova tag</Label>
          <Input
            id="tag-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="arco, local, tema..."
          />
        </div>
        <ColorPicker
          value={color}
          onChange={setColor}
          labelFor={(hex) => `Cor ${hex} para a nova tag`}
        />
        <Button type="submit">
          <Plus aria-hidden />
          Criar tag
        </Button>
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma tag ainda. Tags ajudam a agrupar personagens, locais e notas.
        </p>
      ) : (
        <ul className="grid gap-2">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} others={tags.filter((t) => t.id !== tag.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
  labelFor,
}: {
  value: string;
  onChange: (color: string) => void;
  labelFor: (hex: string) => string;
}) {
  return (
    <fieldset className="flex items-center gap-1 border-0 p-0">
      <legend className="sr-only">Cor da tag</legend>
      {TAG_COLOR_PALETTE.map((hex) => (
        <button
          key={hex}
          type="button"
          aria-label={labelFor(hex)}
          aria-pressed={value === hex}
          onClick={() => onChange(hex)}
          className="size-5 rounded-full ring-offset-2 ring-offset-background transition-shadow aria-pressed:ring-2 aria-pressed:ring-ring"
          style={{ backgroundColor: hex }}
        />
      ))}
      <Input
        type="color"
        className="h-7 w-9 cursor-pointer p-0.5"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : DEFAULT_TAG_COLOR}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Cor personalizada (RGB)"
        title="Cor personalizada (RGB)"
      />
    </fieldset>
  );
}

function TagRow({ tag, others }: { tag: Tag; others: Tag[] }) {
  const [name, setName] = useState(tag.name);

  async function persistName() {
    const next = name.trim() || "Sem nome";
    if (next === tag.name) return;
    try {
      await tagRepository.update(tag.id, { name: next });
      setName(next);
    } catch {
      toast.error("Falha ao renomear a tag");
    }
  }

  async function recolor(color: string) {
    try {
      await tagRepository.update(tag.id, { color });
    } catch {
      toast.error("Falha ao recolorir a tag");
    }
  }

  async function mergeInto(targetId: string) {
    try {
      await tagRepository.merge(tag.id, targetId);
      toast.success(`"${tag.name}" mesclada`);
    } catch {
      toast.error("Falha ao mesclar a tag");
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-full"
        style={{ backgroundColor: resolveTagColor(tag.color) }}
      />
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void persistName()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void persistName();
          }
        }}
        aria-label={`Nome da tag ${tag.name}`}
        className="h-8 min-w-32 flex-1"
      />
      <ColorPicker
        value={resolveTagColor(tag.color)}
        onChange={(hex) => void recolor(hex)}
        labelFor={(hex) => `Definir cor ${hex} para ${tag.name}`}
      />
      {others.length > 0 ? (
        <Select value="" onValueChange={(value) => void mergeInto(value)}>
          <SelectTrigger
            className="h-8 w-36"
            aria-label={`Mesclar ${tag.name} em`}
          >
            <SelectValue placeholder="Mesclar em…" />
          </SelectTrigger>
          <SelectContent>
            {others.map((other) => (
              <SelectItem key={other.id} value={other.id}>
                {other.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir tag ${tag.name}`}
          >
            <Trash2 aria-hidden />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a tag &quot;{tag.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              As referências a esta tag em personagens, locais, lore, notas e
              eventos serão removidas. Isso não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void tagRepository.remove(tag.id).catch(() => {
                  toast.error("Falha ao excluir a tag");
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
