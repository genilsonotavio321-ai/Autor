"use client";

import { useLiveQuery } from "dexie-react-hooks";

import { useUiStore } from "@/shared/store/ui-store";
import type { EntityId, Project } from "@/shared/types/database";

import { projectRepository } from "../infra/dexie-project-repository";

export interface SelectedProject {
  projects: Project[];
  /** Effective project id (persisted choice, else first active project). */
  projectId: EntityId | null;
}

/**
 * Resolves the project shown by planning pages.
 * Falls back to the first active project when there is no valid selection
 * (deleted project, first run, etc).
 */
export function useSelectedProject(): SelectedProject {
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const projects = useLiveQuery(() => projectRepository.listActive(), []) ?? [];

  const valid =
    selectedProjectId !== null &&
    projects.some((project) => project.id === selectedProjectId);

  return {
    projects,
    projectId: valid ? selectedProjectId : (projects[0]?.id ?? null),
  };
}
