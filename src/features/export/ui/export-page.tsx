"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, FileDown, FileUp, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { narrativeArcRepository } from "@/features/plot/infra/dexie-narrative-arc-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { timelineEventRepository } from "@/features/plot/infra/dexie-timeline-event-repository";
import { useUiStore } from "@/shared/store/ui-store";

import { buildAiContext } from "../domain/ai-context";
import { projectToMarkdown } from "../domain/markdown";
import { buildBackupBlob, importBackupJson } from "../infra/backup";
import { downloadBlob, safeFilename } from "../infra/download";
import {
  buildProjectPackageBlob,
  importProjectPackageJson,
} from "../infra/project-package";
import {
  ExportFormatDialog,
  type ExportFormat,
} from "./export-format-dialog";
import { playUiSound } from "@/shared/lib/sound";
import type { EntityId, Scene } from "@/shared/types/database";

type BusyAction =
  | "markdown"
  | "docx"
  | "pdf"
  | "project-package"
  | "context"
  | "backup"
  | "import-project"
  | "import-backup"
  | null;

const DATA_ACTIONS = [
  { value: "project-export", label: "Exportar projeto", icon: FileDown },
  { value: "project-import", label: "Importar projeto completo", icon: FileUp },
  { value: "context", label: "Contexto para IA", icon: FileDown },
  { value: "backup-export", label: "Baixar backup do app", icon: HardDriveDownload },
  { value: "backup-import", label: "Restaurar backup do app", icon: Download },
] as const;

type DataAction = (typeof DATA_ACTIONS)[number]["value"];

const DATA_ACTION_DESCRIPTIONS: Record<DataAction, string> = {
  "project-export": "Baixe Markdown, DOCX, PDF ou pacote JSON completo.",
  "project-import": "Cria um projeto separado; não altera projetos existentes.",
  context: "Gere contexto com capítulo e limite estimado de tokens.",
  "backup-export": "Baixe todos os projetos e configurações do app.",
  "backup-import": "Substitui todos os dados do app e exige confirmação.",
};

