"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, ChevronRight, Eye, PenLine } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const chapters = useMemo(() => liveChapters ?? [], [liveChapters]);
  const [chapterId, setChapterId] = useState<string | null>(null);
  // Destaque ampliado dos trechos grifados (toggle visual, sem navegação).
  const [grifarReveal, setGrifarReveal] = useState(false);
  const requestedChapterRef = useRef(true);

  // Keep a valid selection when the project or chapter list changes.
  // On the first commit, honor ?chapter= (from /write "Ler"), then strip it.
  useEffect(() => {
    if (chapters.length === 0) {
      setChapterId(null);
      return;
    }
    let requested: string | null = null;
    if (requestedChapterRef.current) {
      requestedChapterRef.current = false;
      requested = new URLSearchParams(window.location.search).get("chapter");
      if (requested) {
        window.history.replaceState({}, "", "/read");
      }
    }
    setChapterId((current) => {
      if (current && chapters.some((chapter) => chapter.id === current)) {
        return current;
      }
      if (requested && chapters.some((chapter) => chapter.id === requested)) {
        return requested;
      }
      return chapters[0]?.id ?? null;
    });
  }, [chapters]);

  const index = useMemo(
    () => chapters.findIndex((chapter) => chapter.id === chapterId),
    [chapters, chapterId],
  );
  const chapter: Chapter | null = index >= 0 ? (chapters[index] ?? null) : null;

  function step(delta: number) {
    const next = chapters[index + delta];
    if (next) setChapterId(next.id);
  }

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
    void chapterRepository.update(chapter.id, { content: json }).catch(() => undefined);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Ler</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            aria-pressed={grifarReveal}
            onClick={() => setGrifarReveal((value) => !value)}
          >
            <Eye aria-hidden />
            Revelar grifados
          </Button>
          <Button
            variant="outline"
            disabled={!chapter}
            onClick={() => chapter && router.push(`/write/${chapter.id}`)}
          >
            <PenLine aria-hidden />
            Editar
          </Button>
        </div>
      </header>

      {projectId === null ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Selecione ou crie um projeto para ler o manuscrito.
        </div>
      ) : chapters.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Este projeto ainda não tem capítulos. Escreva algo para ler aqui.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="icon"
              aria-label="Capítulo anterior"
              disabled={index <= 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Select
              value={chapterId ?? undefined}
              onValueChange={(value) => setChapterId(value)}
            >
              <SelectTrigger className="min-w-56 flex-1" aria-label="Capítulo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chapters.map((item, itemIndex) => (
                  <SelectItem key={item.id} value={item.id}>
                    {itemIndex + 1}. {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo capítulo"
              disabled={index < 0 || index >= chapters.length - 1}
              onClick={() => step(1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>

          {chapter ? (
            <article aria-labelledby="reading-title" className="grid gap-2">
              <h2
                id="reading-title"
                className="font-serif text-2xl font-semibold"
              >
                {chapter.title}
              </h2>
              <p className="text-xs text-muted-foreground">
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
                />
              </div>
            </article>
          ) : null}
        </>
      )}
    </div>
  );
}
