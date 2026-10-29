"use client";

import { Keyboard, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataSection } from "@/features/export/ui/export-page";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { PromptManager } from "@/features/creativity/ui/prompt-manager";
import { requestNotificationPermission } from "@/features/productivity/infra/notification-service";
import { SettingSlider } from "@/features/settings/ui/setting-slider";
import { TagsManager } from "@/features/tags/ui/tags-manager";
import { playUiSound } from "@/shared/lib/sound";
import {
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  type HomeSection,
  TRASH_RETENTION_OPTIONS,
  useUiStore,
} from "@/shared/store/ui-store";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const THEME_VARIANTS_LIGHT = [
  { value: "padrao", label: "Padrão" },
  { value: "sepia", label: "Sépia" },
  { value: "areia", label: "Areia" },
] as const;

const THEME_VARIANTS_DARK = [
  { value: "padrao", label: "Padrão" },
  { value: "meia-noite", label: "Meia-noite" },
  { value: "floresta", label: "Floresta" },
] as const;

const HOME_SECTION_OPTIONS: { value: HomeSection; label: string }[] = [
  { value: "search", label: "Buscar" },
  { value: "continue", label: "Continuar escrevendo" },
  { value: "projects", label: "Projetos" },
  { value: "dashboard", label: "Painel" },
  { value: "canvas", label: "Canvas" },
  { value: "data", label: "Dados" },
];

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

/** Toca o som de toggle e aplica a mudança do switch. */
const withToggle =
  (apply: (checked: boolean) => void) => (checked: boolean) => {
    playUiSound("toggle");
    apply(checked);
  };

