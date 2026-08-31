import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from './apparatus';
import { createOctopus } from './octopus';
import { createEmptyProject } from '../storage/ProjectStorage';
import type { ApparatusInstance, CpreyDrawProject } from '../types/project';
import {
  addStudyLevel,
  addStudyRoom,
  canRemoveStudyLevel,
  canRemoveStudyRoom,
  configureStudyPhysicalRepresentation,
  createImportedStudy,
  dissociateStudyPhysicalGroup,
  assignStudyDeviceToOctopusPort,
  getCompatibleCatalogItems,
  getCatalogGroupCapacity,
  getFreeOctopusPorts,
  getCompatibleStudyDeviceCandidates,
  getOctopusPortAssignments,
  getRoomsForLevel,
  getStudyDevicePortAssignment,
  getStudyDeviceSelectionObjectId,
  getStudyDevicesForLevel,
  getStudyDevicesForRoom,
  getStudyOctopusInstallationHeight,
  getStudyOctopusInstallationMode,
  getStudyOctopus,
  getStudyPlacementTargetsForRoom,
  getStudyProgress,
  getStudyProgressForRoom,
  markStudyDevicePlaced,
  markStudyDevicesPlaced,
  mergeImportedStudyReference,
  moveStudyDeviceOctopusPortAssignment,
  normalizeLocationName,
  parseMetricInput,
  parseStudyLocation,
  removeStudyRoom,
  renameStudyLevel,
  renameStudyRoom,
  setManualApparatusLocation,
  setStudyOctopusInstallation,
  setStudyOctopusMounting,
  setStudyOctopusServedRooms,
  shouldDisplayApparatusForActiveLevel,
  syncStudyWithDrawing,
  unassignOctopusPort,
} from './importedStudy';

function importedApparatus(
  catalogId: ApparatusInstance['catalogId'],
  identifier: string,
  levelName: string | undefined,
  roomName: string | undefined,
  roomProfile: string | undefined,
  metricKey: string,
  existing: ApparatusInstance[] = [],
): ApparatusInstance {
  const apparatus = createApparatusInstance(catalogId, { x: 10 + existing.length, y: 20 }, existing);

  return {
    ...apparatus,
    identifier,
    importContext: {
      source: 'CDEF',
      importedAt: '2026-08-26T10:00:00.000Z',
      levelName,
      roomName,
      roomProfile,
      metricKey,
    },
    comments: [
      levelName ? `Niveau : ${levelName}` : undefined,
      roomName ? `Pièce : ${roomName}` : undefined,
      roomProfile ? `Profil : ${roomProfile}` : undefined,
    ].filter(Boolean).join('\n'),
  };
}

function createStudyConnectionProject(): CpreyDrawProject {
  const salonPr1 = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const salonPr2 = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Salon', 'SALON', 'prises', [salonPr1]);
  const salonLa1 = importedApparatus('spot', 'LA1', '0 : RDC', 'Salon', 'SALON', 'lampes', [salonPr1, salonPr2]);
  const cuisinePr1 = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [salonPr1, salonPr2, salonLa1]);
  const dressing = importedApparatus('lampe', 'LA99', '0 : RDC', 'Dressing', 'DRESSING', 'lampes', [salonPr1, salonPr2, salonLa1, cuisinePr1]);
  const octopus = createOctopus('comfort', { x: 30, y: 40 }, []);
  const study = createImportedStudy([salonPr1, salonPr2, salonLa1, cuisinePr1, dressing], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }

  return {
    ...createEmptyProject(),
    apparatus: [salonPr1, salonPr2, salonLa1, cuisinePr1, dressing],
    octopuses: [octopus],
    study,
  };
}

function studyDeviceId(project: CpreyDrawProject, identifier: string, roomName: string): string {
  const room = project.study?.levels.flatMap((level) => level.rooms).find((candidate) => candidate.name === roomName);
  const device = project.study?.devices.find((candidate) =>
    candidate.identifier === identifier &&
    candidate.roomId === room?.id
  );
  if (!device) {
    assert.fail(`Missing study device ${identifier} in ${roomName}`);
  }
  return device.id;
}

function roomId(project: CpreyDrawProject, roomName: string): string {
  const room = project.study?.levels.flatMap((level) => level.rooms).find((candidate) => candidate.name === roomName);
  if (!room) {
    assert.fail(`Missing room ${roomName}`);
  }
  return room.id;
}

test('parses level room and profile location comments', () => {
  const parsed = parseStudyLocation('Niveau : 0 : RDC\nPièce : Salon\nProfil : SALON');

  assert.deepEqual(parsed, {
    levelCode: '0',
    levelName: 'RDC',
    roomName: 'Salon',
    profile: 'SALON',
  });
});

test('parses location comments with spacing and casing variants', () => {
  const parsed = parseStudyLocation(' niveau: 0: RDC \n Piece : Salon \n profil: SALON ');

  assert.equal(parsed.levelCode, '0');
  assert.equal(parsed.levelName, 'RDC');
  assert.equal(parsed.roomName, 'Salon');
  assert.equal(parsed.profile, 'SALON');
});

test('creates one study level and rooms from imported apparatus', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const second = importedApparatus('lampe', 'LA1', '0 : RDC', 'Salon', 'SALON', 'lampes', [first]);
  const third = importedApparatus('prise-16a', 'PR1', '0: rdc ', 'Cuisine', 'CUISINE', 'prises', [first, second]);

  const study = createImportedStudy([first, second, third], []);

  assert.equal(study?.levels.length, 1);
  assert.equal(study?.levels[0].id, 'level_001');
  assert.equal(study?.levels[0].code, '0');
  assert.equal(study?.levels[0].name, 'RDC');
  assert.deepEqual(study?.levels[0].rooms.map((room) => room.name), ['Salon', 'Cuisine']);
  assert.equal(study?.levels[0].rooms[0].id, 'room_001');
  assert.equal(study?.levels[0].rooms[1].id, 'room_002');
});

