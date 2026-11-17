"use client";

import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { requestNotificationPermission } from "@/features/productivity/infra/notification-service";
import { useSelectedProject } from "@/features/projects/application/use-selected-project";
import { SHORTCUTS } from "@/features/settings/ui/settings-options";
import { SettingRow } from "@/features/settings/ui/setting-row";
import { SettingSlider } from "@/features/settings/ui/setting-slider";
import { TagsManager } from "@/features/tags/ui/tags-manager";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/shared/store/ui-store";

/** Seção da área Avançado: título e, opcionalmente, a linha divisória de cima. */
function Section({
  title,
  bordered,
  children,
}: {
  title: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("space-y-3", bordered && "border-t border-border/60 pt-5")}
    >
      <h3 className="font-serif text-base font-medium tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Destaques do texto no modo leitura e as cores de cada tipo de nome. */
export function ReadingSection() {
  const mentionHighlightEnabled = useUiStore(
    (state) => state.mentionHighlightEnabled,
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

  return (
    <Section title="Destaques e leitura">
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
          <Label htmlFor="mention-color-character">Cor de personagens</Label>
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
              onChange={(event) => setMentionColorLocation(event.target.value)}
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
    </Section>
  );
}

/** Avisos dentro do app e quando cada tipo deve disparar. */
export function NotificationsSection() {
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

  return (
    <Section title="Notificações" bordered>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Avisos enquanto o app está em uso; cada tipo avisa uma vez por dia.
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
      <SettingRow label="Tempo sem criar cena" htmlFor="notify-no-new-scenes">
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
    </Section>
  );
}

/** Itens opcionais da navegação. */
export function NavigationSection() {
  const panelTabVisible = useUiStore((state) => state.panelTabVisible);
  const setPanelTabVisible = useUiStore((state) => state.setPanelTabVisible);

  return (
    <Section title="Navegação" bordered>
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
    </Section>
  );
}

/** Comportamento do canvas e o peso dos prompts personalizados. */
export function CanvasSection() {
  const canvasButtonsHidden = useUiStore((state) => state.canvasButtonsHidden);
  const setCanvasButtonsHidden = useUiStore(
    (state) => state.setCanvasButtonsHidden,
  );
  const unblockCloseOnSave = useUiStore((state) => state.unblockCloseOnSave);
  const setUnblockCloseOnSave = useUiStore(
    (state) => state.setUnblockCloseOnSave,
  );
  const promptCiteCharacters = useUiStore(
    (state) => state.promptCiteCharacters,
  );
  const promptCiteLocations = useUiStore((state) => state.promptCiteLocations);
  const setPromptCiteCharacters = useUiStore(
    (state) => state.setPromptCiteCharacters,
  );
  const setPromptCiteLocations = useUiStore(
    (state) => state.setPromptCiteLocations,
  );
  const promptCustomWeight = useUiStore((state) => state.promptCustomWeight);
  const setPromptCustomWeight = useUiStore(
    (state) => state.setPromptCustomWeight,
  );

  return (
    <Section title="Canvas e criatividade" bordered>
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
          onValueChange={(value) => setPromptCustomWeight(value / 100)}
        />
      </div>
    </Section>
  );
}

/** Gerenciador das tags do projeto selecionado. */
export function TagsSection() {
  const { projectId } = useSelectedProject();

  return (
    <Section title="Tags" bordered>
      <TagsManager projectId={projectId} />
    </Section>
  );
}

/** Atalhos de teclado do app. */
export function ShortcutsSection() {
  return (
    <Section title="Atalhos" bordered>
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
    </Section>
  );
}
