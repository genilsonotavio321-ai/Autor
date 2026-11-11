import type { EntityId, Project } from "@/shared/types/database";

import type { ProjectCreateInput } from "../domain/repository";
import type { ProjectFormValues } from "../domain/schemas";
import { projectRepository } from "../infra/dexie-project-repository";

/** Empty form strings become undefined so the DB stays clean. */
function toCreateInput(values: ProjectFormValues): ProjectCreateInput {
  return {
    title: values.title,
    subtitle: values.subtitle || undefined,
    author: values.author || undefined,
    description: values.description || undefined,
    status: values.status,
  };
}

export function createProject(values: ProjectFormValues): Promise<Project> {
  return projectRepository.create(toCreateInput(values));
}

export function updateProject(
  id: EntityId,
  values: ProjectFormValues,
): Promise<Project> {
  return projectRepository.update(id, toCreateInput(values));
}

export async function softDeleteProject(id: EntityId): Promise<void> {
  await projectRepository.softDelete(id);
}

export async function restoreProject(id: EntityId): Promise<void> {
  await projectRepository.restore(id);
}
