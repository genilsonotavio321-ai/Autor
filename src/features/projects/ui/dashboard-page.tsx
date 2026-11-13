"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
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

import { ResumeWritingCard } from "./resume-writing-card";

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

  const stats = useLiveQuery(async (): Promise<DashboardData> => {
    const projects = await projectRepository.listActive();
    const log = await getWritingLog();

    let chapterCount = 0;
    let wordCount = 0;
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
      byProject,
    };
  }, []);

  if (!stats) {
    return (
      <div className="flex flex-col gap-8">
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
    <div className="flex flex-col gap-8">
      <header className="space-y-5">
        <div className="space-y-2">
          <p className="eyebrow">Progresso</p>
          <h1 className="display-title">Painel</h1>
          <p className="lead">
            Retome um projeto ou comece um novo capítulo.
          </p>
        </div>
        <div aria-hidden className="hairline" />
      </header>

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

      <ResumeWritingCard />

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
        />
      </section>

      <section
        aria-label="Progresso"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <div className="surface rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Meta diária</p>
          <p className="mt-1.5 font-serif text-2xl leading-none font-medium tracking-tight tabular-nums">
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
        />
        <div className="col-span-2 sm:col-span-3">
          <ActivityHeatmap days={activityDays} />
        </div>
      </section>

      {stats.byProject.length > 0 ? (
        <section aria-label="Estatísticas por projeto">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="eyebrow">Estatísticas por projeto</h2>
            <div aria-hidden className="hairline flex-1" />
          </div>
          <div className="surface overflow-hidden rounded-xl">
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-xl p-3 sm:p-4">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-serif text-2xl leading-none font-medium tracking-tight tabular-nums sm:text-[2rem]">
        {value}
      </p>
    </div>
  );
}
