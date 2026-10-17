"use client";

import { Download, Keyboard, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { TagsManager } from "@/features/tags/ui/tags-manager";
import {
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  useUiStore,
} from "@/shared/store/ui-store";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const SHORTCUTS = [
  { keys: "Ctrl/Cmd + K", action: "Abrir a paleta de comandos e a busca" },
  { keys: "Esc", action: "Sair do modo foco no editor" },
  { keys: "Espaço + Setas", action: "Reordenar capítulos e cenas (teclado)" },
  { keys: "Ctrl/Cmd + B / I", action: "Negrito e itálico no editor" },
];

export function SettingsPage() {
  const { projectId } = useSelectedProject();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const editorFontFamily = useUiStore((state) => state.editorFontFamily);
  const editorFontSize = useUiStore((state) => state.editorFontSize);
  const dailyWordGoal = useUiStore((state) => state.dailyWordGoal);
  const sprintMinutes = useUiStore((state) => state.sprintMinutes);
  const resumeNoticeSeconds = useUiStore((state) => state.resumeNoticeSeconds);
  const setEditorFontFamily = useUiStore((state) => state.setEditorFontFamily);
  const setEditorFontSize = useUiStore((state) => state.setEditorFontSize);
  const setDailyWordGoal = useUiStore((state) => state.setDailyWordGoal);
  const setSprintMinutes = useUiStore((state) => state.setSprintMinutes);
  const setResumeNoticeSeconds = useUiStore(
    (state) => state.setResumeNoticeSeconds,
  );

  useEffect(() => setMounted(true), []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground">
          Personalize a aparência, a escrita e os dados do seu app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Tema claro, escuro ou conforme o sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="group"
            aria-label="Tema"
            className="flex flex-wrap gap-2"
          >
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={mounted && theme === value ? "default" : "outline"}
                aria-pressed={mounted && theme === value}
                onClick={() => setTheme(value)}
              >
                <Icon aria-hidden />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
          <CardDescription>Fonte e tamanho do texto ao escrever.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="editor-font">Fonte</Label>
            <div
              role="group"
              aria-label="Fonte do editor"
              className="flex gap-2"
            >
              <Button
                id="editor-font"
                variant={editorFontFamily === "serif" ? "default" : "outline"}
                aria-pressed={editorFontFamily === "serif"}
                onClick={() => setEditorFontFamily("serif")}
                className="font-serif"
              >
                Serifada
              </Button>
              <Button
                variant={editorFontFamily === "sans" ? "default" : "outline"}
                aria-pressed={editorFontFamily === "sans"}
                onClick={() => setEditorFontFamily("sans")}
              >
                Sem serifa
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editor-size">
              Tamanho da fonte: {editorFontSize}px
            </Label>
            <Input
              id="editor-size"
              type="range"
              min={EDITOR_FONT_SIZE_MIN}
              max={EDITOR_FONT_SIZE_MAX}
              step={1}
              value={editorFontSize}
              onChange={(event) =>
                setEditorFontSize(Number(event.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escrita</CardTitle>
          <CardDescription>Metas e sessões de escrita.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="daily-goal">Meta diária (palavras)</Label>
            <Input
              id="daily-goal"
              type="number"
              min={0}
              step={50}
              value={dailyWordGoal}
              onChange={(event) => setDailyWordGoal(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sprint-minutes">Sprint (minutos)</Label>
            <Input
              id="sprint-minutes"
              type="number"
              min={1}
              max={120}
              step={5}
              value={sprintMinutes}
              onChange={(event) => setSprintMinutes(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resume-seconds">
              Botão &quot;Continuar&quot; (segundos)
            </Label>
            <Input
              id="resume-seconds"
              type="number"
              min={0}
              max={30}
              step={1}
              value={resumeNoticeSeconds}
              onChange={(event) =>
                setResumeNoticeSeconds(Number(event.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Crie, renomeie, recolor, mescle ou exclua tags do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ProjectPicker />
          <TagsManager projectId={projectId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard aria-hidden className="size-4" />
            Atalhos
          </CardTitle>
          <CardDescription>Teclas rápidas disponíveis no app.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <dt>
                  <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
                    {shortcut.keys}
                  </kbd>
                </dt>
                <dd className="text-muted-foreground">{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados</CardTitle>
          <CardDescription>
            Seus dados ficam apenas neste navegador (IndexedDB). Faça backups
            regularmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/export">
              <Download aria-hidden />
              Exportar e fazer backup
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