test('keeps same room name distinct on two levels', () => {
  const rdc = importedApparatus('lampe', 'LA1', '0 : RDC', 'Salle de bain', 'SDB', 'lampes');
  const floor = importedApparatus('lampe', 'LA1', '1 : Étage', 'Salle de bain', 'SDB', 'lampes', [rdc]);

  const study = createImportedStudy([rdc, floor], []);

  assert.equal(study?.levels.length, 2);
  assert.equal(study?.levels[0].rooms[0].name, 'Salle de bain');
  assert.equal(study?.levels[1].rooms[0].name, 'Salle de bain');
  assert.notEqual(study?.levels[0].rooms[0].id, study?.levels[1].rooms[0].id);
});

test('uses unique internal device ids even when visible identifiers repeat', () => {
  const salon = importedApparatus('lampe', 'LA1', '0 : RDC', 'Salon', 'SALON', 'lampes');
  const cuisine = importedApparatus('lampe', 'LA1', '0 : RDC', 'Cuisine', 'CUISINE', 'lampes', [salon]);

  const study = createImportedStudy([salon, cuisine], []);

  assert.deepEqual(study?.devices.map((device) => device.identifier), ['LA1', 'LA1']);
  assert.equal(new Set(study?.devices.map((device) => device.id)).size, 2);
});

test('attaches devices to level room profile metric and drawing object', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const study = createImportedStudy([apparatus], []);
  const device = study?.devices[0];

  assert.equal(device?.catalogId, 'prise-16a');
  assert.equal(device?.levelId, 'level_001');
  assert.equal(device?.roomId, 'room_001');
  assert.equal(study?.levels[0].rooms[0].profile, 'SALON');
  assert.equal(device?.metricKey, 'prises');
  assert.equal(device?.drawingObjectId, apparatus.id);
  assert.equal(device?.status, 'placed');
});

test('does not fail when an imported apparatus has no room', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', undefined, undefined, 'prises');
  const study = createImportedStudy([apparatus], []);

  assert.equal(study?.levels.length, 1);
  assert.equal(study?.levels[0].rooms.length, 0);
  assert.equal(study?.devices[0].levelId, 'level_001');
  assert.equal(study?.devices[0].roomId, undefined);
});

test('creates study devices for octopuses without inventing room assignment', () => {
  const octopus = {
    ...createOctopus('kitchen', { x: 30, y: 40 }, []),
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-26T10:00:00.000Z',
    },
  };
  const study = createImportedStudy([], [octopus]);
  const device = study?.devices[0];

  assert.equal(device?.type, 'octopus');
  assert.equal(device?.modelId, 'kitchen');
  assert.equal(device?.drawingObjectId, octopus.id);
  assert.equal(device?.status, 'placed');
  assert.equal(device?.levelId, undefined);
  assert.equal(device?.roomId, undefined);
});

test('filters known level apparatus and keeps unknown level apparatus visible', () => {
  const rdc = importedApparatus('lampe', 'LA1', '0 : RDC', 'Salon', 'SALON', 'lampes');
  const floor = importedApparatus('lampe', 'LA1', '1 : Étage', 'Chambre 1', 'CHAMBRE', 'lampes', [rdc]);
  const unknown = createApparatusInstance('prise-16a', { x: 100, y: 100 }, [rdc, floor]);
  const study = createImportedStudy([rdc, floor], []);
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    apparatus: [rdc, floor, unknown],
    study,
    activeLevelId: study?.levels[0].id,
  };

  assert.equal(shouldDisplayApparatusForActiveLevel(project, rdc), true);
  assert.equal(shouldDisplayApparatusForActiveLevel(project, floor), false);
  assert.equal(shouldDisplayApparatusForActiveLevel(project, unknown), true);
  assert.deepEqual(getStudyDevicesForLevel(study, study?.levels[0].id).map((device) => device.identifier), ['LA1']);
});

test('computes global and room progress from device status', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const second = importedApparatus('lampe', 'LA1', '0 : RDC', 'Salon', 'SALON', 'lampes', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  study.devices[1] = { ...study.devices[1], status: 'unplaced', drawingObjectId: undefined };

  assert.deepEqual(getStudyProgress(study), { total: 2, placed: 1, unplaced: 1 });
  assert.deepEqual(getStudyProgressForRoom(study, 'room_001'), {
    roomId: 'room_001',
    total: 2,
    placed: 1,
    unplaced: 1,
  });
  assert.equal(getRoomsForLevel(study, 'level_001').length, 1);
  assert.equal(getStudyDevicesForRoom(study, 'room_001').length, 2);
});

test('syncs study status when apparatus and octopus drawing objects are removed', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const octopus = createOctopus('kitchen', { x: 30, y: 40 }, []);
  const study = createImportedStudy([apparatus], [octopus]);
  const synced = syncStudyWithDrawing({
    ...createEmptyProject(),
    apparatus: [],
    octopuses: [],
    study,
  });

  assert.equal(synced.study?.devices[0].status, 'unplaced');
  assert.equal(synced.study?.devices[0].drawingObjectId, undefined);
  assert.equal(synced.study?.devices[1].status, 'unplaced');
  assert.equal(synced.study?.devices[1].drawingObjectId, undefined);
});

test('study device selection targets the existing drawing object id', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const study = createImportedStudy([apparatus], []);

  assert.equal(getStudyDeviceSelectionObjectId(study?.devices[0] ?? {
    id: 'missing',
    type: 'apparatus',
    status: 'unplaced',
  }), apparatus.id);
});

