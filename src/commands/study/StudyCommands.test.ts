import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../../domain/apparatus';
import { createOctopus } from '../../domain/octopus';
import {
  addStudyLevel,
  addStudyRoom,
  assignStudyDeviceToOctopusPort,
  createImportedStudy,
  getStudyDevicePortAssignment,
  getStudyOctopusInstallationHeight,
  getStudyOctopusInstallationMode,
  setStudyOctopusServedRooms,
} from '../../domain/importedStudy';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { ApparatusInstance, CpreyDrawProject, ImportedStudy } from '../../types/project';
import {
  createAddStudyLevelCommand,
  createAddStudyRoomCommand,
  createConfigureStudyRepresentationCommand,
  createDissociateStudyGroupCommand,
  createAssignStudyDeviceToOctopusPortCommand,
  createMoveStudyDeviceOctopusPortAssignmentCommand,
  createRemoveStudyRoomCommand,
  createSetManualApparatusLocationCommand,
  createSetStudyOctopusMountingCommand,
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

function requireStudy(project: CpreyDrawProject): ImportedStudy {
  if (!project.study) {
    assert.fail('Study should exist');
  }

  return project.study;
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

test('undo and redo octopus wall mounting as one coherent snapshot', () => {
  const octopus = createOctopus('comfort', { x: 40, y: 50 }, []);
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
  };
  const command = createSetStudyOctopusMountingCommand(project, octopus.id, 'wall', 1.8, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(getStudyOctopusInstallationMode(project.study, octopus.id), 'wall');
  assert.equal(getStudyOctopusInstallationHeight(project.study, octopus.id), 1.8);
  command.undo();
  assert.equal(getStudyOctopusInstallationMode(project.study, octopus.id), 'standard');
  assert.equal(getStudyOctopusInstallationHeight(project.study, octopus.id), undefined);
  command.redo();
  assert.equal(getStudyOctopusInstallationMode(project.study, octopus.id), 'wall');
  assert.equal(getStudyOctopusInstallationHeight(project.study, octopus.id), 1.8);
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

test('undo and redo manual level and room commands', () => {
  let project = createEmptyProject();
  const addLevel = createAddStudyLevelCommand(project, 'RDC', (nextProject) => {
    project = nextProject;
  });

  addLevel.execute();
  assert.equal(project.study?.levels[0].id, 'level_001');
  addLevel.undo();
  assert.equal(project.study, undefined);
  addLevel.redo();

  const addRoom = createAddStudyRoomCommand(project, 'level_001', 'Cuisine', (nextProject) => {
    project = nextProject;
  });
  addRoom.execute();
  assert.equal(requireStudy(project).levels[0].rooms[0].id, 'room_001');

  const removeRoom = createRemoveStudyRoomCommand(project, 'room_001', (nextProject) => {
    project = nextProject;
  });
  removeRoom.execute();
  assert.equal(requireStudy(project).levels[0].rooms.length, 0);
  removeRoom.undo();
  assert.equal(requireStudy(project).levels[0].rooms[0].name, 'Cuisine');
  removeRoom.redo();
  assert.equal(requireStudy(project).levels[0].rooms.length, 0);
});

test('undo and redo manual apparatus location command', () => {
  let project = addStudyRoom(addStudyLevel(createEmptyProject(), 'RDC'), 'level_001', 'Cuisine');
  const apparatus = createApparatusInstance('prise-16a', { x: 10, y: 20 }, []);
  project = { ...project, apparatus: [apparatus] };

  const command = createSetManualApparatusLocationCommand(
    project,
    apparatus.id,
    'level_001',
    'room_001',
    (nextProject) => {
      project = nextProject;
    },
  );

  command.execute();
  assert.equal(project.apparatus[0].levelId, 'level_001');
  assert.equal(project.apparatus[0].roomId, 'room_001');
  command.undo();
  assert.equal(project.apparatus[0].levelId, undefined);
  assert.equal(project.apparatus[0].roomId, undefined);
  command.redo();
  assert.equal(project.apparatus[0].roomId, 'room_001');
});
