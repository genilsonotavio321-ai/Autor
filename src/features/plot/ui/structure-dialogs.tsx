"use client";

import { useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import type {
  Chapter,
  Character,
  EntityId,
  PlotBeat,
  Scene,
  SouriauAssignment,
  SouriauFunctionId,
  StructureSection,
} from "@/shared/types/database";

import {
  applyCustomStructure,
  type CustomSectionInput,
} from "../application/plot-service";
import { POLTI_SITUATIONS, SOURIAU_FUNCTIONS } from "../domain/dramatic-catalog";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";
import { sceneRepository } from "../infra/dexie-scene-repository";

const NO_LINK = "__none__";


export interface CustomStructureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: EntityId;
  initialSections: CustomSectionInput[];
}

export function CustomStructureDialog({
  open,
  onOpenChange,
  projectId,
  initialSections,
}: CustomStructureDialogProps) {
  const [rows, setRows] = useState<CustomSectionInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastOpen, setLastOpen] = useState(false);

  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setRows(
        initialSections.length > 0
          ? initialSections.map((section) => ({ ...section }))
          : [{ title: "Ato I" }, { title: "Ato II" }, { title: "Ato III" }],
      );
    }
  }

  async function save() {
    setSaving(true);
    try {
      const result = await applyCustomStructure(projectId, rows);
      toast.success(`Estrutura própria salva (${result.sections} seções)`);
      onOpenChange(false);
    } catch {
      toast.error("A estrutura precisa de pelo menos uma seção");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estrutura própria</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Defina as seções (atos, estágios, partes). Os beats atuais são
          redistribuídos entre elas.
        </p>
        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-1 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Nome da seção ${index + 1}`}
                  value={row.title}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Nome da seção"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover seção ${index + 1}`}
                  onClick={() =>
                    setRows((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  disabled={rows.length === 1}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <Input
                aria-label={`Descrição da seção ${index + 1}`}
                value={row.description ?? ""}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  )
                }
                placeholder="Descrição (opcional)"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((current) => [...current, { title: "" }])}
          >
            <Plus aria-hidden />
            Adicionar seção
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            Salvar estrutura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DramaticCatalogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Catálogos dramáticos</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Catálogos classificatórios: use-os para nomear a situação de um beat
          (no diálogo do beat), não como esqueleto de atos.
        </p>
        <Tabs defaultValue="polti">
          <TabsList>
            <TabsTrigger value="polti">Polti · 36 situações</TabsTrigger>
            <TabsTrigger value="souriau">Souriau · 6 funções</TabsTrigger>
          </TabsList>
          <TabsContent value="polti" className="pt-4">
            <ul className="grid gap-2">
              {POLTI_SITUATIONS.map((situation) => (
                <li key={situation.id} className="rounded-md border p-2">
                  <p className="text-sm font-medium">{situation.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {situation.description}
                  </p>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="souriau" className="pt-4">
            <ul className="grid gap-2">
              {SOURIAU_FUNCTIONS.map((fn) => (
                <li key={fn.id} className="rounded-md border p-2">
                  <p className="text-sm font-medium">
                    {fn.symbol} · {fn.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fn.description}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              A situação nasce da distribuição de personagens entre as seis
              funções — faça isso no diálogo do beat, em “Funções de Souriau”.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export interface BeatEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beat: PlotBeat | null;
  sections: StructureSection[];
  scenes: Scene[];
  chapters: Chapter[];
  characters: Character[];
  canChangeSection: boolean;
}

export function BeatEditDialog({
  open,
  onOpenChange,
  beat,
  sections,
  scenes,
  chapters,
  characters,
  canChangeSection,
}: BeatEditDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sectionId, setSectionId] = useState(NO_LINK);
  const [poltiId, setPoltiId] = useState(NO_LINK);
  const [sceneIds, setSceneIds] = useState<EntityId[]>([]);
  const [souriau, setSouriau] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  if (open && beat && beat.id !== lastId) {
    setLastId(beat.id);
    setTitle(beat.title);
    setDescription(beat.description ?? "");
    setSectionId(beat.sectionId ?? NO_LINK);
    setPoltiId(beat.poltiSituation ?? NO_LINK);
    setSceneIds(scenes.filter((scene) => scene.beatId === beat.id).map((scene) => scene.id));
    setSouriau(
      Object.fromEntries(
        Object.entries(beat.souriauFunctions ?? {}).map(([key, value]) => [
          key,
          value ?? NO_LINK,
        ]),
      ),
    );
  }
  if (!open && lastId !== null) setLastId(null);

  async function save() {
    if (!beat) return;
    setSaving(true);
    try {
      const functions = Object.fromEntries(
        Object.entries(souriau).filter(([, value]) => value !== NO_LINK),
      ) as SouriauAssignment;
      await plotBeatRepository.update(beat.id, {
        title: title.trim() || beat.title,
        description,
        ...(canChangeSection
          ? { sectionId: sectionId === NO_LINK ? null : sectionId }
          : {}),
        poltiSituation: poltiId === NO_LINK ? null : poltiId,
        souriauFunctions:
          Object.keys(functions).length > 0 ? functions : null,
      });

      // Sincroniza os vínculos de cena (a cena é a ponte com a timeline).
      for (const scene of scenes) {
        const shouldLink = sceneIds.includes(scene.id);
        const linked = scene.beatId === beat.id;
        if (shouldLink && !linked) {
          await sceneRepository.update(scene.id, { beatId: beat.id });
        } else if (!shouldLink && linked) {
          await sceneRepository.update(scene.id, { beatId: null });
        }
      }

      toast.success("Beat atualizado");
      onOpenChange(false);
    } catch {
      toast.error("Falha ao atualizar o beat");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={(event) => handleDialogEnter(event, () => void save())}
      >
        <DialogHeader>
          <DialogTitle>Editar beat</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="beat-title">Título</Label>
            <Input
              id="beat-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="beat-description">Descrição</Label>
            <Textarea
              id="beat-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          {canChangeSection && sections.length > 0 ? (
            <div className="grid gap-2">
              <Label>Seção</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger aria-label="Seção do beat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LINK}>Sem seção</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Cenas</legend>
            {scenes.length > 0 ? (
              <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                {scenes.map((scene) => (
                  <label key={scene.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sceneIds.includes(scene.id)}
                      onChange={() =>
                        setSceneIds((current) =>
                          current.includes(scene.id)
                            ? current.filter((id) => id !== scene.id)
                            : [...current, scene.id],
                        )
                      }
                      className="size-4 accent-primary"
                    />
                    <span className="min-w-0 truncate">
                      {chapterById.get(scene.chapterId)?.title ?? "?"} ·{" "}
                      {scene.title}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Crie cenas no Roteiro para vinculá-las a este beat.
              </p>
            )}
          </fieldset>
          <div className="grid gap-2">
            <Label>Situação de Polti</Label>
            <Select value={poltiId} onValueChange={setPoltiId}>
              <SelectTrigger aria-label="Situação de Polti">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LINK}>Nenhuma</SelectItem>
                {POLTI_SITUATIONS.map((situation) => (
                  <SelectItem key={situation.id} value={situation.id}>
                    {situation.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Funções de Souriau
            </summary>
            <div className="mt-3 grid gap-2">
              {SOURIAU_FUNCTIONS.map((fn) => (
                <div key={fn.id} className="grid gap-1">
                  <Label className="text-xs">
                    {fn.symbol} · {fn.name}
                  </Label>
                  <Select
                    value={souriau[fn.id] ?? NO_LINK}
                    onValueChange={(value) =>
                      setSouriau((current) => ({ ...current, [fn.id]: value }))
                    }
                  >
                    <SelectTrigger
                      className="h-8"
                      aria-label={`Função ${fn.name}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_LINK}>Nenhum</SelectItem>
                      {characters.map((character) => (
                        <SelectItem key={character.id} value={character.id}>
                          {character.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Referência explícita para o tipo das funções de Souriau no painel.
export type { SouriauFunctionId };