test('marks an unplaced study device as placed with a drawing object id', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const study = createImportedStudy([apparatus], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const unplacedDevice = {
    ...study.devices[0],
    drawingObjectId: undefined,
    status: 'unplaced' as const,
  };
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: [unplacedDevice],
    },
  };

  const nextProject = markStudyDevicePlaced(project, unplacedDevice.id, 'apparatus-new');

  assert.equal(nextProject.study?.devices[0].status, 'placed');
  assert.equal(nextProject.study?.devices[0].drawingObjectId, 'apparatus-new');
});

test('substitutes a single study device drawing catalog without changing CDEF identifier or source type', () => {
  const apparatus = importedApparatus('prise-16a', 'SP1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises_spec');
  const study = createImportedStudy([apparatus], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: [{ ...study.devices[0], status: 'unplaced', drawingObjectId: undefined }],
    },
  };

  const nextProject = configureStudyPhysicalRepresentation(project, [study.devices[0].id], 'four');

  assert.equal(nextProject.study?.devices[0].identifier, 'SP1');
  assert.equal(nextProject.study?.devices[0].sourceType, 'SP');
  assert.equal(nextProject.study?.devices[0].drawingCatalogId, 'four');
  assert.equal(nextProject.study?.physicalGroups, undefined);
});

test('returns compatible catalog items from the original electrical type', () => {
  const apparatus = importedApparatus('prise-16a', 'SP1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises_spec');
  const study = createImportedStudy([apparatus], []);
  const device = study?.devices[0];
  if (!study || !device) {
    assert.fail('Study should be created');
  }

  const compatibleIds = getCompatibleCatalogItems(study, device).map((item) => item.id);

  assert.equal(compatibleIds.includes('four'), true);
  assert.equal(compatibleIds.includes('lave-vaisselle'), true);
  assert.equal(compatibleIds.includes('prise-16a'), false);
});

test('returns all v2 switch catalog items for imported IN devices', () => {
  const first = importedApparatus('interrupteur-simple', 'IN1', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs');
  const study = createImportedStudy([first], []);
  const device = study?.devices[0];
  if (!study || !device) {
    assert.fail('Study should be created');
  }

  assert.deepEqual(
    getCompatibleCatalogItems(study, device).map((item) => item.id),
    [
      'interrupteur-poussoir',
      'interrupteur-simple',
      'interrupteur-v&v',
      'interrupteur-double',
      'Interrupteur-double-v',
      'Interrupteur-double-vV',
    ],
  );
});

test('uses official switch physical capacities', () => {
  assert.equal(getCatalogGroupCapacity('interrupteur-poussoir'), 1);
  assert.equal(getCatalogGroupCapacity('interrupteur-simple'), 1);
  assert.equal(getCatalogGroupCapacity('interrupteur-v&v'), 1);
  assert.equal(getCatalogGroupCapacity('interrupteur-double'), 2);
  assert.equal(getCatalogGroupCapacity('Interrupteur-double-v'), 2);
  assert.equal(getCatalogGroupCapacity('Interrupteur-double-vV'), 2);
});

test('simple switch variants substitute one IN reference without asking for a group', () => {
  for (const drawingCatalogId of ['interrupteur-poussoir', 'interrupteur-simple', 'interrupteur-v&v'] as const) {
    const first = importedApparatus('interrupteur-simple', 'IN1', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs');
    const study = createImportedStudy([first], []);
    if (!study) {
      assert.fail('Study should be created');
    }

    const nextProject = configureStudyPhysicalRepresentation(
      {
        ...createEmptyProject(),
        study: {
          ...study,
          devices: [{ ...study.devices[0], status: 'unplaced', drawingObjectId: undefined }],
        },
      },
      ['device_001'],
      drawingCatalogId,
    );

    assert.equal(nextProject.study?.devices[0].identifier, 'IN1');
    assert.equal(nextProject.study?.devices[0].sourceType, 'IN');
    assert.equal(nextProject.study?.devices[0].drawingCatalogId, drawingCatalogId);
    assert.equal(nextProject.study?.physicalGroups, undefined);
  }
});

test('groups two same-room study devices into one physical representation', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Salon', 'SALON', 'prises', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced', drawingObjectId: undefined })),
    },
  };

  const nextProject = configureStudyPhysicalRepresentation(
    project,
    project.study?.devices.map((device) => device.id) ?? [],
    'prise_double',
  );
  const group = nextProject.study?.physicalGroups?.[0];

  assert.equal(nextProject.study?.physicalGroups?.length, 1);
  assert.equal(group?.studyDeviceIds.length, 2);
  assert.equal(group?.drawingCatalogId, 'prise_double');
  assert.equal(nextProject.study?.devices.every((device) => device.physicalGroupId === group?.id), true);
  assert.equal(getStudyPlacementTargetsForRoom(nextProject.study, 'room_001')[0].identifiers.join(' + '), 'PR1 + PR2');
});

test('rejects grouping across rooms and levels', () => {
  const salon = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const cuisine = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [salon]);
  const floor = importedApparatus('prise-16a', 'PR3', '1 : Étage', 'Salon', 'SALON', 'prises', [salon, cuisine]);
  const study = createImportedStudy([salon, cuisine, floor], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced', drawingObjectId: undefined })),
    },
  };

  assert.throws(
    () => configureStudyPhysicalRepresentation(project, [project.study?.devices[0].id ?? '', project.study?.devices[1].id ?? ''], 'prise_double'),
    /même pièce/,
  );
  assert.throws(
    () => configureStudyPhysicalRepresentation(project, [project.study?.devices[0].id ?? '', project.study?.devices[2].id ?? ''], 'prise_double'),
    /même niveau/,
  );
});

