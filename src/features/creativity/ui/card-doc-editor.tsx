"use client";

import type { Content } from "@tiptap/core";
import Image from "@tiptap/extension-image";
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
  Highlighter,
  ImagePlus,
  Italic,
  TextQuote,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GrifarMark } from "@/features/editor/domain/grifar-mark";
import { readImageAsDataUrl } from "@/features/editor/domain/image-file";
import type { Json } from "@/shared/types/database";

/**
 * Corpo rico do card: um único texto com formatação (títulos, alinhamento,
 * grifo, citação e imagem), no modelo do editor de capítulos. Grava `doc`
 * (JSON) + espelho de texto.
 *
 * A barra de formatação é um "topbar" fixo: grudo no topo da área de
 * rolagem do card (sticky), de modo que textos longos a mantenham visível
 * o tempo todo — inclusive o estado ativo de título/alinhamento.
 */
export function CardDocEditor({
  content,
  onChange,
}: {
  content: Json | string;
  onChange: (doc: Json, plainText: string) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Desenvolva a ideia…" }),
      // allowBase64: o conteúdo persiste como dataURL no JSON do card —
      // sem isso o parser descarta a imagem ao recarregar.
      Image.configure({
        allowBase64: true,
        inline: false,
        HTMLAttributes: { class: "max-w-full rounded-lg" },
      }),
      GrifarMark,
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
            grifar: current.isActive("grifar"),
            blockquote: current.isActive("blockquote"),
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

  // Arrow consts (não function declarations): o narrowing do `if (!editor)
  // return null` precisa alcançar o corpo dessas funções.
  const toggleGrifar = () => {
    // Padrão do editor de capítulos: toggleMark some com o mark que já está
    // no meio da seleção; set/unset explícito preserva o grifo.
    if (editor.isActive("grifar")) {
      editor.chain().focus().unsetMark("grifar").run();
    } else {
      editor.chain().focus().setMark("grifar").run();
    }
  };

  const insertImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const src = await readImageAsDataUrl(file);
      editor.chain().focus().setImage({ src }).run();
    } catch {
      toast.error("Não foi possível inserir a imagem", {
        description: "Use um arquivo de imagem menor (limite ~2MB).",
      });
    }
  };

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
        // Topbar separada do texto: cola no topo da rolagem do card, com
        // fundo sólido, de modo a continuar usando em textos longos.
        className="sticky top-0 z-10 -mx-2 -mt-2 mb-1 flex flex-wrap items-center gap-0.5 rounded-md border-b bg-background px-1 py-1"
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
        {toolbar &&
          toolButton(
            "Grifar seleção",
            toolbar.grifar,
            toggleGrifar,
            <Highlighter aria-hidden className="size-3.5" />,
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
        {toolButton(
          "Inserir imagem",
          false,
          () => imageInputRef.current?.click(),
          <ImagePlus aria-hidden className="size-3.5" />,
        )}
        {toolbar &&
          toolButton(
            "Citação",
            toolbar.blockquote,
            () => editor.chain().focus().toggleBlockquote().run(),
            <TextQuote aria-hidden className="size-3.5" />,
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
      {/* .tiptap: wrapper igual ao do editor de capítulos — habilita os
          estilos globais (`.tiptap .ProseMirror .grifar`) neste editor. */}
      <EditorContent editor={editor} className="tiptap" />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void insertImage(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
