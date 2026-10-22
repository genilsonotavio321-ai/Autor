import type { Json } from "@/shared/types/database";

function isRecord(value: Json | undefined): value is Record<string, Json> {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

/**
 * Level of a heading node (1–6).
 *
 * Tiptap stores the level in `attrs.level`; `level` at the root is the legacy
 * shape written by older Markdown imports.
 */
export function headingLevel(record: Record<string, Json>): number {
  const attrs = record.attrs;
  const raw = Number(
    (isRecord(attrs) ? attrs.level : undefined) ?? record.level ?? 1,
  );
  if (!Number.isFinite(raw)) return 1;
  return Math.min(Math.max(Math.trunc(raw), 1), 6);
}
