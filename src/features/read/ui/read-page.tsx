"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Eye, Highlighter, List, PenLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
import { estimateReadingMinutes } from "@/features/productivity/domain/writing-log";
import type { MentionType } from "@/features/mentions/domain/entity-index";
import { useMentionEntities } from "@/features/mentions/ui/use-mention-entities";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { formatRelativeTime } from "@/shared/lib/dates";
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
  const [chapterId, setChapterId] = useState<string | null>(chapterParam);
  // Capítulo pedido pelo link: pode estar arquivado e ainda assim ser lido.
  // Fica em estado porque a query é limpa da URL e o parâmetro some.
  const [requestedChapterId, setRequestedChapterId] = useState<string | null>(
    chapterParam,
  );
  const [chooserOpen, setChooserOpen] = useState(false);
  // Destaque ampliado dos trechos grifados (toggle visual, sem navegação).
  const [grifarReveal, setGrifarReveal] = useState(false);
  // O botão de grifar vive na barra: a seleção acontece dentro do documento.
  const [hasSelection, setHasSelection] = useState(false);
  const [grifarRequest, setGrifarRequest] = useState(0);
  const readGrifarEnabled = useUiStore((state) => state.readGrifarEnabled);

  useEffect(() => {
    if (!projectParam) return;
    setSelectedProjectId(projectParam);
  }, [projectParam, setSelectedProjectId]);

  // Trocar de capítulo zera a seleção do documento anterior.
  useEffect(() => setHasSelection(false), [chapterId]);

  // Um novo capítulo pedido pelo link vence a seleção anterior.
  useEffect(() => {
    if (!chapterParam) return;
    setRequestedChapterId(chapterParam);
    setChapterId(chapterParam);
  }, [chapterParam]);

  // A URL volta a ser só `/read` depois de aplicar os parâmetros.
  useEffect(() => {
    if (!projectParam && !chapterParam) return;
    if (chapterParam && chapterId !== chapterParam) return;
    router.replace("/read", { scroll: false });
  }, [chapterId, chapterParam, projectParam, router]);

  // Capítulos arquivados ficam fora da leitura, exceto o pedido pelo link.
  const chapters = useMemo(
    () =>
      (liveChapters ?? []).filter(
        (chapter) => !chapter.archived || chapter.id === requestedChapterId,
      ),
    [liveChapters, requestedChapterId],
  );

  // Keep a valid selection when the project or chapter list changes.
  useEffect(() => {
    // Enquanto a live query carrega (`undefined`) ou o projeto ainda não foi
    // selecionado, o capítulo pedido pelo link não está na lista: limpar aqui
    // cairia no primeiro capítulo.
    if (!projectId || !liveChapters) return;
    if (!chapterId) {
      setChapterId(chapters[0]?.id ?? null);
      return;
    }
    // Lista vazia pode ser "ainda carregando": preserva o capítulo pedido.
    if (chapters.length === 0) return;
    if (chapters.some((chapter) => chapter.id === chapterId)) return;
    // Fora da lista: um link direto pode apontar para outro projeto. Busca o
    // capítulo antes de cair no primeiro do projeto selecionado.
    let cancelled = false;
    void chapterRepository.getById(chapterId).then((found) => {
      if (cancelled) return;
      if (found && !found.deletedAt && found.projectId !== projectId) {
        setSelectedProjectId(found.projectId);
        return;
      }
      setChapterId(chapters[0]?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [chapters, chapterId, liveChapters, projectId, setSelectedProjectId]);

  const chapter: Chapter | null = useMemo(
    () => chapters.find((item) => item.id === chapterId) ?? null,
    [chapters, chapterId],
  );

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
          <div className={grifarReveal ? "grifar-reveal" : undefined}>
            <ReadingDocument
              content={chapter.content}
              mentions={mentionEntities}
              onOpenMention={openMention}
              onGrifarChange={handleGrifarChange}
              onSelectionChange={setHasSelection}
              grifarRequest={grifarRequest}
            />
          </div>
        </article>
      ) : null}

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
