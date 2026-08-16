import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAddElectricalPanelCommand,
  createDeleteElectricalPanelCommand,
  createMoveElectricalPanelCommand,
  createUpdateElectricalPanelCommand,
} from './ElectricalPanelCommands';
import { createElectricalPanel } from '../../domain/electricalPanel';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { CpreyDrawProject, ElectricalPanel } from '../../types/project';

test('adds one electrical panel and refuses a second one', () => {
  let project: CpreyDrawProject = createEmptyProject();
  const first = createElectricalPanel({ x: 10, y: 20 });
  const apply = (nextProject: CpreyDrawProject) => {
    project = nextProject;
  };

  createAddElectricalPanelCommand(project, first, apply).execute();
  assert.equal(project.electricalPanel?.name, 'Tableau principal');

  const second = createElectricalPanel({ x: 50, y: 60 });
  createAddElectricalPanelCommand(project, second, apply).execute();
  assert.equal(project.electricalPanel?.id, first.id);
  assert.equal(project.electricalPanel?.x, 10);
});

test('moves electrical panel with undo and redo', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    electricalPanel: createElectricalPanel({ x: 10, y: 20 }),
  };
  const command = createMoveElectricalPanelCommand(
    project,
    { x: 10, y: 20 },
    { x: 30, y: 40 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.electricalPanel?.x, 30);
  assert.equal(project.electricalPanel?.y, 40);

  command.undo();
  assert.equal(project.electricalPanel?.x, 10);
  assert.equal(project.electricalPanel?.y, 20);

  command.redo();
  assert.equal(project.electricalPanel?.x, 30);
  assert.equal(project.electricalPanel?.y, 40);
});

test('updates electrical panel properties', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    electricalPanel: createElectricalPanel({ x: 10, y: 20 }),
  };

  createUpdateElectricalPanelCommand(
    project,
    { name: 'Tableau garage', rotation: 90, rows: 4, reserveModules: 8, locked: true },
    (nextProject) => {
      project = nextProject;
    },
  ).execute();

  assert.equal(project.electricalPanel?.name, 'Tableau garage');
  assert.equal(project.electricalPanel?.rotation, 90);
  assert.equal(project.electricalPanel?.rows, 4);
  assert.equal(project.electricalPanel?.reserveModules, 8);
  assert.equal(project.electricalPanel?.locked, true);
});

test('deletes electrical panel and undo restores all properties', () => {
  const panel = {
    ...createElectricalPanel({ x: 10, y: 20 }),
    name: 'Tableau restauré',
    rotation: 45,
    comments: 'Près entrée',
  };
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    electricalPanel: panel,
  };
  const command = createDeleteElectricalPanelCommand(project, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.electricalPanel, undefined);

  command.undo();
  const restoredPanel = (project as CpreyDrawProject).electricalPanel as ElectricalPanel | undefined;
  if (!restoredPanel) {
    assert.fail('Electrical panel should be restored.');
  }
  assert.equal(restoredPanel.name, 'Tableau restauré');
  assert.equal(restoredPanel.rotation, 45);
  assert.equal(restoredPanel.comments, 'Près entrée');
});
