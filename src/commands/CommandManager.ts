import type { CpreyDrawProject } from '../types/project';
import type { Command } from './Command';
import { HistoryManager } from './HistoryManager';

export type ApplyProject = (project: CpreyDrawProject) => void;

export class CommandManager {
  private readonly history = new HistoryManager();

  constructor(
    private readonly applyProject: ApplyProject,
    private readonly onHistoryChange: () => void = () => undefined,
  ) {}

  execute(command: Command): void {
    this.history.execute(command);
    this.onHistoryChange();
  }

  undo(): void {
    this.history.undo();
    this.onHistoryChange();
  }

  redo(): void {
    this.history.redo();
    this.onHistoryChange();
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  clear(): void {
    this.history.clear();
    this.onHistoryChange();
  }

  setProject(project: CpreyDrawProject): void {
    this.applyProject(project);
  }
}
