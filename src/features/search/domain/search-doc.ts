import { collapseWhitespace, extractDocText } from "@/shared/lib/text";
import type {
  Character,
  Chapter,
  EntityId,
  Location,
  LoreEntry,
  Note,
  Project,
  Scene,
} from "@/shared/types/database";

export type SearchEntityType =
  | "chapter"
  | "scene"
  | "character"
  | "location"
  | "lore"
  | "note"
  | "project";

export const SEARCH_TYPE_LABELS: Record<SearchEntityType, string> = {
  chapter: "Capítulo",
  scene: "Cena",
  character: "Personagem",
  location: "Local",
  lore: "Lore",
  note: "Nota",
  project: "Projeto",
};

export interface SearchDoc {
  /** Entity id — unique across tables (UUIDs). */
  id: EntityId;
  type: SearchEntityType;
  title: string;
  /** First ~160 chars of plain text, shown in the results list. */
  excerpt: string;
  projectId: EntityId;
  projectTitle: string;
  /** In-app link target for the result. */
  href: string;
  /** Full plain text indexed by the search engine. */
  searchText: string;
}

export interface SearchDocSource {
  projects: Project[];
  chapters: Chapter[];
  scenes: Scene[];
  characters: Character[];
  locations: Location[];
  loreEntries: LoreEntry[];
  notes: Note[];
}

const EXCERPT_LIMIT = 160;

function makeDoc(
  type: SearchEntityType,
  id: EntityId,
  title: string,
  searchText: string,
  projectId: EntityId,
  projectTitle: string,
  href: string,
): SearchDoc {
  const clean = collapseWhitespace(searchText);
  return {
    id,
    type,
    title: collapseWhitespace(title),
    excerpt: clean.length > EXCERPT_LIMIT ? `${clean.slice(0, EXCERPT_LIMIT)}…` : clean,
    projectId,
    projectTitle,
    href,
    searchText: clean,
  };
}

/**
 * Flattens every searchable entity into plain documents.
 * Deleted entities and deleted projects are excluded.
 */
export function buildSearchDocs(source: SearchDocSource): SearchDoc[] {
  const projectTitle = new Map<EntityId, string>();
  for (const project of source.projects) {
    if (!project.deletedAt) projectTitle.set(project.id, project.title);
  }

  const chapterProject = new Map<EntityId, EntityId>();
  for (const chapter of source.chapters) {
    chapterProject.set(chapter.id, chapter.projectId);
  }

  const docs: SearchDoc[] = [];

  for (const project of source.projects) {
    if (project.deletedAt) continue;
    docs.push(
      makeDoc(
        "project",
        project.id,
        project.title,
        [project.subtitle, project.author, project.description]
          .filter(Boolean)
          .join(" "),
        project.id,
        project.title,
        `/projects/${project.id}`,
      ),
    );
  }

  for (const chapter of source.chapters) {
    if (chapter.deletedAt) continue;
    const project = projectTitle.get(chapter.projectId);
    if (!project) continue;
    docs.push(
      makeDoc(
        "chapter",
        chapter.id,
        chapter.title,
        extractDocText(chapter.content),
        chapter.projectId,
        project,
        `/write/${chapter.id}`,
      ),
    );
  }

  for (const scene of source.scenes) {
    if (scene.deletedAt) continue;
    const projectId = chapterProject.get(scene.chapterId);
    const project = projectId ? projectTitle.get(projectId) : undefined;
    if (!projectId || !project) continue;
    docs.push(
      makeDoc(
        "scene",
        scene.id,
        scene.title,
        `${scene.summary ?? ""} ${extractDocText(scene.content)}`,
        projectId,
        project,
        "/outline",
      ),
    );
  }

  for (const character of source.characters) {
    if (character.deletedAt) continue;
    const project = projectTitle.get(character.projectId);
    if (!project) continue;
    docs.push(
      makeDoc(
        "character",
        character.id,
        character.name,
        [
          character.description,
          character.backstory,
          character.goals,
          character.fears,
          character.traits.join(" "),
        ]
          .filter(Boolean)
          .join(" "),
        character.projectId,
        project,
        `/characters?character=${character.id}`,
      ),
    );
  }

  for (const location of source.locations) {
    if (location.deletedAt) continue;
    const project = projectTitle.get(location.projectId);
    if (!project) continue;
    docs.push(
      makeDoc(
        "location",
        location.id,
        location.name,
        `${location.type} ${location.description ?? ""}`,
        location.projectId,
        project,
        `/world?location=${location.id}`,
      ),
    );
  }

  for (const entry of source.loreEntries) {
    if (entry.deletedAt) continue;
    const project = projectTitle.get(entry.projectId);
    if (!project) continue;
    docs.push(
      makeDoc(
        "lore",
        entry.id,
        entry.title,
        `${entry.category} ${typeof entry.content === "string" ? entry.content : ""}`,
        entry.projectId,
        project,
        `/world?lore=${entry.id}`,
      ),
    );
  }

  for (const note of source.notes) {
    if (note.deletedAt) continue;
    const project = projectTitle.get(note.projectId);
    if (!project) continue;
    docs.push(
      makeDoc(
        "note",
        note.id,
        note.title,
        note.content,
        note.projectId,
        project,
        `/notes?note=${note.id}`,
      ),
    );
  }

  return docs.filter((doc) => doc.projectTitle !== "");
}
