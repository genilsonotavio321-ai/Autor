"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, PenLine, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUiStore } from "@/shared/store/ui-store";

import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";

interface ResumeTarget {
  chapterId: string;
  projectTitle: string;
  chapterTitle: string;
}

/**
 * Localiza o capítulo editado mais recentemente entre os projetos ativos.
 * Compartilhado entre o Painel e a seção "Continuar" da página inicial.
 */
function findResume(): Promise<ResumeTarget | null> {
  return projectRepository.listActive().then(async (projects) => {
    let latestEdit = "";
    let resume: ResumeTarget | null = null;

    for (const project of projects) {
      const lastEdit = project.lastEdit;
      if (!lastEdit || lastEdit.updatedAt <= latestEdit) continue;
      const chapter = await chapterRepository.getById(lastEdit.chapterId);
      if (chapter && !chapter.deletedAt) {
        latestEdit = lastEdit.updatedAt;
        resume = {
          chapterId: chapter.id,
          projectTitle: project.title,
          chapterTitle: chapter.title,
        };
      }
    }

    return resume;
  });
}

interface ResumeWritingCardData {
  resume: ResumeTarget | null;
  projectCount: number;
}

/**
 * Card "Continuar de onde parou": retoma o último capítulo editado.
 * Auto-contido (busca e timer próprios) para ser reusado no Painel e na Home.
 */
export function ResumeWritingCard() {
  const resumeNoticeSeconds = useUiStore((state) => state.resumeNoticeSeconds);
  const [resumeVisible, setResumeVisible] = useState(true);

  const data = useLiveQuery(async (): Promise<ResumeWritingCardData> => {
    const projects = await projectRepository.listActive();
    return { resume: await findResume(), projectCount: projects.length };
  }, []);

  // Oculta o card após o tempo configurado (0 = nunca exibir).
  // O timer reinicia quando o capítulo-alvo muda.
  const resumeKey = data?.resume?.chapterId ?? null;
  useEffect(() => {
    setResumeVisible(true);
    if (resumeKey === null || resumeNoticeSeconds <= 0) return;
    const timer = setTimeout(
      () => setResumeVisible(false),
      resumeNoticeSeconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [resumeKey, resumeNoticeSeconds]);

  if (!data) return null;

  if (data.resume && resumeNoticeSeconds > 0 && resumeVisible) {
    return (
      <section aria-label="Continuar de onde parou">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Continuar de onde parou
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">
              {data.resume.chapterTitle}
            </CardTitle>
            <CardDescription>{data.resume.projectTitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={`/write/${data.resume.chapterId}`}>
                <PenLine aria-hidden />
                Continuar escrevendo
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (data.resume) return null;

  return (
    <section aria-label="Continuar de onde parou">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Continuar de onde parou
      </h2>
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {data.projectCount === 0
            ? "Crie um projeto para começar a escrever."
            : "Abra um capítulo para retomar de onde parou."}
        </p>
        <Button asChild className="mt-4">
          <Link href="/projects">
            <Plus aria-hidden />
            Ir para projetos
          </Link>
        </Button>
      </div>
    </section>
  );
}
