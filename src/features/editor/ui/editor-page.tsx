"use client";

import type { Content } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { ArrowLeft, History, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CHAPTER_STATUS_LABELS } from "@/features/projects/domain/repository";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { getTabCoordinator } from "@/infra/db/multi-tab";
import { isQuotaExceededError } from "@/infra/storage/quota";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useUiStore } from "@/shared/store/ui-store";
import type {
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
import { SprintTimer } from "@/features/productivity/ui/sprint-timer";
import { TiptapEditor } from "./tiptap-editor";
import { VersionsDialog } from "./versions-dialog";

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

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function EditorPage({ chapterId }: { chapterId: string }) {
  const [chapter, setChapter] = useState<Chapter | null | undefined>(
    undefined,
  );
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ChapterStatus | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const focusMode = useUiStore((state) => state.focusMode);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);
  const editorFontFamily = useUiStore((state) => state.editorFontFamily);
  const editorFontSize = useUiStore((state) => state.editorFontSize);

  const editorRef = useRef<Editor | null>(null);
  const lastContentRef = useRef<Json | null>(null);
  const lastAutoAtRef = useRef<number | null>(null);
  const lastWordCountRef = useRef(0);
  const restoredRef = useRef(false);

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
          setSavedAt(new Date().toISOString());
        } catch (error) {
          setSaveStatus("error");
          if (isQuotaExceededError(error)) {
            toast.error("Armazenamento do navegador cheio", {
              description:
                "Exporte ou exclua projetos para liberar espaço em disco.",
            });
          } else {
            toast.error("Falha ao salvar", {
              description:
                error instanceof Error ? error.message : undefined,
            });
          }
        }
      }, AUTOSAVE_DELAY_MS),
    [],
  );

  const scheduleSave = useCallback(() => {
    const editor = editorRef.current;
    if (!chapter || !editor) return;
    const words = editor.storage.characterCount.words() as number;
    setWordCount(words);
    save.schedule({
      chapterId,
      projectId: chapter.projectId,
      title,
      content: editor.getJSON() as unknown as Json,
      wordCount: words,
      cursorOffset: editor.state.selection.anchor,
      scrollY: window.scrollY,
    });
  }, [chapter, chapterId, save, title]);

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
          editor.commands.setTextSelection(
            Math.min(lastEdit.cursorOffset, maxOffset),
          );
          requestAnimationFrame(() => window.scrollTo(0, lastEdit.scrollY));
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
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
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
          toast.info("Este projeto está aberto em outra aba", {
            description: "Edições concorrentes podem se sobrescrever.",
          });
        }
      },
    );
    return unsubscribe;
  }, [chapter]);

  // Escape exits focus mode.
  useEffect(() => {
    if (!focusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") toggleFocusMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, toggleFocusMode]);

  const saveManualVersion = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await createManualVersion(
        chapterId,
        editor.getJSON() as unknown as Json,
      );
      toast.success("Versão salva");
      setVersionsOpen(true);
    } catch {
      toast.error("Falha ao salvar a versão");
    }
  }, [chapterId]);

  const restoreVersion = useCallback(
    (version: Version) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.commands.setContent(version.snapshot as unknown as Content);
      setVersionsOpen(false);
      scheduleSave();
      toast.success("Versão restaurada");
    },
    [scheduleSave],
  );

  const changeStatus = useCallback(
    (next: ChapterStatus) => {
      setStatus(next);
      void chapterRepository.update(chapterId, { status: next }).catch(() => {
        toast.error("Falha ao atualizar o status");
      });
    },
    [chapterId],
  );

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
      <div className="mx-auto max-w-3xl rounded-lg border border-dashed p-10 text-center">
        <p className="font-serif text-lg">Capítulo não encontrado</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/projects">
            <ArrowLeft aria-hidden />
            Voltar para projetos
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={
        focusMode
          ? "mx-auto max-w-3xl px-4 py-8"
          : "mx-auto max-w-3xl space-y-4"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {!focusMode ? (
          <Button variant="ghost" size="icon" asChild aria-label="Voltar ao projeto">
            <Link href={`/projects/${chapter.projectId}`}>
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
        ) : null}
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            scheduleSave();
          }}
          className="h-9 min-w-0 flex-1 font-serif text-lg font-semibold"
          aria-label="Título do capítulo"
        />
        <Select
          value={status ?? chapter.status}
          onValueChange={(value) => changeStatus(value as ChapterStatus)}
        >
          <SelectTrigger className="h-9 w-32" aria-label="Status do capítulo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CHAPTER_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => void saveManualVersion()}
        >
          <History aria-hidden />
          Versões
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          onClick={toggleFocusMode}
          aria-label={
            focusMode ? "Sair do modo foco" : "Ativar modo foco (Esc para sair)"
          }
        >
          {focusMode ? (
            <Minimize2 aria-hidden className="size-4" />
          ) : (
            <Maximize2 aria-hidden className="size-4" />
          )}
        </Button>
      </div>

      <div
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
          onReady={handleEditorReady}
          onUpdate={scheduleSave}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{wordCount.toLocaleString("pt-BR")} palavras</span>
        <SprintTimer />
        <span data-testid="save-status" aria-live="polite">
          {saveStatus === "saving"
            ? "Salvando…"
            : saveStatus === "error"
              ? "Erro ao salvar"
              : savedAt
                ? `Salvo ${formatRelativeTime(savedAt)}`
                : "Nenhuma alteração ainda"}
        </span>
      </div>

      <VersionsDialog
        chapterId={chapterId}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestore={restoreVersion}
      />
    </div>
  );
}
