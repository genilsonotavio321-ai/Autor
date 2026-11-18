"use client";

import type { Content } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { ArrowLeft, PanelRightOpen } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChapterBookmarks } from "@/features/bookmarks/application/use-chapter-bookmarks";
import { useProjectReady } from "@/features/projects/application/use-project-ready";
import { bookmarkExcerpt } from "@/features/bookmarks/domain/bookmark-excerpt";
import { bookmarkRepository } from "@/features/bookmarks/infra/dexie-bookmark-repository";
import { BookmarksDialog } from "@/features/bookmarks/ui/bookmarks-dialog";
import { EmptyState } from "@/components/layout/empty-state";
import { useRouter } from "@/infra/navigation/use-app-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { chapterToMd, chapterToTxt } from "@/features/export/domain/plain-text";
import { downloadBlob, safeFilename } from "@/features/export/infra/download";
import {
  ExportFormatDialog,
  type ExportFormat,
} from "@/features/export/ui/export-format-dialog";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { getTabCoordinator } from "@/infra/db/multi-tab";
import { isQuotaExceededError } from "@/infra/storage/quota";
import type { MentionType } from "@/features/mentions/domain/entity-index";
import type { MentionClickSource } from "@/features/mentions/domain/mention-click";
import { useMentionEntities } from "@/features/mentions/ui/use-mention-entities";
import { useUiStore } from "@/shared/store/ui-store";
import type {
  Bookmark,
  Chapter,
  ChapterStatus,
  Json,
  Version,
} from "@/shared/types/database";

import { createAutosave } from "../application/autosave";
import {
  createManualVersion,
  maybeCreateAutoVersion,
} from "../application/version-service";
import { toDayKey } from "@/features/productivity/domain/writing-log";
import { recordWords } from "@/features/productivity/infra/writing-log-repository";
import { EditorSidebar } from "./editor-sidebar";
import { MentionConfirmDialog } from "./mention-confirm-dialog";
import type { SaveStatus } from "./save-status-indicator";
import { MentionSheet } from "./mention-sheet";
import { VersionsDialog } from "./versions-dialog";

