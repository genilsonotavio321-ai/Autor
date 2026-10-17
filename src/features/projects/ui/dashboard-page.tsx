"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, PenLine, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";

interface DashboardStats {
  projectCount: number;
  chapterCount: number;
  wordCount: number;
  resume: { chapterId: string; projectTitle: string; chapterTitle: string } | null;
}

interface DashboardData extends DashboardStats {
  loading: boolean;
}

export function DashboardPage() {
  const stats = useLiveQuery(async (): Promise<DashboardData> => {
    const projects = await projectRepository.listActive();

    let chapterCount = 0;
    let wordCount = 0;
    let resume: DashboardStats["resume"] = null;
    let latestEdit = "";

    for (const project of projects) {
      const chapters = await chapterRepository.listByProject(project.id);
      chapterCount += chapters.length;
      wordCount += chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

      const lastEdit = project.lastEdit;
      if (lastEdit && lastEdit.updatedAt > latestEdit) {
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
    }

    return {
      loading: false,
      projectCount: projects.length,
      chapterCount,
      wordCount,
      resume,
    };
  }, []);

  if (!stats || stats.loading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-semibold">Painel</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Autor. Retome um projeto ou comece um novo.
        </p>
      </div>

      <section aria-label="Continuar de onde parou">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Continuar de onde parou
        </h2>
        {stats.resume ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif">
                {stats.resume.chapterTitle}
              </CardTitle>
              <CardDescription>{stats.resume.projectTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/write/${stats.resume.chapterId}`}>
                  <PenLine aria-hidden />
                  Continuar escrevendo
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {stats.projectCount === 0
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
        )}
      </section>

      <section aria-label="Estatísticas" className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Projetos" value={stats.projectCount} />
        <StatCard label="Capítulos" value={stats.chapterCount} />
        <StatCard label="Palavras" value={stats.wordCount} />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold">
        {value.toLocaleString("pt-BR")}
      </p>
    </div>
  );
}
