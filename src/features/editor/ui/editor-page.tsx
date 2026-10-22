"use client";

import type { Content } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { ArrowLeft, BookOpen, History, Maximize2, Minimize2, Share2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { chapterToMd, chapterToTxt } from "@/features/export/domain/plain-text";
import { downloadBlob, safeFilename } from "@/features/export/infra/download";
import {
  ExportFormatDialog,
  type ExportFormat,
} from "@/features/export/ui/export-format-dialog";
import { CHAPTER_STATUS_COLORS, CHAPTER_STATUS_DOT, CHAPTER_STATUS_LABELS } from "@/features/projects/domain/repository";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { getTabCoordinator } from "@/infra/db/multi-tab";
import { isQuotaExceededError } from "@/infra/storage/quota";
import type { MentionType } from "@/features/mentions/domain/entity-index";
import type { MentionClickSource } from "@/features/mentions/domain/mention-click";
import { useMentionEntities } from "@/features/mentions/ui/use-mention-entities";
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
import { MentionSheet } from "./mention-sheet";
import { VersionsDialog } from "./versions-dialog";

// O editor Tiptap é pesado (~145 kB): carrega só nesta rota (plan §7.9 — perf).
const TiptapEditor = dynamic(
  () => import("./tiptap-editor").then((mod) => mod.TiptapEditor),
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

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function EditorPage({ chapterId }: { chapterId: string }) {
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter | null | undefined>(
    undefined,
  );
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ChapterStatus | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingMention, setPendingMention] = useState<{
    type: MentionType;
    id: string;
    name: string;
  } | null>(null);
  // Ficha aberta *sobre* o editor (item 10), sem navegar para outra página.
  const [mentionSheet, setMentionSheet] = useState<{
    type: MentionType;
    id: string;
  } | null>(null);

  const focusMode = useUiStore((state) => state.focusMode);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);
  const editorSimplified = useUiStore((state) => state.editorSimplified);
  const editorFontFamily = useUiStore((state) => state.editorFontFamily);
  const editorFontSize = useUiStore((state) => state.editorFontSize);
  const mentionConfirmOpen = useUiStore((state) => state.mentionConfirmOpen);
  const setMentionConfirmOpen = useUiStore(
    (state) => state.setMentionConfirmOpen,
  );
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );
  const mentionBackToTextEnabled = useUiStore(
    (state) => state.mentionBackToTextEnabled,
  );
  const mentionBackToTextSeconds = useUiStore(
    (state) => state.mentionBackToTextSeconds,
  );
  const mentionEntities = useMentionEntities(chapter?.projectId ?? null);

  const editorRef = useRef<Editor | null>(null);
  const lastContentRef = useRef<Json | null>(null);
  const lastAutoAtRef = useRef<number | null>(null);
  const lastWordCountRef = useRef(0);
  const restoredRef = useRef(false);
  // Ponto exato de escrita (cursor + rolagem) guardado ao abrir a ficha.
  const returnPointRef = useRef<{ offset: number; scrollTop: number } | null>(
    null,
  );

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

  const scheduleSave = useCallback(
    (nextTitle?: string) => {
      const editor = editorRef.current;
      if (!chapter || !editor) return;
      const words = editor.storage.characterCount.words() as number;
      setWordCount(words);
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

  // Item 10: abre a ficha sobre o editor, guardando o ponto de escrita
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
      toast.success("Capítulo baixado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao compartilhar o capítulo.",
      );
    }
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

  // No layout simplificado os botões de ação ficam dentro do próprio editor.
  const editorActions = editorSimplified ? (
    <>
      <Select
        value={status ?? chapter.status}
        onValueChange={(value) => changeStatus(value as ChapterStatus)}
      >
        <SelectTrigger
          className={`h-8 w-32 gap-2 ${CHAPTER_STATUS_COLORS[status ?? chapter.status]}`}
          aria-label="Status do capítulo"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CHAPTER_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              <span
                aria-hidden
                className={`size-2 rounded-full ${CHAPTER_STATUS_DOT[value as ChapterStatus]}`}
              />
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Ler capítulo"
        onClick={() => router.push(`/read?chapter=${chapterId}`)}
      >
        <BookOpen aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Versões"
        onClick={() => void saveManualVersion()}
      >
        <History aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        aria-label="Compartilhar"
        onClick={() => setShareOpen(true)}
      >
        <Share2 aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8"
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
    </>
  ) : null;

  return (
    <div
      className={
        focusMode
          ? "mx-auto max-w-3xl space-y-4 px-4 py-8"
          : "mx-auto max-w-3xl space-y-4"
      }
    >
      <div className="flex items-center gap-2">
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
            scheduleSave(event.target.value);
          }}
          className="h-11 min-w-0 flex-1 font-serif text-xl font-semibold sm:text-2xl"
          aria-label="Título do capítulo"
        />
      </div>
      {!editorSimplified ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status ?? chapter.status}
            onValueChange={(value) => changeStatus(value as ChapterStatus)}
          >
            <SelectTrigger
              className={`h-9 w-36 gap-2 ${CHAPTER_STATUS_COLORS[status ?? chapter.status]}`}
              aria-label="Status do capítulo"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHAPTER_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${CHAPTER_STATUS_DOT[value as ChapterStatus]}`}
                  />
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => router.push(`/read?chapter=${chapterId}`)}
          >
            <BookOpen aria-hidden />
            Ler
          </Button>
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
            size="sm"
            className="h-9"
            onClick={() => setShareOpen(true)}
          >
            <Share2 aria-hidden />
            Compartilhar
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={toggleFocusMode}
            aria-label={
              focusMode
                ? "Sair do modo foco"
                : "Ativar modo foco (Esc para sair)"
            }
          >
            {focusMode ? (
              <Minimize2 aria-hidden className="size-4" />
            ) : (
              <Maximize2 aria-hidden className="size-4" />
            )}
          </Button>
        </div>
      ) : null}

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
          mentions={mentionEntities}
          onOpenMention={openMention}
          onReady={handleEditorReady}
          onUpdate={() => scheduleSave()}
          actions={editorActions}
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
        getCurrentContent={() =>
          (editorRef.current?.getJSON() as unknown as Json) ?? null
        }
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

      <AlertDialog
        open={pendingMention !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMention(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Abrir a ficha de {pendingMention?.name || "destaque"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Toque no nome destacado para abrir. Você pode desativar este
              aviso nas configurações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingMention) {
                  openMentionSheet(pendingMention.type, pendingMention.id);
                }
              }}
            >
              Abrir
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setMentionConfirmOpen(false);
                if (pendingMention) {
                  openMentionSheet(pendingMention.type, pendingMention.id);
                }
                toast.info(
                  "Aviso desativado. Você pode reativar nas Configurações.",
                );
              }}
            >
              Não perguntar de novo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
