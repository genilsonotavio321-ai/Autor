"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ChevronDown, FolderPlus, LayoutGrid, List, Plus } from "lucide-react";
import { useRouter } from "@/infra/navigation/use-app-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { PageActionBar } from "@/components/layout/action-bar";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { buildAnnouncements, useCardSortable } from "@/shared/lib/sortable";
import { estimateReadingMinutes } from "@/features/productivity/domain/writing-log";
import { resolveFolderDragEnd } from "@/features/folders/application/folder-drag";
import {
  deleteFolderCascade,
  PROJECT_FOLDER_SCOPE,
  restoreFolderCascade,
} from "@/features/folders/application/folder-service";
import {
  directCounts,
  effectiveParentId,
  itemsInFolder,
  rootItems,
} from "@/features/folders/domain/folder-tree";
import { folderRepository } from "@/features/folders/infra/dexie-folder-repository";
import { useFolderDragHint } from "@/features/folders/ui/drag-hint";
import { FolderBackBar } from "@/features/folders/ui/folder-back-bar";
import { FolderCard } from "@/features/folders/ui/folder-card";
import { PROJECTS_SORT_LABELS, useUiStore } from "@/shared/store/ui-store";
import type { Chapter, EntityId, Folder } from "@/shared/types/database";

import { sortProjectEntries, type ProjectEntry } from "../domain/sorting";
import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";
import { ProjectCard, ProjectRow } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";

