"use client";

import type { Content } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import type { Json } from "@/shared/types/database";

/**
 * Editor rico do card: Tiptap mínimo, sem toolbar — formatação via atalhos
 * (Ctrl+B/I/U). Grava `doc` (JSON) e um espelho de texto plano.
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

  return <EditorContent editor={editor} />;
}
