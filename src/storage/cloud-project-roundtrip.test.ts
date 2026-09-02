import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../domain/apparatus';
import { createOctopus } from '../domain/octopus';
import type { CpreyDrawProject } from '../types/project';
import {
  createEmptyProject,
  deserializeProject,
  ProjectFileError,
  serializeProject,
} from './ProjectStorage';
import { ServerProjectRepository } from './ServerProjectRepository';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function loadCloudProject(projectPayload: unknown): Promise<CpreyDrawProject> {
  const repository = new ServerProjectRepository({
    fetchImpl: async () =>
      jsonResponse({
        ok: true,
        application: 'cprey_draw',
        site: {
          siteId: 8,
          codeSite: '00015',
        },
        project: projectPayload,
      }),
  });

  return repository.load('Type_T4-AH');
}

function createRepresentativeProject(): CpreyDrawProject {
  const baseProject = createEmptyProject();
  const octopus = {
    ...createOctopus('kitchen', { x: 300, y: 220 }, []),
    id: 'octopus-cuisine-001',
    name: 'Pieuvre Cuisine',
  };
  const groupedApparatus = {
    ...createApparatusInstance('prise_double', { x: 160, y: 120 }, []),
    id: 'apparatus-prise-double-001',
    name: 'Prise double Cuisine',
    identifier: 'PR1+PR2',
    levelId: 'level-rdc',
    roomId: 'room-cuisine',
    studyDeviceIds: ['device-prise-001', 'device-prise-002'],
  };
  const soloApparatus = {
    ...createApparatusInstance('spot', { x: 420, y: 180 }, [groupedApparatus]),
    id: 'apparatus-spot-001',
    name: 'Spot Salon',
    identifier: 'SP1',
    levelId: 'level-rdc',
    roomId: 'room-salon',
    studyDeviceIds: ['device-spot-001'],
  };

  return {
    ...baseProject,
    project: {
      id: 'project-Type_T4-AH',
      name: 'Type_T4-AH',
      updatedAt: '2026-09-01T12:00:00.000Z',
    },
    site: {
      name: 'Maison Type T4',
      reference: '00015',
      quoteReference: 'DEV-T4-AH',
      clientName: 'AH',
      city: 'Hauterives',
    },
    origin: {
      type: 'configurator',
      configuratorVersion: '1.2.3',
      sourceApplication: 'SmartCPREY',
      sourceVariant: 'T4',
      sourceVersion: '2026.09',
      selectedScenario: 'MOY',
      configuratorSummary: {
        level: 'MOY',
        requestedOctopuses: [{ modelId: 'kitchen', quantity: 1 }],
        requestedApparatus: [{ catalogId: 'prise_double', type: 'PR', quantity: 1 }],
      },
      cdef: {
        schemaVersion: 1,
        levels: ['RDC'],
        rooms: [
          { levelName: 'RDC', roomName: 'Cuisine', profile: 'CUISINE' },
          { levelName: 'RDC', roomName: 'Salon', profile: 'SALON' },
        ],
      },
    },
    status: 'review',
    ownership: {
      ownerUserId: 'installer-001',
      ownerOrganizationId: 'org-cprey',
    },
    access: {
      editableBy: ['installer-001'],
      viewableBy: ['viewer-001'],
    },
    audit: {
      createdAt: '2026-08-31T08:00:00.000Z',
      createdBy: 'installer-001',
      updatedAt: '2026-09-01T12:00:00.000Z',
      updatedBy: 'installer-001',
    },
    technicalSettings: {
      defaultCeilingHeight: 2.5,
      panelCenterHeightFromFloor: 1.35,
      ductConnectionMargin: 0.12,
      crawlSpaceHeight: 0.7,
      roomCeilingHeights: {
        'room-cuisine': 2.45,
        'room-salon': 2.6,
      },
    },
    drawing: {
      viewport: { x: 48, y: -32, scale: 1.4 },
      metersPerPixel: 0.015,
      scaleReference: {
        start: { x: 10, y: 20 },
        end: { x: 210, y: 20 },
        realMeters: 3,
      },
      scaleMarkerVisible: false,
      zoomWheelEnabled: false,
      movementLocked: true,
      showDuctLengths: false,
      apparatusGlobalScale: 1.2,
    },
    plans: [
      {
        id: 'plan-rdc-001',
        name: 'Plan RDC',
        source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
        visible: true,
        locked: true,
        opacity: 0.85,
        rotation: 0,
        mimeType: 'image/png',
        width: 1400,
        height: 900,
        importedAt: '2026-08-31T08:30:00.000Z',
      },
    ],
    octopuses: [octopus],
    apparatus: [groupedApparatus, soloApparatus],
    study: {
      levels: [
        {
          id: 'level-rdc',
          name: 'RDC',
          rooms: [
            { id: 'room-cuisine', levelId: 'level-rdc', name: 'Cuisine', profile: 'CUISINE' },
            { id: 'room-salon', levelId: 'level-rdc', name: 'Salon', profile: 'SALON' },
          ],
        },
      ],
      devices: [
        {
          id: 'device-prise-001',
          type: 'apparatus',
          catalogId: 'prise-16a',
          identifier: 'PR1',
          sourceType: 'PR',
          drawingCatalogId: 'prise_double',
          physicalGroupId: 'physical-group-001',
          levelId: 'level-rdc',
          roomId: 'room-cuisine',
          drawingObjectId: 'apparatus-prise-double-001',
          status: 'placed',
        },
        {
          id: 'device-prise-002',
          type: 'apparatus',
          catalogId: 'prise-16a',
          identifier: 'PR2',
          sourceType: 'PR',
          drawingCatalogId: 'prise_double',
          physicalGroupId: 'physical-group-001',
          levelId: 'level-rdc',
          roomId: 'room-cuisine',
          drawingObjectId: 'apparatus-prise-double-001',
          status: 'placed',
        },
        {
          id: 'device-spot-001',
          type: 'apparatus',
          catalogId: 'spot',
          identifier: 'SP1',
          sourceType: 'SP',
          drawingCatalogId: 'spot',
          levelId: 'level-rdc',
          roomId: 'room-salon',
          drawingObjectId: 'apparatus-spot-001',
          status: 'placed',
        },
        {
          id: 'device-octopus-001',
          type: 'octopus',
          modelId: 'kitchen',
          identifier: 'Pieuvre Cuisine',
          levelId: 'level-rdc',
          roomId: 'room-cuisine',
          drawingObjectId: 'octopus-cuisine-001',
          status: 'placed',
        },
      ],
      physicalGroups: [
        {
          id: 'physical-group-001',
          studyDeviceIds: ['device-prise-001', 'device-prise-002'],
          drawingCatalogId: 'prise_double',
          drawingObjectId: 'apparatus-prise-double-001',
        },
      ],
      octopuses: [
        {
          octopusId: 'octopus-cuisine-001',
          installationLevelId: 'level-rdc',
          installationRoomId: 'room-cuisine',
          servedRoomIds: ['room-cuisine', 'room-salon'],
          installationMode: 'wall',
          installationHeightM: 1.8,
        },
      ],
      portAssignments: [
        {
          id: 'port-assignment-001',
          octopusId: 'octopus-cuisine-001',
          portNumber: 5,
          studyDeviceId: 'device-prise-001',
          source: 'manual',
        },
        {
          id: 'port-assignment-002',
          octopusId: 'octopus-cuisine-001',
          portNumber: 6,
          studyDeviceId: 'device-prise-002',
          source: 'manual',
        },
      ],
    },
    activeLevelId: 'level-rdc',
  };
}

