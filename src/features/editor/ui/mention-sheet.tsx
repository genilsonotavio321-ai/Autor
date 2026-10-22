"use client";

import { CornerUpLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { buildCharacterSections } from "@/features/characters/ui/character-sections";
import { ImageAttachments } from "@/features/attachments/ui/image-attachments";
import type { MentionType } from "@/features/mentions/domain/entity-index";
import { tagRepository } from "@/features/tags/infra/dexie-tag-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import type { Character, Location, Tag } from "@/shared/types/database";
import {
  EntityViewDialog,
  type EntityViewSection,
} from "@/shared/ui/entity-view-dialog";

export interface MentionSheetTarget {
  type: MentionType;
  id: string;
}

interface MentionSheetProps {
  /** Highlighted name whose ficha is open, or null when closed. */
  target: MentionSheetTarget | null;
  /** Seconds before the "Voltar ao texto" popup disappears (0 = never). */
  backToTextSeconds: number;
  /** Whether the floating "Voltar ao texto" popup shows at all. */
  backToTextEnabled: boolean;
  /** Close the sheet and return the caret/scroll to the writing point. */
  onBackToText: () => void;
  /** Leave the editor and open the entity's editing page. */
  onEdit: (target: MentionSheetTarget) => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Opens a entity ficha (character or location) *over* the editor, without
 * navigating away, so the writer can read it and jump straight back to the
 * exact writing point (see `mentionBackToText*` settings in the ui store).
 */
export function MentionSheet({
  target,
  backToTextSeconds,
  backToTextEnabled,
  onBackToText,
  onEdit,
  onOpenChange,
}: MentionSheetProps) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showBack, setShowBack] = useState(false);
  const open = target !== null;

  useEffect(() => {
    let cancelled = false;
    setCharacter(null);
    setLocation(null);
    setCharacters([]);
    setTags([]);
    if (!target) return;
    const load = async () => {
      if (target.type === "character") {
        const found = await characterRepository.getById(target.id);
        if (cancelled) return;
        setCharacter(found ?? null);
        if (!found) return;
        // Relações e tags da ficha precisam dos dados do projeto.
        const [casts, projectTags] = await Promise.all([
          characterRepository.listByProject(found.projectId),
          tagRepository.listByProject(found.projectId),
        ]);
        if (cancelled) return;
        setCharacters(casts);
        setTags(projectTags);
      } else {
        const found = await locationRepository.getById(target.id);
        if (!cancelled) setLocation(found ?? null);
      }
    };
    void load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [target]);

  // The popup shows when the sheet opens and vanishes on its own after the
  // configured timeout (0 = stays until the sheet is closed).
  useEffect(() => {
    if (!target || !backToTextEnabled) {
      setShowBack(false);
      return;
    }
    setShowBack(true);
    if (backToTextSeconds <= 0) return;
    const timer = window.setTimeout(() => setShowBack(false), backToTextSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [target, backToTextEnabled, backToTextSeconds]);

  const isCharacter = target?.type === "character";
  const sections: EntityViewSection[] = isCharacter
    ? character
      ? buildCharacterSections(character, { characters, tags })
      : []
    : location
      ? [
          { label: "Tipo", value: location.type },
          { label: "Descrição", value: location.description ?? "" },
        ].filter((section) => section.value.length > 0)
      : [];

  return (
    <EntityViewDialog
      open={open}
      title={(isCharacter ? character?.name : location?.name) ?? ""}
      sections={sections}
      onEdit={() => {
        if (target) onEdit(target);
      }}
      onOpenChange={onOpenChange}
      gallery={
        target ? (
          <ImageAttachments
            readOnly
            entityType={target.type === "character" ? "character" : "location"}
            entityId={target.id}
          />
        ) : null
      }
      floatingAction={
        showBack ? (
          <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2">
            <button
              type="button"
              onClick={onBackToText}
              className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm font-medium shadow-md transition-colors hover:bg-accent"
            >
              <CornerUpLeft aria-hidden className="size-4" />
              Voltar ao texto
            </button>
          </div>
        ) : null
      }
    />
  );
}
