import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchHighlightRange {
  from: number;
  to: number;
}

export interface SearchHighlightState {
  /** Ranges of every occurrence, in doc order. */
  ranges: SearchHighlightRange[];
  /** Index of the "current" occurrence, highlighted more strongly. */
  active: number;
}

const EMPTY: SearchHighlightState = { ranges: [], active: 0 };

/** Plugin key — the UI layer dispatches `setMeta` to set the ranges. */
export const searchHighlightKey = new PluginKey<SearchHighlightState>(
  "searchHighlight",
);

function buildDecorations(
  doc: ProseMirrorNode,
  state: SearchHighlightState,
): DecorationSet {
  if (state.ranges.length === 0) return DecorationSet.empty;

  const size = doc.content.size;
  const decorations: Decoration[] = [];
  state.ranges.forEach((range, index) => {
    // Guard against ranges that drifted after an edit.
    if (range.from < 0 || range.to > size || range.from >= range.to) return;
    decorations.push(
      Decoration.inline(range.from, range.to, {
        class:
          index === state.active
            ? "search-match search-match-active"
            : "search-match",
      }),
    );
  });

  if (decorations.length === 0) return DecorationSet.empty;
  return DecorationSet.create(doc, decorations);
}

/**
 * View-only highlights for the find & replace section (item 19). They never
 * touch the saved document. The UI dispatches
 * `editor.view.dispatch(tr.setMeta(searchHighlightKey, { ranges, active }))`.
 */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchHighlightState>({
        key: searchHighlightKey,
        state: {
          init: () => EMPTY,
          apply: (tr, value) => {
            const meta = tr.getMeta(searchHighlightKey) as
              | SearchHighlightState
              | undefined;
            if (meta) return meta;
            // Positions drift when the doc changes; the UI re-dispatches.
            if (tr.docChanged) return EMPTY;
            return value;
          },
        },
        props: {
          decorations: (state) =>
            buildDecorations(
              state.doc,
              searchHighlightKey.getState(state) ?? EMPTY,
            ),
        },
      }),
    ];
  },
});
