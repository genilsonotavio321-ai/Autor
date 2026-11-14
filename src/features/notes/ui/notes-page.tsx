"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { downloadBlob, safeFilename } from "@/features/export/infra/download";
import { notesToMd, notesToTxt, plainTextToDoc } from "@/features/export/domain/plain-text";
import { ExportFormatDialog, type ExportFormat } from "@/features/export/ui/export-format-dialog";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { resolveFolderDragEnd } from "@/features/folders/application/folder-drag";
import {
  deleteFolderCascade,
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
import type { EntityId, Folder, Note } from "@/shared/types/database";

import { sortNotes } from "../domain/sort";
import { noteRepository } from "../infra/dexie-note-repository";
import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import { NoteDialog } from "./note-dialog";
import { NoteViewDialog } from "./note-view-dialog";
import { NotesGrid } from "./notes-grid";
import { NotesToolbar } from "./notes-toolbar";
import { useNotesSort } from "./use-notes-sort";

export function NotesPage() {
  const { projectId } = useSelectedProject();
  const liveNotes =
    useLiveQuery(
      () => (projectId ? noteRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? null;
  const notes = useMemo(() => liveNotes ?? [], [liveNotes]);
  const project =
    useLiveQuery(
      () => (projectId ? projectRepository.getById(projectId) : null),
      [projectId],
    ) ?? null;

  const { sort, setSort } = useNotesSort();
  const [dialog, setDialog] = useState<{
    open: boolean;
    note?: Note | null;
  }>({ open: false });
  const [viewNote, setViewNote] = useState<Note | null>(null);
  const [exportTarget, setExportTarget] = useState<{
    open: boolean;
    note?: Note | null;
  }>({ open: false });
  // Deep link: /notes?note=<id> opens the note view (search result clicks).
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Set while a drag is in flight so the trailing click doesn't open the view.
  const suppressClick = useRef(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("note");
    if (!id) return;
    setPendingId(id);
    window.history.replaceState({}, "", "/notes");
  }, []);

  useEffect(() => {
    if (!pendingId) return;
    const found = notes.find((note) => note.id === pendingId);
    if (!found) return;
    setViewNote(found);
    setPendingId(null);
  }, [pendingId, notes]);

  const sortedNotes = useMemo(() => sortNotes(notes, sort), [notes, sort]);
  const liveFolders = useLiveQuery(
    () => (projectId ? folderRepository.listByProject(projectId) : []),
    [projectId],
  );
  // Pastas da aba Notas (uma árvore por tipo de ficha).
  const folders = useMemo(
    () => (liveFolders ?? []).filter((folder) => folder.kind === "note"),
    [liveFolders],
  );
  const liveFolderIds = useMemo(
    () => new Set(folders.map((folder) => folder.id)),
    [folders],
  );
  const [openFolderId, setOpenFolderId] = useState<EntityId | null>(null);
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
  const folderHint = useFolderDragHint({ viewFolderIds });
  const folderCounts = useMemo(
    () => directCounts(folders, notes),
    [folders, notes],
  );
  // Dentro da pasta, fixadas e soltas aparecem juntas (a seção "Fixadas"
  // é só da raiz e ignora notas de pastas).
  const folderNotes = useMemo(
    () =>
      openFolderId === null ? [] : itemsInFolder(sortedNotes, openFolderId),
    [sortedNotes, openFolderId],
  );
  const folderNoteIds = useMemo(
    () => folderNotes.map((note) => note.id),
    [folderNotes],
  );
  const rootNotes = useMemo(
    () =>
      openFolderId === null ? rootItems(sortedNotes, liveFolderIds) : [],
    [sortedNotes, liveFolderIds, openFolderId],
  );
  const pinnedNotes = useMemo(
    () => rootNotes.filter((note) => note.pinned),
    [rootNotes],
  );
  const regularNotes = useMemo(
    () => rootNotes.filter((note) => !note.pinned),
    [rootNotes],
  );

  // Pasta aberta morreu (excluída em cascata, restaurada na lixeira etc.) —
  // volta à raiz em vez de deixar a página presa numa pasta fantasma.
  useEffect(() => {
    if (openFolderId && !folders.some((folder) => folder.id === openFolderId)) {
      setOpenFolderId(null);
    }
  }, [folders, openFolderId]);

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
    for (const note of notes) map.set(note.id, note.title);
    return map;
  }, [notes]);

  const announcements = useMemo<Announcements>(() => {
    const labelFor = (id: UniqueIdentifier) =>
      titlesById.get(id) ?? "nota";
    return {
      onDragStart: ({ active }) => `Arrastando ${labelFor(active.id)}.`,
      onDragOver: ({ over }) =>
        over ? `Sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragEnd: ({ over }) =>
        over ? `Solto sobre ${labelFor(over.id)}.` : "Fora de um destino.",
      onDragCancel: () => "Arraste cancelado.",
    };
  }, [titlesById]);

  function handleDragStart() {
    suppressClick.current = true;
  }

  function handleDragEnd(event: DragEndEvent) {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    void resolveFolderDragEnd({
      kind: "note",
      projectId,
      folders,
      viewFolderIds,
      openFolderId,
      activeId,
      overId,
      activeRect: active.rect.current.translated,
      overRect: over.rect,
    })
      .then((outcome) => {
        if (outcome === "created") {
          toast.success("Pasta criada com as duas notas");
        } else if (outcome === "reorder") {
          reorderNotes(activeId, overId);
        }
      })
      .catch(() => toast.error("Falha ao mover"));
  }

  /** Reordenação de fichas (drop na borda): na raiz mantém o esquema
   * fixadas/soltas; dentro da pasta reordena só as notas da pasta. */
  function reorderNotes(activeId: string, overId: string) {
    if (openFolderId !== null) {
      const oldIndex = folderNoteIds.indexOf(activeId);
      const newIndex = folderNoteIds.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(folderNoteIds, oldIndex, newIndex);
      void noteRepository
        .applyMoves(reordered.map((id, order) => ({ id, order })))
        .catch(() => toast.error("Falha ao reordenar"));
      return;
    }
    const activeNote = notes.find((note) => note.id === activeId);
    const overNote = notes.find((note) => note.id === overId);
    // Cross-group drags are not persisted (pinned and regular keep separate
    // ordering); mirroring the no-op fallback from the chapter list.
    if (!activeNote || !overNote || activeNote.pinned !== overNote.pinned) return;
    const group = activeNote.pinned ? pinnedNotes : regularNotes;
    const ids = group.map((note) => note.id);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    // Persist the full visible order (pinned first, then regular).
    const fullOrder = activeNote.pinned
      ? [...reordered, ...regularNotes.map((note) => note.id)]
      : [...pinnedNotes.map((note) => note.id), ...reordered];
    if (sort !== "manual") setSort("manual");
    void noteRepository
      .applyMoves(fullOrder.map((id, order) => ({ id, order })))
      .catch(() => toast.error("Falha ao reordenar"));
  }

  function handleDragCancel() {
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  }

  async function togglePin(note: Note) {
    await noteRepository.togglePinned(note.id, !note.pinned);
  }

  async function remove(note: Note) {
    await noteRepository.softDelete(note.id);
    toast(`"${note.title}" movida para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void noteRepository.restore(note.id);
        },
      },
    });
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

  async function clearNotes() {
    if (!projectId) return;
    const ids = await noteRepository.softDeleteByProject(projectId);
    if (ids.length === 0) return;
    toast(
      `${ids.length} ${ids.length === 1 ? "nota movida" : "notas movidas"} para a lixeira`,
      {
        action: {
          label: "Desfazer",
          onClick: () => {
            void noteRepository.restoreMany(ids);
          },
        },
      },
    );
  }

  async function handleExport(format: ExportFormat) {
    if (!projectId) return;
    const target = exportTarget.note ? [exportTarget.note] : sortedNotes;
    const title = exportTarget.note
      ? exportTarget.note.title
      : `Notas — ${project?.title ?? "Projeto"}`;
    try {
      const filename = safeFilename(title, format);
      if (format === "txt") {
        downloadBlob(
          new Blob([notesToTxt(target)], { type: "text/plain;charset=utf-8" }),
          filename,
        );
      } else if (format === "md") {
        downloadBlob(
          new Blob([notesToMd(target)], { type: "text/markdown;charset=utf-8" }),
          filename,
        );
      } else {
        const { buildPdf } = await import("@/features/export/infra/pdf-export");
        downloadBlob(
          buildPdf({
            title,
            author: project?.author,
            cover: false,
            chapters: target.map((note) => ({
              title: note.title,
              content: plainTextToDoc(note.content),
            })),
          }),
          filename,
        );
      }
      toast.success(exportTarget.note ? "Nota baixada." : "Notas baixadas.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao exportar as notas.",
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Planejamento"
        title="Notas"
        description="Ideias soltas, pesquisas e lembretes do projeto."
        count={
          notes.length > 0
            ? `${notes.length} ${notes.length === 1 ? "nota" : "notas"}`
            : undefined
        }
      >
        <NotesToolbar
          projectId={projectId}
          noteCount={notes.length}
          sort={sort}
          onSortChange={setSort}
          openFolderId={openFolderId}
          onFolderCreated={(folder) => setOpenFolderId(folder.id)}
          onExportAll={() => setExportTarget({ open: true })}
          onClearAll={() => void clearNotes()}
          onNewNote={() => setDialog({ open: true })}
        />
      </PageHeader>

      {projectId === null ? (
        <EmptyState
          title="Nenhum projeto ativo"
          hint="Crie um projeto para anotar ideias e lembretes."
        />
      ) : notes.length === 0 ? (
        <EmptyState
          title="Nenhuma nota ainda"
          hint="Use notas para ideias soltas, pesquisas e lembretes."
        />
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
          onDragEnd={(event) => {
            folderHint.onDragEnd();
            handleDragEnd(event);
          }}
          onDragCancel={() => {
            folderHint.onDragCancel();
            handleDragCancel();
          }}
        >
          <div className="grid gap-6">
            {currentFolder ? (
              <FolderBackBar title={currentFolder.name} onBack={exitFolder} />
            ) : null}
            {viewFolders.length > 0 ? (
              <section aria-label="Pastas de notas">
                <SortableContext
                  items={viewFolderIds}
                  strategy={rectSortingStrategy}
                >
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
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
                </SortableContext>
              </section>
            ) : null}
            {openFolderId === null ? (
              <>
                {pinnedNotes.length > 0 ? (
                  <NotesGrid
                    label="Notas fixadas"
                    notes={pinnedNotes}
                    suppressClick={suppressClick}
                    folderDropActive={folderHint.mode === "create"}
                    onOpenView={(target) => setViewNote(target)}
                    onTogglePin={(target) => void togglePin(target)}
                    onShare={(target) => setExportTarget({ open: true, note: target })}
                    onRemove={(target) => void remove(target)}
                  />
                ) : null}
                <NotesGrid
                  label="Notas"
                  notes={regularNotes}
                  suppressClick={suppressClick}
                  folderDropActive={folderHint.mode === "create"}
                  onOpenView={(target) => setViewNote(target)}
                  onTogglePin={(target) => void togglePin(target)}
                  onShare={(target) => setExportTarget({ open: true, note: target })}
                  onRemove={(target) => void remove(target)}
                />
              </>
            ) : (
              folderNotes.length > 0 ? (
                <NotesGrid
                  label="Notas da pasta"
                  notes={folderNotes}
                  suppressClick={suppressClick}
                  folderDropActive={folderHint.mode === "create"}
                  onOpenView={(target) => setViewNote(target)}
                  onTogglePin={(target) => void togglePin(target)}
                  onShare={(target) => setExportTarget({ open: true, note: target })}
                  onRemove={(target) => void remove(target)}
                />
              ) : viewFolders.length === 0 ? (
                <EmptyState hint="Pasta vazia. Arraste notas até aqui." />
              ) : null
            )}
          </div>
          {folderHint.hint}
        </DndContext>
      )}

      <NoteViewDialog
        note={viewNote}
        onEdit={(note) => {
          setViewNote(null);
          setDialog({ open: true, note });
        }}
        onShare={(note) => {
          setViewNote(null);
          setExportTarget({ open: true, note });
        }}
        onOpenChange={(open) => {
          if (!open) setViewNote(null);
        }}
        gallery={
          <ImageAttachments
            readOnly
            entityType="note"
            entityId={viewNote?.id}
          />
        }
      />

      <NoteDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        note={dialog.note ?? null}
        projectId={projectId}
      />

      <ExportFormatDialog
        open={exportTarget.open}
        onOpenChange={(open) => setExportTarget((state) => ({ ...state, open }))}
        onExport={(format) => void handleExport(format)}
        title={exportTarget.note ? "Compartilhar nota" : "Exportar notas"}
        description="Escolha o formato do arquivo para baixar."
      />
    </div>
  );
}
