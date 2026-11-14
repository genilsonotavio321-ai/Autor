import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import { listDeletedRows, nowIso, restoreRow, softDeleteRow } from "@/shared/lib/dexie-trash";
import type { EntityId, LastEdit, Project } from "@/shared/types/database";

import type {
  ProjectCreateInput,
  ProjectRepository,
  ProjectUpdateInput,
} from "../domain/repository";

export class DexieProjectRepository implements ProjectRepository {
  async create(input: ProjectCreateInput): Promise<Project> {
    await ensureDbReady();
    const now = nowIso();
    const project: Project = {
      id: createId(),
      title: input.title,
      subtitle: input.subtitle,
      author: input.author,
      description: input.description,
      status: input.status,
      settings: {},
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().projects.add(project);
    return project;
  }

  async getById(id: EntityId): Promise<Project | undefined> {
    await ensureDbReady();
    return getDatabase().projects.get(id);
  }

  async listActive(): Promise<Project[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .projects.filter((project) => !project.deletedAt)
      .toArray();
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listDeleted(): Promise<Project[]> {
    await ensureDbReady();
    return listDeletedRows(getDatabase().projects);
  }

  async update(id: EntityId, patch: ProjectUpdateInput): Promise<Project> {
    await ensureDbReady();
    await getDatabase().projects.update(id, { ...patch, updatedAt: nowIso() });
    const updated = await getDatabase().projects.get(id);
    if (!updated) throw new Error(`Project not found: ${id}`);
    return updated;
  }

  async updateLastEdit(id: EntityId, lastEdit: LastEdit): Promise<void> {
    await ensureDbReady();
    await getDatabase().projects.update(id, { lastEdit });
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await softDeleteRow(getDatabase().projects, id);
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    await restoreRow(getDatabase().projects, id);
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().projects.delete(id);
  }
}

export const projectRepository: ProjectRepository = new DexieProjectRepository();
