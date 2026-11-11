import { collapseWhitespace, extractDocText } from "@/shared/lib/text";
import type {
  Chapter,
  Character,
  EntityId,
  Location,
  LoreEntry,
  NarrativeArc,
  Project,
  Scene,
  StoryItem,
  TimelineEvent,
} from "@/shared/types/database";

import {
  deriveContinuityState,
  findContinuityIssues,
} from "@/features/plot/domain/continuity";

export interface AiContextInput {
  project: Project;
  chapter: Chapter;
  scenes: Scene[];
  characters: Character[];
  locations: Location[];
  loreEntries: LoreEntry[];
  arcs: NarrativeArc[];
  items: StoryItem[];
  events: TimelineEvent[];
  budgetTokens: number;
}

export interface AiContextResult {
  markdown: string;
  estimatedTokens: number;
  budgetTokens: number;
  omittedRecords: number;
  exceedsBudget: boolean;
}

function compact(text: string, limit = 240): string {
  const normalized = collapseWhitespace(text);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? "").localeCompare(b.time ?? "") ||
    a.createdAt.localeCompare(b.createdAt)
  );
}

function sortRelevant<T extends { id: string; name?: string; title?: string }>(
  values: T[],
  relevantIds: Set<string>,
): T[] {
  return [...values].sort(
    (a, b) =>
      Number(relevantIds.has(b.id)) - Number(relevantIds.has(a.id)) ||
      (a.name ?? a.title ?? "").localeCompare(
        b.name ?? b.title ?? "",
        "pt-BR",
      ),
  );
}

function estimate(text: string): number {
  return Math.ceil(text.length / 3);
}

export function estimateContextTokens(markdown: string): number {
  return estimate(markdown);
}

function itemStatusLabel(status: "available" | "lost" | "destroyed"): string {
  if (status === "lost") return "perdido";
  if (status === "destroyed") return "destruído";
  return "disponível";
}