export function ProjectsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [openFolderId, setOpenFolderId] = useState<EntityId | null>(null);
  // Set while a card is being dragged, so the trailing click doesn't open it.
  const suppressClick = useRef(false);

  // `?novo=1` (Início → Nova história) abre o formulário de criação.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") !== "1") return;
    setDialogOpen(true);
    window.history.replaceState({}, "", "/projects");
  }, []);

  const projectsSort = useUiStore((state) => state.projectsSort);
  const projectsLayout = useUiStore((state) => state.projectsLayout);
  const setProjectsSort = useUiStore((state) => state.setProjectsSort);
  const setProjectsLayout = useUiStore((state) => state.setProjectsLayout);
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );

  const entries = useLiveQuery(async (): Promise<ProjectEntry[]> => {
    // Uma consulta de capítulos para todos os projetos (era uma por projeto).
    const [projects, chapters] = await Promise.all([
      projectRepository.listActive(),
      chapterRepository.listAll(),
    ]);
    const byProject = new Map<string, Chapter[]>();
    for (const chapter of chapters) {
      const list = byProject.get(chapter.projectId);
      if (list) list.push(chapter);
      else byProject.set(chapter.projectId, [chapter]);
    }
    return projects.map((project) => {
      const own = byProject.get(project.id) ?? [];
      const wordCount = own.reduce(
        (sum, chapter) => sum + chapter.wordCount,
        0,
      );
      return {
        project,
        chapterCount: own.length,
        wordCount,
        readingMinutes: estimateReadingMinutes(wordCount),
      };
    });
  }, []);

  const liveFolders = useLiveQuery(
    () => folderRepository.listByProject(PROJECT_FOLDER_SCOPE),
    [],
  );
  const folders = useMemo(
    () => (liveFolders ?? []).filter((folder) => folder.kind === "project"),
    [liveFolders],
  );
  const liveFolderIds = useMemo(
    () => new Set(folders.map((folder) => folder.id)),
    [folders],
  );

  const allEntries = useMemo(() => entries ?? [], [entries]);
  const activeEntries = useMemo(
    () => allEntries.filter(({ project }) => project.status !== "archived"),
    [allEntries],
  );
  const archivedEntries = useMemo(
    () => allEntries.filter(({ project }) => project.status === "archived"),
    [allEntries],
  );
  const activeProjects = useMemo(
    () => activeEntries.map(({ project }) => project),
    [activeEntries],
  );

  // Arquivados ficam fora das pastas: a árvore cobre só a biblioteca ativa.
  const currentFolder = useMemo(
    () =>
      openFolderId
        ? (folders.find((folder) => folder.id === openFolderId) ?? null)
        : null,
    [folders, openFolderId],
  );
  const viewFolders = useMemo(
    () =>
      folders.filter(
        (folder) =>
          effectiveParentId(folder, liveFolderIds) === (openFolderId ?? null),
      ),
    [folders, liveFolderIds, openFolderId],
  );
  const viewFolderIds = useMemo(
    () => viewFolders.map((folder) => folder.id),
    [viewFolders],
  );
  const folderCounts = useMemo(
    () => directCounts(folders, activeProjects),
    [folders, activeProjects],
  );

  const viewProjects = useMemo(() => {
    const inFolder =
      openFolderId === null
        ? rootItems(activeProjects, liveFolderIds)
        : itemsInFolder(activeProjects, openFolderId);
    const ids = new Set(inFolder.map((project) => project.id));
    return sortProjectEntries(
      activeEntries.filter(({ project }) => ids.has(project.id)),
      projectsSort,
    );
  }, [
    activeProjects,
    activeEntries,
    liveFolderIds,
    openFolderId,
    projectsSort,
  ]);
  const viewIds = useMemo(
    () => [...viewFolderIds, ...viewProjects.map(({ project }) => project.id)],
    [viewFolderIds, viewProjects],
  );

  const folderHint = useFolderDragHint({ viewFolderIds });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const titlesById = useMemo(() => {
    const map = new Map<UniqueIdentifier, string>();
    for (const folder of folders) map.set(folder.id, `pasta ${folder.name}`);
    for (const { project } of allEntries) map.set(project.id, project.title);
    return map;
  }, [folders, allEntries]);

  const announcements = useMemo(
    () => buildAnnouncements(titlesById, "projeto"),
    [titlesById],
  );

  function handleDragStart() {
    suppressClick.current = true;
  }

  function handleDragCancel() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  /** Reordenação de projetos (drop na borda do card) — pastas ficam de fora. */
  function reorderProjects(activeId: string, overId: string) {
    const oldIndex = viewIds.indexOf(activeId);
    const newIndex = viewIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const folderIdSet = new Set(viewFolderIds);
    const reordered = arrayMove(viewIds, oldIndex, newIndex).filter(
      (id) => !folderIdSet.has(id),
    );
    void projectRepository
      .applyMoves(reordered.map((id, order) => ({ id, order })))
      .catch(() => toast.error("Falha ao reordenar"));
  }

  function handleDragEnd(event: DragEndEvent) {
    folderHint.onDragEnd();
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    // Arrastar assume a ordem manual: o seletor deixa de reposicionar tudo.
    if (projectsSort !== "manual") setProjectsSort("manual");
    void resolveFolderDragEnd({
      kind: "project",
      projectId: PROJECT_FOLDER_SCOPE,
      folders,
      viewFolderIds,
      openFolderId,
      activeId,
      overId,
      activeRect: active.rect.current.translated,
      overRect: over.rect,
      // Soltar um projeto no centro de outro cria uma pasta com o nome dele.
      newFolderName: allEntries.find(({ project }) => project.id === overId)
        ?.project.title,
    })
      .then((outcome) => {
        if (outcome === "created") {
          toast.success("Pasta criada com os dois projetos");
        } else if (outcome === "reorder") {
          reorderProjects(activeId, overId);
        }
      })
      .catch(() => toast.error("Falha ao mover"));
  }

  async function createFolder() {
    try {
      const folder = await folderRepository.create({
        projectId: PROJECT_FOLDER_SCOPE,
        kind: "project",
        ...(openFolderId ? { parentId: openFolderId } : {}),
      });
      toast.success(`Pasta "${folder.name}" criada`);
    } catch {
      toast.error("Falha ao criar a pasta");
    }
  }

  async function removeFolder(folder: Folder) {
    await deleteFolderCascade(folder);
    toast(`Pasta "${folder.name}" movida para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void restoreFolderCascade(folder.id);
        },
      },
    });
  }

  async function renameFolder(folder: Folder, name: string) {
    try {
      await folderRepository.rename(folder.id, name);
    } catch {
      toast.error("Falha ao renomear a pasta");
    }
  }

  function exitFolder() {
    setOpenFolderId(
      currentFolder
        ? effectiveParentId(currentFolder, liveFolderIds)
        : null,
    );
  }

  const loading = entries === undefined || liveFolders === undefined;

  return (
    <div className="w-full space-y-8">
      <PageHeader
        eyebrow="Biblioteca"
        title="Projetos"
        description="Seus romances, contos e rascunhos."
      >
        <Button
          className="rounded-full px-5"
          onClick={() => setDialogOpen(true)}
        >
          <Plus aria-hidden />
          Novo projeto
        </Button>
      </PageHeader>

      <PageActionBar>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Nova pasta"
          title="Nova pasta"
          onClick={() => void createFolder()}
        >
          <FolderPlus aria-hidden />
        </Button>
      </PageActionBar>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <p className="text-sm text-muted-foreground">
          {viewProjects.length}{" "}
          {viewProjects.length === 1 ? "projeto" : "projetos"}
          {viewFolders.length > 0
            ? ` · ${viewFolders.length} ${viewFolders.length === 1 ? "pasta" : "pastas"}`
            : ""}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={projectsSort}
            onValueChange={(value) =>
              setProjectsSort(value as typeof projectsSort)
            }
          >
            <SelectTrigger
              id="projects-sort"
              className="h-9 w-52"
              aria-label="Ordenar projetos"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECTS_SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            role="group"
            aria-label="Disposição dos projetos"
            className="flex items-center gap-0.5 rounded-full border border-border/70 p-0.5"
          >
            <Button
              variant={projectsLayout === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="size-8 rounded-full"
              aria-label="Exibir em caixas"
              aria-pressed={projectsLayout === "grid"}
              onClick={() => setProjectsLayout("grid")}
            >
              <LayoutGrid aria-hidden />
            </Button>
            <Button
              variant={projectsLayout === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-8 rounded-full"
              aria-label="Exibir em lista"
              aria-pressed={projectsLayout === "list"}
              onClick={() => setProjectsLayout("list")}
            >
              <List aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : viewIds.length === 0 ? (
        <EmptyState
          icon={<Plus aria-hidden className="size-5" />}
          title={
            openFolderId ? "Pasta vazia" : "Nenhum projeto ainda"
          }
          hint={
            openFolderId
              ? "Arraste projetos até aqui ou crie um novo."
              : "Crie seu primeiro projeto e comece a escrever."
          }
        >
          <Button className="rounded-full" onClick={() => setDialogOpen(true)}>
            <Plus aria-hidden />
            Novo projeto
          </Button>
        </EmptyState>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragStart={(event) => {
            handleDragStart();
            folderHint.onDragStart(event);
          }}
          onDragMove={folderHint.onDragMove}
          onDragOver={folderHint.onDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            folderHint.onDragCancel();
            handleDragCancel();
          }}
        >
          {currentFolder ? (
            <FolderBackBar title={currentFolder.name} onBack={exitFolder} />
          ) : null}

          <SortableContext items={viewIds} strategy={rectSortingStrategy}>
            {viewFolders.length > 0 ? (
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {viewFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    count={folderCounts.get(folder.id) ?? 0}
                    suppressClick={suppressClick}
                    onOpen={(target) => setOpenFolderId(target.id)}
                    onRename={renameFolder}
                    onDelete={removeFolder}
                  />
                ))}
              </ul>
            ) : null}

            {viewProjects.length > 0 ? (
              projectsLayout === "list" ? (
                <ul className="surface mt-3 divide-y divide-border/60 overflow-hidden">
                  {viewProjects.map((entry) => (
                    <SortableProject
                      key={entry.project.id}
                      entry={entry}
                      layout="list"
                      suppressClick={suppressClick}
                    />
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {viewProjects.map((entry, index) => (
                    <SortableProject
                      key={entry.project.id}
                      entry={entry}
                      layout="grid"
                      index={index}
                      suppressClick={suppressClick}
                    />
                  ))}
                </ul>
              )
            ) : null}
          </SortableContext>
          {folderHint.hint}
        </DndContext>
      )}

      {archivedEntries.length > 0 ? (
        <section className="space-y-3">
          <Button
            variant="ghost"
            className="gap-2 rounded-full px-3"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((value) => !value)}
          >
            <ChevronDown
              aria-hidden
              className={`size-4 transition-transform ${showArchived ? "rotate-180" : ""}`}
            />
            {showArchived ? "Ocultar arquivados" : "Mostrar arquivados"}
            <Badge variant="outline">{archivedEntries.length}</Badge>
          </Button>
          {showArchived ? (
            <ul className="surface divide-y divide-border/60 overflow-hidden">
              {archivedEntries.map((entry) => (
                <ProjectRow
                  key={entry.project.id}
                  project={entry.project}
                  stats={entry}
                />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(project) => {
          // Criar um projeto já o seleciona como projeto carregado no app.
          setSelectedProjectId(project.id);
          router.push(`/projects/${project.id}`);
        }}
      />
    </div>
  );
}

interface SortableProjectProps {
  entry: ProjectEntry;
  layout: "grid" | "list";
  index?: number;
  suppressClick: RefObject<boolean>;
}

/** Card/linha de projeto arrastável (base do DnD com pastas). */
function SortableProject({
  entry,
  layout,
  index = 0,
  suppressClick,
}: SortableProjectProps) {
  const { setNodeRef, dragProps, style, isDragging, isOver } =
    useCardSortable(entry.project.id);
  return (
    <li
      ref={setNodeRef}
      style={
        layout === "grid"
          ? ({ ...style, "--i": index } as CSSProperties)
          : style
      }
      data-dragging={isDragging || undefined}
      {...dragProps}
      className={`relative touch-none select-none ${
        isDragging ? "opacity-60" : ""
      } ${isOver ? "rounded-2xl ring-2 ring-primary" : ""}`}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {layout === "grid" ? (
        <ProjectCard project={entry.project} stats={entry} />
      ) : (
        <ProjectRow project={entry.project} stats={entry} />
      )}
    </li>
  );
}