test('group placement marks each study device while progress counts devices', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Salon', 'SALON', 'prises', [first]);
  const third = importedApparatus('lampe', 'LA1', '0 : RDC', 'Salon', 'SALON', 'lampes', [first, second]);
  const study = createImportedStudy([first, second, third], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const unplacedStudy = {
    ...study,
    devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
  };
  const grouped = configureStudyPhysicalRepresentation({
    ...createEmptyProject(),
    study: unplacedStudy,
  }, [unplacedStudy.devices[0].id, unplacedStudy.devices[1].id], 'prise_double');

  assert.deepEqual(getStudyProgress(grouped.study), { total: 3, placed: 0, unplaced: 3 });

  const placed = markStudyDevicesPlaced(grouped, [unplacedStudy.devices[0].id, unplacedStudy.devices[1].id], 'apparatus-025');

  assert.deepEqual(getStudyProgress(placed.study), { total: 3, placed: 2, unplaced: 1 });
  assert.equal(placed.study?.devices[0].drawingObjectId, 'apparatus-025');
  assert.equal(placed.study?.devices[1].drawingObjectId, 'apparatus-025');
});

test('deleting a grouped apparatus makes every linked study device unplaced but keeps the group', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Salon', 'SALON', 'prises', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const grouped = configureStudyPhysicalRepresentation({
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
    },
  }, ['device_001', 'device_002'], 'prise_double');
  const placed = markStudyDevicesPlaced({
    ...grouped,
    apparatus: [{ ...first, id: 'apparatus-025', studyDeviceIds: ['device_001', 'device_002'] }],
  }, ['device_001', 'device_002'], 'apparatus-025');

  const synced = syncStudyWithDrawing({ ...placed, apparatus: [] });

  assert.equal(synced.study?.physicalGroups?.[0].drawingCatalogId, 'prise_double');
  assert.equal(synced.study?.devices.every((device) => device.status === 'unplaced'), true);
  assert.equal(synced.study?.devices.every((device) => device.drawingObjectId === undefined), true);
});

test('dissociates an unplaced physical group without changing imported references', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Salon', 'SALON', 'prises', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const grouped = configureStudyPhysicalRepresentation({
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
    },
  }, ['device_001', 'device_002'], 'prise_double');

  const nextProject = dissociateStudyPhysicalGroup(grouped, grouped.study?.physicalGroups?.[0].id ?? '');

  assert.equal(nextProject.study?.physicalGroups, undefined);
  assert.deepEqual(nextProject.study?.devices.map((device) => device.identifier), ['PR1', 'PR2']);
  assert.equal(nextProject.study?.devices.every((device) => device.physicalGroupId === undefined), true);
});

test('stores octopus installation and served rooms without coupling them', () => {
  const project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const dressingId = roomId(project, 'Dressing');
  const salonId = roomId(project, 'Salon');
  const levelId = project.study?.levels[0].id;

  const installed = setStudyOctopusInstallation(project, octopusId, levelId, dressingId);
  const served = setStudyOctopusServedRooms(installed, octopusId, [salonId, salonId]);

  assert.equal(getStudyOctopus(served.study, octopusId)?.installationRoomId, dressingId);
  assert.deepEqual(getStudyOctopus(served.study, octopusId)?.servedRoomIds, [salonId]);
});

test('refuses removing a served room while a port still targets its devices', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const salonId = roomId(project, 'Salon');
  const la1Id = studyDeviceId(project, 'LA1', 'Salon');

  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 3, la1Id);

  assert.throws(
    () => setStudyOctopusServedRooms(project, octopusId, []),
    /Impossible de retirer cette pièce/,
  );
  assert.equal(getStudyDevicePortAssignment(project.study, la1Id)?.portNumber, 3);
});

test('assigns and frees one study device on an octopus port', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const salonId = roomId(project, 'Salon');
  const la1Id = studyDeviceId(project, 'LA1', 'Salon');

  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 3, la1Id);

  assert.equal(getStudyDevicePortAssignment(project.study, la1Id)?.octopusId, octopusId);
  assert.equal(getStudyDevicePortAssignment(project.study, la1Id)?.portNumber, 3);
  assert.equal(getFreeOctopusPorts(project, octopusId).includes(3), false);

  project = unassignOctopusPort(project, octopusId, 3);
  assert.equal(getStudyDevicePortAssignment(project.study, la1Id), undefined);
  assert.equal(getFreeOctopusPorts(project, octopusId).includes(3), true);
});

test('rejects invalid ports occupied ports duplicate devices and non-served rooms', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const otherOctopus = createOctopus('other', { x: 80, y: 90 }, project.octopuses);
  project = {
    ...project,
    octopuses: [...project.octopuses, otherOctopus],
  };
  const salonId = roomId(project, 'Salon');
  const la1Id = studyDeviceId(project, 'LA1', 'Salon');
  const pr1SalonId = studyDeviceId(project, 'PR1', 'Salon');
  const pr1CuisineId = studyDeviceId(project, 'PR1', 'Cuisine');

  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);

  assert.throws(() => assignStudyDeviceToOctopusPort(project, octopusId, 0, la1Id), /Numéro de port invalide/);
  assert.throws(() => assignStudyDeviceToOctopusPort(project, octopusId, 17, la1Id), /Numéro de port invalide/);
  assert.throws(() => assignStudyDeviceToOctopusPort(project, octopusId, 4, pr1CuisineId), /n'est pas desservie/);

  project = assignStudyDeviceToOctopusPort(project, octopusId, 3, la1Id);
  assert.throws(() => assignStudyDeviceToOctopusPort(project, octopusId, 3, pr1SalonId), /déjà affecté/);
  assert.throws(() => assignStudyDeviceToOctopusPort(project, otherOctopus.id, 5, la1Id), /déjà affecté/);

  const withCuisine = setStudyOctopusServedRooms(project, octopusId, [salonId, roomId(project, 'Cuisine')]);
  assert.doesNotThrow(() => assignStudyDeviceToOctopusPort(withCuisine, octopusId, 4, pr1CuisineId));
});

