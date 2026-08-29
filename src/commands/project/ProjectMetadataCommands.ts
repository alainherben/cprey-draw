import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';
import type { CpreyDrawProject, ProjectStatus, SiteInformation } from '../../types/project';
import { normalizeProjectStatus, normalizeSiteInformation } from '../../domain/site';

export interface ProjectMetadataUpdates {
  site?: SiteInformation;
  status?: ProjectStatus;
  updatedBy?: string;
}

export function createUpdateProjectMetadataCommand(
  project: CpreyDrawProject,
  updates: ProjectMetadataUpdates,
  applyProject: ApplyProject,
  now = new Date().toISOString(),
): ProjectSnapshotCommand {
  const nextProject: CpreyDrawProject = {
    ...project,
    site: updates.site ? normalizeSiteInformation(updates.site) : project.site,
    status: updates.status ? normalizeProjectStatus(updates.status) : project.status,
    audit: {
      ...project.audit,
      updatedAt: now,
      updatedBy: updates.updatedBy ?? project.audit.updatedBy,
    },
  };

  return new ProjectSnapshotCommand(
    'Modifier les informations chantier',
    project,
    nextProject,
    applyProject,
  );
}