export function SettingsPage() {
  const { projectId } = useSelectedProject();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // /settings?tab=dados abre direto a aba de dados (redirect de /export).
  const [tab, setTab] = useState("geral");

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
  const readGrifarEnabled = useUiStore((state) => state.readGrifarEnabled);
  const setReadGrifarEnabled = useUiStore(
    (state) => state.setReadGrifarEnabled,
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
  const soundEnabled = useUiStore((state) => state.soundEnabled);
  const soundVolume = useUiStore((state) => state.soundVolume);
  const setSoundEnabled = useUiStore((state) => state.setSoundEnabled);
  const setSoundVolume = useUiStore((state) => state.setSoundVolume);
  const animationsEnabled = useUiStore((state) => state.animationsEnabled);
  const animationDuration = useUiStore((state) => state.animationDuration);
  const setAnimationsEnabled = useUiStore(
    (state) => state.setAnimationsEnabled,
  );
  const setAnimationDuration = useUiStore(
    (state) => state.setAnimationDuration,
  );
  const pageTransitionEnabled = useUiStore(
    (state) => state.pageTransitionEnabled,
  );
  const setPageTransitionEnabled = useUiStore(
    (state) => state.setPageTransitionEnabled,
  );
  const editorSimplified = useUiStore((state) => state.editorSimplified);
  const setEditorSimplified = useUiStore(
    (state) => state.setEditorSimplified,
  );
  const searchGlobalEnabled = useUiStore(
    (state) => state.searchGlobalEnabled,
  );
  const setSearchGlobalEnabled = useUiStore(
    (state) => state.setSearchGlobalEnabled,
  );
  const homeSections = useUiStore((state) => state.homeSections);
  const setHomeSections = useUiStore((state) => state.setHomeSections);
  const panelTabVisible = useUiStore((state) => state.panelTabVisible);
  const setPanelTabVisible = useUiStore((state) => state.setPanelTabVisible);
  const promptCiteCharacters = useUiStore(
    (state) => state.promptCiteCharacters,
  );
  const promptCiteLocations = useUiStore(
    (state) => state.promptCiteLocations,
  );
  const setPromptCiteCharacters = useUiStore(
    (state) => state.setPromptCiteCharacters,
  );
  const setPromptCiteLocations = useUiStore(
    (state) => state.setPromptCiteLocations,
  );
  const promptCustomWeight = useUiStore(
    (state) => state.promptCustomWeight,
  );
  const setPromptCustomWeight = useUiStore(
    (state) => state.setPromptCustomWeight,
  );
  const unblockCloseOnSave = useUiStore(
    (state) => state.unblockCloseOnSave,
  );
  const setUnblockCloseOnSave = useUiStore(
    (state) => state.setUnblockCloseOnSave,
  );
  const canvasButtonsHidden = useUiStore(
    (state) => state.canvasButtonsHidden,
  );
  const setCanvasButtonsHidden = useUiStore(
    (state) => state.setCanvasButtonsHidden,
  );
  const trashRetentionMs = useUiStore((state) => state.trashRetentionMs);
  const setTrashRetentionMs = useUiStore(
    (state) => state.setTrashRetentionMs,
  );
  const notificationsEnabled = useUiStore(
    (state) => state.notificationsEnabled,
  );
  const setNotificationsEnabled = useUiStore(
    (state) => state.setNotificationsEnabled,
  );
  const notifyGoalNotMet = useUiStore((state) => state.notifyGoalNotMet);
  const setNotifyGoalNotMet = useUiStore(
    (state) => state.setNotifyGoalNotMet,
  );
  const notifyNoNewCharacters = useUiStore(
    (state) => state.notifyNoNewCharacters,
  );
  const setNotifyNoNewCharacters = useUiStore(
    (state) => state.setNotifyNoNewCharacters,
  );
  const notifyNoNewScenes = useUiStore((state) => state.notifyNoNewScenes);
  const setNotifyNoNewScenes = useUiStore(
    (state) => state.setNotifyNoNewScenes,
  );
  const notifyNoNewChapters = useUiStore(
    (state) => state.notifyNoNewChapters,
  );
  const setNotifyNoNewChapters = useUiStore(
    (state) => state.setNotifyNoNewChapters,
  );
  const notificationsStaleDays = useUiStore(
    (state) => state.notificationsStaleDays,
  );
  const setNotificationsStaleDays = useUiStore(
    (state) => state.setNotificationsStaleDays,
  );
  const themeVariantLight = useUiStore((state) => state.themeVariantLight);
  const themeVariantDark = useUiStore((state) => state.themeVariantDark);
  const setThemeVariantLight = useUiStore(
    (state) => state.setThemeVariantLight,
  );
  const setThemeVariantDark = useUiStore(
    (state) => state.setThemeVariantDark,
  );

  const isDark = resolvedTheme === "dark";
  const variantLabels = isDark
    ? THEME_VARIANTS_DARK
    : THEME_VARIANTS_LIGHT;
  const activeVariant = isDark ? themeVariantDark : themeVariantLight;

  const toggleHomeSection = (section: HomeSection) => {
    setHomeSections(
      homeSections.includes(section)
        ? homeSections.filter((item) => item !== section)
        : [...homeSections, section],
    );
  };

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "dados") setTab("dados");
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-semibold">Configurações</h1>
        <p className="text-muted-foreground">
          Personalize a aparência, a escrita e os dados do seu app.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
        </TabsList>
        <TabsContent
          value="geral"
          className="mt-4 flex flex-col gap-6"
        >
      <Card id="aparencia">
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Tema claro, escuro ou conforme o sistema.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
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
          {mounted && (
            <div
              role="group"
              aria-label="Paleta do tema"
              className="flex flex-wrap gap-2"
            >
              {variantLabels.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={activeVariant === value ? "default" : "outline"}
                  aria-pressed={activeVariant === value}
                  onClick={() =>
                    isDark
                      ? setThemeVariantDark(
                          value as (typeof THEME_VARIANTS_DARK)[number]["value"],
                        )
                      : setThemeVariantLight(
                          value as (typeof THEME_VARIANTS_LIGHT)[number]["value"],
                        )
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="som">
        <CardHeader>
          <CardTitle>Som</CardTitle>
          <CardDescription>
            Efeitos sonoros nos botões e aviso ao concluir um sprint.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sound-enabled">Ativar efeitos sonoros</Label>
            <Switch
              id="sound-enabled"
              checked={soundEnabled}
              onCheckedChange={withToggle(setSoundEnabled)}
            />
          </div>
          <div className="max-w-xs">
            <SettingSlider
              id="sound-volume"
              label="Volume do efeito"
              unit="%"
              value={soundVolume}
              min={0}
              max={100}
              step={5}
              onValueChange={setSoundVolume}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="animacoes">
        <CardHeader>
          <CardTitle>Animações</CardTitle>
          <CardDescription>
            Tempo de easy-in, easy-out, fade-in e fade-out do app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="animations-disabled">Desativar animações</Label>
            <Switch
              id="animations-disabled"
              checked={!animationsEnabled}
              onCheckedChange={withToggle((checked) =>
                setAnimationsEnabled(!checked),
              )}
            />
          </div>
          <div className="max-w-xs">
            <SettingSlider
              id="animation-duration"
              label="Duração da animação"
              unit="ms"
              value={animationDuration}
              min={50}
              max={1000}
              step={50}
              onValueChange={setAnimationDuration}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="page-transition-enabled">
              Transição entre seções
            </Label>
            <Switch
              id="page-transition-enabled"
              checked={pageTransitionEnabled}
              onCheckedChange={withToggle(setPageTransitionEnabled)}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="editor">
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
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="editor-simplified">
              Editor Simplificado
              <span className="block text-xs font-normal text-muted-foreground">
                Formatação na seleção; botões de ação dentro do editor.
              </span>
            </Label>
            <Switch
              id="editor-simplified"
              checked={editorSimplified}
              onCheckedChange={withToggle(setEditorSimplified)}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="destaques">
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
              onCheckedChange={withToggle(setMentionHighlightEnabled)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-highlight-read">
              Destacar no modo leitura
            </Label>
            <Switch
              id="mention-highlight-read"
              checked={mentionHighlightReadEnabled}
              onCheckedChange={withToggle(setMentionHighlightReadEnabled)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="read-grifar">Grifar na seleção (modo leitura)</Label>
            <Switch
              id="read-grifar"
              checked={readGrifarEnabled}
              onCheckedChange={withToggle(setReadGrifarEnabled)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-confirm-open">
              Perguntar antes de abrir a ficha
            </Label>
            <Switch
              id="mention-confirm-open"
              checked={mentionConfirmOpen}
              onCheckedChange={withToggle(setMentionConfirmOpen)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="mention-back-to-text">
              Mostrar &quot;Voltar ao texto&quot; na ficha
            </Label>
            <Switch
              id="mention-back-to-text"
              checked={mentionBackToTextEnabled}
              onCheckedChange={withToggle(setMentionBackToTextEnabled)}
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

      <Card id="escrita">
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

      <Card id="lixeira">
        <CardHeader>
          <CardTitle>Lixeira</CardTitle>
          <CardDescription>
            Itens excluídos são apagados automaticamente após este tempo de
            espera (o padrão do app é 30 dias).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="trash-retention">
              Apagar itens da lixeira após
            </Label>
            <Select
              value={String(trashRetentionMs)}
              onValueChange={(value) => setTrashRetentionMs(Number(value))}
            >
              <SelectTrigger id="trash-retention">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRASH_RETENTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card id="notificacoes">
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>
            Avisos do sistema enquanto o app está em uso — sem a permissão do
            navegador, aparecem como aviso dentro do app. Cada tipo avisa uma
            vez por dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notifications-enabled">Ativar notificações</Label>
            <Switch
              id="notifications-enabled"
              checked={notificationsEnabled}
              onCheckedChange={async (checked) => {
                if (checked) {
                  const result = await requestNotificationPermission();
                  if (result === "denied") {
                    playUiSound("warn");
                    toast.warning(
                      "Notificações do sistema bloqueadas neste navegador; os avisos aparecerão dentro do app.",
                    );
                  }
                }
                setNotificationsEnabled(checked);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notify-goal-not-met" className="min-w-0">
              Meta do dia não batida
              <span className="block text-xs font-normal text-muted-foreground">
                Avisa a partir das 19h.
              </span>
            </Label>
            <Switch
              id="notify-goal-not-met"
              disabled={!notificationsEnabled}
              checked={notifyGoalNotMet}
              onCheckedChange={withToggle(setNotifyGoalNotMet)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notify-no-new-characters">
              Tempo sem criar personagem novo
            </Label>
            <Switch
              id="notify-no-new-characters"
              disabled={!notificationsEnabled}
              checked={notifyNoNewCharacters}
              onCheckedChange={withToggle(setNotifyNoNewCharacters)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notify-no-new-scenes">
              Tempo sem criar cena nova
            </Label>
            <Switch
              id="notify-no-new-scenes"
              disabled={!notificationsEnabled}
              checked={notifyNoNewScenes}
              onCheckedChange={withToggle(setNotifyNoNewScenes)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notify-no-new-chapters">
              Tempo sem criar capítulo novo
            </Label>
            <Switch
              id="notify-no-new-chapters"
              disabled={!notificationsEnabled}
              checked={notifyNoNewChapters}
              onCheckedChange={withToggle(setNotifyNoNewChapters)}
            />
          </div>
          <div className="max-w-xs">
            <SettingSlider
              id="notifications-stale-days"
              label="Considerar parado a partir de"
              unit="dias"
              value={notificationsStaleDays}
              min={1}
              max={60}
              step={1}
              onValueChange={setNotificationsStaleDays}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="busca">
        <CardHeader>
          <CardTitle>Busca</CardTitle>
          <CardDescription>
            A busca global procura também seções do app e opções das
            configurações. Desative para buscar apenas dentro do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="search-global">Incluir seções do app</Label>
            <Switch
              id="search-global"
              checked={searchGlobalEnabled}
              onCheckedChange={withToggle(setSearchGlobalEnabled)}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="gerador">
        <CardHeader>
          <CardTitle>Perguntas e e se...</CardTitle>
          <CardDescription>
            O que os sorteios de Criatividade podem citar das suas fichas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="prompt-cite-characters">Citar personagens</Label>
            <Switch
              id="prompt-cite-characters"
              checked={promptCiteCharacters}
              onCheckedChange={withToggle(setPromptCiteCharacters)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="prompt-cite-locations">Citar locais</Label>
            <Switch
              id="prompt-cite-locations"
              checked={promptCiteLocations}
              onCheckedChange={withToggle(setPromptCiteLocations)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="unblock-close-on-save">
              Fechar painel ao guardar no canvas
            </Label>
            <Switch
              id="unblock-close-on-save"
              checked={unblockCloseOnSave}
              onCheckedChange={withToggle(setUnblockCloseOnSave)}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="canvas">
        <CardHeader>
          <CardTitle>Canvas</CardTitle>
          <CardDescription>
            Botões flutuantes no canto do canvas de ideias.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="canvas-buttons-hidden">
              Ocultar botões do canvas
            </Label>
            <Switch
              id="canvas-buttons-hidden"
              checked={canvasButtonsHidden}
              onCheckedChange={withToggle(setCanvasButtonsHidden)}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="pagina-inicial">
        <CardHeader>
          <CardTitle>Página inicial</CardTitle>
          <CardDescription>
            Seções oferecidas ao abrir o app. Por padrão: buscar, projetos e
            dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {HOME_SECTION_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="flex items-center justify-between gap-4"
            >
              <Label htmlFor={`home-section-${option.value}`}>
                {option.label}
              </Label>
              <Switch
                id={`home-section-${option.value}`}
                checked={homeSections.includes(option.value)}
                onCheckedChange={withToggle(() =>
                  toggleHomeSection(option.value),
                )}
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <Label htmlFor="panel-tab-visible">
              Mostrar “Painel” na navegação
            </Label>
            <Switch
              id="panel-tab-visible"
              checked={panelTabVisible}
              onCheckedChange={withToggle(setPanelTabVisible)}
            />
          </div>
        </CardContent>
      </Card>

      <Card id="tags">
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Crie, renomeie, recolor, mescle ou exclua tags do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <TagsManager projectId={projectId} />
        </CardContent>
      </Card>

      <Card id="atalhos">
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

        </TabsContent>
        <TabsContent
          value="dados"
          className="mt-4 flex flex-col gap-6"
        >
          <DataSection />
          <Card id="dados">
            <CardHeader>
              <CardTitle>Prompts personalizados</CardTitle>
              <CardDescription>
                Perguntas e combinações “E se...?” criadas por você, com
                exportação e importação em JSON.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="max-w-xs">
                <SettingSlider
                  id="prompt-custom-weight"
                  label="Peso dos prompts personalizados"
                  unit="%"
                  value={Math.round(promptCustomWeight * 100)}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(value) => setPromptCustomWeight(value / 100)}
                />
                <p className="text-xs text-muted-foreground">
                  0% usa só os embutidos; 100% prioriza os seus.
                </p>
              </div>
              <PromptManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
