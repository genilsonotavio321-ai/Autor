"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BookOpen, GripVertical, Plus, Trash2 } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { useCardSortable } from "@/shared/lib/sortable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import type {
  Chapter,
  EntityId,
  NarrativeArc,
  PlotBeat,
  Scene,
  StructureTemplateId,
} from "@/shared/types/database";

import {
  applyStructureTemplate,
  type CustomSectionInput,
} from "../application/plot-service";
import {
  getPoltiSituation,
} from "../domain/dramatic-catalog";
import {
  STRUCTURE_TEMPLATES,
  getStructureTemplate,
} from "../domain/structure-catalog";
import { narrativeArcRepository } from "../infra/dexie-narrative-arc-repository";
import { plotBeatRepository } from "../infra/dexie-plot-beat-repository";
import { sceneRepository } from "../infra/dexie-scene-repository";
import { structureSectionRepository } from "../infra/dexie-structure-section-repository";
import { timelineEventRepository } from "../infra/dexie-timeline-event-repository";
import { NarrativeArcDialog } from "./narrative-arc-dialog";
import {
  BeatEditDialog,
  CustomStructureDialog,
  DramaticCatalogDialog,
} from "./structure-dialogs";


const MAIN_SCOPE = "main";

interface StructurePanelProps {
  projectId: EntityId;
  chapters: Chapter[];
  pendingBeatId?: string | null;
  onPendingBeatConsumed?: () => void;
}

interface BoardColumn {
  /** Droppable id (section id or the implicit single column). */
  id: string;
  title: string;
  description?: string;
  sectionId?: EntityId;
  beats: PlotBeat[];
}