test('moves a study device assignment atomically between octopus ports', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const salonId = roomId(project, 'Salon');
  const la1Id = studyDeviceId(project, 'LA1', 'Salon');

  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 3, la1Id);
  project = moveStudyDeviceOctopusPortAssignment(project, la1Id, octopusId, 7);

  assert.equal(getOctopusPortAssignments(project.study, octopusId).some((assignment) => assignment.portNumber === 3), false);
  assert.equal(getStudyDevicePortAssignment(project.study, la1Id)?.portNumber, 7);
});

test('keeps electrical port assignments when an apparatus drawing object is removed', () => {
  const base = createStudyConnectionProject();
  const octopusId = base.octopuses[0].id;
  const salonId = roomId(base, 'Salon');
  const la1Id = studyDeviceId(base, 'LA1', 'Salon');
  const assigned = assignStudyDeviceToOctopusPort(
    setStudyOctopusServedRooms(base, octopusId, [salonId]),
    octopusId,
    2,
    la1Id,
  );
  const la1DrawingObjectId = assigned.study?.devices.find((device) => device.id === la1Id)?.drawingObjectId;

  const synced = syncStudyWithDrawing({
    ...assigned,
    apparatus: assigned.apparatus.filter((apparatus) => apparatus.id !== la1DrawingObjectId),
  });

  const device = synced.study?.devices.find((candidate) => candidate.id === la1Id);
  assert.equal(device?.status, 'unplaced');
  assert.equal(device?.drawingObjectId, undefined);
  assert.equal(getStudyDevicePortAssignment(synced.study, la1Id)?.portNumber, 2);
});

test('cleans study octopus port assignments when the octopus drawing object is removed', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const salonId = roomId(project, 'Salon');
  const la1Id = studyDeviceId(project, 'LA1', 'Salon');

  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 1, la1Id);
  const synced = syncStudyWithDrawing({ ...project, octopuses: [] });

  assert.equal(synced.study?.octopuses, undefined);
  assert.equal(synced.study?.portAssignments, undefined);
});

test('physical groups keep electrical assignments per study device', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const salonId = roomId(project, 'Salon');
  const pr1Id = studyDeviceId(project, 'PR1', 'Salon');
  const pr2Id = studyDeviceId(project, 'PR2', 'Salon');

  project = {
    ...project,
    study: project.study
      ? {
          ...project.study,
          devices: project.study.devices.map((device) =>
            [pr1Id, pr2Id].includes(device.id)
              ? { ...device, status: 'unplaced', drawingObjectId: undefined }
              : device,
          ),
        }
      : undefined,
  };
  project = configureStudyPhysicalRepresentation(project, [pr1Id, pr2Id], 'prise_double');
  project = markStudyDevicesPlaced(project, [pr1Id, pr2Id], 'apparatus-double-1');
  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 5, pr1Id);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 6, pr2Id);

  assert.equal(project.study?.physicalGroups?.length, 1);
  assert.equal(new Set(project.study?.devices.filter((device) => [pr1Id, pr2Id].includes(device.id)).map((device) => device.drawingObjectId)).size, 1);
  assert.equal(getOctopusPortAssignments(project.study, octopusId).length, 2);
  assert.deepEqual(
    [getStudyDevicePortAssignment(project.study, pr1Id)?.portNumber, getStudyDevicePortAssignment(project.study, pr2Id)?.portNumber],
    [5, 6],
  );
});

test('proposes only explicit same-room unplaced candidates for a double socket workflow', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [first]);
  const third = importedApparatus('prise-16a', 'PR3', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [first, second]);
  const otherRoom = importedApparatus('prise-16a', 'PR4', '0 : RDC', 'Salon', 'SALON', 'prises', [first, second, third]);
  const otherLevel = importedApparatus('prise-16a', 'PR5', '1 : Étage', 'Cuisine', 'CUISINE', 'prises', [first, second, third, otherRoom]);
  const otherType = importedApparatus('lampe', 'LA1', '0 : RDC', 'Cuisine', 'CUISINE', 'lampes', [first, second, third, otherRoom, otherLevel]);
  const study = createImportedStudy([first, second, third, otherRoom, otherLevel, otherType], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const unplacedStudy = {
    ...study,
    devices: study.devices.map((device) =>
      device.identifier === 'PR3'
        ? { ...device, status: 'placed' as const, drawingObjectId: 'apparatus-pr3' }
        : { ...device, status: 'unplaced' as const, drawingObjectId: undefined },
    ),
  };

  const candidates = getCompatibleStudyDeviceCandidates(unplacedStudy, unplacedStudy.devices[0])
    .filter((device) => device.id !== unplacedStudy.devices[0].id);

  assert.deepEqual(candidates.map((device) => device.identifier), ['PR2']);
});

test('does not propose or accept a study device already attached to another physical group', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises');
  const second = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [first]);
  const third = importedApparatus('prise-16a', 'PR3', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [first, second]);
  const study = createImportedStudy([first, second, third], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const groupedStudy = {
    ...study,
    physicalGroups: [{
      id: 'physical_group_999',
      studyDeviceIds: ['device_002', 'device_003'],
      drawingCatalogId: 'prise_double' as const,
    }],
    devices: study.devices.map((device) => ({
      ...device,
      status: 'unplaced' as const,
      drawingObjectId: undefined,
      physicalGroupId: device.id === 'device_002' || device.id === 'device_003' ? 'physical_group_999' : undefined,
    })),
  };

  const candidates = getCompatibleStudyDeviceCandidates(groupedStudy, groupedStudy.devices[0])
    .filter((device) => device.id !== groupedStudy.devices[0].id);

  assert.deepEqual(candidates, []);
  assert.throws(
    () => configureStudyPhysicalRepresentation({ ...createEmptyProject(), study: groupedStudy }, ['device_001', 'device_002'], 'prise_double'),
    /déjà associée/,
  );
});

