import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultProject } from '../storage/ProjectStorage';
import type { CpreyDrawProject } from '../types/project';
import { CommandManager } from './CommandManager';
import { ProjectSnapshotCommand } from './ProjectSnapshotCommand';

test('clear empties undo and redo history after a document change', () => {
  let currentProject: CpreyDrawProject = createDefaultProject();
  const commandManager = new CommandManager((project) => {
    currentProject = project;
  });
  const projectWithChange = {
    ...currentProject,
    project: {
      ...currentProject.project,
      name: 'Projet modifié',
    },
  };

  commandManager.execute(
    new ProjectSnapshotCommand(
      'Modifier le projet',
      currentProject,
      projectWithChange,
      commandManager.setProject.bind(commandManager),
    ),
  );
  commandManager.undo();

  assert.equal(commandManager.canRedo(), true);

  currentProject = createDefaultProject();
  commandManager.clear();

  assert.equal(commandManager.canUndo(), false);
  assert.equal(commandManager.canRedo(), false);
  assert.equal(currentProject.status, 'draft');
});
