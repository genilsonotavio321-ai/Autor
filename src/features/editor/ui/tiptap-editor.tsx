"use client";

import type { Content } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  PenLine,
  Quote,
  Redo,
  Undo,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  setDocumentAlignment,
  type TextAlignValue,
} from "@/features/editor/domain/alignment";
import { GrifarMark } from "@/features/editor/domain/grifar-mark";
import { ReviewButton, ReviewDialog } from "@/features/editor/ui/review-dialog";
import { SearchHighlight } from "@/features/editor/ui/search-highlight";
import {
  EntityHighlight,
  mentionHighlightKey,
  type MentionHighlightSettings,
} from "@/features/mentions/ui/entity-highlight";
import type { MentionEntity, MentionType } from "@/features/mentions/domain/entity-index";
import {
  isTouchDevice,
  type MentionClickSource,
} from "@/features/mentions/domain/mention-click";
import { useUiStore } from "@/shared/store/ui-store";
import type { Json } from "@/shared/types/database";

interface TiptapEditorProps {
  content: Json;
  placeholder?: string;
  /** Character/location names to highlight inline. */
  mentions?: MentionEntity[];
  /** Called when a highlight is opened (Ctrl/Cmd+click or touch tap). */
  onOpenMention?: (
    type: MentionType,
    id: string,
    source: MentionClickSource,
  ) => void;
  /** Called once when the editor instance is ready (restore cursor, etc). */
  onReady?: (editor: Editor) => void;
  /** Called on every document change. */
  onUpdate?: (editor: Editor) => void;
  /** Barra de ações renderizada dentro do container do editor (layout simplificado). */
  actions?: React.ReactNode;
}

// Identidades estáveis: o efeito interno do BubbleMenu (@tiptap/react/menus)
// depende de shouldShow/options e dispara updateOptions no editor a cada nova
// referência — props inline aqui re-renderizam → dispatch → loop infinito.
const GRIFAR_BUBBLE_OPTIONS = { placement: "top" } as const;

function grifarBubbleShouldShow({ editor }: { editor: Editor }): boolean {
  return !editor.state.selection.empty;
}