test('keeps a single reference unchanged when no second candidate exists for a double device', () => {
  const first = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises');
  const study = createImportedStudy([first], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const unplacedStudy = {
    ...study,
    devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
  };

  const candidates = getCompatibleStudyDeviceCandidates(unplacedStudy, unplacedStudy.devices[0])
    .filter((device) => device.id !== unplacedStudy.devices[0].id);

  assert.deepEqual(candidates, []);
  assert.throws(
    () => configureStudyPhysicalRepresentation({ ...createEmptyProject(), study: unplacedStudy }, ['device_001'], 'prise_double'),
    /doit associer 2/,
  );
  assert.equal(unplacedStudy.physicalGroups, undefined);
  assert.equal(unplacedStudy.devices[0].physicalGroupId, undefined);
});

test('groups two switches into any v2 double switch using the same physical workflow', () => {
  for (const drawingCatalogId of ['interrupteur-double', 'Interrupteur-double-v', 'Interrupteur-double-vV'] as const) {
    const first = importedApparatus('interrupteur-simple', 'IN1', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs');
    const second = importedApparatus('interrupteur-simple', 'IN2', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs', [first]);
    const study = createImportedStudy([first, second], []);
    if (!study) {
      assert.fail('Study should be created');
    }
    const unplacedStudy = {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
    };

    const nextProject = configureStudyPhysicalRepresentation(
      { ...createEmptyProject(), study: unplacedStudy },
      ['device_001', 'device_002'],
      drawingCatalogId,
    );

    assert.equal(nextProject.study?.physicalGroups?.[0].drawingCatalogId, drawingCatalogId);
    assert.deepEqual(nextProject.study?.physicalGroups?.[0].studyDeviceIds, ['device_001', 'device_002']);
  }
});

test('placing a v2 double switch group uses one drawing object for two IN study devices', () => {
  const first = importedApparatus('interrupteur-simple', 'IN1', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs');
  const second = importedApparatus('interrupteur-simple', 'IN2', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs', [first]);
  const study = createImportedStudy([first, second], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const grouped = configureStudyPhysicalRepresentation({
    ...createEmptyProject(),
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, status: 'unplaced' as const, drawingObjectId: undefined })),
    },
  }, ['device_001', 'device_002'], 'Interrupteur-double-vV');

  const placed = markStudyDevicesPlaced(grouped, ['device_001', 'device_002'], 'apparatus-double-switch');

  assert.equal(placed.study?.physicalGroups?.length, 1);
  assert.equal(placed.study?.physicalGroups?.[0].drawingCatalogId, 'Interrupteur-double-vV');
  assert.deepEqual(placed.study?.devices.map((device) => device.status), ['placed', 'placed']);
  assert.equal(placed.study?.devices[0].drawingObjectId, 'apparatus-double-switch');
  assert.equal(placed.study?.devices[1].drawingObjectId, 'apparatus-double-switch');
});

test('proposes only same-room unplaced IN candidates for double switch workflows', () => {
  const first = importedApparatus('interrupteur-simple', 'IN1', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs');
  const second = importedApparatus('interrupteur-simple', 'IN2', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs', [first]);
  const placed = importedApparatus('interrupteur-simple', 'IN3', '0 : RDC', 'Cuisine', 'CUISINE', 'interrupteurs', [first, second]);
  const otherRoom = importedApparatus('interrupteur-simple', 'IN4', '0 : RDC', 'Salon', 'SALON', 'interrupteurs', [first, second, placed]);
  const otherLevel = importedApparatus('interrupteur-simple', 'IN5', '1 : Étage', 'Cuisine', 'CUISINE', 'interrupteurs', [first, second, placed, otherRoom]);
  const otherType = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [first, second, placed, otherRoom, otherLevel]);
  const study = createImportedStudy([first, second, placed, otherRoom, otherLevel, otherType], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const unplacedStudy = {
    ...study,
    devices: study.devices.map((device) =>
      device.identifier === 'IN3'
        ? { ...device, status: 'placed' as const, drawingObjectId: 'apparatus-in3' }
        : { ...device, status: 'unplaced' as const, drawingObjectId: undefined },
    ),
  };

  const candidates = getCompatibleStudyDeviceCandidates(unplacedStudy, unplacedStudy.devices[0])
    .filter((device) => device.id !== unplacedStudy.devices[0].id);

  assert.deepEqual(candidates.map((device) => device.identifier), ['IN2']);
  assert.throws(
    () => configureStudyPhysicalRepresentation(
      { ...createEmptyProject(), study: unplacedStudy },
      ['device_001', 'device_006'],
      'Interrupteur-double-vV',
    ),
    /même type électrique/,
  );
});

test('keeps octopus port assignments when grouping and dissociating a physical representation', () => {
  let project = createStudyConnectionProject();
  const octopusId = project.octopuses[0].id;
  const salonId = roomId(project, 'Salon');
  const pr1Id = studyDeviceId(project, 'PR1', 'Salon');
  const pr2Id = studyDeviceId(project, 'PR2', 'Salon');

  project = {
    ...project,
    study: project.study
      ? {
          ...project.study,
          devices: project.study.devices.map((device) =>
            [pr1Id, pr2Id].includes(device.id)
              ? { ...device, status: 'unplaced' as const, drawingObjectId: undefined }
              : device,
          ),
        }
      : undefined,
  };
  project = setStudyOctopusServedRooms(project, octopusId, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 5, pr1Id);
  project = assignStudyDeviceToOctopusPort(project, octopusId, 6, pr2Id);
  project = configureStudyPhysicalRepresentation(project, [pr1Id, pr2Id], 'prise_double');

  assert.equal(getStudyDevicePortAssignment(project.study, pr1Id)?.portNumber, 5);
  assert.equal(getStudyDevicePortAssignment(project.study, pr2Id)?.portNumber, 6);

  const dissociated = dissociateStudyPhysicalGroup(project, project.study?.physicalGroups?.[0].id ?? '');
  assert.equal(getStudyDevicePortAssignment(dissociated.study, pr1Id)?.portNumber, 5);
  assert.equal(getStudyDevicePortAssignment(dissociated.study, pr2Id)?.portNumber, 6);
});

test('keeps octopus port assignments when changing a switch physical model', () => {
  const first = importedApparatus('interrupteur-simple', 'IN1', '0 : RDC', 'Salon', 'SALON', 'interrupteurs');
  const octopus = createOctopus('comfort', { x: 30, y: 40 }, []);
  const study = createImportedStudy([first], [octopus]);
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
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 3, 'device_001');

  const changed = configureStudyPhysicalRepresentation(project, ['device_001'], 'interrupteur-v&v');

  assert.equal(changed.study?.devices[0].drawingCatalogId, 'interrupteur-v&v');
  assert.equal(getStudyDevicePortAssignment(changed.study, 'device_001')?.octopusId, octopus.id);
  assert.equal(getStudyDevicePortAssignment(changed.study, 'device_001')?.portNumber, 3);
});

test('creates manual study levels and rooms from an empty project with stable ids', () => {
  let project = createEmptyProject();
  project = addStudyLevel(project, '  RDC  ');
  project = addStudyRoom(project, 'level_001', ' Cuisine ');

  assert.equal(project.study?.levels.length, 1);
  assert.equal(project.study?.levels[0].id, 'level_001');
  assert.equal(project.study?.levels[0].name, 'RDC');
  assert.equal(project.activeLevelId, 'level_001');
  assert.equal(project.study?.levels[0].rooms[0].id, 'room_001');
  assert.equal(project.study?.levels[0].rooms[0].levelId, 'level_001');
  assert.equal(project.study?.levels[0].rooms[0].name, 'Cuisine');
});

test('renames manual levels and rooms without changing ids', () => {
  let project = addStudyRoom(addStudyLevel(createEmptyProject(), 'RDC'), 'level_001', 'Cuisine');
  project = renameStudyLevel(project, 'level_001', 'Rez-de-chaussée');
  project = renameStudyRoom(project, 'room_001', 'Cuisine ouverte');

  assert.equal(project.study?.levels[0].id, 'level_001');
  assert.equal(project.study?.levels[0].name, 'Rez-de-chaussée');
  assert.equal(project.study?.levels[0].rooms[0].id, 'room_001');
  assert.equal(project.study?.levels[0].rooms[0].name, 'Cuisine ouverte');
});

test('rejects empty and duplicate location names with normalized comparison', () => {
  let project = addStudyLevel(createEmptyProject(), 'RDC');
  project = addStudyRoom(project, 'level_001', 'Cuisine');

  assert.equal(normalizeLocationName('  Cuisine   ouverte '), 'cuisine ouverte');
  assert.throws(() => addStudyLevel(project, '   '), /obligatoire/);
  assert.throws(() => addStudyLevel(project, 'rdc'), /existe déjà/);
  assert.throws(() => addStudyRoom(project, 'level_001', 'cuisine'), /existe déjà/);

  project = addStudyLevel(project, 'Étage');
  project = addStudyRoom(project, 'level_002', 'cuisine');
  assert.equal(project.study?.levels[1].rooms[0].name, 'cuisine');
});

test('removes an unused room and protects used rooms and levels', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises');
  const octopus = createOctopus('comfort', { x: 30, y: 40 }, []);
  const study = createImportedStudy([apparatus], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    apparatus: [apparatus],
    octopuses: [octopus],
    study,
    activeLevelId: study.levels[0].id,
  };
  const cuisineId = roomId(project, 'Cuisine');
  project = addStudyRoom(project, study.levels[0].id, 'Cellier');
  const cellierId = roomId(project, 'Cellier');

  assert.equal(canRemoveStudyRoom(project, cuisineId).ok, false);
  assert.equal(canRemoveStudyLevel(project, study.levels[0].id).ok, false);

  const withoutCellier = removeStudyRoom(project, cellierId);
  assert.equal(withoutCellier.study?.levels[0].rooms.some((room) => room.id === cellierId), false);
});

test('protects rooms used by manual octopus installation and served rooms', () => {
  let project = addStudyLevel(createEmptyProject(), 'RDC');
  project = addStudyRoom(project, 'level_001', 'Cuisine');
  project = addStudyRoom(project, 'level_001', 'Cellier');
  const octopus = createOctopus('comfort', { x: 30, y: 40 }, []);
  project = { ...project, octopuses: [octopus] };
  project = setStudyOctopusInstallation(project, octopus.id, 'level_001', 'room_002');
  project = setStudyOctopusServedRooms(project, octopus.id, ['room_001']);

  assert.equal(getStudyOctopus(project.study, octopus.id)?.installationRoomId, 'room_002');
  assert.deepEqual(getStudyOctopus(project.study, octopus.id)?.servedRoomIds, ['room_001']);
  assert.equal(canRemoveStudyRoom(project, 'room_001').ok, false);
  assert.equal(canRemoveStudyRoom(project, 'room_002').ok, false);
});

test('sets wall mounting on a manual octopus without changing location or served rooms', () => {
  let project = addStudyLevel(createEmptyProject(), 'RDC');
  project = addStudyRoom(project, 'level_001', 'Cuisine');
  project = addStudyRoom(project, 'level_001', 'Cellier');
  const octopus = createOctopus('kitchen', { x: 30, y: 40 }, []);
  project = { ...project, octopuses: [octopus] };
  project = setStudyOctopusInstallation(project, octopus.id, 'level_001', 'room_002');
  project = setStudyOctopusServedRooms(project, octopus.id, ['room_001']);

  const wallMounted = setStudyOctopusMounting(project, octopus.id, 'wall', 1.8);
  const studyOctopus = getStudyOctopus(wallMounted.study, octopus.id);

  assert.equal(studyOctopus?.installationMode, 'wall');
  assert.equal(studyOctopus?.installationHeightM, 1.8);
  assert.equal(studyOctopus?.installationLevelId, 'level_001');
  assert.equal(studyOctopus?.installationRoomId, 'room_002');
  assert.deepEqual(studyOctopus?.servedRoomIds, ['room_001']);
  assert.equal(wallMounted.octopuses[0].x, 30);
  assert.equal(wallMounted.octopuses[0].y, 40);
});

test('creates the StudyOctopus entry when mounting a manual octopus', () => {
  const octopus = createOctopus('comfort', { x: 10, y: 20 }, []);
  const project = { ...createEmptyProject(), octopuses: [octopus] };

  const mounted = setStudyOctopusMounting(project, octopus.id, 'wall', 1.82);

  assert.equal(mounted.study?.levels.length, 0);
  assert.equal(mounted.study?.devices.length, 0);
  assert.equal(getStudyOctopusInstallationMode(mounted.study, octopus.id), 'wall');
  assert.equal(getStudyOctopusInstallationHeight(mounted.study, octopus.id), 1.82);
});

test('parses French and point metric input for wall mounting height', () => {
  assert.equal(parseMetricInput('1,80'), 1.8);
  assert.equal(parseMetricInput('1.80'), 1.8);
  assert.equal(parseMetricInput(' 1,82 '), 1.82);
});

test('rejects invalid wall mounting heights', () => {
  const octopus = createOctopus('comfort', { x: 10, y: 20 }, []);
  const project = { ...createEmptyProject(), octopuses: [octopus] };

  assert.throws(() => setStudyOctopusMounting(project, octopus.id, 'wall', undefined), /strictement positive/);
  assert.throws(() => setStudyOctopusMounting(project, octopus.id, 'wall', -0.5), /strictement positive/);
  assert.throws(() => setStudyOctopusMounting(project, octopus.id, 'wall', Number.NaN), /strictement positive/);
  assert.throws(() => setStudyOctopusMounting(project, octopus.id, 'wall', Number.POSITIVE_INFINITY), /strictement positive/);
});

test('returning to standard mounting clears the stored wall height', () => {
  const octopus = createOctopus('comfort', { x: 10, y: 20 }, []);
  const project = setStudyOctopusMounting(
    { ...createEmptyProject(), octopuses: [octopus] },
    octopus.id,
    'wall',
    1.8,
  );

  const standard = setStudyOctopusMounting(project, octopus.id, 'standard', undefined);

  assert.equal(getStudyOctopusInstallationMode(standard.study, octopus.id), 'standard');
  assert.equal(getStudyOctopusInstallationHeight(standard.study, octopus.id), undefined);
  assert.equal(getStudyOctopus(standard.study, octopus.id)?.installationMode, undefined);
  assert.equal(getStudyOctopus(standard.study, octopus.id)?.installationHeightM, undefined);
});

test('wall mounting keeps octopus port assignments unchanged', () => {
  const pr1 = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises');
  const pr2 = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [pr1]);
  const octopus = createOctopus('kitchen', { x: 30, y: 40 }, []);
  const study = createImportedStudy([pr1, pr2], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  const cuisineId = study.levels[0].rooms[0].id;
  let project: CpreyDrawProject = { ...createEmptyProject(), octopuses: [octopus], study };
  project = setStudyOctopusServedRooms(project, octopus.id, [cuisineId]);
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 5, 'device_001');
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 6, 'device_002');

  const mounted = setStudyOctopusMounting(project, octopus.id, 'wall', 1.8);

  assert.deepEqual(mounted.study?.portAssignments, project.study?.portAssignments);
});

