"use client";

import type { Content } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import type { Json } from "@/shared/types/database";

/** Renders Tiptap document JSON as read-only typographic prose (plan §7.6). */
export function ReadingDocument({ content }: { content: Json }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: content as Content,
    editorProps: {
      attributes: {
        class: "px-1 py-2 font-serif text-lg leading-relaxed outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor) editor.commands.setContent(content as Content);
  }, [editor, content]);

  if (!editor) return null;
  return <EditorContent editor={editor} className="tiptap" />;
}
