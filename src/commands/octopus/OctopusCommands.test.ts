import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAddOctopusCommand,
  createDeleteOctopusCommand,
  createMoveOctopusCommand,
  createResetOctopusOutputOverrideCommand,
  createUpdateOctopusCommand,
  createUpdateOctopusOutputOverrideCommand,
} from './OctopusCommands';
import {
  createOctopus,
  getOctopusPortLocalPosition,
  getOctopusPixelSize,
  OCTOPUS_PORTS,
} from '../../domain/octopus';
import { createImportedStudy } from '../../domain/importedStudy';
import { createOctopusOutputOverride } from '../../domain/octopusOutputs';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { CpreyDrawProject, OctopusModelId } from '../../types/project';

test('adds every octopus model', () => {
  const modelIds: OctopusModelId[] = ['kitchen', 'bath', 'other', 'comfort'];
  let project: CpreyDrawProject = createEmptyProject();

  for (const modelId of modelIds) {
    const octopus = createOctopus(modelId, { x: 10, y: 20 }, project.octopuses);
    createAddOctopusCommand(project, octopus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.deepEqual(project.octopuses.map((octopus) => octopus.modelId), modelIds);
});

test('allows multiple octopuses and generates unique ids and names', () => {
  let project: CpreyDrawProject = createEmptyProject();
  const first = createOctopus('kitchen', { x: 10, y: 20 }, project.octopuses);
  createAddOctopusCommand(project, first, (nextProject) => {
    project = nextProject;
  }).execute();
  const second = createOctopus('kitchen', { x: 30, y: 40 }, project.octopuses);
  createAddOctopusCommand(project, second, (nextProject) => {
    project = nextProject;
  }).execute();

  assert.equal(project.octopuses.length, 2);
  assert.notEqual(project.octopuses[0]?.id, project.octopuses[1]?.id);
  assert.equal(project.octopuses[0]?.name, 'Cuisine 01');
  assert.equal(project.octopuses[1]?.name, 'Cuisine 02');
});

test('adds 3 kitchen octopuses with unique ids and sequential names', () => {
  let project: CpreyDrawProject = createEmptyProject();

  for (let index = 0; index < 3; index += 1) {
    const octopus = createOctopus('kitchen', { x: 10 + index, y: 20 + index }, project.octopuses);
    createAddOctopusCommand(project, octopus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.equal(project.octopuses.length, 3);
  assert.equal(new Set(project.octopuses.map((octopus) => octopus.id)).size, 3);
  assert.deepEqual(
    project.octopuses.map((octopus) => octopus.name),
    ['Cuisine 01', 'Cuisine 02', 'Cuisine 03'],
  );
});

test('keeps independent counters per octopus model', () => {
  let project: CpreyDrawProject = createEmptyProject();
  const models: OctopusModelId[] = ['kitchen', 'kitchen', 'bath', 'bath'];

  for (const modelId of models) {
    const octopus = createOctopus(modelId, { x: 10, y: 20 }, project.octopuses);
    createAddOctopusCommand(project, octopus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.deepEqual(
    project.octopuses.map((octopus) => octopus.name),
    ['Cuisine 01', 'Cuisine 02', 'Bain 01', 'Bain 02'],
  );
});

test('undo and redo preserve the first octopus when adding a second one', () => {
  let project: CpreyDrawProject = createEmptyProject();
  const first = createOctopus('kitchen', { x: 10, y: 20 }, project.octopuses);
  createAddOctopusCommand(project, first, (nextProject) => {
    project = nextProject;
  }).execute();

  const second = createOctopus('kitchen', { x: 30, y: 40 }, project.octopuses);
  const addSecondCommand = createAddOctopusCommand(project, second, (nextProject) => {
    project = nextProject;
  });

  addSecondCommand.execute();
  assert.deepEqual(project.octopuses.map((octopus) => octopus.name), ['Cuisine 01', 'Cuisine 02']);

  addSecondCommand.undo();
  assert.deepEqual(project.octopuses.map((octopus) => octopus.name), ['Cuisine 01']);

  addSecondCommand.redo();
  assert.deepEqual(project.octopuses.map((octopus) => octopus.name), ['Cuisine 01', 'Cuisine 02']);
});

test('uses largest existing model number plus one to avoid duplicate names', () => {
  let project: CpreyDrawProject = createEmptyProject();
  for (let index = 0; index < 3; index += 1) {
    const octopus = createOctopus('kitchen', { x: 10 + index, y: 20 + index }, project.octopuses);
    createAddOctopusCommand(project, octopus, (nextProject) => {
      project = nextProject;
    }).execute();
  }
  const removedMiddleId = project.octopuses[1]?.id;
  project = { ...project, octopuses: project.octopuses.filter((octopus) => octopus.id !== removedMiddleId) };

  const next = createOctopus('kitchen', { x: 50, y: 60 }, project.octopuses);

  assert.equal(next.name, 'Cuisine 04');
});

test('creates the exact 16-port numbering by side', () => {
  assert.deepEqual(
    OCTOPUS_PORTS.filter((port) => port.side === 'top').map((port) => port.number),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    OCTOPUS_PORTS.filter((port) => port.side === 'right').map((port) => port.number),
    [5, 6, 7, 8],
  );
  assert.deepEqual(
    OCTOPUS_PORTS.filter((port) => port.side === 'bottom').map((port) => port.number),
    [12, 11, 10, 9],
  );
  assert.deepEqual(
    OCTOPUS_PORTS.filter((port) => port.side === 'left').map((port) => port.number),
    [16, 15, 14, 13],
  );
});

test('positions ports from physical box dimensions', () => {
  const { width, height } = getOctopusPixelSize(0.01);
  const topFirst = getOctopusPortLocalPosition(OCTOPUS_PORTS[0], width, height);
  const bottomLast = getOctopusPortLocalPosition(OCTOPUS_PORTS[11], width, height);

  assert.equal(width, 20);
  assert.equal(height, 20);
  assert.equal(topFirst.y, -10);
  assert.equal(bottomLast.x, 7.5);
  assert.equal(bottomLast.y, 10);
});

test('moves octopus with undo and redo', () => {
  const octopus = createOctopus('bath', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), octopuses: [octopus] };
  const command = createMoveOctopusCommand(
    project,
    octopus.id,
    { x: 10, y: 20 },
    { x: 30, y: 40 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.octopuses[0]?.x, 30);
  command.undo();
  assert.equal(project.octopuses[0]?.x, 10);
  command.redo();
  assert.equal(project.octopuses[0]?.x, 30);
});

test('updates rotation and deletes octopus with undo restore', () => {
  const octopus = createOctopus('comfort', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), octopuses: [octopus] };

  createUpdateOctopusCommand(
    project,
    octopus.id,
    { rotation: 90, name: 'Confort nuit' },
    (nextProject) => {
      project = nextProject;
    },
  ).execute();
  assert.equal(project.octopuses[0]?.rotation, 90);
  assert.equal(project.octopuses[0]?.name, 'Confort nuit');

  const deleteCommand = createDeleteOctopusCommand(project, octopus.id, (nextProject) => {
    project = nextProject;
  });
  deleteCommand.execute();
  assert.equal(project.octopuses.length, 0);
  deleteCommand.undo();
  assert.equal(project.octopuses[0]?.modelId, 'comfort');
  assert.equal(project.octopuses[0]?.rotation, 90);
});

test('deleting imported octopus marks its study device unplaced', () => {
  const octopus = {
    ...createOctopus('kitchen', { x: 10, y: 20 }, []),
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-26T10:00:00.000Z',
    },
  };
  const study = createImportedStudy([], [octopus]);
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    study,
  };
  const command = createDeleteOctopusCommand(project, octopus.id, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.study?.devices[0].status, 'unplaced');
  assert.equal(project.study?.devices[0].drawingObjectId, undefined);

  command.undo();
  assert.equal(project.study?.devices[0].status, 'placed');
  assert.equal(project.study?.devices[0].drawingObjectId, octopus.id);
});

test('updates display scale with undo and redo', () => {
  const octopus = createOctopus('kitchen', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), octopuses: [octopus] };
  const command = createUpdateOctopusCommand(
    project,
    octopus.id,
    { displayScale: 1.5 },
    (nextProject) => {
      project = nextProject;
    },
    "Modifier la taille d'affichage",
  );

  command.execute();
  assert.equal(project.octopuses[0]?.displayScale, 1.5);
  command.undo();
  assert.equal(project.octopuses[0]?.displayScale, 1);
  command.redo();
  assert.equal(project.octopuses[0]?.displayScale, 1.5);
});

test('updates and resets octopus output overrides with undo and redo', () => {
  const octopus = createOctopus('kitchen', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), octopuses: [octopus] };
  const override = {
    ...createOctopusOutputOverride(octopus, 13, 'LA'),
    code: 'LA4',
  };
  const updateCommand = createUpdateOctopusOutputOverrideCommand(
    project,
    octopus.id,
    override,
    (nextProject) => {
      project = nextProject;
    },
  );

  updateCommand.execute();
  assert.equal(project.octopuses[0]?.outputOverrides.length, 1);
  assert.equal(project.octopuses[0]?.outputOverrides[0]?.code, 'LA4');
  updateCommand.undo();
  assert.equal(project.octopuses[0]?.outputOverrides.length, 0);
  updateCommand.redo();
  assert.equal(project.octopuses[0]?.outputOverrides[0]?.code, 'LA4');

  const resetCommand = createResetOctopusOutputOverrideCommand(
    project,
    octopus.id,
    13,
    (nextProject) => {
      project = nextProject;
    },
  );

  resetCommand.execute();
  assert.equal(project.octopuses[0]?.outputOverrides.length, 0);
  resetCommand.undo();
  assert.equal(project.octopuses[0]?.outputOverrides[0]?.code, 'LA4');
});
