import type { CpreyDrawProject } from '../types/project';
import type { ApplyProject } from './CommandManager';
import type { Command } from './Command';

export class ProjectSnapshotCommand implements Command {
  constructor(
    public readonly label: string,
    private readonly before: CpreyDrawProject,
    private readonly after: CpreyDrawProject,
    private readonly applyProject: ApplyProject,
  ) {}

  execute(): void {
    this.applyProject(this.after);
  }

  undo(): void {
    this.applyProject(this.before);
  }

  redo(): void {
    this.applyProject(this.after);
  }
}
