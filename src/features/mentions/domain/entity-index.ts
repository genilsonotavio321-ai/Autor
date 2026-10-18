/**
 * Index of character/location names used to highlight mentions in prose
 * (plan §7.10). Pure functions — no editor or database dependencies.
 */

export type MentionType = "character" | "location";

export interface MentionEntity {
  id: string;
  type: MentionType;
  name: string;
}

export interface MentionMatch {
  /** Offset of the first character, within the text passed to findMentions. */
  start: number;
  /** Offset just past the last character. */
  end: number;
  entity: MentionEntity;
}

/** A name shorter than this is ignored (too noisy to highlight). */
const MIN_NAME_LENGTH = 2;

const WORD = "[\\p{L}\\p{N}]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalises an entity list for matching: trims names, drops very short or
 * duplicate names, and sorts longest-first so longer names win overlaps.
 */
export function buildMentionIndex(entities: MentionEntity[]): MentionEntity[] {
  const seen = new Map<string, MentionEntity>();
  for (const entity of entities) {
    const name = entity.name.trim();
    if (name.length < MIN_NAME_LENGTH) continue;
    const key = `${entity.type}:${name.toLocaleLowerCase("pt-BR")}`;
    if (!seen.has(key)) seen.set(key, { ...entity, name });
  }
  return [...seen.values()].sort((a, b) => b.name.length - a.name.length);
}

/**
 * Finds every whole-word occurrence of the indexed names in `text`.
 * Matching is case-insensitive; overlapping matches resolve to the longest
 * name. Returns matches ordered by position.
 */
export function findMentions(
  text: string,
  entities: MentionEntity[],
): MentionMatch[] {
  if (text.length === 0 || entities.length === 0) return [];

  const claimed = new Array<boolean>(text.length).fill(false);
  const matches: MentionMatch[] = [];

  for (const entity of entities) {
    const pattern = new RegExp(
      `(?<!${WORD})${escapeRegExp(entity.name)}(?!${WORD})`,
      "giu",
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      let overlaps = false;
      for (let i = start; i < end; i += 1) {
        if (claimed[i]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (let i = start; i < end; i += 1) claimed[i] = true;
      matches.push({ start, end, entity });

      // Guard against zero-length matches (not expected, but safe).
      if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
    }
  }

  return matches.sort((a, b) => a.start - b.start);
}
