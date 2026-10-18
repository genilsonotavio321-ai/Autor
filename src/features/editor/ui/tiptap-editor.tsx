"use client";

import type { Content } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  setDocumentAlignment,
  type TextAlignValue,
} from "@/features/editor/domain/alignment";
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
}

export function TiptapEditor({
  content,
  placeholder = "Comece a escrever…",
  mentions = [],
  onOpenMention,
  onReady,
  onUpdate,
}: TiptapEditorProps) {
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
    ],
    content: content as Content,
    editorProps: {
      attributes: {
        // Sem font-family/tamanho aqui: o wrapper em editor-page.tsx injeta
        // fontSize/fontFamily do store via estilo inline no container, e
        // classes utilitárias neste elemento sobrescreveriam o valor herdado.
        // Altura estática com scroll interno (F1): o contenteditable não
        // cresce a página — o scroll acontece dentro dele. Consequência
        // aceitável: window.scrollY salvo pelo autosave fica ~0 (ver
        // scheduleSave em editor-page.tsx), então a restauração de scroll
        // ao voltar ao capítulo não tem efeito prático.
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

  return (
    <div className="rounded-lg border">
      <div
        role="toolbar"
        aria-label="Formatação"
        className="flex flex-wrap items-center gap-0.5 border-b p-1.5"
      >
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
      <EditorContent editor={editor} className="tiptap px-3" />
      <ReviewDialog
        editor={editor}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}