export function StructurePanel({
  projectId,
  chapters,
  pendingBeatId,
  onPendingBeatConsumed,
}: StructurePanelProps) {
  const beats =
    useLiveQuery(() => plotBeatRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const sections =
    useLiveQuery(() => structureSectionRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const arcs =
    useLiveQuery(() => narrativeArcRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const project = useLiveQuery(
    () => projectRepository.getById(projectId),
    [projectId],
  );
  const scenes =
    useLiveQuery(() => sceneRepository.listByProject(projectId), [projectId]) ??
    [];
  const events =
    useLiveQuery(() => timelineEventRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const characters =
    useLiveQuery(() => characterRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];

  const [scopeKey, setScopeKey] = useState<string>(MAIN_SCOPE);
  const [draftTemplate, setDraftTemplate] = useState<string>("three_acts");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [arcDialog, setArcDialog] = useState<{
    open: boolean;
    arc?: NarrativeArc | null;
  }>({ open: false });
  const [editing, setEditing] = useState<PlotBeat | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const isMain = scopeKey === MAIN_SCOPE;
  const currentTemplateId = isMain
    ? (project?.settings?.structureTemplateId as string | undefined)
    : undefined;

  useEffect(() => {
    if (currentTemplateId) setDraftTemplate(currentTemplateId);
  }, [currentTemplateId]);

  // Escopo órfão (arco excluído) volta para a trama principal.
  useEffect(() => {
    if (scopeKey !== MAIN_SCOPE && !arcs.some((arc) => arc.id === scopeKey)) {
      setScopeKey(MAIN_SCOPE);
    }
  }, [arcs, scopeKey]);

  const scopedBeats = useMemo(
    () =>
      beats.filter((beat) =>
        isMain
          ? beat.scope === "main"
          : beat.scope === "arc" && beat.arcId === scopeKey,
      ),
    [beats, isMain, scopeKey],
  );
  const scopedSections = useMemo(
    () =>
      sections.filter((section) =>
        isMain
          ? section.scope === "main"
          : section.scope === "arc" && section.arcId === scopeKey,
      ),
    [sections, isMain, scopeKey],
  );

  const columns = useMemo<BoardColumn[]>(() => {
    if (scopedSections.length === 0) {
      return [
        {
          id: "single",
          title: isMain ? "Beats" : "Beats do arco",
          beats: [...scopedBeats].sort((a, b) => a.order - b.order),
        },
      ];
    }
    const used = new Set<EntityId>();
    const mapped = scopedSections.map((section) => {
      const list = scopedBeats
        .filter((beat) => beat.sectionId === section.id)
        .sort((a, b) => a.order - b.order);
      for (const beat of list) used.add(beat.id);
      return {
        id: section.id,
        title: section.title,
        description: section.description,
        sectionId: section.id,
        beats: list,
      };
    });
    const orphans = scopedBeats
      .filter((beat) => !used.has(beat.id))
      .sort((a, b) => a.order - b.order);
    if (orphans.length > 0 && mapped[0]) {
      mapped[0] = { ...mapped[0], beats: [...mapped[0].beats, ...orphans] };
    }
    return mapped;
  }, [isMain, scopedBeats, scopedSections]);

  const scenesByBeat = useMemo(() => {
    const map = new Map<EntityId, Scene[]>();
    for (const scene of scenes) {
      if (!scene.beatId) continue;
      const list = map.get(scene.beatId) ?? [];
      list.push(scene);
      map.set(scene.beatId, list);
    }
    return map;
  }, [scenes]);

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Touch drags also end with a click under the finger; without this guard a
  // release would open the edit dialog and the on-screen keyboard.
  const suppressClick = useRef(false);

  function suppressNextClick() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromColumn = columns.find((column) =>
      column.beats.some((beat) => beat.id === active.id),
    );
    if (!fromColumn) return;

    const overType = over.data.current?.type;
    const toColumn =
      overType === "section"
        ? columns.find((column) => column.id === over.id)
        : columns.find((column) =>
            column.beats.some((beat) => beat.id === over.id),
          );
    if (!toColumn) return;

    const toIndex =
      overType === "section"
        ? toColumn.beats.length
        : Math.max(
            0,
            toColumn.beats.findIndex((beat) => beat.id === over.id),
          );
    const moved = fromColumn.beats.find((beat) => beat.id === active.id);
    if (!moved) return;

    const updates: { id: EntityId; sectionId?: EntityId; order: number }[] =
      [];
    for (const column of columns) {
      const list = column.beats.filter((beat) => beat.id !== moved.id);
      if (column.id === toColumn.id) {
        list.splice(Math.min(toIndex, list.length), 0, moved);
      }
      list.forEach((beat, index) =>
        updates.push({ id: beat.id, sectionId: column.sectionId, order: index + 1 }),
      );
    }

    try {
      await plotBeatRepository.applyMoves(updates);
    } catch {
      toast.error("Falha ao mover o beat");
    }
  }

  function requestApply() {
    if (!draftTemplate) {
      toast.error("Escolha uma teoria de estrutura primeiro.");
      return;
    }
    if (scopedBeats.length > 0) setConfirmOpen(true);
    else void apply();
  }

  async function apply() {
    try {
      const result = await applyStructureTemplate(
        projectId,
        draftTemplate as Exclude<StructureTemplateId, "custom">,
        { replaceExisting: scopedBeats.length > 0 },
      );
      toast.success(
        `${result.sections} seções e ${result.beats} beats criados${result.replaced > 0 ? ` (${result.replaced} anteriores na lixeira)` : ""}`,
      );
    } catch {
      toast.error("Falha ao aplicar a estrutura");
    } finally {
      setConfirmOpen(false);
    }
  }

  async function addBeat(column: BoardColumn) {
    try {
      const created = await plotBeatRepository.create({
        projectId,
        scope: isMain ? "main" : "arc",
        arcId: isMain ? undefined : scopeKey,
        sectionId: column.sectionId,
        title: "Novo beat",
      });
      setEditing(created);
      setEditOpen(true);
    } catch {
      toast.error("Falha ao criar o beat");
    }
  }

  async function remove(beat: PlotBeat) {
    await plotBeatRepository.softDelete(beat.id);
    toast(`"${beat.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void plotBeatRepository.restore(beat.id);
        },
      },
    });
  }

  // Deep link /outline?beat=<id> abre o beat direto.
  useEffect(() => {
    if (!pendingBeatId) return;
    const beat = beats.find((item) => item.id === pendingBeatId);
    if (beat) {
      setScopeKey(
        beat.scope === "arc" && beat.arcId ? beat.arcId : MAIN_SCOPE,
      );
      setEditing(beat);
      setEditOpen(true);
    }
    onPendingBeatConsumed?.();
  }, [beats, onPendingBeatConsumed, pendingBeatId]);

  const activeTemplate = draftTemplate
    ? getStructureTemplate(draftTemplate as StructureTemplateId)
    : undefined;
  const activeArc = arcs.find((arc) => arc.id === scopeKey);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-2">
          <Label>Escopo</Label>
          <Select value={scopeKey} onValueChange={setScopeKey}>
            <SelectTrigger className="w-52" aria-label="Escopo da estrutura">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={MAIN_SCOPE}>Trama principal</SelectItem>
              {arcs.map((arc) => (
                <SelectItem key={arc.id} value={arc.id}>
                  {arc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="ghost"
          onClick={() => setArcDialog({ open: true })}
          aria-label="Novo arco"
        >
          <Plus aria-hidden />
          Arco
        </Button>

        {isMain ? (
          <>
            <div className="grid gap-2">
              <Label>Teoria</Label>
              <Select value={draftTemplate} onValueChange={setDraftTemplate}>
                <SelectTrigger
                  className="w-64"
                  aria-label="Estrutura narrativa"
                >
                  <SelectValue placeholder="Escolher teoria" />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={requestApply} disabled={!draftTemplate}>
              Aplicar estrutura
            </Button>
            <Button variant="outline" onClick={() => setCustomOpen(true)}>
              Estrutura própria
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            onClick={() => setArcDialog({ open: true, arc: activeArc })}
            disabled={!activeArc}
          >
            Editar arco
          </Button>
        )}

        <Button variant="outline" onClick={() => setCatalogOpen(true)}>
          <BookOpen aria-hidden />
          Catálogos dramáticos
        </Button>
      </div>

      {isMain ? (
        <p className="text-sm text-muted-foreground">
          {activeTemplate
            ? `${activeTemplate.name} · ${activeTemplate.description}`
            : "Escolha uma teoria para destrinchar a história em atos, estágios ou funções — ou crie uma estrutura própria."}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Beats deste arco/trama paralela. A cena vinculada a cada beat é a
          ponte com a linha do tempo.
        </p>
      )}

      {columns.every((column) => column.beats.length === 0) && (
        <EmptyState
          hint={
            isMain
              ? "Nenhum beat ainda. Aplique uma teoria ou adicione beats à mão."
              : "Nenhum beat neste arco ainda. Adicione o primeiro."
          }
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={() => {
          suppressClick.current = true;
        }}
        onDragCancel={suppressNextClick}
        onDragEnd={(event) => {
          suppressNextClick();
          void handleDragEnd(event);
        }}
      >
        <div
          className={`grid gap-3 ${columns.length > 1 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}
        >
          {columns.map((column) => (
            <SectionColumn
              key={column.id}
              column={column}
              scenesByBeat={scenesByBeat}
              chapterTitle={(chapterId) =>
                chapterById.get(chapterId)?.title ?? "Capítulo"
              }
              eventCount={(beat) =>
                scenesByBeat
                  .get(beat.id)
                  ?.filter((scene) =>
                    events.some((event) => event.linkedSceneId === scene.id),
                  ).length ?? 0
              }
              suppressClick={suppressClick}
              onEdit={(beat) => {
                setEditing(beat);
                setEditOpen(true);
              }}
              onRemove={(beat) => void remove(beat)}
              onAdd={() => void addBeat(column)}
            />
          ))}
        </div>
      </DndContext>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir os beats atuais?</AlertDialogTitle>
            <AlertDialogDescription>
              A trama principal tem {scopedBeats.length} beats. Aplicar{" "}
              {activeTemplate?.name ?? "a estrutura"} move os atuais para a
              lixeira e cria as seções e beats sugeridos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void apply()}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomStructureDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        projectId={projectId}
        initialSections={scopedSections.map((section) => ({
          title: section.title,
          description: section.description,
        }))}
      />

      <DramaticCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
      />

      <NarrativeArcDialog
        open={arcDialog.open}
        onOpenChange={(open) => setArcDialog((state) => ({ ...state, open }))}
        projectId={projectId}
        arc={arcDialog.arc ?? null}
      />

      <BeatEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        beat={editing}
        sections={isMain ? scopedSections : []}
        scenes={scenes}
        chapters={chapters}
        characters={characters}
        canChangeSection={isMain}
      />
    </div>
  );
}

interface SectionColumnProps {
  column: BoardColumn;
  scenesByBeat: Map<EntityId, Scene[]>;
  chapterTitle: (chapterId: EntityId) => string;
  eventCount: (beat: PlotBeat) => number;
  suppressClick: RefObject<boolean>;
  onEdit: (beat: PlotBeat) => void;
  onRemove: (beat: PlotBeat) => void;
  onAdd: () => void;
}

function SectionColumn({
  column,
  scenesByBeat,
  chapterTitle,
  eventCount,
  suppressClick,
  onEdit,
  onRemove,
  onAdd,
}: SectionColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "section", sectionId: column.sectionId },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={`Seção: ${column.title}`}
      className={`flex min-h-40 flex-col rounded-lg border bg-muted/30 p-2 ${isOver ? "ring-2 ring-ring" : ""}`}
    >
      <header className="mb-2 flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{column.title}</h3>
          {column.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {column.description}
            </p>
          ) : null}
        </div>
        <Badge variant="secondary">{column.beats.length}</Badge>
      </header>
      <SortableContext
        items={column.beats.map((beat) => beat.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="grid gap-2">
          {column.beats.map((beat) => (
            <BeatCard
              key={beat.id}
              beat={beat}
              scenes={(scenesByBeat.get(beat.id) ?? []).map((scene) => ({
                scene,
                chapterTitle: chapterTitle(scene.chapterId),
              }))}
              events={eventCount(beat)}
              suppressClick={suppressClick}
              onEdit={() => onEdit(beat)}
              onRemove={() => onRemove(beat)}
            />
          ))}
        </ul>
      </SortableContext>
      <Button variant="ghost" size="sm" className="mt-2" onClick={onAdd}>
        <Plus aria-hidden />
        Adicionar beat
      </Button>
    </section>
  );
}

interface BeatCardProps {
  beat: PlotBeat;
  scenes: { scene: Scene; chapterTitle: string }[];
  events: number;
  suppressClick: RefObject<boolean>;
  onEdit: () => void;
  onRemove: () => void;
}

function BeatCard({
  beat,
  scenes,
  events,
  suppressClick,
  onEdit,
  onRemove,
}: BeatCardProps) {
  const { setNodeRef, dragProps, style, isDragging } = useCardSortable(
    beat.id,
    { type: "beat" },
  );
  const polti = getPoltiSituation(beat.poltiSituation);
  const souriauCount = Object.values(beat.souriauFunctions ?? {}).filter(
    Boolean,
  ).length;

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-dragging={isDragging || undefined}
      className={`rounded-md border bg-card p-2 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          {...dragProps}
          aria-label={`Reordenar ${beat.title}`}
          className="inline-flex size-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              if (suppressClick.current) return;
              onEdit();
            }}
            className="block w-full truncate text-left text-sm font-medium hover:underline"
          >
            {beat.title}
          </button>
          {beat.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {beat.description}
            </p>
          ) : null}
          {polti || souriauCount > 0 || scenes.length > 0 || events > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {polti ? (
                <Badge variant="outline" className="text-[10px]">
                  Polti: {polti.title}
                </Badge>
              ) : null}
              {souriauCount > 0 ? (
                <Badge variant="outline" className="text-[10px]">
                  Souriau: {souriauCount} funções
                </Badge>
              ) : null}
              {scenes.map(({ scene, chapterTitle }) => (
                <Link
                  key={scene.id}
                  href={`/write/${scene.chapterId}`}
                  className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                  title={`${chapterTitle} · ${scene.title}`}
                >
                  {scene.title}
                </Link>
              ))}
              {events > 0 ? (
                <Link
                  href="/timeline"
                  className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  {events} {events === 1 ? "evento" : "eventos"}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Excluir ${beat.title}`}
          onClick={onRemove}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 aria-hidden />
        </button>
      </div>
    </li>
  );
}
