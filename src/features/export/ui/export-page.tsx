"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileDown, FileUp, HardDriveDownload } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { sceneRepository } from "@/features/plot/infra/dexie-scene-repository";

import { projectToMarkdown } from "../domain/markdown";
import { buildBackupBlob, importBackupJson } from "../infra/backup";
import { downloadBlob, safeFilename } from "../infra/download";
import { importMarkdownFile } from "../infra/md-import";
import {
  ExportFormatDialog,
  type ExportFormat,
} from "./export-format-dialog";
import { playUiSound } from "@/shared/lib/sound";
import type { Scene } from "@/shared/types/database";

type BusyAction =
  | "markdown"
  | "docx"
  | "pdf"
  | "backup"
  | "import-md"
  | "import-docx"
  | "import-backup"
  | null;

/** Export/import/backup compactos — aba "Dados" das Configurações (fase 5). */
export function DataSection() {
  const router = useRouter();
  const { projects, projectId } = useSelectedProject();
  const [busy, setBusy] = useState<BusyAction>(null);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const pendingBackupJson = useRef<string | null>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const docxInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const project = projects.find((item) => item.id === projectId) ?? null;
  const exporting =
    busy === "markdown" || busy === "docx" || busy === "pdf";

  /** "Memória": picks the project export format chosen in the dialog. */
  function handleExportProject(format: ExportFormat) {
    if (format === "md") void exportMarkdown();
    else if (format === "docx") void exportDocx();
    else if (format === "pdf") void exportPdf();
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

  async function handleMdFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !project) return;
    setBusy("import-md");
    try {
      const text = await file.text();
      const result = await importMarkdownFile(project.id, file.name, text);
      toast.success(
        result.count === 1
          ? `Capítulo “${result.titles[0]}” importado.`
          : `${result.count} capítulos importados.`,
      );
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDocxFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !project) return;
    setBusy("import-docx");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { importDocxFile } = await import("../infra/docx-import");
      const result = await importDocxFile(project.id, file.name, bytes);
      toast.success(
        result.count === 1
          ? `Capítulo “${result.titles[0]}” importado.`
          : `${result.count} capítulos importados.`,
      );
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar.");
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
    <div className="grid gap-4">
      <div className="divide-y rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <FileDown aria-hidden className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                Memória {project ? `— ${project.title}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Baixe o projeto inteiro em Markdown, Word ou PDF.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
            disabled={!project || busy !== null}
            aria-busy={exporting}
          >
            {exporting ? "Exportando..." : "Exportar projeto"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <FileUp aria-hidden className="size-5 text-muted-foreground" />
            <div>
              <Label htmlFor="import-md-input">Importar capítulos (.md)</Label>
              <p className="text-xs text-muted-foreground">
                Um arquivo exportado pelo Autor vira um capítulo por seção “#
                Título”.
              </p>
            </div>
          </div>
          <input
            ref={mdInputRef}
            id="import-md-input"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            disabled={!project || busy !== null}
            onChange={handleMdFile}
            className="block w-full max-w-xs cursor-pointer rounded-md border border-input bg-transparent p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <FileUp aria-hidden className="size-5 text-muted-foreground" />
            <div>
              <Label htmlFor="import-docx-input">
                Importar capítulos (.docx)
              </Label>
              <p className="text-xs text-muted-foreground">
                Um Word com estilos de título vira um capítulo por seção.
              </p>
            </div>
          </div>
          <input
            ref={docxInputRef}
            id="import-docx-input"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={!project || busy !== null}
            onChange={handleDocxFile}
            className="block w-full max-w-xs cursor-pointer rounded-md border border-input bg-transparent p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <HardDriveDownload
              aria-hidden
              className="size-5 text-muted-foreground"
            />
            <div>
              <p className="text-sm font-medium">Backup</p>
              <p className="text-xs text-muted-foreground">
                Inclui todos os projetos, capítulos, personagens, mundo, notas
                e configurações.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportBackup}
            disabled={busy !== null}
            aria-busy={busy === "backup"}
          >
            {busy === "backup" ? "Gerando..." : "Baixar backup completo (.json)"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Download aria-hidden className="size-5 text-muted-foreground" />
            <div>
              <Label htmlFor="import-backup-input">
                Restaurar backup completo (.json)
              </Label>
              <p className="text-xs text-muted-foreground">
                Substitui <strong>todos</strong> os dados atuais pelos do
                arquivo.
              </p>
            </div>
          </div>
          <input
            ref={backupInputRef}
            id="import-backup-input"
            type="file"
            accept=".json,application/json"
            disabled={busy !== null}
            onChange={handleBackupFile}
            className="block w-full max-w-xs cursor-pointer rounded-md border border-input bg-transparent p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>
      </div>
      {!project && (
        <p className="text-sm text-muted-foreground">
          Crie um projeto para exportar capítulos.
        </p>
      )}

      <ExportFormatDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        title="Exportar projeto"
        description="Escolha o formato do arquivo para baixar."
        formats={["md", "docx", "pdf"]}
        onExport={handleExportProject}
      />

      <AlertDialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados atuais serão substituídos pelos do arquivo. Esta ação
              não pode ser desfeita — baixe um backup antes de continuar.
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
    </div>
  );
}