export function buildAiContext(input: AiContextInput): AiContextResult {
  const budgetTokens = Math.floor(input.budgetTokens);
  if (!Number.isFinite(budgetTokens) || budgetTokens < 1) {
    throw new RangeError("O limite de tokens deve ser maior que zero.");
  }

  const scenes = input.scenes
    .filter((scene) => scene.chapterId === input.chapter.id)
    .sort((a, b) => a.order - b.order);
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const chapterEvents = input.events
    .filter(
      (event) =>
        event.linkedChapterId === input.chapter.id ||
        (event.linkedSceneId !== undefined && sceneIds.has(event.linkedSceneId)),
    )
    .sort(compareEvents);
  const lastChapterEvent = chapterEvents.at(-1);
  const continuity = deriveContinuityState(
    input.events,
    input.items,
    lastChapterEvent?.id,
  );
  const issues = findContinuityIssues(input.events).filter(
    (issue) =>
      chapterEvents.some(
        (event) =>
          event.id === issue.eventId || event.id === issue.relatedEventId,
      ),
  );

  const characterIds = new Set<EntityId>(
    chapterEvents.flatMap((event) => [
      ...event.characterIds,
      ...(event.stateChanges ?? [])
        .filter((change) => change.kind === "character")
        .map((change) => change.characterId),
    ]),
  );
  for (const scene of scenes) {
    if (scene.povCharacterId) characterIds.add(scene.povCharacterId);
  }
  for (const characterId of continuity.characters.keys()) {
    if (characterIds.has(characterId)) continue;
    const character = input.characters.find((item) => item.id === characterId);
    if (character && chapterEvents.some((event) => event.characterIds.includes(characterId))) {
      characterIds.add(characterId);
    }
  }

  const relevantLocationIds = new Set<EntityId>(
    chapterEvents
      .map((event) => event.locationId)
      .filter((id): id is EntityId => Boolean(id)),
  );
  for (const scene of scenes) {
    if (scene.locationId) relevantLocationIds.add(scene.locationId);
  }

  const relevantArcIds = new Set(
    chapterEvents.flatMap((event) => event.arcIds ?? []),
  );
  const relevantItemIds = new Set(
    chapterEvents.flatMap((event) =>
      (event.stateChanges ?? [])
        .filter((change) => change.kind === "item")
        .map((change) => change.itemId),
    ),
  );
  for (const characterId of characterIds) {
    const state = continuity.characters.get(characterId);
    for (const itemId of state?.inventoryItemIds ?? []) {
      relevantItemIds.add(itemId);
    }
  }
  for (const characterId of characterIds) {
    const locationId = continuity.characters.get(characterId)?.locationId;
    if (locationId) relevantLocationIds.add(locationId);
  }

  const characterById = new Map(
    input.characters.map((character) => [character.id, character] as const),
  );
  const locationById = new Map(
    input.locations.map((location) => [location.id, location] as const),
  );
  const itemById = new Map(input.items.map((item) => [item.id, item] as const));
  const loreById = new Map(
    input.loreEntries.map((entry) => [entry.id, entry] as const),
  );

  const currentStateLines = [...characterIds]
    .map((id) => characterById.get(id))
    .filter((character): character is Character => Boolean(character))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((character) => {
      const state = continuity.characters.get(character.id);
      const location = state?.locationId
        ? locationById.get(state.locationId)?.name ?? "local não registrado"
        : "não registrado";
      const inventory = (state?.inventoryItemIds ?? [])
        .map((id) => itemById.get(id)?.name)
        .filter((name): name is string => Boolean(name));
      return `- ${character.name} — local: ${location}; Motivação ativa: ${state?.motivation ?? "não registrada"}; Estado físico: ${state?.physicalCondition ?? "não registrado"}; Inventário: ${inventory.join(", ") || "sem itens registrados"}.`;
    });

  const itemStateLines = [...relevantItemIds]
    .map((id) => itemById.get(id))
    .filter((item): item is StoryItem => Boolean(item))
    .map((item) => {
      const state = continuity.items.get(item.id);
      const owner = state?.ownerCharacterId
        ? characterById.get(state.ownerCharacterId)?.name ?? "personagem não registrado"
        : "sem possuidor";
      return `- ${item.name} — ${itemStatusLabel(state?.status ?? "available")}; possuidor: ${owner}.`;
    });

  const sceneLines = scenes.map((scene) => {
    const summary = compact(
      scene.summary || extractDocText(scene.content),
      320,
    );
    const location = scene.locationId
      ? locationById.get(scene.locationId)?.name ?? "local não registrado"
      : "local não registrado";
    return `- Cena ${scene.order}: ${scene.title} [${scene.status}] — local: ${location}; ${summary || "sem resumo"}.`;
  });

  const statePoint = lastChapterEvent
    ? `${lastChapterEvent.date}${lastChapterEvent.time ? ` ${lastChapterEvent.time}` : ""} · ${lastChapterEvent.title}`
    : "ponto mais recente registrado no projeto; nenhum evento ligado diretamente ao capítulo";
  const coreLines = [
    `# Contexto · ${input.project.title}`,
    input.project.description ? compact(input.project.description, 400) : "",
    "",
    `## Capítulo atual · ${input.chapter.title}`,
    `Status: ${input.chapter.status} · Palavras: ${input.chapter.wordCount}`,
    `Estado calculado em: ${statePoint}`,
    ...(sceneLines.length > 0 ? sceneLines : ["- Nenhuma cena cadastrada."]),
    "",
    "## Estado atual das entidades",
    ...(currentStateLines.length > 0
      ? currentStateLines
      : ["- Nenhum personagem ligado ao capítulo."]),
    ...(itemStateLines.length > 0 ? itemStateLines : []),
    "",
    "## Alertas de continuidade",
    ...(issues.length > 0
      ? issues.map((issue) => {
          const event = input.events.find((item) => item.id === issue.eventId);
          const prior = input.events.find(
            (item) => item.id === issue.relatedEventId,
          );
          const severity = issue.severity === "confirmed" ? "confirmado" : "possível";
          return `- [${severity}] ${event?.title ?? "Evento"} ↔ ${prior?.title ?? "evento anterior"}: ${issue.kind}.`;
        })
      : ["- Nenhum alerta encontrado nos fatos registrados para este capítulo."]),
    "",
    "## Bíblia do mundo",
  ].filter((line, index, lines) => line !== "" || lines[index - 1] !== "");

  const coreMarkdown = coreLines.join("\n").trim();
  const coreTokens = estimate(coreMarkdown);
  if (coreTokens > budgetTokens) {
    return {
      markdown: "",
      estimatedTokens: coreTokens,
      budgetTokens,
      omittedRecords: 0,
      exceedsBudget: true,
    };
  }

  const relevantLoreIds = new Set<EntityId>();
  const relevantEntityIds = new Set<EntityId>([
    ...characterIds,
    ...relevantLocationIds,
    ...relevantItemIds,
  ]);
  for (const entry of input.loreEntries) {
    if (entry.linkedIds.some((id) => relevantEntityIds.has(id))) {
      relevantLoreIds.add(entry.id);
    }
  }

  const optionalRecords: string[] = [];
  for (const character of sortRelevant(input.characters, characterIds)) {
    optionalRecords.push(
      `- Personagem · ${character.name} (${character.role})${character.description ? ` — ${compact(character.description)}` : ""}${character.goals ? `; objetivo: ${compact(character.goals, 120)}` : ""}${character.traits.length > 0 ? `; traços: ${character.traits.join(", ")}` : ""}`,
    );
  }
  for (const location of sortRelevant(input.locations, relevantLocationIds)) {
    optionalRecords.push(
      `- Local · ${location.name} (${location.type})${location.description ? ` — ${compact(location.description)}` : ""}`,
    );
  }
  for (const item of sortRelevant(input.items, relevantItemIds)) {
    const entry = loreById.get(item.id);
    const details = entry && typeof entry.content === "string"
      ? compact(entry.content)
      : "";
    optionalRecords.push(
      `- Objeto · ${item.name}${details ? ` — ${details}` : ""}`,
    );
  }
  for (const arc of sortRelevant(input.arcs, relevantArcIds)) {
    optionalRecords.push(
      `- Arco · ${arc.name}${arc.description ? ` — ${compact(arc.description)}` : ""}`,
    );
  }
  const loreRecords = input.loreEntries
    .filter((entry) => !entry.isTrackableItem)
    .sort(
      (a, b) =>
        Number(relevantLoreIds.has(b.id)) - Number(relevantLoreIds.has(a.id)) ||
        a.title.localeCompare(b.title, "pt-BR"),
    );
  for (const entry of loreRecords) {
    const details =
      typeof entry.content === "string"
        ? compact(entry.content)
        : compact(JSON.stringify(entry.content));
    optionalRecords.push(
      `- Lore · ${entry.title} (${entry.category})${details ? ` — ${details}` : ""}`,
    );
  }

  const selectedRecords: string[] = [];
  let omittedRecords = optionalRecords.length;
  for (const record of optionalRecords) {
    const nextOmitted = omittedRecords - 1;
    const footer = nextOmitted > 0
      ? `\n\nRegistros omitidos pelo limite: ${nextOmitted}.`
      : "";
    const candidate = `${coreMarkdown}\n${[...selectedRecords, record].join("\n")}${footer}`;
    if (estimate(candidate) <= budgetTokens) {
      selectedRecords.push(record);
      omittedRecords = nextOmitted;
    }
  }

  let markdown = `${coreMarkdown}${selectedRecords.length > 0 ? `\n${selectedRecords.join("\n")}` : ""}`;
  let footer = omittedRecords > 0
    ? `\n\nRegistros omitidos pelo limite: ${omittedRecords}.`
    : "";
  while (estimate(`${markdown}${footer}`) > budgetTokens && selectedRecords.length > 0) {
    selectedRecords.pop();
    omittedRecords += 1;
    markdown = `${coreMarkdown}${selectedRecords.length > 0 ? `\n${selectedRecords.join("\n")}` : ""}`;
    footer = `\n\nRegistros omitidos pelo limite: ${omittedRecords}.`;
  }
  markdown = `${markdown}${footer}`;

  return {
    markdown,
    estimatedTokens: estimate(markdown),
    budgetTokens,
    omittedRecords,
    exceedsBudget: estimate(markdown) > budgetTokens,
  };
}
