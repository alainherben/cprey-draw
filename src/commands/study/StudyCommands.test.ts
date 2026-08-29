import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../../domain/apparatus';
import { createOctopus } from '../../domain/octopus';
import {
  assignStudyDeviceToOctopusPort,
  createImportedStudy,
  getStudyDevicePortAssignment,
  setStudyOctopusServedRooms,
} from '../../domain/importedStudy';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { ApparatusInstance, CpreyDrawProject } from '../../types/project';
import {
  createConfigureStudyRepresentationCommand,
  createDissociateStudyGroupCommand,
  createAssignStudyDeviceToOctopusPortCommand,
  createMoveStudyDeviceOctopusPortAssignmentCommand,
  createSetStudyOctopusServedRoomsCommand,
} from './StudyCommands';

function importedApparatus(
  catalogId: ApparatusInstance['catalogId'],
  identifier: string,
  metricKey: string,
  existing: ApparatusInstance[] = [],
): ApparatusInstance {
  return {
    ...createApparatusInstance(catalogId, { x: 10 + existing.length, y: 20 }, existing),
    identifier,
    importContext: {
      source: 'CDEF',
      importedAt: '2026-08-27T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Salon',
      roomProfile: 'SALON',
      metricKey,
    },
  };
}

test('undo and redo a single apparatus substitution without changing imported reference', () => {
  const imported = importedApparatus('prise-16a', 'SP1', 'prises_spec');
  const study = createImportedStudy([imported], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: [{ ...study.devices[0], status: 'unplaced', drawingObjectId: undefined }],
    },
  };
  const command = createConfigureStudyRepresentationCommand(
    project,
    [project.study?.devices[0].id ?? ''],
    'four',
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.study?.devices[0].identifier, 'SP1');
  assert.equal(project.study?.devices[0].sourceType, 'SP');
  assert.equal(project.study?.devices[0].drawingCatalogId, 'four');

  command.undo();
  assert.equal(project.study?.devices[0].identifier, 'SP1');
  assert.equal(project.study?.devices[0].drawingCatalogId, undefined);

  command.redo();
  assert.equal(project.study?.devices[0].drawingCatalogId, 'four');
});

test('undo and redo a grouped physical representation', () => {
  const first = importedApparatus('prise-16a', 'PR1', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', 'prises', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced', drawingObjectId: undefined })),
    },
  };
  const command = createConfigureStudyRepresentationCommand(
    project,
    ['device_001', 'device_002'],
    'prise_double',
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.study?.physicalGroups?.length, 1);
  assert.equal(project.study?.devices.every((device) => device.physicalGroupId === 'physical_group_001'), true);

  command.undo();
  assert.equal(project.study?.physicalGroups, undefined);
  assert.equal(project.study?.devices.every((device) => device.physicalGroupId === undefined), true);

  command.redo();
  const redoneProject: CpreyDrawProject = project;
  assert.deepEqual(redoneProject.study?.physicalGroups?.map((group) => group.drawingCatalogId), ['prise_double']);
});

test('undo and redo grouping without changing octopus port assignments', () => {
  const first = importedApparatus('prise-16a', 'PR1', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', 'prises', [first]);
  const octopus = createOctopus('comfort', { x: 40, y: 50 }, []);
  const study = createImportedStudy([first, second], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    study: {
      ...study,
      devices: study.devices.map((device) =>
        device.type === 'apparatus'
          ? { ...device, status: 'unplaced' as const, drawingObjectId: undefined }
          : device,
      ),
    },
  };
  const roomId = project.study?.levels[0].rooms[0].id ?? '';
  project = setStudyOctopusServedRooms(project, octopus.id, [roomId]);
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 5, 'device_001');
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 6, 'device_002');
  const command = createConfigureStudyRepresentationCommand(
    project,
    ['device_001', 'device_002'],
    'prise_double',
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.study?.physicalGroups?.length, 1);
  assert.equal(getStudyDevicePortAssignment(project.study, 'device_001')?.portNumber, 5);
  assert.equal(getStudyDevicePortAssignment(project.study, 'device_002')?.portNumber, 6);

  command.undo();
  assert.equal(project.study?.physicalGroups, undefined);
  assert.equal(getStudyDevicePortAssignment(project.study, 'device_001')?.portNumber, 5);
  assert.equal(getStudyDevicePortAssignment(project.study, 'device_002')?.portNumber, 6);

  command.redo();
  const redoneProject: CpreyDrawProject = project;
  assert.equal(redoneProject.study?.physicalGroups?.length, 1);
  assert.equal(getStudyDevicePortAssignment(redoneProject.study, 'device_001')?.portNumber, 5);
  assert.equal(getStudyDevicePortAssignment(redoneProject.study, 'device_002')?.portNumber, 6);
});

