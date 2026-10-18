"use client";

import type { Content } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
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
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  EntityHighlight,
  mentionHighlightKey,
  type MentionHighlightSettings,
} from "@/features/mentions/ui/entity-highlight";
import type { MentionEntity, MentionType } from "@/features/mentions/domain/entity-index";
import { useUiStore } from "@/shared/store/ui-store";
import type { Json } from "@/shared/types/database";

interface TiptapEditorProps {
  content: Json;
  placeholder?: string;
  /** Character/location names to highlight inline. */
  mentions?: MentionEntity[];
  /** Called when a highlight is opened (Ctrl/Cmd+click in the editor). */
  onOpenMention?: (type: MentionType, id: string) => void;
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
    onOpen: (type, id) => onOpenMention?.(type, id),
    title: "Ctrl+clique para abrir a ficha",
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      EntityHighlight.configure({
        getSettings: () => mentionSettingsRef.current,
      }),
    ],
    content: content as Content,
    editorProps: {
      attributes: {
        class:
          "min-h-[55vh] px-1 py-4 font-serif text-lg leading-relaxed outline-none",
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
    </div>
  );
}
