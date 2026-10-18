"use client";

import type { Content } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import type {
  MentionEntity,
  MentionType,
} from "@/features/mentions/domain/entity-index";
import {
  EntityHighlight,
  mentionHighlightKey,
  type MentionHighlightSettings,
} from "@/features/mentions/ui/entity-highlight";
import { useUiStore } from "@/shared/store/ui-store";
import type { Json } from "@/shared/types/database";

interface ReadingDocumentProps {
  content: Json;
  /** Character/location names to highlight inline. */
  mentions?: MentionEntity[];
  /** Called when a highlight is clicked (plain click in read mode). */
  onOpenMention?: (type: MentionType, id: string) => void;
}

/** Renders Tiptap document JSON as read-only typographic prose (plan §7.6). */
export function ReadingDocument({
  content,
  mentions = [],
  onOpenMention,
}: ReadingDocumentProps) {
  const mentionHighlightEnabled = useUiStore(
    (state) => state.mentionHighlightEnabled,
  );
  const mentionColorCharacter = useUiStore(
    (state) => state.mentionColorCharacter,
  );
  const mentionColorLocation = useUiStore(
    (state) => state.mentionColorLocation,
  );

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
    title: "Abrir ficha",
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      EntityHighlight.configure({
        getSettings: () => mentionSettingsRef.current,
      }),
    ],
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

  if (!editor) return null;
  return (
    <EditorContent editor={editor} className="tiptap mention-readonly" />
  );
}