test('stores manual apparatus location without creating a study device', () => {
  let project = addStudyRoom(addStudyLevel(createEmptyProject(), 'RDC'), 'level_001', 'Cuisine');
  const apparatus = createApparatusInstance('prise-16a', { x: 10, y: 20 }, []);
  project = { ...project, apparatus: [apparatus] };

  const located = setManualApparatusLocation(project, apparatus.id, 'level_001', 'room_001');

  assert.equal(located.apparatus[0].levelId, 'level_001');
  assert.equal(located.apparatus[0].roomId, 'room_001');
  assert.equal(located.study?.devices.length, 0);
});

test('does not allow manual location to diverge from configurator devices', () => {
  const apparatus = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Cuisine', 'CUISINE', 'prises');
  const study = createImportedStudy([apparatus], []);
  if (!study) {
    assert.fail('Study should be created');
  }
  const project: CpreyDrawProject = { ...createEmptyProject(), apparatus: [apparatus], study };

  assert.throws(
    () => setManualApparatusLocation(project, apparatus.id, 'level_001', 'room_001'),
    /configurateur/,
  );
});

test('merges imported levels and rooms into an existing manual reference while preserving ids', () => {
  let manualProject = addStudyRoom(addStudyLevel(createEmptyProject(), 'RDC'), 'level_001', 'Cuisine');
  const salon = importedApparatus('prise-16a', 'PR1', '0 : RDC', 'Salon', 'SALON', 'prises');
  const cuisine = importedApparatus('prise-16a', 'PR2', '0 : RDC', 'Cuisine', 'CUISINE', 'prises', [salon]);
  const importedStudy = createImportedStudy([salon, cuisine], []);
  const merged = mergeImportedStudyReference(manualProject.study, importedStudy);

  assert.equal(merged?.levels.length, 1);
  assert.equal(merged?.levels[0].id, 'level_001');
  assert.equal(merged?.levels[0].rooms.find((room) => room.name === 'Cuisine')?.id, 'room_001');
  assert.equal(merged?.levels[0].rooms.find((room) => room.name === 'Salon')?.id, 'room_002');
  assert.equal(merged?.devices.find((device) => device.identifier === 'PR2')?.roomId, 'room_001');
});