function getCounts(project: CpreyDrawProject) {
  return {
    apparatus: project.apparatus.length,
    octopuses: project.octopuses.length,
    rooms: project.study?.levels.flatMap((level) => level.rooms).length ?? 0,
    plans: project.plans.length,
    portAssignments: project.study?.portAssignments?.length ?? 0,
  };
}

test('cloud load accepts project as object', async () => {
  const loaded = await loadCloudProject({ schemaVersion: 1 });

  assert.equal(loaded.schemaVersion, 1);
  assert.equal(loaded.project.name, 'Projet CPREY DRAW');
});

test('cloud load accepts project as JSON string', async () => {
  const loaded = await loadCloudProject('{"schemaVersion":1}');

  assert.equal(loaded.schemaVersion, 1);
  assert.equal(loaded.project.name, 'Projet CPREY DRAW');
});

test('cloud load rejects invalid project JSON with a controlled error', async () => {
  await assert.rejects(
    () => loadCloudProject('{"schemaVersion":'),
    (error) => error instanceof ProjectFileError && error.code === 'invalid-json',
  );
});

test('cloud project round-trip restores the complete saved business data', async () => {
  const project = createRepresentativeProject();
  const serialized = serializeProject(project);
  const expected = deserializeProject(serialized);
  const loaded = await loadCloudProject(JSON.parse(serialized));

  assert.deepEqual(loaded, expected);
  assert.equal(loaded.origin.type, 'configurator');
  assert.equal(loaded.origin.configuratorVersion, '1.2.3');
  assert.equal(loaded.origin.sourceApplication, 'SmartCPREY');
  assert.equal(loaded.origin.sourceVariant, 'T4');
  assert.equal(loaded.origin.sourceVersion, '2026.09');
  assert.equal(loaded.origin.selectedScenario, 'MOY');
  assert.deepEqual(loaded.origin.configuratorSummary, expected.origin.configuratorSummary);
  assert.deepEqual(loaded.origin.cdef, expected.origin.cdef);
  assert.deepEqual(loaded.technicalSettings, expected.technicalSettings);
  assert.deepEqual(loaded.drawing, expected.drawing);
  assert.deepEqual(loaded.study, expected.study);
});

