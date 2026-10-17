"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUiStore } from "@/shared/store/ui-store";

import { useSelectedProject } from "../application/use-selected-project";

/**
 * Project switcher used by planning pages (outline, timeline, notes).
 * Renders nothing when there are no projects (pages show their own CTA).
 */
export function ProjectPicker() {
  const { projects, projectId } = useSelectedProject();
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );

  if (projects.length === 0) return null;

  return (
    <Select
      value={projectId ?? undefined}
      onValueChange={(value) => setSelectedProjectId(value)}
    >
      <SelectTrigger className="w-64" aria-label="Projeto selecionado">
        <SelectValue placeholder="Selecionar projeto" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
