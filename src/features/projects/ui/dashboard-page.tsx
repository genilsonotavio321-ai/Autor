"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Clock, Flame, PenLine, Plus, Target } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  estimateReadingMinutes,
  summariseWriting,
  type WritingLog,
} from "@/features/productivity/domain/writing-log";
import { getWritingLog } from "@/features/productivity/infra/writing-log-repository";
import { buildActivityDays } from "@/features/productivity/domain/activity-chart";
import { ActivityHeatmap } from "@/features/productivity/ui/activity-heatmap";
import { formatRelativeTime } from "@/shared/lib/dates";
import { useUiStore } from "@/shared/store/ui-store";

import { chapterRepository } from "../infra/dexie-chapter-repository";
import { projectRepository } from "../infra/dexie-project-repository";

interface RecentProject {
  id: string;
  title: string;
  chapterCount: number;
  wordCount: number;
  updatedAt: string;
}

interface DashboardData {
  projectCount: number;
  chapterCount: number;
  wordCount: number;
  wordsToday: number;
  wordsWeek: number;
  streak: number;
  readingMinutes: number;
  log: WritingLog;
  resume: { chapterId: string; projectTitle: string; chapterTitle: string } | null;
  byProject: RecentProject[];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function DashboardPage() {
  const dailyWordGoal = useUiStore((state) => state.dailyWordGoal);
  const resumeNoticeSeconds = useUiStore((state) => state.resumeNoticeSeconds);
  const [resumeVisible, setResumeVisible] = useState(true);

  const stats = useLiveQuery(async (): Promise<DashboardData> => {
    const projects = await projectRepository.listActive();
    const log = await getWritingLog();

    let chapterCount = 0;
    let wordCount = 0;
    let resume: DashboardData["resume"] = null;
    let latestEdit = "";
    const recent: RecentProject[] = [];

    for (const project of projects) {
      const chapters = await chapterRepository.listByProject(project.id);
      const projectWords = chapters.reduce(
        (sum, chapter) => sum + chapter.wordCount,
        0,
      );
      chapterCount += chapters.length;
      wordCount += projectWords;
      recent.push({
        id: project.id,
        title: project.title,
        chapterCount: chapters.length,
        wordCount: projectWords,
        updatedAt: project.updatedAt,
      });

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

    const summary = summariseWriting(log, new Date());
    recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const byProject = [...recent].sort((a, b) =>
      a.title.localeCompare(b.title, "pt-BR"),
    );

    return {
      projectCount: projects.length,
      chapterCount,
      wordCount,
      wordsToday: summary.today,
      wordsWeek: summary.week,
      streak: summary.streak,
      readingMinutes: estimateReadingMinutes(wordCount),
      log,
      resume,
      byProject,
    };
  }, []);

  // Oculta o card "Continuar de onde parou" após o tempo configurado
  // (0 = nunca exibir). O timer reinicia quando o capítulo-alvo muda.
  const resumeKey = stats?.resume?.chapterId ?? null;
  useEffect(() => {
    setResumeVisible(true);
    if (resumeKey === null || resumeNoticeSeconds <= 0) return;
    const timer = setTimeout(
      () => setResumeVisible(false),
      resumeNoticeSeconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [resumeKey, resumeNoticeSeconds]);

  if (!stats) {
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

  const goalPercent =
    dailyWordGoal > 0
      ? Math.min(100, Math.round((stats.wordsToday / dailyWordGoal) * 100))
      : 0;

  const activityDays = buildActivityDays(stats.log, new Date(), 12, dailyWordGoal);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-semibold">Painel</h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Autor. Retome um projeto ou comece um novo.
        </p>
      </div>

      {stats.projectCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Primeiros passos</CardTitle>
            <CardDescription>
              Três passos para tirar sua história do papel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ol className="grid gap-2 text-sm text-muted-foreground">
              <li>1. Crie um projeto (livro ou série).</li>
              <li>2. Adicione um capítulo e comece a escrever.</li>
              <li>3. Planeje personagens, mundo e enredo quando quiser.</li>
            </ol>
            <Button asChild className="w-fit">
              <Link href="/projects">
                <Plus aria-hidden />
                Criar primeiro projeto
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {stats.resume && resumeNoticeSeconds > 0 && resumeVisible ? (
        <section aria-label="Continuar de onde parou">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Continuar de onde parou
          </h2>
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
        </section>
      ) : stats.resume ? null : (
        <section aria-label="Continuar de onde parou">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Continuar de onde parou
          </h2>
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
        </section>
      )}

      <section
        aria-label="Estatísticas"
        className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard label="Projetos" value={stats.projectCount.toLocaleString("pt-BR")} />
        <StatCard label="Capítulos" value={stats.chapterCount.toLocaleString("pt-BR")} />
        <StatCard label="Palavras" value={stats.wordCount.toLocaleString("pt-BR")} />
        <StatCard
          label="Tempo de leitura"
          value={formatDuration(stats.readingMinutes)}
          icon={<Clock aria-hidden className="size-3.5" />}
        />
      </section>

      <section
        aria-label="Progresso"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Target aria-hidden className="size-3.5" />
            Meta diária
          </p>
          <p className="mt-1 font-serif text-2xl font-semibold">
            {stats.wordsToday.toLocaleString("pt-BR")}
            <span className="text-sm font-normal text-muted-foreground">
              {" / "}
              {dailyWordGoal.toLocaleString("pt-BR")}
            </span>
          </p>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progresso da meta diária"
            aria-valuenow={goalPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>
        <StatCard label="Palavras na semana" value={stats.wordsWeek.toLocaleString("pt-BR")} />
        <StatCard
          label="Sequência"
          value={`${stats.streak} ${stats.streak === 1 ? "dia" : "dias"}`}
          icon={<Flame aria-hidden className="size-3.5" />}
        />
        <div className="col-span-2 sm:col-span-3">
          <ActivityHeatmap days={activityDays} />
        </div>
      </section>

      {stats.byProject.length > 0 ? (
        <section aria-label="Estatísticas por projeto">
          <h2 className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Estatísticas por projeto
          </h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Capítulos, palavras e tempo de leitura por projeto
              </caption>
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="p-3 text-left font-medium">
                    Projeto
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Capítulos
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Palavras
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Leitura
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.byProject.map((project) => (
                  <tr key={project.id} className="border-t">
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-sm font-medium hover:underline"
                        >
                          {project.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(project.updatedAt)}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {project.chapterCount.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {project.wordCount.toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {formatDuration(
                        estimateReadingMinutes(project.wordCount),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-serif text-xl font-semibold sm:text-2xl">
        {value}
      </p>
    </div>
  );
}