test('undo and redo group dissociation', () => {
  const first = importedApparatus('prise-16a', 'PR1', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', 'prises', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
    },
  };
  createConfigureStudyRepresentationCommand(
    project,
    ['device_001', 'device_002'],
    'prise_double',
    (nextProject) => {
      project = nextProject;
    },
  ).execute();
  const command = createDissociateStudyGroupCommand(project, 'physical_group_001', (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.study?.physicalGroups, undefined);
  command.undo();
  const restoredProject: CpreyDrawProject = project;
  assert.deepEqual(restoredProject.study?.physicalGroups?.map((group) => group.drawingCatalogId), ['prise_double']);
});

test('undo and redo served room changes', () => {
  const imported = importedApparatus('lampe', 'LA1', 'lampes');
  const octopus = createOctopus('comfort', { x: 40, y: 50 }, []);
  const study = createImportedStudy([imported], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  const roomId = study.levels[0].rooms[0].id;
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    study,
  };
  const command = createSetStudyOctopusServedRoomsCommand(project, octopus.id, [roomId], (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.deepEqual(project.study?.octopuses?.[0].servedRoomIds, [roomId]);
  command.undo();
  assert.equal(project.study?.octopuses?.[0].servedRoomIds, undefined);
  command.redo();
  assert.deepEqual(project.study?.octopuses?.[0].servedRoomIds, [roomId]);
});

test('undo and redo a study device port assignment', () => {
  const imported = importedApparatus('lampe', 'LA1', 'lampes');
  const octopus = createOctopus('comfort', { x: 40, y: 50 }, []);
  const study = createImportedStudy([imported], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  const deviceId = study.devices[0].id;
  const roomId = study.levels[0].rooms[0].id;
  let project: CpreyDrawProject = setStudyOctopusServedRooms({
    ...createEmptyProject(),
    octopuses: [octopus],
    study,
  }, octopus.id, [roomId]);
  const command = createAssignStudyDeviceToOctopusPortCommand(project, octopus.id, 3, deviceId, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(getStudyDevicePortAssignment(project.study, deviceId)?.portNumber, 3);
  command.undo();
  assert.equal(getStudyDevicePortAssignment(project.study, deviceId), undefined);
  command.redo();
  assert.equal(getStudyDevicePortAssignment(project.study, deviceId)?.portNumber, 3);
});

test('undo and redo moving a study device port assignment', () => {
  const imported = importedApparatus('lampe', 'LA1', 'lampes');
  const octopus = createOctopus('comfort', { x: 40, y: 50 }, []);
  const study = createImportedStudy([imported], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  const deviceId = study.devices[0].id;
  const roomId = study.levels[0].rooms[0].id;
  let project: CpreyDrawProject = setStudyOctopusServedRooms({
    ...createEmptyProject(),
    octopuses: [octopus],
    study,
  }, octopus.id, [roomId]);
  createAssignStudyDeviceToOctopusPortCommand(project, octopus.id, 3, deviceId, (nextProject) => {
    project = nextProject;
  }).execute();
  const command = createMoveStudyDeviceOctopusPortAssignmentCommand(project, deviceId, octopus.id, 7, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(getStudyDevicePortAssignment(project.study, deviceId)?.portNumber, 7);
  command.undo();
  assert.equal(getStudyDevicePortAssignment(project.study, deviceId)?.portNumber, 3);
  command.redo();
  assert.equal(getStudyDevicePortAssignment(project.study, deviceId)?.portNumber, 7);
});