// O editor Tiptap é pesado (~145 kB): carrega só nesta rota (plan §7.9 — perf).
const TiptapEditor = dynamic(
  () =>
    import("./tiptap-editor").then((mod) => ({
      default: mod.TiptapEditor,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full rounded-lg" />,
  },
);

const AUTOSAVE_DELAY_MS = 800;

interface SavePayload {
  chapterId: string;
  projectId: string;
  title: string;
  content: Json;
  wordCount: number;
  cursorOffset: number;
  scrollY: number;
}

export function EditorPage({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter | null | undefined>(
    undefined,
  );
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ChapterStatus | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [revealGrifar, setRevealGrifar] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarkDocSize, setBookmarkDocSize] = useState<number | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [pendingMention, setPendingMention] = useState<{
    type: MentionType;
    id: string;
    name: string;
  } | null>(null);
  // Ficha aberta *sobre* o editor, sem navegar para outra página.
  const [mentionSheet, setMentionSheet] = useState<{
    type: MentionType;
    id: string;
  } | null>(null);

  const editorFontFamily = useUiStore((state) => state.editorFontFamily);
  const editorFontSize = useUiStore((state) => state.editorFontSize);
  const mentionConfirmOpen = useUiStore((state) => state.mentionConfirmOpen);
  const setMentionConfirmOpen = useUiStore(
    (state) => state.setMentionConfirmOpen,
  );
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );
  const editorSidebarCollapsed = useUiStore(
    (state) => state.editorSidebarCollapsed,
  );
  const setEditorSidebarCollapsed = useUiStore(
    (state) => state.setEditorSidebarCollapsed,
  );
  const mentionBackToTextEnabled = useUiStore(
    (state) => state.mentionBackToTextEnabled,
  );
  const mentionBackToTextSeconds = useUiStore(
    (state) => state.mentionBackToTextSeconds,
  );
  const mentionEntities = useMentionEntities(chapter?.projectId ?? null);
  const bookmarks = useChapterBookmarks(chapterId);
  useProjectReady(chapter !== undefined, chapter?.projectId ?? null);

  const editorRef = useRef<Editor | null>(null);
  const lastContentRef = useRef<Json | null>(null);
  const lastAutoAtRef = useRef<number | null>(null);
  const lastWordCountRef = useRef(0);
  const restoredRef = useRef(false);
  // Ponto exato de escrita (cursor + rolagem) guardado ao abrir a ficha.
  const returnPointRef = useRef<{ offset: number; scrollTop: number } | null>(
    null,
  );
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load chapter (and remember its content for auto-versioning).
  useEffect(() => {
    let alive = true;
    void chapterRepository.getById(chapterId).then((loaded) => {
      if (!alive) return;
      if (!loaded || loaded.deletedAt) {
        setChapter(null);
        return;
      }
      setChapter(loaded);
      setTitle(loaded.title);
      setStatus(loaded.status);
      setWordCount(loaded.wordCount);
      lastContentRef.current = loaded.content;
      lastWordCountRef.current = loaded.wordCount;
    });
    return () => {
      alive = false;
    };
  }, [chapterId]);

  const save = useMemo(
    () =>
      createAutosave<SavePayload>(async (payload) => {
        setSaveStatus("saving");
        try {
          await chapterRepository.update(payload.chapterId, {
            title: payload.title.trim() || "Sem título",
            content: payload.content,
            wordCount: payload.wordCount,
          });
          await projectRepository.updateLastEdit(payload.projectId, {
            chapterId: payload.chapterId,
            cursorOffset: payload.cursorOffset,
            scrollY: payload.scrollY,
            updatedAt: new Date().toISOString(),
          });
          if (lastContentRef.current) {
            try {
              lastAutoAtRef.current = await maybeCreateAutoVersion(
                payload.chapterId,
                lastContentRef.current,
                lastAutoAtRef.current,
              );
            } catch {
              // Versioning must never block saving.
            }
          }
          lastContentRef.current = payload.content;
          const delta = payload.wordCount - lastWordCountRef.current;
          if (delta > 0) {
            void recordWords(toDayKey(new Date()), delta).catch(
              () => undefined,
            );
          }
          lastWordCountRef.current = payload.wordCount;
          setSaveStatus("saved");
          setDirty(false);
          setSavedAt(new Date().toISOString());
        } catch (error) {
          setSaveStatus("error");
          if (isQuotaExceededError(error)) {
          } else {
          }
        }
      }, AUTOSAVE_DELAY_MS),
    [],
  );

  const scheduleSave = useCallback(
    (nextTitle?: string) => {
      const editor = editorRef.current;
      if (!chapter) return;
      if (!editor) {
        // Título editado antes de o Tiptap montar: o conteúdo ainda não existe,
        // mas o título não pode ser descartado.
        if (nextTitle === undefined) return;
        void chapterRepository
          .update(chapterId, { title: nextTitle.trim() || "Sem título" })
          .catch(() => undefined);
        return;
      }
      const words = editor.storage.characterCount.words() as number;
      setWordCount(words);
      setDirty(true);
      save.schedule({
        chapterId,
        projectId: chapter.projectId,
        // The title input hands its fresh value over: without it the debounced
        // payload would carry the previous render's title and the last typed
        // character would be dropped by the autosave.
        title: nextTitle ?? title,
        content: editor.getJSON() as unknown as Json,
        wordCount: words,
        cursorOffset: editor.state.selection.anchor,
        // O conteúdo do editor rola dentro dele mesmo (altura fixa): a página
        // fica parada, então window.scrollY seria sempre ~0.
        scrollY: editor.view.dom.scrollTop,
      });
    },
    [chapter, chapterId, save, title],
  );

  const handleEditorReady = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (restoredRef.current || !chapter) return;
      restoredRef.current = true;
      // Resume writing: restore cursor and scroll from the last session.
      void projectRepository
        .getById(chapter.projectId)
        .then((project) => {
          const lastEdit = project?.lastEdit;
          if (!lastEdit || lastEdit.chapterId !== chapterId) return;
          const maxOffset = editor.state.doc.content.size;
          editor.commands.focus(Math.min(lastEdit.cursorOffset, maxOffset), {
            scrollIntoView: false,
          });
          // Repõe a rolagem do próprio editor (não da página), repetindo
          // enquanto o conteúdo/layout assenta.
          const restoreScroll = () => {
            editor.view.dom.scrollTop = lastEdit.scrollY;
          };
          requestAnimationFrame(restoreScroll);
          window.setTimeout(restoreScroll, 100);
          window.setTimeout(restoreScroll, 400);
        })
        .catch(() => undefined);
    },
    [chapter, chapterId],
  );

  // Flush pending autosave when leaving the page or hiding the tab.
  useEffect(() => {
    const flush = () => {
      void save.flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    // `pagehide` cobre fechar a aba/sair do navegador, onde
    // `visibilitychange` não dispara de forma confiável.
    const onPageHide = () => flush();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, [save]);

  // Multi-tab: warn once when the same project is open in another tab.
  useEffect(() => {
    if (!chapter) return;
    const coordinator = getTabCoordinator();
    let warned = false;
    const unsubscribe = coordinator.subscribeProject(
      chapter.projectId,
      (otherTabPresent) => {
        if (otherTabPresent && !warned) {
          warned = true;
        }
      },
    );
    return unsubscribe;
  }, [chapter]);

  const saveManualVersion = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await createManualVersion(
        chapterId,
        editor.getJSON() as unknown as Json,
      );
    } catch {
    }
  }, [chapterId]);

  const restoreVersion = useCallback(
    (version: Version) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.commands.setContent(version.snapshot as unknown as Content);
      setVersionsOpen(false);
      scheduleSave();
    },
    [scheduleSave],
  );

  const openBookmarks = useCallback(() => {
    const editor = editorRef.current;
    setBookmarkDocSize(editor ? editor.state.doc.content.size : null);
    setBookmarksOpen(true);
  }, []);

  const addBookmark = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !chapter) return;
    const max = editor.state.doc.content.size;
    const position = Math.min(editor.state.selection.from, max);
    try {
      await bookmarkRepository.create({
        projectId: chapter.projectId,
        chapterId,
        position,
        excerpt: bookmarkExcerpt(editor.state.doc, position),
      });
    } catch {
    }
  }, [chapter, chapterId]);

  const jumpToBookmark = useCallback((bookmark: Bookmark) => {
    const editor = editorRef.current;
    if (!editor) return;
    const max = editor.state.doc.content.size;
    editor
      .chain()
      .focus(Math.min(bookmark.position, max))
      .scrollIntoView()
      .run();
    setBookmarksOpen(false);
  }, []);

  const removeBookmark = useCallback(async (bookmark: Bookmark) => {
    try {
      await bookmarkRepository.remove(bookmark.id);
    } catch {
    }
  }, []);

  const changeStatus = useCallback(
    (next: ChapterStatus) => {
      setStatus(next);
      void chapterRepository.update(chapterId, { status: next }).catch(() => {
      });
    },
    [chapterId],
  );

  const goToMention = useCallback(
    (type: MentionType, id: string) => {
      if (!chapter) return;
      setSelectedProjectId(chapter.projectId);
      router.push(
        type === "character"
          ? `/characters?character=${id}`
          : `/world?location=${id}`,
      );
    },
    [chapter, router, setSelectedProjectId],
  );

  // Abre a ficha sobre o editor, guardando o ponto de escrita
  // (cursor + rolagem do ProseMirror) para o "Voltar ao texto".
  const openMentionSheet = useCallback((type: MentionType, id: string) => {
    const editor = editorRef.current;
    if (editor) {
      returnPointRef.current = {
        offset: editor.state.selection.anchor,
        scrollTop: editor.view.dom.scrollTop,
      };
    }
    setMentionSheet({ type, id });
  }, []);

  const closeMentionSheet = useCallback(() => setMentionSheet(null), []);

  const backToText = useCallback(() => {
    setMentionSheet(null);
    const editor = editorRef.current;
    const point = returnPointRef.current;
    if (!editor || !point) return;
    const maxOffset = editor.state.doc.content.size;
    editor.commands.focus(Math.min(point.offset, maxOffset), {
      scrollIntoView: false,
    });
    requestAnimationFrame(() => {
      editor.view.dom.scrollTop = point.scrollTop;
    });
  }, []);

  const openMention = useCallback(
    (type: MentionType, id: string, source: MentionClickSource) => {
      // Ctrl/Cmd+click is the documented shortcut — always opens directly.
      if (source === "modifier" || !mentionConfirmOpen) {
        openMentionSheet(type, id);
        return;
      }
      const entity = mentionEntities.find(
        (item) => item.type === type && item.id === id,
      );
      setPendingMention({ type, id, name: entity?.name ?? "" });
    },
    [openMentionSheet, mentionConfirmOpen, mentionEntities],
  );

  async function handleShare(format: ExportFormat) {
    if (!chapter) return;
    try {
      // O autosave é debounced (800 ms): força o flush e lê o documento vivo
      // do editor, senão a exportação sai com o conteúdo do mount.
      await save.flush();
      const content = (editorRef.current?.getJSON() as Json) ?? chapter.content;
      const fresh = { ...chapter, content };
      const filename = safeFilename(chapter.title, format);
      if (format === "txt") {
        downloadBlob(
          new Blob([chapterToTxt(fresh)], {
            type: "text/plain;charset=utf-8",
          }),
          filename,
        );
      } else if (format === "md") {
        downloadBlob(
          new Blob([chapterToMd(fresh)], {
            type: "text/markdown;charset=utf-8",
          }),
          filename,
        );
      } else if (format === "pdf") {
        // jsPDF é pesado: carrega só quando o usuário pede PDF.
        const { buildPdf } = await import(
          "@/features/export/infra/pdf-export"
        );
        downloadBlob(
          buildPdf({
            title: chapter.title,
            chapters: [{ title: chapter.title, content }],
            cover: false,
          }),
          filename,
        );
      }
    } catch {
    }
  }

  async function insertImageFromInput(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const editor = editorRef.current;
    if (!editor) return;
    const { insertImageFiles, imageFilesOf } = await import("./tiptap-editor");
    await insertImageFiles(editor.view, imageFilesOf(fileList));
    scheduleSave();
  }

  if (chapter === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!chapter || chapter.deletedAt) {
    return (
      <EmptyState
        className="mx-auto max-w-3xl"
        title="Capítulo não encontrado"
        hint="Ele pode ter sido excluído ou estar na lixeira."
      >
        <Button asChild variant="outline">
          <Link href="/projects">
            <ArrowLeft aria-hidden />
            Voltar para projetos
          </Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl pt-1">
      <div
        className="flex items-start gap-2"
      >
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 shrink-0"
          asChild
          aria-label="Voltar ao projeto"
        >
          <Link href={`/projects/${chapter.projectId}`}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            scheduleSave(event.target.value);
          }}
          className="h-auto min-w-0 flex-1 rounded-none border-0 border-b border-transparent bg-transparent px-0 py-1 font-serif text-[2.1rem] font-medium tracking-[-0.015em] shadow-none focus-visible:border-border focus-visible:ring-0 dark:bg-transparent md:text-[2.6rem]"
          aria-label="Título do capítulo"
        />
        <div className="mt-1 flex shrink-0 items-center gap-1.5">
          {/* O botão de expandir entra deslizando pela borda direita. */}
          <div className="size-9 shrink-0 overflow-hidden">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                // `translate`: o Tailwind v4 não usa `transform` nas utilidades
                // de deslocamento — animar `transform` não produzia efeito.
                "rounded-full transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                editorSidebarCollapsed
                  ? "visible translate-x-0 opacity-100"
                  : "pointer-events-none invisible translate-x-10 opacity-0",
              )}
              aria-label="Expandir ações do capítulo"
              aria-hidden={!editorSidebarCollapsed}
              tabIndex={editorSidebarCollapsed ? 0 : -1}
              onClick={() => setEditorSidebarCollapsed(false)}
            >
              <PanelRightOpen aria-hidden />
            </Button>
          </div>
        </div>
      </div>
      <div aria-hidden className="hairline mt-3" />

      <div
        className="relative mt-4"
        style={{
          fontSize: `${editorFontSize}px`,
          fontFamily:
            editorFontFamily === "sans"
              ? "var(--font-sans)"
              : "var(--font-serif)",
        }}
      >
        <TiptapEditor
          content={chapter.content}
          mentions={mentionEntities}
          onOpenMention={openMention}
          onReady={handleEditorReady}
          onUpdate={() => scheduleSave()}
          onEditorState={(state) => {
            setCanUndo(state.canUndo);
            setCanRedo(state.canRedo);
          }}
          revealGrifar={revealGrifar}
          reviewOpen={reviewOpen}
          onReviewOpenChange={setReviewOpen}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] tracking-wide text-muted-foreground">
        <span>{wordCount.toLocaleString("pt-BR")} palavras</span>
      </div>

      <EditorSidebar
        status={status ?? chapter.status}
        onStatusChange={changeStatus}
        saveStatus={saveStatus}
        dirty={dirty}
        savedAt={savedAt}
        onBookmarks={openBookmarks}
        onRead={() =>
          router.push(`/read?project=${chapter.projectId}&chapter=${chapterId}`)
        }
        onStructure={() => router.push("/outline")}
        onShare={() => setShareOpen(true)}
        onVersions={() => setVersionsOpen(true)}
        revealGrifar={revealGrifar}
        onToggleRevealGrifar={() => setRevealGrifar((value) => !value)}
        onInsertImage={() => imageInputRef.current?.click()}
        onUndo={() => editorRef.current?.chain().focus().undo().run()}
        onRedo={() => editorRef.current?.chain().focus().redo().run()}
        canUndo={canUndo}
        canRedo={canRedo}
        onReview={() => setReviewOpen(true)}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Inserir imagem no capítulo"
        onChange={(event) => {
          void insertImageFromInput(event.target.files);
          event.target.value = "";
        }}
      />

      <BookmarksDialog
        open={bookmarksOpen}
        onOpenChange={setBookmarksOpen}
        bookmarks={bookmarks}
        docSize={bookmarkDocSize}
        onAdd={() => void addBookmark()}
        onJump={jumpToBookmark}
        onRemove={(bookmark) => void removeBookmark(bookmark)}
      />

      <VersionsDialog
        chapterId={chapterId}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestore={restoreVersion}
        getCurrentContent={() =>
          (editorRef.current?.getJSON() as unknown as Json) ?? null
        }
        onCreateVersion={() => saveManualVersion()}
      />

      <ExportFormatDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        onExport={(format) => void handleShare(format)}
      />

      <MentionSheet
        target={mentionSheet}
        backToTextSeconds={mentionBackToTextSeconds}
        backToTextEnabled={mentionBackToTextEnabled}
        onBackToText={backToText}
        onEdit={(target) => {
          closeMentionSheet();
          goToMention(target.type, target.id);
        }}
        onOpenChange={(open) => {
          if (!open) closeMentionSheet();
        }}
      />

      <MentionConfirmDialog
        open={pendingMention !== null}
        name={pendingMention?.name ?? ""}
        onOpenChange={(open) => {
          if (!open) setPendingMention(null);
        }}
        onConfirm={() => {
          if (pendingMention) {
            openMentionSheet(pendingMention.type, pendingMention.id);
          }
        }}
        onDontAskAgain={() => {
          setMentionConfirmOpen(false);
          if (pendingMention) {
            openMentionSheet(pendingMention.type, pendingMention.id);
          }
        }}
      />
    </div>
  );
}
