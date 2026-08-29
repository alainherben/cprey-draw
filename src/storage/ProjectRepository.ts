import type { CpreyDrawProject } from '../types/project';
import { ProjectStorage } from './ProjectStorage';

export interface ProjectRepository {
  load(): Promise<CpreyDrawProject>;
  save(project: CpreyDrawProject): Promise<void>;
}

export class LocalProjectRepository implements ProjectRepository {
  async load(): Promise<CpreyDrawProject> {
    return ProjectStorage.load();
  }

  async save(project: CpreyDrawProject): Promise<void> {
    ProjectStorage.save(project);
  }
}