export function TiptapEditor({
  content,
  placeholder = "Comece a escrever…",
  mentions = [],
  onOpenMention,
  onReady,
  onUpdate,
  actions,
}: TiptapEditorProps) {
  const editorSimplified = useUiStore((state) => state.editorSimplified);
  const mentionHighlightEnabled = useUiStore(
    (state) => state.mentionHighlightEnabled,
  );
  const mentionColorCharacter = useUiStore(
    (state) => state.mentionColorCharacter,
  );
  const mentionColorLocation = useUiStore(
    (state) => state.mentionColorLocation,
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  // Destaque dos trechos grifados ("Revelar grifados" → classe grifar-reveal).
  const [grifarReveal, setGrifarReveal] = useState(false);
  // Item 20: com o switch "Capítulo inteiro" ligado, o alinhamento vale para
  // todos os parágrafos; desligado, só para a seleção atual.
  const [alignmentScope, setAlignmentScope] = useState<
    "chapter" | "selection"
  >("selection");

  // Latest settings, read lazily by the extension (updated every render).
  const mentionSettingsRef = useRef<MentionHighlightSettings>({
    enabled: false,
    entities: [],
    colorFor: () => "inherit",
    onOpen: () => undefined,
    title: "",
  });
  mentionSettingsRef.current = {
    enabled: mentionHighlightEnabled,
    entities: mentions,
    colorFor: (type) =>
      type === "character" ? mentionColorCharacter : mentionColorLocation,
    onOpen: (type, id, source) => onOpenMention?.(type, id, source),
    // Item 15: em dispositivos de toque o clique simples abre (com aviso).
    title: isTouchDevice()
      ? "Toque para abrir a ficha"
      : "Ctrl+clique para abrir a ficha",
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      EntityHighlight.configure({
        getSettings: () => mentionSettingsRef.current,
      }),
      SearchHighlight,
      GrifarMark,
    ],
    content: content as Content,
    editorProps: {
      attributes: {
        // Sem font-family/tamanho aqui: o wrapper em editor-page.tsx injeta
        // fontSize/fontFamily do store via estilo inline no container, e
        // classes utilitárias neste elemento sobrescreveriam o valor herdado.
        // Altura estática com scroll interno (F1): o contenteditable não
        // cresce a página — o scroll acontece dentro dele. Por isso o
        // autosave guarda editor.view.dom.scrollTop (e não window.scrollY)
        // para "Continuar escrevendo" (ver scheduleSave em editor-page.tsx).
        class:
          "h-[calc(100dvh-14rem)] min-h-72 overflow-y-auto px-1 py-4 leading-relaxed outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onUpdate?.(current),
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
    // onReady is expected to be stable (useCallback) — runs once per instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Recompute highlights when the index or its styling changes.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(mentionHighlightKey, { refresh: true }),
    );
  }, [
    editor,
    mentions,
    mentionHighlightEnabled,
    mentionColorCharacter,
    mentionColorLocation,
  ]);

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            grifar: current.isActive("grifar"),
            heading1: current.isActive("heading", { level: 1 }),
            heading2: current.isActive("heading", { level: 2 }),
            heading3: current.isActive("heading", { level: 3 }),
            bulletList: current.isActive("bulletList"),
            orderedList: current.isActive("orderedList"),
            blockquote: current.isActive("blockquote"),
            textAlign:
              (current.getAttributes("paragraph").textAlign as
                | TextAlignValue
                | undefined) ??
              (current.getAttributes("heading").textAlign as
                | TextAlignValue
                | undefined) ??
              "left",
            canUndo: current.can().chain().undo(),
            canRedo: current.can().chain().redo(),
          }
        : null,
  });

  if (!editor) return null;

  function toolButton(
    label: string,
    active: boolean,
    disabled: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) {
    return (
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className="size-8"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
      </Button>
    );
  }

  function applyAlignment(value: TextAlignValue) {
    if (!editor) return;
    if (alignmentScope === "chapter") {
      editor.view.dispatch(setDocumentAlignment(editor.state, value));
      editor.view.focus();
      return;
    }
    editor.chain().focus().setTextAlign(value).run();
  }

  function toggleGrifar() {
    if (!editor) return;
    if (editor.isActive("grifar")) {
      editor.chain().focus().unsetMark("grifar").run();
    } else {
      editor.chain().focus().setMark("grifar").run();
    }
  }

  return (
    <div className="rounded-lg border">
      <div
        role="toolbar"
        aria-label="Formatação"
        className="flex flex-wrap items-center gap-0.5 border-b p-1.5"
      >
        {!editorSimplified ? (
          <>
            {toolbar &&
              toolButton(
                "Negrito",
                toolbar.bold,
                false,
                () => editor.chain().focus().toggleBold().run(),
                <Bold aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Itálico",
                toolbar.italic,
                false,
                () => editor.chain().focus().toggleItalic().run(),
                <Italic aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Grifar seleção",
                toolbar.grifar,
                false,
                toggleGrifar,
                <PenLine aria-hidden className="size-4" />,
              )}
            <Separator orientation="vertical" className="mx-1 h-5" />
            {toolbar &&
              toolButton(
                "Título 1",
                toolbar.heading1,
                false,
                () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
                <Heading1 aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Título 2",
                toolbar.heading2,
                false,
                () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
                <Heading2 aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Título 3",
                toolbar.heading3,
                false,
                () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
                <Heading3 aria-hidden className="size-4" />,
              )}
            <Separator orientation="vertical" className="mx-1 h-5" />
            {toolbar &&
              toolButton(
                "Lista com marcadores",
                toolbar.bulletList,
                false,
                () => editor.chain().focus().toggleBulletList().run(),
                <List aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Lista numerada",
                toolbar.orderedList,
                false,
                () => editor.chain().focus().toggleOrderedList().run(),
                <ListOrdered aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Citação",
                toolbar.blockquote,
                false,
                () => editor.chain().focus().toggleBlockquote().run(),
                <Quote aria-hidden className="size-4" />,
              )}
            <Separator orientation="vertical" className="mx-1 h-5" />
            {toolbar &&
              toolButton(
                "Alinhar à esquerda",
                toolbar.textAlign === "left",
                false,
                () => applyAlignment("left"),
                <AlignLeft aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Centralizar",
                toolbar.textAlign === "center",
                false,
                () => applyAlignment("center"),
                <AlignCenter aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Alinhar à direita",
                toolbar.textAlign === "right",
                false,
                () => applyAlignment("right"),
                <AlignRight aria-hidden className="size-4" />,
              )}
            {toolbar &&
              toolButton(
                "Justificar",
                toolbar.textAlign === "justify",
                false,
                () => applyAlignment("justify"),
                <AlignJustify aria-hidden className="size-4" />,
              )}
            <div className="ml-1 flex items-center gap-1.5">
              <Switch
                id="alignment-chapter"
                aria-label="Aplicar alinhamento ao capítulo inteiro"
                checked={alignmentScope === "chapter"}
                onCheckedChange={(checked) =>
                  setAlignmentScope(checked ? "chapter" : "selection")
                }
              />
              <Label
                htmlFor="alignment-chapter"
                className="text-xs text-muted-foreground"
              >
                Capítulo inteiro
              </Label>
            </div>
            <Separator orientation="vertical" className="mx-1 h-5" />
          </>
        ) : null}
        {toolbar &&
          toolButton(
            "Revelar grifados",
            grifarReveal,
            false,
            () => setGrifarReveal((value) => !value),
            <Eye aria-hidden className="size-4" />,
          )}
        <ReviewButton onClick={() => setReviewOpen(true)} />
        <Separator orientation="vertical" className="mx-1 h-5" />
        {toolbar &&
          toolButton(
            "Desfazer",
            false,
            !toolbar.canUndo,
            () => editor.chain().focus().undo().run(),
            <Undo aria-hidden className="size-4" />,
          )}
        {toolbar &&
          toolButton(
            "Refazer",
            false,
            !toolbar.canRedo,
            () => editor.chain().focus().redo().run(),
            <Redo aria-hidden className="size-4" />,
          )}
      </div>
      <BubbleMenu
        editor={editor}
        shouldShow={grifarBubbleShouldShow}
        options={GRIFAR_BUBBLE_OPTIONS}
        className="rounded-lg border bg-popover p-1 shadow-md"
      >
        <div className="flex items-center gap-0.5">
          {editorSimplified && toolbar ? (
            <>
              {toolButton(
                "Negrito",
                toolbar.bold,
                false,
                () => editor.chain().focus().toggleBold().run(),
                <Bold aria-hidden className="size-4" />,
              )}
              {toolButton(
                "Itálico",
                toolbar.italic,
                false,
                () => editor.chain().focus().toggleItalic().run(),
                <Italic aria-hidden className="size-4" />,
              )}
            </>
          ) : null}
          {toolButton(
            "Grifar seleção",
            toolbar?.grifar ?? false,
            false,
            toggleGrifar,
            <PenLine aria-hidden className="size-4" />,
          )}
          {editorSimplified && toolbar ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Título"
                  >
                    {toolbar.heading1 ? (
                      <Heading1 aria-hidden className="size-4" />
                    ) : toolbar.heading2 ? (
                      <Heading2 aria-hidden className="size-4" />
                    ) : toolbar.heading3 ? (
                      <Heading3 aria-hidden className="size-4" />
                    ) : (
                      <Heading aria-hidden className="size-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-36"
                  portal={false}
                >
                  <DropdownMenuItem
                    onSelect={() =>
                      editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                  >
                    Título 1
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                  >
                    Título 2
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      editor.chain().focus().toggleHeading({ level: 3 }).run()
                    }
                  >
                    Título 3
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {toolButton(
                "Citação",
                toolbar.blockquote,
                false,
                () => editor.chain().focus().toggleBlockquote().run(),
                <Quote aria-hidden className="size-4" />,
              )}
              {toolButton(
                "Lista com marcadores",
                toolbar.bulletList,
                false,
                () => editor.chain().focus().toggleBulletList().run(),
                <List aria-hidden className="size-4" />,
              )}
              {toolButton(
                "Lista numerada",
                toolbar.orderedList,
                false,
                () => editor.chain().focus().toggleOrderedList().run(),
                <ListOrdered aria-hidden className="size-4" />,
              )}
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Alinhamento"
                  >
                    {toolbar.textAlign === "center" ? (
                      <AlignCenter aria-hidden className="size-4" />
                    ) : toolbar.textAlign === "right" ? (
                      <AlignRight aria-hidden className="size-4" />
                    ) : toolbar.textAlign === "justify" ? (
                      <AlignJustify aria-hidden className="size-4" />
                    ) : (
                      <AlignLeft aria-hidden className="size-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-44"
                  portal={false}
                >
                  <DropdownMenuItem onSelect={() => applyAlignment("left")}>
                    Esquerda
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyAlignment("center")}>
                    Centro
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyAlignment("right")}>
                    Direita
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => applyAlignment("justify")}>
                    Justificar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div
                    className="flex items-center justify-between gap-2 px-1.5 py-1"
                    onPointerDown={(event) => event.preventDefault()}
                  >
                    <Label
                      htmlFor="bubble-alignment-chapter"
                      className="text-xs text-muted-foreground"
                    >
                      Capítulo inteiro
                    </Label>
                    <Switch
                      id="bubble-alignment-chapter"
                      aria-label="Aplicar alinhamento ao capítulo inteiro"
                      checked={alignmentScope === "chapter"}
                      onCheckedChange={(checked) =>
                        setAlignmentScope(checked ? "chapter" : "selection")
                      }
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </BubbleMenu>
      <div className={grifarReveal ? "grifar-reveal" : undefined}>
        <EditorContent editor={editor} className="tiptap px-3" />
      </div>
      {actions ? (
        <div className="flex items-center justify-end gap-1.5 border-t px-2 py-1.5">
          {actions}
        </div>
      ) : null}
      <ReviewDialog
        editor={editor}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}
