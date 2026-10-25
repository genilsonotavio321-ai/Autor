"use client";

import type { Content } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
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
} from "lucide-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Json } from "@/shared/types/database";

/**
 * Corpo rico do card: um único texto com formatação (títulos, alinhamento),
 * no modelo do editor de capítulos. Grava `doc` (JSON) + espelho de texto.
 */
export function CardDocEditor({
  content,
  onChange,
}: {
  content: Json | string;
  onChange: (doc: Json, plainText: string) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Desenvolva a ideia…" }),
    ],
    // shortcut: conteúdo lido só na montagem; reabrir a edição recria o editor.
    content: content as Content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as Json, editor.getText());
    },
    editorProps: {
      attributes: {
        class: "max-w-none text-sm focus:outline-none",
      },
    },
  });

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
            textAlign:
              (current.getAttributes("paragraph").textAlign as
                | string
                | undefined) ??
              (current.getAttributes("heading").textAlign as
                | string
                | undefined) ??
              "left",
          }
        : null,
  });

  if (!editor) return null;

  function toolButton(
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) {
    return (
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className="size-6"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
      >
        {icon}
      </Button>
    );
  }

  return (
    <div className="grid gap-1">
      <div
        role="toolbar"
        aria-label="Formatação"
        className="flex flex-wrap items-center gap-0.5"
      >
        {toolbar &&
          toolButton(
            "Negrito",
            toolbar.bold,
            () => editor.chain().focus().toggleBold().run(),
            <Bold aria-hidden className="size-3.5" />,
          )}
        {toolbar &&
          toolButton(
            "Itálico",
            toolbar.italic,
            () => editor.chain().focus().toggleItalic().run(),
            <Italic aria-hidden className="size-3.5" />,
          )}
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        {toolbar &&
          toolButton(
            "Título 1",
            toolbar.heading1,
            () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            <Heading1 aria-hidden className="size-3.5" />,
          )}
        {toolbar &&
          toolButton(
            "Título 2",
            toolbar.heading2,
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            <Heading2 aria-hidden className="size-3.5" />,
          )}
        {toolbar &&
          toolButton(
            "Título 3",
            toolbar.heading3,
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            <Heading3 aria-hidden className="size-3.5" />,
          )}
        <Separator orientation="vertical" className="mx-0.5 h-4" />
        {toolbar &&
          toolButton(
            "Alinhar à esquerda",
            toolbar.textAlign === "left",
            () => editor.chain().focus().setTextAlign("left").run(),
            <AlignLeft aria-hidden className="size-3.5" />,
          )}
        {toolbar &&
          toolButton(
            "Centralizar",
            toolbar.textAlign === "center",
            () => editor.chain().focus().setTextAlign("center").run(),
            <AlignCenter aria-hidden className="size-3.5" />,
          )}
        {toolbar &&
          toolButton(
            "Alinhar à direita",
            toolbar.textAlign === "right",
            () => editor.chain().focus().setTextAlign("right").run(),
            <AlignRight aria-hidden className="size-3.5" />,
          )}
        {toolbar &&
          toolButton(
            "Justificar",
            toolbar.textAlign === "justify",
            () => editor.chain().focus().setTextAlign("justify").run(),
            <AlignJustify aria-hidden className="size-3.5" />,
          )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
