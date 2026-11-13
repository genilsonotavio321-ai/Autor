"use client";

import { Check, ChevronDown, Monitor, Moon, Sun } from "lucide-react";
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
import { PromptManager } from "@/features/creativity/ui/prompt-manager";
import { DataSection } from "@/features/export/ui/export-page";
import { requestNotificationPermission } from "@/features/productivity/infra/notification-service";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { SettingSlider } from "@/features/settings/ui/setting-slider";
import { TagsManager } from "@/features/tags/ui/tags-manager";
import { cn } from "@/lib/utils";
import {
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  type HomeSection,
  type ThemeVariantDark,
  type ThemeVariantLight,
  TRASH_RETENTION_OPTIONS,
  useUiStore,
} from "@/shared/store/ui-store";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const LIGHT_PALETTES = [
  {
    value: "papel",
    label: "Papel",
    description: "Papel quente com tinta marrom — o padrão.",
    bg: "#faf7f1",
    ink: "#2b241c",
  },
  {
    value: "marfim",
    label: "Marfim",
    description: "Off-white neutro, leitura limpa.",
    bg: "#fbfaf5",
    ink: "#2a2a27",
  },
  {
    value: "nevoa",
    label: "Névoa",
    description: "Cinza-azulado frio e suave.",
    bg: "#f3f6fb",
    ink: "#232a33",
  },
  {
    value: "terra",
    label: "Terra",
    description: "Areia e terracota, calor de oficina.",
    bg: "#f5ece1",
    ink: "#3a2b21",
  },
  {
    value: "oliva",
    label: "Oliva",
    description: "Verde sutil, caderno de campo.",
    bg: "#f2f3e8",
    ink: "#2f3520",
  },
  {
    value: "lavanda",
    label: "Lavanda",
    description: "Lilás discreto, ritmo noturno.",
    bg: "#f4f2fb",
    ink: "#2d2638",
  },
] as const;

