"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Character,
  CharacterRole,
  EntityId,
  Relationship,
  RelationshipType,
} from "@/shared/types/database";

import { characterRepository } from "../infra/dexie-character-repository";
import {
  CHARACTER_ROLE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "../domain/repository";

export function parseTraits(text: string): string[] {
  return text
    .split(",")
    .map((trait) => trait.trim())
    .filter(Boolean);
}

interface CharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  character: Character | null;
  projectId: EntityId | null;
  /** All project characters (excluding deleted) — relationship targets. */
  characters: Character[];
}

export function CharacterDialog({
  open,
  onOpenChange,
  character,
  projectId,
  characters,
}: CharacterDialogProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<CharacterRole>("protagonist");
  const [description, setDescription] = useState("");
  const [backstory, setBackstory] = useState("");
  const [goals, setGoals] = useState("");
  const [fears, setFears] = useState("");
  const [traitsText, setTraitsText] = useState("");
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [newTargetId, setNewTargetId] = useState("");
  const [newType, setNewType] = useState<RelationshipType>("friend");
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(character?.name ?? "");
    setRole(character?.role ?? "protagonist");
    setDescription(character?.description ?? "");
    setBackstory(character?.backstory ?? "");
    setGoals(character?.goals ?? "");
    setFears(character?.fears ?? "");
    setTraitsText((character?.traits ?? []).join(", "));
    setRelationships(character?.relationships ?? []);
    setNewTargetId("");
    setNewType("friend");
    setNewNote("");
  }, [open, character]);

  const nameById = useMemo(() => {
    const map = new Map<EntityId, string>();
    for (const item of characters) map.set(item.id, item.name);
    return map;
  }, [characters]);

  const availableTargets = useMemo(
    () =>
      characters.filter(
        (item) =>
          item.id !== character?.id &&
          !relationships.some((relation) => relation.targetId === item.id),
      ),
    [characters, character, relationships],
  );

  function addRelationship() {
    if (!newTargetId) return;
    setRelationships((current) => [
      ...current,
      { targetId: newTargetId, type: newType, note: newNote.trim() || undefined },
    ]);
    setNewTargetId("");
    setNewNote("");
  }

  function removeRelationship(targetId: EntityId) {
    setRelationships((current) =>
      current.filter((relation) => relation.targetId !== targetId),
    );
  }

  async function submit() {
    if (!projectId) return;
    setSaving(true);
    try {
      const traits = parseTraits(traitsText);
      if (character) {
        await characterRepository.update(character.id, {
          name: name.trim() || "Sem nome",
          role,
          description: description.trim() || undefined,
          backstory: backstory.trim() || undefined,
          goals: goals.trim() || undefined,
          fears: fears.trim() || undefined,
          traits,
          relationships,
        });
        toast.success("Personagem atualizado");
      } else {
        await characterRepository.create({
          projectId,
          name: name.trim(),
          role,
          description: description.trim() || undefined,
          backstory: backstory.trim() || undefined,
          goals: goals.trim() || undefined,
          fears: fears.trim() || undefined,
          traits,
        });
        toast.success("Personagem criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Falha ao salvar o personagem");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {character ? "Editar personagem" : "Novo personagem"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="char-name">Nome</Label>
            <Input
              id="char-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do personagem"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-role">Papel</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as CharacterRole)}
            >
              <SelectTrigger id="char-role" aria-label="Papel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHARACTER_ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-description">Descrição</Label>
            <Textarea
              id="char-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Quem é esse personagem?"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-backstory">História</Label>
            <Textarea
              id="char-backstory"
              value={backstory}
              onChange={(event) => setBackstory(event.target.value)}
              rows={3}
              placeholder="Passado do personagem..."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="char-goals">Objetivos</Label>
              <Textarea
                id="char-goals"
                value={goals}
                onChange={(event) => setGoals(event.target.value)}
                rows={2}
                placeholder="O que ele quer?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="char-fears">Medos</Label>
              <Textarea
                id="char-fears"
                value={fears}
                onChange={(event) => setFears(event.target.value)}
                rows={2}
                placeholder="Do que ele tem medo?"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="char-traits">Traços</Label>
            <Input
              id="char-traits"
              value={traitsText}
              onChange={(event) => setTraitsText(event.target.value)}
              placeholder="corajoso, teimosa, leal (separados por vírgula)"
            />
          </div>

          <section aria-labelledby="char-relationships-heading" className="grid gap-3">
            <h3 id="char-relationships-heading" className="text-sm font-medium">
              Relações
            </h3>
            {relationships.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {relationships.map((relation) => (
                  <li
                    key={relation.targetId}
                    className="flex items-center gap-2 p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p>
                        <span className="text-muted-foreground">
                          {RELATIONSHIP_TYPE_LABELS[relation.type]}:
                        </span>{" "}
                        {nameById.get(relation.targetId) ??
                          "Personagem removido"}
                      </p>
                      {relation.note ? (
                        <p className="text-xs text-muted-foreground">
                          {relation.note}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover relação com ${
                        nameById.get(relation.targetId) ?? "personagem"
                      }`}
                      onClick={() => removeRelationship(relation.targetId)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {characters.length > (character ? 1 : 0)
                  ? "Nenhuma relação registrada."
                  : "Crie outros personagens para registrar relações."}
              </p>
            )}
            {availableTargets.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid w-40 gap-2">
                  <Label htmlFor="rel-target">Personagem</Label>
                  <Select
                    value={newTargetId}
                    onValueChange={setNewTargetId}
                  >
                    <SelectTrigger id="rel-target" aria-label="Personagem relacionado">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargets.map((target) => (
                        <SelectItem key={target.id} value={target.id}>
                          {target.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid w-36 gap-2">
                  <Label htmlFor="rel-type">Tipo</Label>
                  <Select
                    value={newType}
                    onValueChange={(value) =>
                      setNewType(value as RelationshipType)
                    }
                  >
                    <SelectTrigger id="rel-type" aria-label="Tipo de relação">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RELATIONSHIP_TYPE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-32 flex-1 gap-2">
                  <Label htmlFor="rel-note">Nota</Label>
                  <Input
                    id="rel-note"
                    value={newNote}
                    onChange={(event) => setNewNote(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={addRelationship}
                  disabled={!newTargetId}
                >
                  <Plus aria-hidden />
                  Adicionar relação
                </Button>
              </div>
            ) : null}
          </section>
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
