"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Bookmark, Eye, Highlighter, List, PenLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { useRouter } from "@/infra/navigation/use-app-router";
import { cn } from "@/lib/utils";
import { PageActionBar } from "@/components/layout/action-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useChapterBookmarks } from "@/features/bookmarks/application/use-chapter-bookmarks";
import { bookmarkRepository } from "@/features/bookmarks/infra/dexie-bookmark-repository";
import { BookmarksDialog } from "@/features/bookmarks/ui/bookmarks-dialog";
import { estimateReadingMinutes } from "@/features/productivity/domain/writing-log";
import type { MentionType } from "@/features/mentions/domain/entity-index";
import { useMentionEntities } from "@/features/mentions/ui/use-mention-entities";
import { useProjectReady } from "@/features/projects/application/use-project-ready";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { nextReadChapterId } from "@/features/read/domain/chapter-selection";
import { resolveReadingSwipe } from "@/features/read/domain/swipe-navigation";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useHorizontalSwipe } from "@/shared/lib/use-horizontal-swipe";
import { useUiStore } from "@/shared/store/ui-store";
import type { Chapter, Json } from "@/shared/types/database";

const ReadingDocument = dynamic(
  () =>
    import("./reading-document").then((module) => module.ReadingDocument),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full rounded-lg" />,
  },
);

