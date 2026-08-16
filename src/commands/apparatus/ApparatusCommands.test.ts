import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAddApparatusCommand,
  createDeleteApparatusCommand,
  createMoveApparatusCommand,
  createUpdateApparatusCommand,
} from './ApparatusCommands';
import { createApparatusInstance, getApparatusPixelSize } from '../../domain/apparatus';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { CpreyDrawProject } from '../../types/project';

test('adds apparatus with catalog defaults and independent names', () => {
  let project: CpreyDrawProject = createEmptyProject();

  for (const catalogId of ['lampe', 'lampe', 'prise-16a'] as const) {
    const apparatus = createApparatusInstance(catalogId, { x: 10, y: 20 }, project.apparatus);
    createAddApparatusCommand(project, apparatus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.equal(project.apparatus.length, 3);
  assert.equal(new Set(project.apparatus.map((apparatus) => apparatus.id)).size, 3);
  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.name),
    ['Lampe 01', 'Lampe 02', 'Prise 01'],
  );
  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.identifier),
    ['LA1', 'LA2', 'PR1'],
  );
  assert.equal(project.apparatus[0]?.connected, false);
  assert.equal(project.apparatus[0]?.displayScale, 4);
  assert.equal(project.apparatus[0]?.labelPosition, 'right');
  assert.equal(project.apparatus[0]?.labelFontSize, 12);
});

test('socket variants share the PR identifier counter', () => {
  let project: CpreyDrawProject = createEmptyProject();

  for (const catalogId of ['prise-16a', 'prise_haute', 'prise_double', 'prise_double_haute'] as const) {
    const apparatus = createApparatusInstance(catalogId, { x: 10, y: 20 }, project.apparatus);
    createAddApparatusCommand(project, apparatus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.identifier),
    ['PR1', 'PR2', 'PR3', 'PR4'],
  );
  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.name),
    ['Prise 01', 'Prise haute 01', 'Prise double 01', 'Prise double haute 01'],
  );
});

test('generates apparatus identifiers with independent counters per catalog type', () => {
  let project: CpreyDrawProject = createEmptyProject();

  for (const catalogId of ['lampe', 'prise-16a', 'interrupteur-simple', 'interrupteur-double', 'vmc'] as const) {
    const apparatus = createApparatusInstance(catalogId, { x: 10, y: 20 }, project.apparatus);
    createAddApparatusCommand(project, apparatus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.identifier),
    ['LA1', 'PR1', 'IN1', 'IN2', 'VM1'],
  );
});

test('Spot and Applique share the LA identifier counter', () => {
  let project: CpreyDrawProject = createEmptyProject();

  for (const catalogId of ['lampe', 'lampe', 'spot', 'applique'] as const) {
    const apparatus = createApparatusInstance(catalogId, { x: 10, y: 20 }, project.apparatus);
    createAddApparatusCommand(project, apparatus, (nextProject) => {
      project = nextProject;
    }).execute();
  }

  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.identifier),
    ['LA1', 'LA2', 'LA3', 'LA4'],
  );
  assert.deepEqual(
    project.apparatus.map((apparatus) => apparatus.name),
    ['Lampe 01', 'Lampe 02', 'Spot 01', 'Applique 01'],
  );
  assert.equal(project.apparatus[2]?.displayScale, 2);
  assert.equal(project.apparatus[3]?.displayScale, 2);
});

test('moves apparatus with undo and redo', () => {
  const apparatus = createApparatusInstance('radiateur', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), apparatus: [apparatus] };
  const command = createMoveApparatusCommand(
    project,
    apparatus.id,
    { x: 10, y: 20 },
    { x: 30, y: 40 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.apparatus[0]?.x, 30);
  command.undo();
  assert.equal(project.apparatus[0]?.x, 10);
  command.redo();
  assert.equal(project.apparatus[0]?.x, 30);
});

test('updates connected and display scale with undo and redo', () => {
  const apparatus = createApparatusInstance('lampe', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), apparatus: [apparatus] };
  const command = createUpdateApparatusCommand(
    project,
    apparatus.id,
    { connected: true, displayScale: 1.5 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.apparatus[0]?.connected, true);
  assert.equal(project.apparatus[0]?.displayScale, 1.5);
  command.undo();
  assert.equal(project.apparatus[0]?.connected, false);
  assert.equal(project.apparatus[0]?.displayScale, 4);
  command.redo();
  assert.equal(project.apparatus[0]?.connected, true);
  assert.equal(project.apparatus[0]?.displayScale, 1.5);
});

test('updates label position and font size with undo and redo', () => {
  const apparatus = createApparatusInstance('lampe', { x: 10, y: 20 }, []);
  let project: CpreyDrawProject = { ...createEmptyProject(), apparatus: [apparatus] };
  const command = createUpdateApparatusCommand(
    project,
    apparatus.id,
    { labelPosition: 'left', labelFontSize: 18 },
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.apparatus[0]?.labelPosition, 'left');
  assert.equal(project.apparatus[0]?.labelFontSize, 18);
  command.undo();
  assert.equal(project.apparatus[0]?.labelPosition, 'right');
  assert.equal(project.apparatus[0]?.labelFontSize, 12);
  command.redo();
  assert.equal(project.apparatus[0]?.labelPosition, 'left');
  assert.equal(project.apparatus[0]?.labelFontSize, 18);
});

test('sizes apparatus proportionally without applying viewport zoom or screen minimum', () => {
  const size = getApparatusPixelSize(0.01, 1, 1);
  const doubledSize = getApparatusPixelSize(0.01, 2, 1);
  const globalScaledSize = getApparatusPixelSize(0.01, 2, 1.5);

  assert.equal(size.width, 10);
  assert.equal(size.height, 10);
  assert.equal(doubledSize.width, size.width * 2);
  assert.equal(doubledSize.height, size.height * 2);
  assert.ok(Math.abs(globalScaledSize.width - doubledSize.width * 1.5) < 0.000001);
});

test('deletes apparatus and undo restores the complete instance', () => {
  const apparatus = {
    ...createApparatusInstance('vmc', { x: 10, y: 20 }, []),
    connected: true,
    rotation: 90,
    comments: 'Combles',
  };
  let project: CpreyDrawProject = { ...createEmptyProject(), apparatus: [apparatus] };
  const command = createDeleteApparatusCommand(project, apparatus.id, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.apparatus.length, 0);
  command.undo();
  assert.equal(project.apparatus[0]?.catalogId, 'vmc');
  assert.equal(project.apparatus[0]?.connected, true);
  assert.equal(project.apparatus[0]?.rotation, 90);
  assert.equal(project.apparatus[0]?.comments, 'Combles');
});