test('cloud project round-trip preserves existing identifiers', async () => {
  const project = createRepresentativeProject();
  const loaded = await loadCloudProject(serializeProject(project));

  assert.equal(loaded.project.id, 'project-Type_T4-AH');
  assert.deepEqual(loaded.plans.map((plan) => plan.id), ['plan-rdc-001']);
  assert.deepEqual(loaded.octopuses.map((octopus) => octopus.id), ['octopus-cuisine-001']);
  assert.deepEqual(
    loaded.apparatus.map((apparatus) => apparatus.id),
    ['apparatus-prise-double-001', 'apparatus-spot-001'],
  );
  assert.deepEqual(
    loaded.study?.devices.map((device) => device.id),
    ['device-prise-001', 'device-prise-002', 'device-spot-001', 'device-octopus-001'],
  );
  assert.deepEqual(
    loaded.study?.portAssignments?.map((assignment) => assignment.id),
    ['port-assignment-001', 'port-assignment-002'],
  );
});

test('loading the same cloud project repeatedly replaces state without duplicates', async () => {
  const serialized = serializeProject(createRepresentativeProject());
  let currentProject = createEmptyProject();

  for (let index = 0; index < 3; index += 1) {
    currentProject = await loadCloudProject(serialized);
  }

  assert.deepEqual(getCounts(currentProject), {
    apparatus: 2,
    octopuses: 1,
    rooms: 2,
    plans: 1,
    portAssignments: 2,
  });
});

test('cloud project round-trip preserves embedded PNG base64 source strictly', async () => {
  const project = createRepresentativeProject();
  const loaded = await loadCloudProject(serializeProject(project));

  assert.equal(loaded.plans[0]?.source, project.plans[0]?.source);
});

test('invalid cloud project response does not destroy the current project', async () => {
  const before = createRepresentativeProject();
  let currentProject = before;

  try {
    currentProject = await loadCloudProject('{invalid-json');
    assert.fail('Invalid cloud project should not load');
  } catch (error) {
    assert.equal(error instanceof ProjectFileError, true);
  }

  assert.equal(currentProject, before);
  assert.equal(currentProject.project.id, 'project-Type_T4-AH');
});