export function ReadPage() {
  const router = useRouter();
  const { projectId } = useSelectedProject();
  const mentionEntities = useMentionEntities(projectId);
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );
  const liveChapters = useLiveQuery(
    () => (projectId ? chapterRepository.listByProject(projectId) : []),
    [projectId],
  );
  // `/read?project=…&chapter=…` (clique na lista de capítulos). Lido do router:
  // um segundo clique em /read precisa enxergar a nova query.
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const chapterParam = searchParams.get("chapter");
  const [chapterId, setChapterId] = useState<string | null>(null);
  // Capítulo pedido pelo link: pode estar arquivado e ainda assim ser lido.
  // Fica em estado porque a query é limpa da URL e o parâmetro some.
  const [requestedChapterId, setRequestedChapterId] = useState<string | null>(
    chapterParam,
  );
  // O deep link é aplicado uma única vez; depois a troca de projeto manda.
  const [deepLinkDone, setDeepLinkDone] = useState(() => !chapterParam);
  const [chooserOpen, setChooserOpen] = useState(false);
  // Destaque ampliado dos trechos grifados (toggle visual, sem navegação).
  const [grifarReveal, setGrifarReveal] = useState(false);
  // O botão de grifar vive na barra: a seleção acontece dentro do documento.
  const [hasSelection, setHasSelection] = useState(false);
  const [grifarRequest, setGrifarRequest] = useState(0);
  // Marcadores: pedido de criação, salto pendente e tamanho do documento.
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarkAddRequest, setBookmarkAddRequest] = useState(0);
  const [bookmarkJump, setBookmarkJump] = useState<{
    position: number;
    nonce: number;
  } | null>(null);
  const [bookmarkDocSize, setBookmarkDocSize] = useState<number | null>(null);
  const readGrifarEnabled = useUiStore((state) => state.readGrifarEnabled);
  const readFontSize = useUiStore((state) => state.readFontSize);
  const bookmarks = useChapterBookmarks(chapterId);

  useEffect(() => {
    if (!projectParam) return;
    setSelectedProjectId(projectParam);
  }, [projectParam, setSelectedProjectId]);

  // Trocar de capítulo zera a seleção do documento anterior.
  useEffect(() => setHasSelection(false), [chapterId]);

  // Deep link (`/read?project=…&chapter=…`): adota o projeto e o capítulo do
  // link uma única vez. Nenhum efeito posterior volta o projeto selecionado.
  const appliedChapterParam = useRef<string | null>(null);
  // Troca de projeto causada pelo próprio deep link: não pode descartar o
  // capítulo que o link pediu.
  const deepLinkProjectId = useRef<string | null>(null);
  useEffect(() => {
    if (!chapterParam || appliedChapterParam.current === chapterParam) return;
    appliedChapterParam.current = chapterParam;
    void chapterRepository.getById(chapterParam).then((found) => {
      // Resposta de um link anterior: o parâmetro atual é quem manda. Sem esse
      // token, o cleanup do StrictMode cancelava a única requisição e o
      // capítulo pedido nunca era selecionado (Editar capítulo ficava travado).
      if (appliedChapterParam.current !== chapterParam) return;
      if (found && !found.deletedAt) {
        deepLinkProjectId.current = found.projectId;
        setSelectedProjectId(found.projectId);
        setRequestedChapterId(found.id);
        setChapterId(found.id);
      } else {
        setRequestedChapterId(chapterParam);
      }
      setDeepLinkDone(true);
    });
  }, [chapterParam, setSelectedProjectId]);

  // A URL volta a ser só `/read` depois de aplicar os parâmetros.
  useEffect(() => {
    if (!projectParam && !chapterParam) return;
    if (!deepLinkDone) return;
    router.replace("/read", { scroll: false });
  }, [chapterParam, deepLinkDone, projectParam, router]);

  // Troca de projeto (seletor/menu rápido): recomeça do primeiro capítulo do
  // projeto novo. Preservar o capítulo anterior era o que fazia a leitura
  // alternar entre os dois projetos.
  const previousProjectId = useRef(projectId);
  useEffect(() => {
    if (previousProjectId.current === projectId) return;
    previousProjectId.current = projectId;
    setHasSelection(false);
    // O deep link já escolheu projeto + capítulo: preserva o capítulo pedido.
    if (deepLinkProjectId.current === projectId) {
      deepLinkProjectId.current = null;
      return;
    }
    setChapterId(null);
    setRequestedChapterId(null);
  }, [projectId]);

  // Lista de outro projeto enquanto a live query reemite: trata como carregando.
  const chaptersStale =
    liveChapters !== undefined &&
    liveChapters.length > 0 &&
    liveChapters[0]!.projectId !== projectId;
  const chaptersLoading = liveChapters === undefined || chaptersStale;

  // Capítulos arquivados ficam fora da leitura, exceto o pedido pelo link.
  const chapters = useMemo(
    () =>
      chaptersLoading
        ? []
        : (liveChapters ?? []).filter(
            (chapter) =>
              !chapter.archived || chapter.id === requestedChapterId,
          ),
    [chaptersLoading, liveChapters, requestedChapterId],
  );

  // Mantém uma seleção válida quando a lista de capítulos muda.
  useEffect(() => {
    if (!deepLinkDone) return;
    const next = nextReadChapterId({
      loading: chaptersLoading,
      chapterIds: chapters.map((chapter) => chapter.id),
      currentChapterId: chapterId,
    });
    if (next === undefined) return;
    setChapterId(next);
  }, [chapters, chapterId, chaptersLoading, deepLinkDone]);

  const chapter: Chapter | null = useMemo(
    () => chapters.find((item) => item.id === chapterId) ?? null,
    [chapters, chapterId],
  );

  const chapterIndex = chapterId
    ? chapters.findIndex((item) => item.id === chapterId)
    : -1;

  // Deslize (celular): avança/volta capítulos; no primeiro, volta ao projeto.
  useHorizontalSwipe({
    onSwipeLeft: () => {
      const result = resolveReadingSwipe({
        direction: "left",
        chapterIndex,
        chapterCount: chapters.length,
      });
      const target = result.type === "chapter" ? chapters[result.index] : null;
      if (!target) return;
      setChapterId(target.id);
      window.scrollTo({ top: 0 });
    },
    onSwipeRight: () => {
      const result = resolveReadingSwipe({
        direction: "right",
        chapterIndex,
        chapterCount: chapters.length,
      });
      if (result.type === "chapter") {
        const target = chapters[result.index];
        if (!target) return;
        setChapterId(target.id);
        window.scrollTo({ top: 0 });
        return;
      }
      if (result.type === "project" && projectId) {
        router.push(`/projects/${projectId}`);
      }
    },
  });

  const ready =
    !chaptersLoading && (chapters.length === 0 || chapter !== null);
  useProjectReady(ready, projectId);

  function openMention(type: MentionType, id: string) {
    if (!projectId) return;
    setSelectedProjectId(projectId);
    router.push(
      type === "character"
        ? `/characters?character=${id}`
        : `/world?location=${id}`,
    );
  }

  // Persiste a grife aplicada no modo leitura. Guard contra loop com
  // useLiveQuery: só grava quando o documento difere do salvo.
  function handleGrifarChange(json: Json) {
    if (!chapter) return;
    if (JSON.stringify(json) === JSON.stringify(chapter.content)) return;
    void chapterRepository
      .update(chapter.id, { content: json })
      .catch(() => undefined);
  }

  async function handleBookmarkAt(position: number, excerpt: string) {
    if (!chapter) return;
    try {
      await bookmarkRepository.create({
        projectId: chapter.projectId,
        chapterId: chapter.id,
        position,
        excerpt,
      });

    } catch {

    }
  }

  function handleJumpToBookmark(position: number) {
    setBookmarkJump({ position, nonce: Date.now() });
    setBookmarksOpen(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-2">
      <header className="space-y-1 text-center">
        <p className="eyebrow">Manuscrito</p>
        <h1 className="display-title">Ler</h1>
      </header>

      <PageActionBar>
        <Button
          size="icon"
          className="rounded-full"
          aria-label="Grifar seleção"
          title={
            readGrifarEnabled
              ? "Grifar seleção"
              : "Grifar desativado nas Configurações"
          }
          disabled={!readGrifarEnabled || !hasSelection || !chapter}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setGrifarRequest((value) => value + 1)}
        >
          <Highlighter aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "rounded-full",
            grifarReveal
              ? "bg-accent text-accent-foreground [&_svg]:opacity-100"
              : "text-muted-foreground [&_svg]:opacity-70",
          )}
          aria-label="Revelar grifados"
          title="Revelar grifados"
          aria-pressed={grifarReveal}
          onClick={() => setGrifarReveal((value) => !value)}
        >
          <Eye aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Marcadores"
          title="Marcadores"
          disabled={!chapter}
          onClick={() => setBookmarksOpen(true)}
        >
          <Bookmark aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Escolher capítulo"
          title="Escolher capítulo"
          disabled={chapters.length === 0}
          onClick={() => setChooserOpen(true)}
        >
          <List aria-hidden />
        </Button>
        <Button
          size="icon"
          className="rounded-full"
          aria-label="Editar capítulo"
          title="Editar capítulo"
          disabled={!chapter}
          onClick={() => chapter && router.push(`/write/${chapter.id}`)}
        >
          <PenLine aria-hidden />
        </Button>
      </PageActionBar>

      {projectId === null ? (
        <EmptyState
          title="Nenhum projeto ativo"
          hint="Selecione ou crie um projeto para ler o manuscrito."
        />
      ) : chaptersLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : chapters.length === 0 ? (
        <EmptyState
          title="Nenhum capítulo ainda"
          hint="Este projeto ainda não tem capítulos. Escreva algo para ler aqui."
        />
      ) : chapter ? (
        <article aria-labelledby="reading-title" className="grid gap-3">
          <h2
            id="reading-title"
            className="font-serif text-3xl leading-tight font-semibold tracking-tight"
          >
            {chapter.title}
          </h2>
          <p className="text-[11px] tracking-wide text-muted-foreground">
            {chapter.wordCount.toLocaleString("pt-BR")} palavras ·{" "}
            {estimateReadingMinutes(chapter.wordCount)} min de leitura ·
            atualizado {formatRelativeTime(chapter.updatedAt)}
          </p>
          <div
            className={grifarReveal ? "grifar-reveal" : undefined}
            style={{ fontSize: `${readFontSize}px` }}
          >
            <ReadingDocument
              content={chapter.content}
              mentions={mentionEntities}
              onOpenMention={openMention}
              onGrifarChange={handleGrifarChange}
              onSelectionChange={setHasSelection}
              grifarRequest={grifarRequest}
              bookmarkAddRequest={bookmarkAddRequest}
              onBookmarkAt={handleBookmarkAt}
              onDocSize={setBookmarkDocSize}
              jumpToBookmark={bookmarkJump}
            />
          </div>
        </article>
      ) : null}

      <BookmarksDialog
        open={bookmarksOpen}
        onOpenChange={setBookmarksOpen}
        bookmarks={bookmarks}
        docSize={bookmarkDocSize}
        onAdd={() => setBookmarkAddRequest((value) => value + 1)}
        onJump={(bookmark) => handleJumpToBookmark(bookmark.position)}
        onRemove={(bookmark) => {
          void bookmarkRepository
            .remove(bookmark.id)
            .catch(() => undefined);
        }}
      />

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolher capítulo</DialogTitle>
            <DialogDescription>
              O manuscrito é lido na ordem dos capítulos do projeto.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 divide-y overflow-y-auto">
            {chapters.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChapterId(item.id);
                    setChooserOpen(false);
                  }}
                  aria-current={item.id === chapterId ? "page" : undefined}
                  className={`flex w-full items-center gap-2 px-2 py-2.5 text-left text-sm hover:bg-accent/60 ${
                    item.id === chapterId ? "font-semibold" : ""
                  }`}
                >
                  <span className="w-6 shrink-0 text-xs text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.archived ? (
                    <span className="text-[10px] text-muted-foreground">
                      arquivado
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
