"use client";

import type { Content } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Highlighter } from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";

import { GrifarMark } from "@/features/editor/domain/grifar-mark";

import type {
  MentionEntity,
  MentionType,
} from "@/features/mentions/domain/entity-index";
import {
  EntityHighlight,
  mentionHighlightKey,
  type MentionHighlightSettings,
} from "@/features/mentions/ui/entity-highlight";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/shared/store/ui-store";
import type { Json } from "@/shared/types/database";

interface ReadingDocumentProps {
  content: Json;
  /** Character/location names to highlight inline. */
  mentions?: MentionEntity[];
  /** Called when a highlight is clicked (plain click in read mode). */
  onOpenMention?: (type: MentionType, id: string) => void;
  /** Called after the user grifou a selection (doc JSON ready to persist). */
  onGrifarChange?: (json: Json) => void;
}

/** Renders Tiptap document JSON as read-only typographic prose (plan §7.6). */
export function ReadingDocument({
  content,
  mentions = [],
  onOpenMention,
  onGrifarChange,
}: ReadingDocumentProps) {
  const mentionHighlightReadEnabled = useUiStore(
    (state) => state.mentionHighlightReadEnabled,
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
    enabled: mentionHighlightReadEnabled,
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
      // Same alignment attribute as the editor, so centered/right/justified
      // paragraphs keep their `text-align` style in read mode.
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Mesma configuração do editor: capítulo com imagem precisa do node
      // registrado aqui, senão o setContent descarta a imagem.
      Image.configure({
        allowBase64: true,
        inline: false,
        HTMLAttributes: { class: "max-w-full rounded-lg" },
      }),
      EntityHighlight.configure({
        getSettings: () => mentionSettingsRef.current,
      }),
      GrifarMark,
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
    mentionHighlightReadEnabled,
    mentionColorCharacter,
    mentionColorLocation,
  ]);

  // Botão "Grifar": segue a seleção no modo leitura (edição continua proibida).
  const [grifarPos, setGrifarPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const onGrifarChangeRef = useRef(onGrifarChange);
  onGrifarChangeRef.current = onGrifarChange;

  useEffect(() => {
    if (!editor) return;
    const hide = () => setGrifarPos(null);
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || !useUiStore.getState().readGrifarEnabled) {
        hide();
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const top = Math.min(start.top, end.top) - 44;
      const left =
        (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
      setGrifarPos({ top: Math.max(8, top), left });
    };
    editor.on("selectionUpdate", update);
    // position:fixed acompanha a viewport, não o texto — some ao rolar.
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    window.addEventListener("resize", hide);
    return () => {
      editor.off("selectionUpdate", update);
      window.removeEventListener("scroll", hide, { capture: true });
      window.removeEventListener("resize", hide);
    };
  }, [editor]);

  function applyGrifar() {
    if (!editor) return;
    editor.chain().setMark("grifar").run();
    setGrifarPos(null);
    onGrifarChangeRef.current?.(editor.getJSON() as Json);
  }

  if (!editor) return null;
  return (
    <>
      <EditorContent editor={editor} className="tiptap mention-readonly" />
      {grifarPos ? (
        <Button
          size="sm"
          className="fixed z-50 shadow-md print:hidden"
          style={{
            top: grifarPos.top,
            left: grifarPos.left,
            transform: "translateX(-50%)",
          }}
          data-testid="read-grifar-button"
          aria-label="Grifar seleção"
          onMouseDown={(event) => event.preventDefault()}
          onClick={applyGrifar}
        >
          <Highlighter aria-hidden className="size-3.5" />
          Grifar
        </Button>
      ) : null}
    </>
  );
}
