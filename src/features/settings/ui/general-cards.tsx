"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SettingRow } from "@/features/settings/ui/setting-row";
import { SettingSlider } from "@/features/settings/ui/setting-slider";
import {
  EDITOR_FONT_SIZE_MAX,
  EDITOR_FONT_SIZE_MIN,
  READ_FONT_SIZE_MAX,
  READ_FONT_SIZE_MIN,
  TRASH_RETENTION_OPTIONS,
  useUiStore,
} from "@/shared/store/ui-store";

/** Fonte e tamanho do texto no editor. */
export function EditorCard() {
  const editorFontFamily = useUiStore((state) => state.editorFontFamily);
  const editorFontSize = useUiStore((state) => state.editorFontSize);
  const setEditorFontFamily = useUiStore((state) => state.setEditorFontFamily);
  const setEditorFontSize = useUiStore((state) => state.setEditorFontSize);

  return (
    <Card id="editor">
      <CardHeader>
        <CardTitle>Editor</CardTitle>
        <CardDescription>Fonte e tamanho do texto ao escrever.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="editor-font">Fonte</Label>
          <div role="group" aria-label="Fonte do editor" className="flex gap-2">
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
  );
}

/** Tamanho do texto no modo leitura (independente do editor). */
export function ReadingCard() {
  const readFontSize = useUiStore((state) => state.readFontSize);
  const setReadFontSize = useUiStore((state) => state.setReadFontSize);

  return (
    <Card id="leitura">
      <CardHeader>
        <CardTitle>Leitura</CardTitle>
        <CardDescription>Tamanho do texto no modo leitura.</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingSlider
          id="read-size"
          label="Tamanho da fonte"
          unit="px"
          value={readFontSize}
          min={READ_FONT_SIZE_MIN}
          max={READ_FONT_SIZE_MAX}
          step={1}
          onValueChange={setReadFontSize}
        />
      </CardContent>
    </Card>
  );
}

/** Deslize lateral no celular: capítulos e volta ao projeto. */
export function NavigationCard() {
  const swipeNavigationEnabled = useUiStore(
    (state) => state.swipeNavigationEnabled,
  );
  const setSwipeNavigationEnabled = useUiStore(
    (state) => state.setSwipeNavigationEnabled,
  );

  return (
    <Card id="navegacao">
      <CardHeader>
        <CardTitle>Navegação</CardTitle>
        <CardDescription>
          Deslize a tela para o lado no celular para trocar de capítulo e
          voltar ao projeto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow
          label="Deslizar para navegar"
          description="Na leitura, troca de capítulo. Nas páginas secundárias, volta ao projeto."
          htmlFor="swipe-navigation"
        >
          <Switch
            id="swipe-navigation"
            checked={swipeNavigationEnabled}
            onCheckedChange={setSwipeNavigationEnabled}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}

/** Meta de escrita. */
export function WritingCard() {
  const dailyWordGoal = useUiStore((state) => state.dailyWordGoal);
  const setDailyWordGoal = useUiStore((state) => state.setDailyWordGoal);

  return (
    <Card id="escrita">
      <CardHeader>
        <CardTitle>Escrita</CardTitle>
        <CardDescription>Meta diária de palavras.</CardDescription>
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
      </CardContent>
    </Card>
  );
}

/** Tempo de transições e fades do app. */
export function AnimationsCard() {
  const animationsEnabled = useUiStore((state) => state.animationsEnabled);
  const setAnimationsEnabled = useUiStore(
    (state) => state.setAnimationsEnabled,
  );

  return (
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
  );
}

/** Destaque de nomes de personagens e locais no editor. */
export function MentionsCard() {
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

  return (
    <Card id="destaques">
      <CardHeader>
        <CardTitle>Menções</CardTitle>
        <CardDescription>
          Nomes de personagens e locais destacados no texto. Ctrl/Cmd+clique (ou
          toque) abre a ficha.
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
  );
}

/** Prazo de retenção dos itens excluídos. */
export function TrashCard() {
  const trashRetentionMs = useUiStore((state) => state.trashRetentionMs);
  const setTrashRetentionMs = useUiStore((state) => state.setTrashRetentionMs);

  return (
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
          <Label htmlFor="trash-retention">Apagar itens da lixeira após</Label>
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
  );
}

/** Busca global incluindo seções e opções do app. */
export function SearchCard() {
  const searchGlobalEnabled = useUiStore(
    (state) => state.searchGlobalEnabled,
  );
  const setSearchGlobalEnabled = useUiStore(
    (state) => state.setSearchGlobalEnabled,
  );

  return (
    <Card id="busca">
      <CardHeader>
        <CardTitle>Busca</CardTitle>
        <CardDescription>
          A busca global também encontra seções e opções do app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow label="Incluir seções do app" htmlFor="search-global">
          <Switch
            id="search-global"
            checked={searchGlobalEnabled}
            onCheckedChange={setSearchGlobalEnabled}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