const DARK_PALETTES = [
  {
    value: "tinta",
    label: "Tinta",
    description: "Preto quente, contraste alto.",
    bg: "#1b1a17",
    ink: "#efe9dd",
  },
  {
    value: "grafite",
    label: "Grafite",
    description: "Cinza neutro de estúdio.",
    bg: "#1c1c1c",
    ink: "#f2f2f2",
  },
  {
    value: "meia-noite",
    label: "Meia-noite",
    description: "Azul profundo, pouca luz.",
    bg: "#131a26",
    ink: "#e6ecf5",
  },
  {
    value: "ameixa",
    label: "Ameixa",
    description: "Roxo profundo, vinho e tinta.",
    bg: "#211826",
    ink: "#f3e9f8",
  },
  {
    value: "oceano",
    label: "Oceano",
    description: "Azul-petróleo, calmo e frio.",
    bg: "#0f1e28",
    ink: "#e0eff5",
  },
  {
    value: "musgo",
    label: "Musgo",
    description: "Verde escuro, floresta à noite.",
    bg: "#141f18",
    ink: "#e7f2e8",
  },
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

function SettingRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { projectId } = useSelectedProject();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // /settings?tab=dados abre direto a aba de dados (redirect de /export).
  const [tab, setTab] = useState("geral");

  const editorFontFamily = useUiStore((state) => state.editorFontFamily);
  const editorFontSize = useUiStore((state) => state.editorFontSize);
  const setEditorFontFamily = useUiStore((state) => state.setEditorFontFamily);
  const setEditorFontSize = useUiStore((state) => state.setEditorFontSize);
  const dailyWordGoal = useUiStore((state) => state.dailyWordGoal);
  const sprintMinutes = useUiStore((state) => state.sprintMinutes);
  const resumeNoticeSeconds = useUiStore((state) => state.resumeNoticeSeconds);
  const setResumeNoticeSeconds = useUiStore(
    (state) => state.setResumeNoticeSeconds,
  );
  const setDailyWordGoal = useUiStore((state) => state.setDailyWordGoal);
  const setSprintMinutes = useUiStore((state) => state.setSprintMinutes);

  const animationsEnabled = useUiStore((state) => state.animationsEnabled);
  const setAnimationsEnabled = useUiStore(
    (state) => state.setAnimationsEnabled,
  );

  const mentionHighlightEnabled = useUiStore(
    (state) => state.mentionHighlightEnabled,
  );
  const setMentionHighlightEnabled = useUiStore(
    (state) => state.setMentionHighlightEnabled,
  );
  const mentionConfirmOpen = useUiStore((state) => state.mentionConfirmOpen);
  const setMentionConfirmOpen = useUiStore(
    (state) => state.setMentionConfirmOpen,
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
  const mentionColorCharacter = useUiStore(
    (state) => state.mentionColorCharacter,
  );
  const mentionColorLocation = useUiStore(
    (state) => state.mentionColorLocation,
  );
  const setMentionColorCharacter = useUiStore(
    (state) => state.setMentionColorCharacter,
  );
  const setMentionColorLocation = useUiStore(
    (state) => state.setMentionColorLocation,
  );

  const searchGlobalEnabled = useUiStore(
    (state) => state.searchGlobalEnabled,
  );
  const setSearchGlobalEnabled = useUiStore(
    (state) => state.setSearchGlobalEnabled,
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

  const homeSections = useUiStore((state) => state.homeSections);
  const setHomeSections = useUiStore((state) => state.setHomeSections);
  const panelTabVisible = useUiStore((state) => state.panelTabVisible);
  const setPanelTabVisible = useUiStore((state) => state.setPanelTabVisible);

  const canvasButtonsHidden = useUiStore(
    (state) => state.canvasButtonsHidden,
  );
  const setCanvasButtonsHidden = useUiStore(
    (state) => state.setCanvasButtonsHidden,
  );
  const unblockCloseOnSave = useUiStore(
    (state) => state.unblockCloseOnSave,
  );
  const setUnblockCloseOnSave = useUiStore(
    (state) => state.setUnblockCloseOnSave,
  );
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

  const themeVariantLight = useUiStore((state) => state.themeVariantLight);
  const themeVariantDark = useUiStore((state) => state.themeVariantDark);
  const setThemeVariantLight = useUiStore(
    (state) => state.setThemeVariantLight,
  );
  const setThemeVariantDark = useUiStore((state) => state.setThemeVariantDark);

  const isDark = resolvedTheme === "dark";
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pt-2">
      <header className="space-y-2">
        <p className="eyebrow">
          Ajustes
        </p>
        <h1 className="display-title">
          Configurações
        </h1>
        <p className="lead">
          O essencial para escrever bem — o resto fica em Avançado.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6 flex flex-col gap-5">
          <Card id="aparencia">
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Tema claro, escuro ou conforme o sistema — e a paleta de cada um.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div role="group" aria-label="Tema" className="flex flex-wrap gap-2">
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
              {mounted ? (
                <ul aria-label="Paleta do tema" className="grid gap-2">
                  {palettes.map((palette) => {
                    const value = palette.value as string;
                    const active = (activeVariant as string) === value;
                    return (
                      <li key={palette.value}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            isDark
                              ? setThemeVariantDark(value as ThemeVariantDark)
                              : setThemeVariantLight(value as ThemeVariantLight)
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                            active
                              ? "bg-accent ring-2 ring-primary"
                              : "ring-border/70 hover:bg-accent/50",
                          )}
                        >
                          <span
                            aria-hidden
                            className="size-9 shrink-0 rounded-full border border-black/10"
                            style={{
                              background: `linear-gradient(135deg, ${palette.bg} 50%, ${palette.ink} 50%)`,
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {palette.label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {palette.description}
                            </span>
                          </span>
                          {active ? (
                            <Check
                              aria-hidden
                              className="size-4 shrink-0 text-primary"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card id="editor">
            <CardHeader>
              <CardTitle>Editor</CardTitle>
              <CardDescription>
                Fonte e tamanho do texto ao escrever.
              </CardDescription>
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

          <Card id="escrita">
            <CardHeader>
              <CardTitle>Escrita</CardTitle>
              <CardDescription>Metas e sessões de escrita.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
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
            </CardContent>
          </Card>

          <Card id="animacoes">
            <CardHeader>
              <CardTitle>Animações</CardTitle>
              <CardDescription>Tempo de transições e fades do app.</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingRow
                label="Ativar animações"
                description="Desligue para uma interface totalmente estática."
                htmlFor="animations-enabled"
              >
                <Switch
                  id="animations-enabled"
                  checked={animationsEnabled}
                  onCheckedChange={setAnimationsEnabled}
                />
              </SettingRow>
            </CardContent>
          </Card>

          <Card id="destaques">
            <CardHeader>
              <CardTitle>Menções</CardTitle>
              <CardDescription>
                Nomes de personagens e locais destacados no texto. Ctrl/Cmd+clique
                (ou toque) abre a ficha.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <SettingRow
                label="Destacar nomes no editor"
                htmlFor="mention-highlight"
              >
                <Switch
                  id="mention-highlight"
                  checked={mentionHighlightEnabled}
                  onCheckedChange={setMentionHighlightEnabled}
                />
              </SettingRow>
              <SettingRow
                label="Perguntar antes de abrir a ficha"
                htmlFor="mention-confirm-open"
              >
                <Switch
                  id="mention-confirm-open"
                  checked={mentionConfirmOpen}
                  onCheckedChange={setMentionConfirmOpen}
                />
              </SettingRow>
            </CardContent>
          </Card>

          <Card id="lixeira">
            <CardHeader>
              <CardTitle>Lixeira</CardTitle>
              <CardDescription>
                Itens excluídos são apagados de vez depois deste prazo (padrão: 30
                dias).
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

          <Card id="busca">
            <CardHeader>
              <CardTitle>Busca</CardTitle>
              <CardDescription>
                A busca global também encontra seções e opções do app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SettingRow
                label="Incluir seções do app"
                htmlFor="search-global"
              >
                <Switch
                  id="search-global"
                  checked={searchGlobalEnabled}
                  onCheckedChange={setSearchGlobalEnabled}
                />
              </SettingRow>
            </CardContent>
          </Card>

          <details className="group surface rounded-2xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
              Avançado
              <ChevronDown
                aria-hidden
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="grid gap-6 border-t border-border/60 px-5 py-5">
              <section className="space-y-3">
                <h3 className="font-serif text-base font-medium tracking-tight">
                  Destaques e leitura
                </h3>
                <SettingRow
                  label="Destacar no modo leitura"
                  htmlFor="mention-highlight-read"
                >
                  <Switch
                    id="mention-highlight-read"
                    checked={mentionHighlightReadEnabled}
                    onCheckedChange={setMentionHighlightReadEnabled}
                  />
                </SettingRow>
                <SettingRow
                  label="Grifar na seleção (modo leitura)"
                  htmlFor="read-grifar"
                >
                  <Switch
                    id="read-grifar"
                    checked={readGrifarEnabled}
                    onCheckedChange={setReadGrifarEnabled}
                  />
                </SettingRow>
                <SettingRow
                  label='Mostrar "Voltar ao texto" na ficha'
                  htmlFor="mention-back-to-text"
                >
                  <Switch
                    id="mention-back-to-text"
                    checked={mentionBackToTextEnabled}
                    onCheckedChange={setMentionBackToTextEnabled}
                  />
                </SettingRow>
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
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="font-serif text-base font-medium tracking-tight">
                  Notificações
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Avisos enquanto o app está em uso; cada tipo avisa uma vez por
                  dia.
                </p>
                <SettingRow
                  label="Ativar notificações"
                  htmlFor="notifications-enabled"
                >
                  <Switch
                    id="notifications-enabled"
                    checked={notificationsEnabled}
                    onCheckedChange={async (checked) => {
                      if (checked) {
                        const result = await requestNotificationPermission();
                        if (result === "denied") {
                          toast.warning(
                            "Notificações do sistema bloqueadas; os avisos aparecem dentro do app.",
                          );
                        }
                      }
                      setNotificationsEnabled(checked);
                    }}
                  />
                </SettingRow>
                <SettingRow
                  label="Meta do dia não batida"
                  description="Avisa a partir das 19h."
                  htmlFor="notify-goal-not-met"
                >
                  <Switch
                    id="notify-goal-not-met"
                    disabled={!notificationsEnabled}
                    checked={notifyGoalNotMet}
                    onCheckedChange={setNotifyGoalNotMet}
                  />
                </SettingRow>
                <SettingRow
                  label="Tempo sem criar personagem"
                  htmlFor="notify-no-new-characters"
                >
                  <Switch
                    id="notify-no-new-characters"
                    disabled={!notificationsEnabled}
                    checked={notifyNoNewCharacters}
                    onCheckedChange={setNotifyNoNewCharacters}
                  />
                </SettingRow>
                <SettingRow
                  label="Tempo sem criar cena"
                  htmlFor="notify-no-new-scenes"
                >
                  <Switch
                    id="notify-no-new-scenes"
                    disabled={!notificationsEnabled}
                    checked={notifyNoNewScenes}
                    onCheckedChange={setNotifyNoNewScenes}
                  />
                </SettingRow>
                <SettingRow
                  label="Tempo sem criar capítulo"
                  htmlFor="notify-no-new-chapters"
                >
                  <Switch
                    id="notify-no-new-chapters"
                    disabled={!notificationsEnabled}
                    checked={notifyNoNewChapters}
                    onCheckedChange={setNotifyNoNewChapters}
                  />
                </SettingRow>
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
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="font-serif text-base font-medium tracking-tight">
                  Página inicial
                </h3>
                {HOME_SECTION_OPTIONS.map((option) => (
                  <SettingRow
                    key={option.value}
                    label={option.label}
                    htmlFor={`home-section-${option.value}`}
                  >
                    <Switch
                      id={`home-section-${option.value}`}
                      checked={homeSections.includes(option.value)}
                      onCheckedChange={() => toggleHomeSection(option.value)}
                    />
                  </SettingRow>
                ))}
                <SettingRow
                  label="Mostrar “Painel” na navegação"
                  htmlFor="panel-tab-visible"
                >
                  <Switch
                    id="panel-tab-visible"
                    checked={panelTabVisible}
                    onCheckedChange={setPanelTabVisible}
                  />
                </SettingRow>
                <div className="max-w-xs">
                  <SettingSlider
                    id="resume-notice-seconds"
                    label={'Botão "Continuar"'}
                    unit="segundos"
                    value={resumeNoticeSeconds}
                    min={0}
                    max={30}
                    step={5}
                    onValueChange={setResumeNoticeSeconds}
                  />
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="font-serif text-base font-medium tracking-tight">
                  Canvas e criatividade
                </h3>
                <SettingRow
                  label="Ocultar botões flutuantes do canvas"
                  htmlFor="canvas-buttons-hidden"
                >
                  <Switch
                    id="canvas-buttons-hidden"
                    checked={canvasButtonsHidden}
                    onCheckedChange={setCanvasButtonsHidden}
                  />
                </SettingRow>
                <SettingRow
                  label="Sorteios citam personagens"
                  htmlFor="prompt-cite-characters"
                >
                  <Switch
                    id="prompt-cite-characters"
                    checked={promptCiteCharacters}
                    onCheckedChange={setPromptCiteCharacters}
                  />
                </SettingRow>
                <SettingRow
                  label="Sorteios citam locais"
                  htmlFor="prompt-cite-locations"
                >
                  <Switch
                    id="prompt-cite-locations"
                    checked={promptCiteLocations}
                    onCheckedChange={setPromptCiteLocations}
                  />
                </SettingRow>
                <SettingRow
                  label="Fechar painel ao guardar no canvas"
                  htmlFor="unblock-close-on-save"
                >
                  <Switch
                    id="unblock-close-on-save"
                    checked={unblockCloseOnSave}
                    onCheckedChange={setUnblockCloseOnSave}
                  />
                </SettingRow>
                <div className="max-w-xs">
                  <SettingSlider
                    id="prompt-custom-weight"
                    label="Peso dos prompts personalizados"
                    unit="%"
                    value={Math.round(promptCustomWeight * 100)}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(value) =>
                      setPromptCustomWeight(value / 100)
                    }
                  />
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="font-serif text-base font-medium tracking-tight">
                  Tags
                </h3>
                <TagsManager projectId={projectId} />
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="font-serif text-base font-medium tracking-tight">
                  Atalhos
                </h3>
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
                      <dd className="text-muted-foreground">
                        {shortcut.action}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </details>
        </TabsContent>

        <TabsContent value="dados" className="mt-6 flex flex-col gap-6">
          <DataSection />
          <Card id="dados">
            <CardHeader>
              <CardTitle>Prompts personalizados</CardTitle>
              <CardDescription>
                Perguntas e “E se...?” criadas por você, com exportação e
                importação em JSON.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4">
              <PromptManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
