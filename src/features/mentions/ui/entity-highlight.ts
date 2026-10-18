import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import {
  findMentions,
  type MentionEntity,
  type MentionType,
} from "../domain/entity-index";

export interface MentionHighlightSettings {
  enabled: boolean;
  entities: MentionEntity[];
  colorFor: (type: MentionType) => string;
  onOpen: (type: MentionType, id: string) => void;
  /** Tooltip shown on highlighted names. */
  title: string;
}

/** Plugin key — also used by the UI layer to force a refresh. */
export const mentionHighlightKey = new PluginKey<DecorationSet>(
  "mentionHighlight",
);

interface EntityHighlightOptions {
  /** Read lazily so editor options always reflect the latest React props. */
  getSettings: () => MentionHighlightSettings;
}

const EMPTY_SETTINGS: MentionHighlightSettings = {
  enabled: false,
  entities: [],
  colorFor: () => "inherit",
  onOpen: () => undefined,
  title: "",
};

function buildDecorations(
  doc: ProseMirrorNode,
  settings: MentionHighlightSettings,
): DecorationSet {
  if (!settings.enabled || settings.entities.length === 0) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of findMentions(node.text, settings.entities)) {
      decorations.push(
        Decoration.inline(pos + match.start, pos + match.end, {
          class: "mention",
          "data-mention-id": match.entity.id,
          "data-mention-type": match.entity.type,
          style: `color: ${settings.colorFor(match.entity.type)};`,
          title: settings.title,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Highlights character and location names inline. Decorations are view-only,
 * so they never touch the saved document or the exported text. Clicking a
 * highlight opens the matching ficha.
 *
 * In the editable writer a modifier key (Ctrl/Cmd) is required, so plain
 * clicks keep placing the caret; in read-only surfaces a plain click opens.
 */
export const EntityHighlight = Extension.create<EntityHighlightOptions>({
  name: "entityHighlight",

  addOptions() {
    return { getSettings: () => EMPTY_SETTINGS };
  },

  addProseMirrorPlugins() {
    const { getSettings } = this.options;
    return [
      new Plugin<DecorationSet>({
        key: mentionHighlightKey,
        state: {
          init: (_config, state) =>
            buildDecorations(state.doc, getSettings()),
          apply: (tr, value, _oldState, newState) => {
            const meta = tr.getMeta(mentionHighlightKey);
            if (tr.docChanged || (meta && meta.refresh)) {
              return buildDecorations(newState.doc, getSettings());
            }
            return value;
          },
        },
        props: {
          decorations: (state) =>
            mentionHighlightKey.getState(state) ?? DecorationSet.empty,
          handleClick: (view, _pos, event) => {
            const settings = getSettings();
            if (!settings.enabled) return false;
            const target = (
              event.target as HTMLElement | null
            )?.closest<HTMLElement>("[data-mention-id]");
            if (!target) return false;
            // In the editor a plain click must place the caret instead.
            if (view.editable && !(event.metaKey || event.ctrlKey)) return false;
            const id = target.getAttribute("data-mention-id");
            const type = target.getAttribute(
              "data-mention-type",
            ) as MentionType | null;
            if (!id || (type !== "character" && type !== "location")) {
              return false;
            }
            settings.onOpen(type, id);
            return true;
          },
        },
      }),
    ];
  },
});
