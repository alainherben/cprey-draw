import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { CpreyDrawProject, Plan } from '../../types/project';
import {
  createDeletePlanCommand,
  createImportPlanCommand,
  createSetScaleCommand,
  createUpdatePlanCommand,
} from './PlanCommands';

function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    name: 'plan.png',
    source: 'data:image/png;base64,test',
    visible: true,
    locked: false,
    opacity: 1,
    rotation: 0,
    mimeType: 'image/png',
    width: 100,
    height: 200,
    importedAt: '2026-08-11T00:00:00.000Z',
    ...overrides,
  };
}

test('plan import command replaces project plan and can undo/redo', () => {
  let project: CpreyDrawProject = createEmptyProject();
  const before = project;
  const command = createImportPlanCommand(
    before,
    createPlan(),
    { x: 10, y: 20, scale: 0.5 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.plans.length, 1);
  assert.equal(project.drawing.viewport.scale, 0.5);

  command.undo();
  assert.equal(project.plans.length, 0);

  command.redo();
  assert.equal(project.plans[0]?.name, 'plan.png');
});

test('plan update command changes visual state only for matching plan', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    plans: [createPlan()],
  };

  const command = createUpdatePlanCommand(
    project,
    'plan-1',
    { visible: false, locked: true, opacity: 0.4, rotation: 90 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.plans[0]?.visible, false);
  assert.equal(project.plans[0]?.locked, true);
  assert.equal(project.plans[0]?.opacity, 0.4);
  assert.equal(project.plans[0]?.rotation, 90);

  command.undo();
  assert.equal(project.plans[0]?.visible, true);
  assert.equal(project.plans[0]?.locked, false);
  assert.equal(project.plans[0]?.opacity, 1);
  assert.equal(project.plans[0]?.rotation, 0);
});

test('delete plan command removes plan and clears scale-dependent drawing data', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    drawing: {
      ...createEmptyProject().drawing,
      metersPerPixel: 0.01,
      scaleReference: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        realMeters: 1,
      },
    },
    plans: [createPlan()],
  };

  const command = createDeletePlanCommand(project, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.plans.length, 0);
  assert.equal(project.drawing.metersPerPixel, null);
});

test('set scale command stores scale reference and can undo', () => {
  let project: CpreyDrawProject = createEmptyProject();
  const command = createSetScaleCommand(
    project,
    0.02,
    { start: { x: 0, y: 0 }, end: { x: 250, y: 0 }, realMeters: 5 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.drawing.metersPerPixel, 0.02);
  assert.equal(project.drawing.scaleReference?.realMeters, 5);
  assert.equal(project.drawing.scaleMarkerVisible, true);

  command.undo();
  assert.equal(project.drawing.metersPerPixel, null);
  assert.equal(project.drawing.scaleReference, null);
});
