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
import { Switch } from "@/components/ui/switch";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { SettingSlider } from "@/features/settings/ui/setting-slider";
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
  { keys: "Ctrl/Cmd + B / I", action: "Negrito e itálico no editor" },
  {
    keys: "Ctrl/Cmd + clique",
    action: "Abrir a ficha de um nome destacado no texto",
  },
  { keys: "Enter / Espaço", action: "Abrir a ficha de um card em listas" },
  { keys: "Enter", action: "Salvar em diálogos" },
  {
    keys: "Espaço + Setas",
    action: "Reordenar capítulos, cenas, beats e cards (teclado)",
  },
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
  const mentionHighlightEnabled = useUiStore(
    (state) => state.mentionHighlightEnabled,
  );
  const mentionColorCharacter = useUiStore(
    (state) => state.mentionColorCharacter,
  );
  const mentionColorLocation = useUiStore(
    (state) => state.mentionColorLocation,
  );
  const setMentionHighlightEnabled = useUiStore(
    (state) => state.setMentionHighlightEnabled,
  );
  const mentionHighlightReadEnabled = useUiStore(
    (state) => state.mentionHighlightReadEnabled,
  );
  const setMentionHighlightReadEnabled = useUiStore(
    (state) => state.setMentionHighlightReadEnabled,
  );
  const mentionConfirmOpen = useUiStore(
    (state) => state.mentionConfirmOpen,
  );
  const setMentionConfirmOpen = useUiStore(
    (state) => state.setMentionConfirmOpen,
  );
  const setMentionColorCharacter = useUiStore(
    (state) => state.setMentionColorCharacter,
  );
  const setMentionColorLocation = useUiStore(
    (state) => state.setMentionColorLocation,
  );
  const mentionBackToTextEnabled = useUiStore(
    (state) => state.mentionBackToTextEnabled,
  );
  const setMentionBackToTextEnabled = useUiStore(
    (state) => state.setMentionBackToTextEnabled,
  );
  const mentionBackToTextSeconds = useUiStore(
    (state) => state.mentionBackToTextSeconds,
  );
  const setMentionBackToTextSeconds = useUiStore(
    (state) => state.setMentionBackToTextSeconds,
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
          <SettingSlider
            id="editor-size"
            label="Tamanho da fonte"
            unit="px"
            value={editorFontSize}
            min={EDITOR_FONT_SIZE_MIN}
            max={EDITOR_FONT_SIZE_MAX}
            step={1}
            onValueChange={setEditorFontSize}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Destaques no texto</CardTitle>
          <CardDescription>
            Realce nomes de personagens e locais no editor e no modo leitura.
            Clique no nome (Ctrl/Cmd+clique no editor) para abrir a ficha.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-highlight">Ativar destaques</Label>
            <Switch
              id="mention-highlight"
              checked={mentionHighlightEnabled}
              onCheckedChange={setMentionHighlightEnabled}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-highlight-read">
              Destacar no modo leitura
            </Label>
            <Switch
              id="mention-highlight-read"
              checked={mentionHighlightReadEnabled}
              onCheckedChange={setMentionHighlightReadEnabled}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-confirm-open">
              Perguntar antes de abrir a ficha
            </Label>
            <Switch
              id="mention-confirm-open"
              checked={mentionConfirmOpen}
              onCheckedChange={setMentionConfirmOpen}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-back-to-text">
              Mostrar &quot;Voltar ao texto&quot; na ficha
            </Label>
            <Switch
              id="mention-back-to-text"
              checked={mentionBackToTextEnabled}
              onCheckedChange={setMentionBackToTextEnabled}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="mention-color-character">
                Cor de personagens
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mention-color-character"
                  type="color"
                  className="h-9 w-16 p-1"
                  value={mentionColorCharacter}
                  disabled={!mentionHighlightEnabled}
                  onChange={(event) =>
                    setMentionColorCharacter(event.target.value)
                  }
                />
                <span
                  aria-hidden
                  className="text-sm font-medium"
                  style={{ color: mentionColorCharacter }}
                >
                  Personagem
                </span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mention-color-location">Cor de locais</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mention-color-location"
                  type="color"
                  className="h-9 w-16 p-1"
                  value={mentionColorLocation}
                  disabled={!mentionHighlightEnabled}
                  onChange={(event) =>
                    setMentionColorLocation(event.target.value)
                  }
                />
                <span
                  aria-hidden
                  className="text-sm font-medium"
                  style={{ color: mentionColorLocation }}
                >
                  Local
                </span>
              </div>
            </div>
          </div>
          <div className="max-w-xs">
            <SettingSlider
              id="mention-back-to-text-seconds"
              label='Pop-up "Voltar ao texto"'
              unit="segundos"
              value={mentionBackToTextSeconds}
              min={0}
              max={30}
              step={1}
              onValueChange={setMentionBackToTextSeconds}
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
          <SettingSlider
            id="daily-goal"
            label="Meta diária"
            unit="palavras"
            value={dailyWordGoal}
            min={0}
            max={5000}
            step={50}
            onValueChange={setDailyWordGoal}
          />
          <SettingSlider
            id="sprint-minutes"
            label="Sprint"
            unit="minutos"
            value={sprintMinutes}
            min={1}
            max={120}
            step={5}
            onValueChange={setSprintMinutes}
          />
          <SettingSlider
            id="resume-seconds"
            label='Botão "Continuar"'
            unit="segundos"
            value={resumeNoticeSeconds}
            min={0}
            max={30}
            step={1}
            onValueChange={setResumeNoticeSeconds}
          />
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
              Exportar, importar e fazer backup
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