/** Export/import/backup compactos — aba "Dados" das Configurações (fase 5). */
export function DataSection() {
  const router = useRouter();
  const { projects, projectId: activeProjectId } = useSelectedProject();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [action, setAction] = useState<DataAction>("project-export");
  const [projectIdOverride, setProjectIdOverride] = useState<
    EntityId | null | undefined
  >();
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [contextChapterId, setContextChapterId] = useState("");
  const [contextBudget, setContextBudget] = useState("16000");
  const [contextStatus, setContextStatus] = useState("");
  const pendingBackupJson = useRef<string | null>(null);
  const projectPackageInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const projectId =
    projectIdOverride === undefined ||
    (projectIdOverride !== null &&
      !projects.some((item) => item.id === projectIdOverride))
      ? activeProjectId
      : projectIdOverride;
  const project = projects.find((item) => item.id === projectId) ?? null;
  const contextChapters =
    useLiveQuery(
      () => (projectId ? chapterRepository.listByProject(projectId) : []),
      [projectId],
    ) ?? [];
  const selectedContextChapterId = contextChapters.some(
    (chapter) => chapter.id === contextChapterId,
  )
    ? contextChapterId
    : contextChapters.some((chapter) => chapter.id === project?.lastEdit?.chapterId)
      ? (project?.lastEdit?.chapterId ?? "")
      : (contextChapters[0]?.id ?? "");
  const selectedContextChapter = contextChapters.find(
    (chapter) => chapter.id === selectedContextChapterId,
  );
  const selectedAction = DATA_ACTIONS.find((item) => item.value === action)!;
  const ActionIcon = selectedAction.icon;
  const requiresProject = action === "project-export" || action === "context";
  const exporting =
    busy === "markdown" ||
    busy === "docx" ||
    busy === "pdf" ||
    busy === "project-package";

  function handleExportProject(format: ExportFormat) {
    if (format === "md") void exportMarkdown();
    else if (format === "docx") void exportDocx();
    else if (format === "pdf") void exportPdf();
    else if (format === "json") void exportProjectPackage();
  }

  async function gather() {
    if (!project) throw new Error("Nenhum projeto selecionado.");
    const chapters = await chapterRepository.listByProject(project.id);
    const scenes = await sceneRepository.listByProject(project.id);
    const scenesByChapter = new Map<string, Scene[]>();
    for (const scene of scenes) {
      const list = scenesByChapter.get(scene.chapterId) ?? [];
      list.push(scene);
      scenesByChapter.set(scene.chapterId, list);
    }
    return { chapters, scenesByChapter };
  }

  async function exportMarkdown() {
    setBusy("markdown");
    try {
      const { chapters, scenesByChapter } = await gather();
      const markdown = projectToMarkdown({
        project: project!,
        chapters,
        scenesByChapter,
      });
      downloadBlob(
        new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
        safeFilename(project!.title, "md"),
      );
      toast.success("Projeto exportado em Markdown.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  }

  async function exportAiContext() {
    if (!project || !selectedContextChapter) return;
    const budgetTokens = Number(contextBudget);
    if (!Number.isFinite(budgetTokens) || budgetTokens < 1) {
      toast.error("Informe um limite de tokens maior que zero.");
      return;
    }

    setBusy("context");
    setContextStatus("");
    try {
      const [scenes, characters, locations, loreEntries, arcs, events] =
        await Promise.all([
          sceneRepository.listByProject(project.id),
          characterRepository.listByProject(project.id),
          locationRepository.listByProject(project.id),
          loreEntryRepository.listByProject(project.id),
          narrativeArcRepository.listByProject(project.id),
          timelineEventRepository.listByProject(project.id),
        ]);
      const result = buildAiContext({
        project,
        chapter: selectedContextChapter,
        scenes,
        characters,
        locations,
        loreEntries,
        arcs,
        items: loreEntries
          .filter((entry) => entry.isTrackableItem)
          .map((entry) => ({
            id: entry.id,
            name: entry.title,
            initialOwnerId: entry.initialOwnerId,
          })),
        events,
        budgetTokens,
      });

      if (result.exceedsBudget) {
        const message = `Contexto essencial estima ${result.estimatedTokens} tokens; limite atual: ${result.budgetTokens}. Aumente o limite.`;
        setContextStatus(message);
        toast.error(message);
        return;
      }

      downloadBlob(
        new Blob([result.markdown], { type: "text/markdown;charset=utf-8" }),
        safeFilename(
          `${project.title}-contexto-${selectedContextChapter.title}`,
          "md",
        ),
      );
      const omitted = result.omittedRecords > 0
        ? ` ${result.omittedRecords} registros omitidos pelo limite.`
        : "";
      const message = `Contexto baixado. Estimativa: ${result.estimatedTokens} tokens.${omitted}`;
      setContextStatus(message);
      toast.success(message);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao gerar contexto.";
      setContextStatus(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function exportDocx() {
    setBusy("docx");
    try {
      const [{ chapters }] = await Promise.all([gather()]);
      const { buildDocxBlob } = await import("../infra/docx-export");
      const blob = await buildDocxBlob(
        project!,
        chapters.map((chapter) => ({ title: chapter.title, content: chapter.content })),
      );
      downloadBlob(blob, safeFilename(project!.title, "docx"));
      toast.success("Projeto exportado em DOCX.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const { chapters } = await gather();
      const { buildPdfBlob } = await import("../infra/pdf-export");
      const blob = buildPdfBlob(
        project!,
        chapters.map((chapter) => ({ title: chapter.title, content: chapter.content })),
      );
      downloadBlob(blob, safeFilename(project!.title, "pdf"));
      toast.success("Projeto exportado em PDF.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  }

  async function exportProjectPackage() {
    if (!project) return;
    setBusy("project-package");
    try {
      const blob = await buildProjectPackageBlob(project.id);
      downloadBlob(
        blob,
        safeFilename(`${project.title}-projeto-completo`, "json"),
      );
      toast.success("Projeto completo exportado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  }

  async function exportBackup() {
    setBusy("backup");
    try {
      const { blob, filename } = await buildBackupBlob();
      downloadBlob(blob, filename);
      playUiSound("backup");
      toast.success("Backup completo baixado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar backup.");
    } finally {
      setBusy(null);
    }
  }

  async function handleProjectPackageFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("import-project");
    try {
      const imported = await importProjectPackageJson(await file.text());
      useUiStore.getState().setSelectedProjectId(imported.id);
      setProjectIdOverride(imported.id);
      playUiSound("restore");
      toast.success(`Projeto “${imported.title}” importado como novo projeto.`);
      router.push(`/projects/${imported.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao importar projeto.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleBackupFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      pendingBackupJson.current = await file.text();
      setBackupDialogOpen(true);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  }

  async function confirmBackupImport() {
    const json = pendingBackupJson.current;
    pendingBackupJson.current = null;
    setBackupDialogOpen(false);
    if (!json) return;
    setBusy("import-backup");
    try {
      const counts = await importBackupJson(json);
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      toast.success(`Backup restaurado (${total} registros).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao restaurar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Projetos e backups</CardTitle>
          <CardDescription>
            Exporte ou importe projetos sem substituir outros. Backup do app inclui tudo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-4">
          <div
            className={`grid min-w-0 grid-cols-1 gap-4 ${requiresProject ? "sm:grid-cols-2" : ""}`}
          >
            {requiresProject ? (
              <div className="grid min-w-0 grid-cols-1 gap-2">
                <Label htmlFor="data-project">Projeto</Label>
                <Select
                  value={projectId ?? "__none__"}
                  onValueChange={(value) => {
                    setProjectIdOverride(value === "__none__" ? null : value);
                    setContextChapterId("");
                    setContextStatus("");
                  }}
                >
                  <SelectTrigger
                    id="data-project"
                    aria-label="Projeto"
                    className="w-full min-w-0"
                  >
                    <SelectValue placeholder="Selecionar projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum projeto</SelectItem>
                    {projects.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="data-action">Ação</Label>
              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value as DataAction);
                  setContextStatus("");
                }}
              >
                <SelectTrigger id="data-action" aria-label="Ação de dados">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_ACTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <section className="grid gap-4 rounded-lg border p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <ActionIcon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {selectedAction.label}
                    {project && requiresProject ? ` — ${project.title}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {DATA_ACTION_DESCRIPTIONS[action]}
                  </p>
                </div>
              </div>

              {action === "project-export" ? (
                <Button
                  variant="outline"
                  onClick={() => setExportDialogOpen(true)}
                  disabled={!project || busy !== null}
                  aria-busy={exporting}
                  className="w-full sm:w-auto"
                >
                  <FileDown aria-hidden />
                  {exporting ? "Exportando..." : "Escolher formato"}
                </Button>
              ) : null}
              {action === "project-import" ? (
                <Button
                  variant="outline"
                  onClick={() => projectPackageInputRef.current?.click()}
                  disabled={busy !== null}
                  className="w-full sm:w-auto"
                >
                  <FileUp aria-hidden />
                  {busy === "import-project" ? "Importando..." : "Selecionar pacote"}
                </Button>
              ) : null}
              {action === "backup-export" ? (
                <Button
                  variant="outline"
                  onClick={() => void exportBackup()}
                  disabled={busy !== null}
                  aria-busy={busy === "backup"}
                  className="w-full sm:w-auto"
                >
                  <HardDriveDownload aria-hidden />
                  {busy === "backup" ? "Gerando..." : "Baixar backup"}
                </Button>
              ) : null}
              {action === "backup-import" ? (
                <Button
                  variant="outline"
                  onClick={() => backupInputRef.current?.click()}
                  disabled={busy !== null}
                  aria-label="Selecionar backup completo para restaurar"
                  className="w-full sm:w-auto"
                >
                  <Download aria-hidden />
                  {busy === "import-backup" ? "Restaurando..." : "Selecionar backup"}
                </Button>
              ) : null}
            </div>

            {action === "context" ? (
              <div className="grid gap-4 border-t pt-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <div className="grid gap-2">
                    <Label htmlFor="ai-context-chapter">Capítulo</Label>
                    <Select
                      value={selectedContextChapterId || "__none__"}
                      onValueChange={(value) => {
                        setContextChapterId(value === "__none__" ? "" : value);
                        setContextStatus("");
                      }}
                      disabled={!project || contextChapters.length === 0}
                    >
                      <SelectTrigger
                        id="ai-context-chapter"
                        aria-label="Capítulo incluído no contexto"
                      >
                        <SelectValue placeholder="Selecionar capítulo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum capítulo</SelectItem>
                        {contextChapters.map((chapter) => (
                          <SelectItem key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ai-context-budget">Limite de tokens</Label>
                    <Input
                      id="ai-context-budget"
                      type="number"
                      min={1}
                      step={256}
                      value={contextBudget}
                      onChange={(event) => {
                        setContextBudget(event.target.value);
                        setContextStatus("");
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estimativa conservadora de 3 caracteres por token. O texto do
                  capítulo não entra; cenas usam resumo ou trecho curto.
                </p>
                {contextStatus ? (
                  <p role="status" aria-live="polite" className="text-sm">
                    {contextStatus}
                  </p>
                ) : null}
                <div>
                  <Button
                    variant="outline"
                    onClick={() => void exportAiContext()}
                    disabled={!project || !selectedContextChapter || busy !== null}
                    aria-busy={busy === "context"}
                  >
                    <FileDown aria-hidden />
                    {busy === "context" ? "Gerando contexto..." : "Baixar contexto"}
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          <input
            ref={projectPackageInputRef}
            id="project-package-input"
            type="file"
            accept=".json,application/json"
            disabled={busy !== null}
            onChange={handleProjectPackageFile}
            className="hidden"
            aria-label="Pacote de projeto completo"
          />
          <input
            ref={backupInputRef}
            id="import-backup-input"
            type="file"
            accept=".json,application/json"
            disabled={busy !== null}
            onChange={handleBackupFile}
            className="hidden"
            aria-label="Backup completo do app"
          />
        </CardContent>
      </Card>

      <ExportFormatDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        title="Exportar projeto"
        description="Escolha o formato do arquivo para baixar."
        formats={["md", "docx", "pdf", "json"]}
        onExport={handleExportProject}
      />

      <AlertDialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados atuais serão substituídos pelos do arquivo. Esta ação
              não pode ser desfeita. Baixe um backup antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBackupImport}
              aria-label="Confirmar restauração do backup"
            >
              <Download aria-hidden="true" />
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
