import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import type { EntityId, LastEdit, Project } from "@/shared/types/database";

import type {
  ProjectCreateInput,
  ProjectRepository,
  ProjectUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieProjectRepository implements ProjectRepository {
  async create(input: ProjectCreateInput): Promise<Project> {
    await ensureDbReady();
    const now = nowIso();
    const project: Project = {
      id: crypto.randomUUID(),
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
    const all = await getDatabase()
      .projects.filter((project) => Boolean(project.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
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
    await getDatabase().projects.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .projects.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }
}

export const projectRepository: ProjectRepository = new DexieProjectRepository();
