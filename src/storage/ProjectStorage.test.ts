import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../domain/apparatus';
import { createConnection } from '../domain/connections';
import { buildQuadraticDuctGeometry, createDuctControlPoint } from '../domain/ductGeometry';
import { createDirectPanelDuct } from '../domain/ducts';
import { createElectricalPanel } from '../domain/electricalPanel';
import { createDefaultTechnicalSettings } from '../domain/technicalSettings';
import {
  addStudyLevel,
  addStudyRoom,
  assignStudyDeviceToOctopusPort,
  configureStudyPhysicalRepresentation,
  createImportedStudy,
  markStudyDevicesPlaced,
  setManualApparatusLocation,
  setStudyOctopusInstallation,
  setStudyOctopusMounting,
  setStudyOctopusServedRooms,
} from '../domain/importedStudy';
import { createOctopus } from '../domain/octopus';
import { createOctopusOutputOverride, upsertOctopusOutputOverride } from '../domain/octopusOutputs';
import type { CpreyDrawProject } from '../types/project';
import {
  createDefaultProject,
  createEmptyProject,
  createSafeProjectFileName,
  deserializeProject,
  ProjectFileError,
  ProjectStorage,
  serializeProject,
} from './ProjectStorage';

function installMemoryStorage(storage = new Map<string, string>()) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  return storage;
}

test('saves and restores chantier metadata', () => {
  installMemoryStorage();
  const project = {
    ...createEmptyProject(),
    site: {
      name: 'Maison Dupont',
      reference: 'CP-2026-0012',
      quoteReference: 'DEV-4582',
      clientName: 'M. Dupont',
      address: '12 rue des Pins',
      postalCode: '44000',
      city: 'Nantes',
      electrician: 'Élec Atlantique',
      distributor: 'Magasin CPREY',
      projectVersion: 'V3',
    },
    status: 'validated' as const,
    ownership: {
      ownerUserId: 'installer-1',
      ownerOrganizationId: 'org-1',
    },
    access: {
      editableBy: ['installer-1', 'cprey-support-1'],
      viewableBy: ['viewer-1'],
    },
    audit: {
      createdAt: '2026-08-16T10:00:00.000Z',
      createdBy: 'installer-1',
      updatedAt: '2026-08-16T10:00:00.000Z',
      updatedBy: 'cprey-support-1',
    },
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.site.name, 'Maison Dupont');
  assert.equal(restored.site.quoteReference, 'DEV-4582');
  assert.equal(restored.site.city, 'Nantes');
  assert.equal(restored.status, 'validated');
  assert.equal(restored.ownership.ownerUserId, 'installer-1');
  assert.deepEqual(restored.access.editableBy, ['installer-1', 'cprey-support-1']);
  assert.equal(restored.audit.createdBy, 'installer-1');
  assert.equal(restored.audit.updatedBy, 'cprey-support-1');
});

test('saves and restores chantier changes from an initially empty site', () => {
  installMemoryStorage();
  const project = {
    ...createEmptyProject(),
    site: {
      name: 'Test chantier',
      clientName: 'Dupont',
      city: 'Lyon',
    },
    status: 'review' as const,
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.site.name, 'Test chantier');
  assert.equal(restored.site.clientName, 'Dupont');
  assert.equal(restored.site.city, 'Lyon');
  assert.equal(restored.status, 'review');
});

test('migrates legacy projects with default chantier metadata', () => {
  const storage = installMemoryStorage();
  const legacyProject = createEmptyProject();
  const rawProject = {
    ...legacyProject,
    project: {
      ...legacyProject.project,
      updatedAt: '2026-08-15T08:00:00.000Z',
    },
  };
  delete (rawProject as Partial<typeof rawProject>).site;
  delete (rawProject as Partial<typeof rawProject>).origin;
  delete (rawProject as Partial<typeof rawProject>).status;
  delete (rawProject as Partial<typeof rawProject>).ownership;
  delete (rawProject as Partial<typeof rawProject>).access;
  delete (rawProject as Partial<typeof rawProject>).audit;
  storage.set('cprey-draw.current-project.v1', JSON.stringify(rawProject));

  const restored = ProjectStorage.load();

  assert.deepEqual(restored.site, {});
  assert.deepEqual(restored.origin, { type: 'manual' });
  assert.equal(restored.status, 'draft');
  assert.deepEqual(restored.ownership, {});
  assert.deepEqual(restored.access, {});
  assert.equal(restored.audit.createdAt, '2026-08-15T08:00:00.000Z');
  assert.equal(restored.audit.updatedAt, '2026-08-15T08:00:00.000Z');
  assert.equal(restored.study, undefined);
  assert.equal(restored.activeLevelId, undefined);
});

test('keeps chantier metadata added after migrating a legacy project without site', () => {
  const storage = installMemoryStorage();
  const legacyProject = createEmptyProject();
  const rawProject = {
    ...legacyProject,
    project: {
      ...legacyProject.project,
      updatedAt: '2026-08-15T08:00:00.000Z',
    },
  };
  delete (rawProject as Partial<typeof rawProject>).site;
  storage.set('cprey-draw.current-project.v1', JSON.stringify(rawProject));

  const migrated = ProjectStorage.load();
  assert.deepEqual(migrated.site, {});

  ProjectStorage.save({
    ...migrated,
    site: {
      name: 'Test chantier',
      clientName: 'Dupont',
      city: 'Lyon',
    },
  });
  const restored = ProjectStorage.load();

  assert.equal(restored.site.name, 'Test chantier');
  assert.equal(restored.site.clientName, 'Dupont');
  assert.equal(restored.site.city, 'Lyon');
});

test('saves and restores electrical panel without selection state', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
    },
  });

  const project = {
    ...createEmptyProject(),
    electricalPanel: {
      ...createElectricalPanel({ x: 12, y: 34 }),
      rotation: 90,
      locked: true,
      visible: false,
      comments: 'Persisté',
    },
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.electricalPanel?.x, 12);
  assert.equal(restored.electricalPanel?.y, 34);
  assert.equal(restored.electricalPanel?.rotation, 90);
  assert.equal(restored.electricalPanel?.locked, true);
  assert.equal(restored.electricalPanel?.visible, false);
  assert.equal(restored.electricalPanel?.comments, 'Persisté');
  assert.equal('selected' in (restored.electricalPanel ?? {}), false);
});

test('saves and restores drawing display preferences without affecting calibration', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const project = {
    ...createEmptyProject(),
    drawing: {
      ...createEmptyProject().drawing,
      metersPerPixel: 0.01,
      scaleReference: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        realMeters: 1,
      },
      scaleMarkerVisible: false,
      zoomWheelEnabled: false,
      movementLocked: true,
      showDuctLengths: false,
    },
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.drawing.metersPerPixel, 0.01);
  assert.deepEqual(restored.drawing.scaleReference, project.drawing.scaleReference);
  assert.equal(restored.drawing.scaleMarkerVisible, false);
  assert.equal(restored.drawing.zoomWheelEnabled, false);
  assert.equal(restored.drawing.movementLocked, true);
  assert.equal(restored.drawing.showDuctLengths, false);
});

test('normalizes legacy drawing display preferences with coherent defaults', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const legacyProject = createEmptyProject();
  const rawProject = {
    ...legacyProject,
    drawing: {
      viewport: legacyProject.drawing.viewport,
      metersPerPixel: 0.01,
      scaleReference: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        realMeters: 1,
      },
      apparatusGlobalScale: 1,
    },
  };

  storage.set('cprey-draw.current-project.v1', JSON.stringify(rawProject));
  const restored = ProjectStorage.load();

  assert.equal(restored.drawing.scaleMarkerVisible, true);
  assert.equal(restored.drawing.zoomWheelEnabled, true);
  assert.equal(restored.drawing.movementLocked, false);
  assert.equal(restored.drawing.showDuctLengths, true);
});

test('saves and restores apparatus instances without duplicating catalog data', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const project = {
    ...createEmptyProject(),
    apparatus: [
      {
        ...createApparatusInstance('lampe', { x: 56, y: 78 }, []),
        connected: true,
        displayScale: 1.5,
        identifier: 'LA7',
        labelPosition: 'top' as const,
        labelFontSize: 18,
        labelOffsetX: 3,
        labelOffsetY: -2,
        labelLocked: true,
        rotation: 45,
        locked: true,
        comments: 'Salon',
      },
      {
        ...createApparatusInstance('prise_double_haute', { x: 90, y: 120 }, []),
        identifier: 'PR4',
      },
      {
        ...createApparatusInstance('prise_haute', { x: 100, y: 130 }, []),
        identifier: 'PR2',
      },
    ],
  };

  ProjectStorage.save(project);
  const rawProject = storage.values().next().value as string;
  const parsed = JSON.parse(rawProject) as { apparatus: Array<Record<string, unknown>> };
  assert.equal('category' in parsed.apparatus[0], false);
  assert.equal('svg' in parsed.apparatus[0], false);

  const restored = ProjectStorage.load();

  assert.equal(restored.apparatus.length, 3);
  assert.equal(restored.apparatus[0]?.catalogId, 'lampe');
  assert.equal(restored.apparatus[0]?.x, 56);
  assert.equal(restored.apparatus[0]?.connected, true);
  assert.equal(restored.apparatus[0]?.displayScale, 1.5);
  assert.equal(restored.apparatus[0]?.identifier, 'LA7');
  assert.equal(restored.apparatus[0]?.labelPosition, 'top');
  assert.equal(restored.apparatus[0]?.labelFontSize, 18);
  assert.equal(restored.apparatus[0]?.labelOffsetX, 3);
  assert.equal(restored.apparatus[0]?.labelOffsetY, -2);
  assert.equal(restored.apparatus[0]?.labelLocked, true);
  assert.equal(restored.apparatus[0]?.rotation, 45);
  assert.equal(restored.apparatus[0]?.locked, true);
  assert.equal(restored.apparatus[0]?.comments, 'Salon');
  assert.equal(restored.apparatus[0]?.catalogVersion, '2026.08');
  assert.equal(restored.apparatus[0]?.catalogRevision, 1);
  assert.equal(restored.apparatus[1]?.catalogId, 'prise_double_haute');
  assert.equal(restored.apparatus[1]?.identifier, 'PR4');
  assert.equal(restored.apparatus[1]?.catalogRevision, 1);
  assert.equal(restored.apparatus[2]?.catalogId, 'prise_haute');
  assert.equal(restored.apparatus[2]?.identifier, 'PR2');
});

test('saves and restores connections without derived geometry', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const octopus = createOctopus('kitchen', { x: 12, y: 34 }, []);
  const apparatus = createApparatusInstance('lampe', { x: 56, y: 78 }, []);
  const baseProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    apparatus: [apparatus],
  };
  const result = createConnection(baseProject, octopus.id, 10, { type: 'apparatus', id: apparatus.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const project = {
    ...baseProject,
    ducts: [{ ...result.duct, locked: true }],
  };

  ProjectStorage.save(project);
  const rawProject = storage.values().next().value as string;
  const parsed = JSON.parse(rawProject) as { ducts: Array<Record<string, unknown>> };
  assert.equal('start' in parsed.ducts[0], false);
  assert.equal('end' in parsed.ducts[0], false);

  const restored = ProjectStorage.load();
  assert.equal(restored.ducts.length, 1);
  assert.deepEqual(restored.ducts[0]?.source, {
    type: 'octopus-output',
    octopusId: octopus.id,
    outputNumber: 10,
  });
  assert.deepEqual(restored.ducts[0]?.circuitOrigin, restored.ducts[0]?.source);
  assert.deepEqual(restored.ducts[0]?.target, { type: 'apparatus', id: apparatus.id });
  assert.equal(restored.ducts[0]?.specification.linkColor, 'Cyan');
  assert.equal(restored.ducts[0]?.visible, true);
  assert.equal(restored.ducts[0]?.locked, true);
});

test('saves duct editable geometry and rebuilds identical quadratic geometry after reload', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const octopus = createOctopus('kitchen', { x: 12, y: 34 }, []);
  const apparatus = createApparatusInstance('lampe', { x: 180, y: 120 }, []);
  const baseProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    octopuses: [octopus],
    apparatus: [apparatus],
  };
  const result = createConnection(baseProject, octopus.id, 10, { type: 'apparatus', id: apparatus.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const project = {
    ...baseProject,
    ducts: [{
      ...result.duct,
      waypoints: [{ id: 'w1', x: 120, y: 80 }],
      controls: [
        createDuctControlPoint({ x: 60, y: 90 }),
        createDuctControlPoint({ x: 150, y: 100 }),
      ],
    }],
  };
  const beforeGeometry = buildQuadraticDuctGeometry(
    [
      { x: 12, y: 34 },
      project.ducts[0].waypoints[0],
      { x: 180, y: 120 },
    ],
    project.ducts[0].controls,
    0.01,
  );

  ProjectStorage.save(project);
  const rawProject = storage.values().next().value as string;
  const parsed = JSON.parse(rawProject) as { ducts: Array<Record<string, unknown>> };
  assert.equal('pathData' in parsed.ducts[0], false);
  assert.equal('segments' in parsed.ducts[0], false);

  const restored = ProjectStorage.load();
  assert.deepEqual(restored.ducts[0]?.waypoints, [{ id: 'w1', x: 120, y: 80 }]);
  assert.deepEqual(
    restored.ducts[0]?.controls.map(({ x, y }) => ({ x, y })),
    [{ x: 60, y: 90 }, { x: 150, y: 100 }],
  );

  const afterGeometry = buildQuadraticDuctGeometry(
    [
      { x: 12, y: 34 },
      restored.ducts[0]?.waypoints[0] ?? { x: 0, y: 0 },
      { x: 180, y: 120 },
    ],
    restored.ducts[0]?.controls ?? [],
    0.01,
  );
  assert.equal(afterGeometry?.pathData, beforeGeometry?.pathData);
  assert.equal(afterGeometry?.lengthMeters, beforeGeometry?.lengthMeters);
});

test('saves and restores manual direct duct specification', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const electricalPanel = createElectricalPanel({ x: 20, y: 20 });
  const rj45 = createApparatusInstance('prise-rj45', { x: 100, y: 100 }, []);
  const baseProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    electricalPanel,
    apparatus: [rj45],
  };
  const result = createDirectPanelDuct(baseProject, electricalPanel.id, rj45.id);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const project = {
    ...baseProject,
    ducts: [{
      ...result.duct,
      specification: {
        ...result.duct.specification,
        diameterMm: 20 as const,
        availableLengthMeters: 12.5,
        linkColor: 'Bleu',
        contentDescription: 'Câble RJ45',
        conductors: [],
      },
    }],
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.ducts[0]?.specification.diameterMm, 20);
  assert.equal(restored.ducts[0]?.specification.availableLengthMeters, 12.5);
  assert.equal(restored.ducts[0]?.specification.linkColor, 'Bleu');
  assert.equal(restored.ducts[0]?.specification.contentDescription, 'Câble RJ45');
  assert.deepEqual(restored.ducts[0]?.specification.conductors, []);
});

test('migrates legacy connections to ducts with catalog snapshot', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const octopus = createOctopus('kitchen', { x: 12, y: 34 }, []);
  const apparatus = createApparatusInstance('lampe', { x: 56, y: 78 }, []);
  const legacyProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    apparatus: [apparatus],
    connections: [
      {
        id: 'connection-legacy',
        octopusId: octopus.id,
        outputNumber: 10,
        apparatusId: apparatus.id,
        color: 'Cyan',
        visible: true,
        locked: false,
      },
    ],
  };

  storage.set('cprey-draw.current-project.v1', JSON.stringify(legacyProject));
  const restored = ProjectStorage.load();

  assert.equal(restored.ducts.length, 1);
  assert.equal(restored.ducts[0]?.id, 'connection-legacy');
  assert.deepEqual(restored.ducts[0]?.target, { type: 'apparatus', id: apparatus.id });
  assert.equal(restored.ducts[0]?.specification.outputCode, 'LA2');
  assert.equal(restored.ducts[0]?.specification.destination, 'Lampe');
  assert.equal(restored.ducts[0]?.specification.diameterMm, 16);
  assert.equal(restored.ducts[0]?.specification.linkColor, 'Cyan');
});

test('saves and restores octopuses', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const project = {
    ...createEmptyProject(),
    octopuses: [
      {
        ...createOctopus('kitchen', { x: 12, y: 34 }, []),
        rotation: 45,
        locked: true,
        visible: false,
        displayScale: 1.5,
        comments: 'Sous-sol',
      },
    ],
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.octopuses.length, 1);
  assert.equal(restored.octopuses[0]?.modelId, 'kitchen');
  assert.equal(restored.octopuses[0]?.x, 12);
  assert.equal(restored.octopuses[0]?.rotation, 45);
  assert.equal(restored.octopuses[0]?.locked, true);
  assert.equal(restored.octopuses[0]?.visible, false);
  assert.equal(restored.octopuses[0]?.displayScale, 1.5);
  assert.equal(restored.octopuses[0]?.catalogVersion, '2026.08');
  assert.equal(restored.octopuses[0]?.catalogRevision, 1);
  assert.equal(restored.octopuses[0]?.ports.length, 16);
});

test('saves and restores octopus output overrides without duplicating the catalog', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  const baseOctopus = createOctopus('kitchen', { x: 12, y: 34 }, []);
  const octopus = upsertOctopusOutputOverride(baseOctopus, {
    ...createOctopusOutputOverride(baseOctopus, 13, 'LA'),
    code: 'LA4',
    destination: 'Lampe dressing',
    duct: {
      diameterMm: 20,
      adapterColor: 'blue',
      capped: false,
      availableLengthMeters: 12.25,
    },
    linkColor: 'Orange',
    conductors: [
      {
        order: 1,
        quantity: 1,
        function: 'Phase',
        color: 'Rouge',
        sectionMm2: 1.5,
      },
    ],
  });
  const project = {
    ...createEmptyProject(),
    octopuses: [octopus],
  };

  ProjectStorage.save(project);
  const rawProject = storage.values().next().value as string;
  const parsed = JSON.parse(rawProject) as { octopuses: Array<Record<string, unknown>> };
  const rawOverride = (parsed.octopuses[0]?.outputOverrides as Array<Record<string, unknown>>)[0];
  assert.equal(rawOverride.code, 'LA4');
  assert.equal('catalogOutput' in rawOverride, false);

  const restored = ProjectStorage.load();
  const override = restored.octopuses[0]?.outputOverrides[0];

  assert.equal(override?.outputNumber, 13);
  assert.equal(override?.code, 'LA4');
  assert.equal(override?.type, 'LA');
  assert.equal(override?.destination, 'Lampe dressing');
  assert.equal(override?.duct.diameterMm, 20);
  assert.equal(override?.duct.adapterColor, 'blue');
  assert.equal(override?.duct.capped, false);
  assert.equal(override?.duct.availableLengthMeters, 12.25);
  assert.equal(override?.linkColor, 'Orange');
  assert.deepEqual(override?.conductors, [
    {
      order: 1,
      quantity: 1,
      function: 'Phase',
      color: 'Rouge',
      sectionMm2: 1.5,
    },
  ]);
});

test('createDefaultProject returns the official empty DRAW defaults', () => {
  const project = createDefaultProject();

  assert.equal(project.schemaVersion, 1);
  assert.equal(project.project.name, 'Projet CPREY DRAW');
  assert.deepEqual(project.site, {});
  assert.deepEqual(project.origin, { type: 'manual' });
  assert.equal(project.status, 'draft');
  assert.deepEqual(project.ownership, {});
  assert.deepEqual(project.access, {});
  assert.equal(project.drawing.metersPerPixel, null);
  assert.equal(project.drawing.scaleReference, null);
  assert.equal(project.drawing.scaleMarkerVisible, true);
  assert.equal(project.drawing.zoomWheelEnabled, true);
  assert.equal(project.drawing.movementLocked, false);
  assert.equal(project.drawing.showDuctLengths, true);
  assert.equal(project.drawing.apparatusGlobalScale, 1);
  assert.deepEqual(project.plans, []);
  assert.equal(project.electricalPanel, undefined);
  assert.deepEqual(project.octopuses, []);
  assert.deepEqual(project.apparatus, []);
  assert.deepEqual(project.ducts, []);
  assert.deepEqual(project.layers.map((layer) => layer.id), [
    'plan',
    'electrical-panel',
    'direct-ducts',
    'unassigned-apparatus',
  ]);
  assert.equal(project.study, undefined);
  assert.equal(project.activeLevelId, undefined);
});

test('createNew saves and reloads an empty project without previous business data', () => {
  const storage = installMemoryStorage();
  const electricalPanel = createElectricalPanel({ x: 20, y: 20 });
  const octopus = createOctopus('kitchen', { x: 120, y: 100 }, []);
  const apparatus = createApparatusInstance('prise-rj45', { x: 200, y: 160 }, []);
  const duct = createDirectPanelDuct(
    {
      ...createEmptyProject(),
      drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
      electricalPanel,
      apparatus: [apparatus],
    },
    electricalPanel.id,
    apparatus.id,
  );
  assert.equal(duct.ok, true);
  if (!duct.ok) {
    return;
  }

  ProjectStorage.save({
    ...createEmptyProject(),
    project: {
      ...createEmptyProject().project,
      name: 'Ancien projet',
    },
    site: {
      name: 'Chantier à effacer',
      reference: 'REF-001',
      city: 'Nantes',
      comments: 'Métadonnées chantier',
    },
    origin: {
      type: 'configurator',
      sourceApplication: 'smartcprey-configurator',
      sourceVariant: 'LM',
      sourceVersion: '1.8.0',
      selectedScenario: 'MOY',
      cdef: {
        schemaVersion: 1,
        levels: ['0 : RDC'],
        rooms: [{ levelName: '0 : RDC', roomName: 'Cuisine 1' }],
      },
    },
    status: 'design',
    drawing: {
      ...createEmptyProject().drawing,
      metersPerPixel: 0.01,
      scaleReference: {
        start: { x: 0, y: 0 },
        end: { x: 100, y: 0 },
        realMeters: 1,
      },
      scaleMarkerVisible: false,
      zoomWheelEnabled: false,
      movementLocked: true,
      showDuctLengths: false,
    },
    plans: [{
      id: 'plan-old',
      name: 'ancien-plan.png',
      source: 'data:image/png;base64,abc',
      visible: true,
      locked: false,
      opacity: 1,
      rotation: 0,
      mimeType: 'image/png',
      width: 100,
      height: 80,
    }],
    electricalPanel,
    octopuses: [{
      ...octopus,
      importContext: {
        source: 'CDEF',
        importedAt: '2026-08-16T10:00:00.000Z',
      },
    }],
    apparatus: [{
      ...apparatus,
      importContext: {
        source: 'CDEF',
        importedAt: '2026-08-16T10:00:00.000Z',
        levelName: '0 : RDC',
        roomName: 'Cuisine 1',
        metricKey: 'lampes',
      },
    }],
    ducts: [duct.duct],
  });

  const newProject = ProjectStorage.createNew();
  const rawProject = storage.values().next().value as string;
  const restored = ProjectStorage.load();

  assert.equal(rawProject.includes('Ancien projet'), false);
  for (const project of [newProject, restored]) {
    assert.deepEqual(project.plans, []);
    assert.equal(project.electricalPanel, undefined);
    assert.deepEqual(project.octopuses, []);
    assert.deepEqual(project.apparatus, []);
    assert.deepEqual(project.ducts, []);
    assert.deepEqual(project.site, {});
    assert.deepEqual(project.origin, { type: 'manual' });
    assert.deepEqual(project.technicalSettings, createDefaultTechnicalSettings());
    assert.equal(project.status, 'draft');
    assert.equal(project.drawing.metersPerPixel, null);
    assert.equal(project.drawing.scaleReference, null);
    assert.equal(project.drawing.zoomWheelEnabled, true);
    assert.equal(project.drawing.movementLocked, false);
    assert.equal(project.drawing.showDuctLengths, true);
    assert.equal(project.study, undefined);
    assert.equal(project.activeLevelId, undefined);
  }
});

test('saves and restores technical settings', () => {
  installMemoryStorage();
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    technicalSettings: {
      defaultCeilingHeight: 2.65,
      panelCenterHeightFromFloor: 1.45,
      ductConnectionMargin: 0.55,
      crawlSpaceHeight: 0.75,
      roomCeilingHeights: {
        room_a: 2.8,
      },
    },
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.deepEqual(restored.technicalSettings, project.technicalSettings);
});

test('loads legacy project without technical settings and legacy duct without route mode', () => {
  const storage = installMemoryStorage();
  const panel = createElectricalPanel({ x: 0, y: 0 });
  const apparatus = createApparatusInstance('prise-rj45', { x: 100, y: 0 }, []);
  const baseProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    electricalPanel: panel,
    apparatus: [apparatus],
  };
  const result = createDirectPanelDuct(baseProject, panel.id, apparatus.id);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const legacyProject = {
    ...baseProject,
    ducts: [Object.fromEntries(Object.entries(result.duct).filter(([key]) => key !== 'routeMode'))],
  };
  delete (legacyProject as Partial<CpreyDrawProject>).technicalSettings;
  storage.set('cprey-draw.current-project.v1', JSON.stringify(legacyProject));

  const restored = ProjectStorage.load();

  assert.deepEqual(restored.technicalSettings, createDefaultTechnicalSettings());
  assert.equal(restored.ducts[0]?.routeMode, 'standard');
});

test('migrates v1.8.5 panel distance and saves only panel center height', () => {
  const storage = installMemoryStorage();
  const legacyProject = {
    ...createEmptyProject(),
    technicalSettings: {
      defaultCeilingHeight: 2.5,
      panelDistanceFromCeiling: 0.3,
      ductConnectionMargin: 0.5,
      crawlSpaceHeight: 0.6,
      roomCeilingHeights: {},
    },
  };
  storage.set('cprey-draw.current-project.v1', JSON.stringify(legacyProject));

  const restored = ProjectStorage.load();
  assert.equal(restored.technicalSettings.panelCenterHeightFromFloor, 2.2);

  ProjectStorage.save(restored);
  const rawSaved = storage.get('cprey-draw.current-project.v1') ?? '';
  assert.equal(rawSaved.includes('panelCenterHeightFromFloor'), true);
  assert.equal(rawSaved.includes('panelDistanceFromCeiling'), false);
});

test('saves and restores duct route mode', () => {
  installMemoryStorage();
  const panel = createElectricalPanel({ x: 0, y: 0 });
  const apparatus = createApparatusInstance('prise-rj45', { x: 100, y: 0 }, []);
  const baseProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    electricalPanel: panel,
    apparatus: [apparatus],
  };
  const result = createDirectPanelDuct(baseProject, panel.id, apparatus.id);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  ProjectStorage.save({
    ...baseProject,
    ducts: [{ ...result.duct, routeMode: 'crawl-space' }],
  });

  assert.equal(ProjectStorage.load().ducts[0]?.routeMode, 'crawl-space');
});

test('saves and restores imported study and active level', () => {
  installMemoryStorage();
  const apparatus = {
    ...createApparatusInstance('prise-16a', { x: 10, y: 20 }, []),
    identifier: 'PR1',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-26T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Salon',
      roomProfile: 'SALON',
      metricKey: 'prises',
    },
  };
  const study = createImportedStudy([apparatus], []);
  const project = {
    ...createEmptyProject(),
    apparatus: [apparatus],
    study,
    activeLevelId: study?.levels[0].id,
  };

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.activeLevelId, 'level_001');
  assert.equal(restored.study?.levels[0].name, 'RDC');
  assert.equal(restored.study?.levels[0].rooms[0].name, 'Salon');
  assert.equal(restored.study?.devices[0].drawingObjectId, apparatus.id);
  assert.equal(restored.study?.devices[0].status, 'placed');
});

test('saves and restores study physical choices and grouped drawing links', () => {
  installMemoryStorage();
  const first = {
    ...createApparatusInstance('prise-16a', { x: 10, y: 20 }, []),
    identifier: 'PR1',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-27T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Salon',
      roomProfile: 'SALON',
      metricKey: 'prises',
    },
  };
  const second = {
    ...createApparatusInstance('prise-16a', { x: 30, y: 20 }, [first]),
    identifier: 'PR2',
    importContext: first.importContext,
  };
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
    activeLevelId: study.levels[0].id,
  }, ['device_001', 'device_002'], 'prise_double');
  const physicalApparatus = {
    ...createApparatusInstance('prise_double', { x: 80, y: 90 }, []),
    id: 'apparatus-physical',
    studyDeviceIds: ['device_001', 'device_002'],
  };
  const project = markStudyDevicesPlaced({
    ...grouped,
    apparatus: [physicalApparatus],
  }, ['device_001', 'device_002'], physicalApparatus.id);

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.activeLevelId, 'level_001');
  assert.deepEqual(restored.apparatus[0]?.studyDeviceIds, ['device_001', 'device_002']);
  assert.equal(restored.study?.physicalGroups?.[0].drawingCatalogId, 'prise_double');
  assert.equal(restored.study?.devices[0].drawingCatalogId, 'prise_double');
  assert.equal(restored.study?.devices[1].drawingCatalogId, 'prise_double');
  assert.equal(restored.study?.devices[0].drawingObjectId, 'apparatus-physical');
  assert.equal(restored.study?.devices[1].drawingObjectId, 'apparatus-physical');
});

test('saves and restores v2 switch physical choices and groups', () => {
  installMemoryStorage();
  const first = {
    ...createApparatusInstance('interrupteur-simple', { x: 10, y: 20 }, []),
    identifier: 'IN1',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-29T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Salon',
      roomProfile: 'SALON',
      metricKey: 'interrupteurs',
    },
  };
  const second = {
    ...createApparatusInstance('interrupteur-simple', { x: 30, y: 20 }, [first]),
    identifier: 'IN2',
    importContext: first.importContext,
  };
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

  ProjectStorage.save(grouped);
  const restored = ProjectStorage.load();

  assert.equal(restored.study?.physicalGroups?.[0].drawingCatalogId, 'Interrupteur-double-vV');
  assert.deepEqual(restored.study?.physicalGroups?.[0].studyDeviceIds, ['device_001', 'device_002']);
  assert.equal(restored.study?.devices[0].drawingCatalogId, 'Interrupteur-double-vV');
  assert.equal(restored.study?.devices[1].drawingCatalogId, 'Interrupteur-double-vV');
  assert.equal(restored.study?.devices[0].identifier, 'IN1');
  assert.equal(restored.study?.devices[1].identifier, 'IN2');
});

test('saves and restores study octopus installation served rooms and port assignments', () => {
  installMemoryStorage();
  const la1 = {
    ...createApparatusInstance('spot', { x: 10, y: 20 }, []),
    identifier: 'LA1',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-27T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Salon',
      roomProfile: 'SALON',
      metricKey: 'lampes',
    },
  };
  const pr1 = {
    ...createApparatusInstance('prise-16a', { x: 30, y: 20 }, [la1]),
    identifier: 'PR1',
    importContext: la1.importContext,
  };
  const dressing = {
    ...createApparatusInstance('lampe', { x: 50, y: 20 }, [la1, pr1]),
    identifier: 'LA99',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-27T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Dressing',
      roomProfile: 'DRESSING',
      metricKey: 'lampes',
    },
  };
  const octopus = createOctopus('comfort', { x: 80, y: 90 }, []);
  const study = createImportedStudy([la1, pr1, dressing], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  const salonId = study.levels[0].rooms.find((room) => room.name === 'Salon')?.id ?? '';
  const dressingId = study.levels[0].rooms.find((room) => room.name === 'Dressing')?.id ?? '';
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    apparatus: [la1, pr1, dressing],
    octopuses: [octopus],
    study,
    activeLevelId: study.levels[0].id,
  };
  project = setStudyOctopusInstallation(project, octopus.id, study.levels[0].id, dressingId);
  project = setStudyOctopusServedRooms(project, octopus.id, [salonId]);
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 1, 'device_001');
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 5, 'device_002');

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored.study?.octopuses?.[0].octopusId, octopus.id);
  assert.equal(restored.study?.octopuses?.[0].installationRoomId, dressingId);
  assert.deepEqual(restored.study?.octopuses?.[0].servedRoomIds, [salonId]);
  assert.deepEqual(
    restored.study?.portAssignments?.map((assignment) => ({
      octopusId: assignment.octopusId,
      portNumber: assignment.portNumber,
      studyDeviceId: assignment.studyDeviceId,
      source: assignment.source,
    })),
    [
      { octopusId: octopus.id, portNumber: 1, studyDeviceId: 'device_001', source: 'manual' },
      { octopusId: octopus.id, portNumber: 5, studyDeviceId: 'device_002', source: 'manual' },
    ],
  );
});

test('saves and restores manual levels rooms active level and apparatus location', () => {
  installMemoryStorage();
  let project = addStudyLevel(createEmptyProject(), 'RDC');
  project = addStudyRoom(project, 'level_001', 'Cuisine');
  const apparatus = createApparatusInstance('prise-16a', { x: 10, y: 20 }, []);
  project = {
    ...project,
    activeLevelId: 'level_001',
    apparatus: [apparatus],
  };
  project = setManualApparatusLocation(project, apparatus.id, 'level_001', 'room_001');

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(restored?.study?.levels[0].id, 'level_001');
  assert.equal(restored?.study?.levels[0].rooms[0].id, 'room_001');
  assert.equal(restored?.activeLevelId, 'level_001');
  assert.equal(restored?.apparatus[0].levelId, 'level_001');
  assert.equal(restored?.apparatus[0].roomId, 'room_001');
});

test('creates safe cprey draw project filenames', () => {
  assert.equal(createSafeProjectFileName('Maison Dupont'), 'Maison-Dupont.cpreydraw');
  assert.equal(createSafeProjectFileName('Maison/Herben: RDC.json'), 'Maison-Herben-RDC.cpreydraw');
  assert.equal(createSafeProjectFileName('   '), 'projet-cprey-draw.cpreydraw');
});

test('serializes and deserializes a project file with UTF-8 names', () => {
  let project = addStudyLevel(createEmptyProject(), 'Étage');
  project = addStudyRoom(project, 'level_001', 'Séjour');
  project = addStudyRoom(project, 'level_001', 'Entrée');
  project = {
    ...project,
    project: { ...project.project, name: 'Maison Élodie' },
  };

  const restored = deserializeProject(serializeProject(project));

  assert.equal(restored.project.name, 'Maison Élodie');
  assert.equal(restored.study?.levels[0].name, 'Étage');
  assert.equal(restored.study?.levels[0].rooms[0].name, 'Séjour');
  assert.equal(restored.study?.levels[0].rooms[1].name, 'Entrée');
});

test('rejects corrupted and invalid project files with explicit errors', () => {
  assert.throws(
    () => deserializeProject('{ "schemaVersion":'),
    (error) => error instanceof ProjectFileError && error.code === 'invalid-json',
  );
  assert.throws(
    () => deserializeProject('{ "hello": "world" }'),
    (error) => error instanceof ProjectFileError && error.code === 'invalid-project',
  );
  assert.throws(
    () => deserializeProject(JSON.stringify({ ...createEmptyProject(), schemaVersion: 999 })),
    (error) => error instanceof ProjectFileError && error.code === 'unsupported-version',
  );
});

test('project file round-trip preserves plan scale viewport panel ducts and manual locations', () => {
  const electricalPanel = createElectricalPanel({ x: 20, y: 30 });
  const apparatus = createApparatusInstance('plaque-cuisson', { x: 120, y: 160 }, []);
  let project = addStudyRoom(addStudyLevel(createEmptyProject(), 'RDC'), 'level_001', 'Cuisine');
  project = {
    ...project,
    drawing: {
      ...project.drawing,
      viewport: { x: 12, y: -8, scale: 1.75 },
      metersPerPixel: 0.02,
      scaleReference: {
        start: { x: 0, y: 0 },
        end: { x: 150, y: 0 },
        realMeters: 3,
      },
    },
    plans: [{
      id: 'plan_001',
      name: 'Plan RDC.png',
      source: 'data:image/png;base64,ZmFrZS1wbGFu',
      visible: false,
      locked: true,
      opacity: 0.42,
      rotation: 90,
      mimeType: 'image/png',
      width: 1024,
      height: 768,
      importedAt: '2026-08-31T10:00:00.000Z',
    }],
    electricalPanel: {
      ...electricalPanel,
      x: 20,
      y: 30,
      rotation: 15,
      rows: 4,
      reserveModules: 8,
    },
    apparatus: [apparatus],
    activeLevelId: 'level_001',
  };
  project = setManualApparatusLocation(project, apparatus.id, 'level_001', 'room_001');
  const duct = createDirectPanelDuct(project, electricalPanel.id, apparatus.id);
  if (!duct.ok) {
    assert.fail(duct.reason);
  }
  project = { ...project, ducts: [duct.duct] };

  const restored = deserializeProject(serializeProject(project));

  assert.equal(restored.plans[0].source, 'data:image/png;base64,ZmFrZS1wbGFu');
  assert.equal(restored.plans[0].visible, false);
  assert.equal(restored.plans[0].locked, true);
  assert.equal(restored.plans[0].opacity, 0.42);
  assert.equal(restored.plans[0].rotation, 90);
  assert.equal(restored.drawing.viewport.scale, 1.75);
  assert.equal(restored.drawing.metersPerPixel, 0.02);
  assert.equal(restored.drawing.scaleReference?.realMeters, 3);
  assert.equal(restored.electricalPanel?.x, 20);
  assert.equal(restored.electricalPanel?.rows, 4);
  assert.equal(restored.electricalPanel?.reserveModules, 8);
  assert.equal(restored.apparatus[0].levelId, 'level_001');
  assert.equal(restored.apparatus[0].roomId, 'room_001');
  assert.equal(restored.ducts[0].id, duct.duct.id);
});

test('project file round-trip preserves study groups octopuses port assignments and ids', () => {
  const pr1 = {
    ...createApparatusInstance('prise-16a', { x: 10, y: 20 }, []),
    identifier: 'PR1',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-31T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Cuisine',
      roomProfile: 'CUISINE',
      metricKey: 'prises',
    },
  };
  const pr2 = {
    ...createApparatusInstance('prise-16a', { x: 30, y: 20 }, [pr1]),
    identifier: 'PR2',
    importContext: pr1.importContext,
  };
  const sp1 = {
    ...createApparatusInstance('prise-16a', { x: 50, y: 20 }, [pr1, pr2]),
    identifier: 'SP1',
    importContext: {
      ...pr1.importContext,
      roomName: 'Salon',
      roomProfile: 'SALON',
      metricKey: 'prises_spec',
    },
  };
  const manual = createApparatusInstance('prise-rj45', { x: 70, y: 20 }, [pr1, pr2, sp1]);
  const octopus = createOctopus('kitchen', { x: 100, y: 120 }, []);
  const study = createImportedStudy([pr1, pr2, sp1], [octopus]);
  if (!study) {
    assert.fail('Study should be created');
  }
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    apparatus: [manual],
    octopuses: [octopus],
    study: {
      ...study,
      devices: study.devices.map((device) => ({ ...device, drawingObjectId: undefined, status: 'unplaced' as const })),
    },
    activeLevelId: study.levels[0].id,
  };
  const cuisineId = study.levels[0].rooms.find((room) => room.name === 'Cuisine')?.id ?? '';
  project = addStudyRoom(project, study.levels[0].id, 'Cellier');
  project = configureStudyPhysicalRepresentation(project, ['device_001', 'device_002'], 'prise_double');
  const placedGroup = createApparatusInstance('prise_double', { x: 15, y: 25 }, [manual]);
  project = {
    ...project,
    apparatus: [
      ...project.apparatus,
      {
        ...placedGroup,
        studyDeviceIds: ['device_001', 'device_002'],
      },
    ],
  };
  project = markStudyDevicesPlaced(project, ['device_001', 'device_002'], placedGroup.id);
  project = setStudyOctopusInstallation(project, octopus.id, study.levels[0].id, 'room_003');
  project = setStudyOctopusServedRooms(project, octopus.id, [cuisineId]);
  project = setStudyOctopusMounting(project, octopus.id, 'wall', 1.8);
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 5, 'device_001');
  project = assignStudyDeviceToOctopusPort(project, octopus.id, 6, 'device_002');
  project = setManualApparatusLocation(project, manual.id, study.levels[0].id, cuisineId);

  const restored = deserializeProject(serializeProject(project));

  assert.equal(restored.activeLevelId, study.levels[0].id);
  assert.equal(restored.study?.levels[0].id, study.levels[0].id);
  assert.equal(restored.study?.levels[0].rooms.find((room) => room.name === 'Cuisine')?.id, cuisineId);
  assert.equal(restored.study?.devices.find((device) => device.id === 'device_001')?.physicalGroupId, 'physical_group_001');
  assert.equal(restored.study?.devices.find((device) => device.id === 'device_002')?.physicalGroupId, 'physical_group_001');
  assert.equal(restored.study?.physicalGroups?.[0].drawingCatalogId, 'prise_double');
  assert.equal(restored.study?.physicalGroups?.[0].drawingObjectId, placedGroup.id);
  assert.deepEqual(restored.apparatus.find((item) => item.id === placedGroup.id)?.studyDeviceIds, ['device_001', 'device_002']);
  assert.equal(restored.study?.octopuses?.[0].installationRoomId, 'room_003');
  assert.deepEqual(restored.study?.octopuses?.[0].servedRoomIds, [cuisineId]);
  assert.equal(restored.study?.octopuses?.[0].installationMode, 'wall');
  assert.equal(restored.study?.octopuses?.[0].installationHeightM, 1.8);
  assert.deepEqual(
    restored.study?.portAssignments?.map((assignment) => [assignment.studyDeviceId, assignment.portNumber]),
    [['device_001', 5], ['device_002', 6]],
  );
  assert.equal(restored.apparatus.find((item) => item.id === manual.id)?.roomId, cuisineId);
});

test('normalizes invalid activeLevelId from a project file to the first available level', () => {
  const project = addStudyLevel(createEmptyProject(), 'RDC');
  const restored = deserializeProject(serializeProject({
    ...project,
    activeLevelId: 'missing_level',
  }));

  assert.equal(restored.activeLevelId, 'level_001');
});

test('autosave round-trip preserves octopus wall mounting', () => {
  const storage = installMemoryStorage();
  const octopus = createOctopus('kitchen', { x: 10, y: 20 }, []);
  const project = setStudyOctopusMounting(
    { ...createEmptyProject(), octopuses: [octopus] },
    octopus.id,
    'wall',
    1.8,
  );

  ProjectStorage.save(project);
  const restored = ProjectStorage.load();

  assert.equal(storage.size, 1);
  assert.equal(restored.study?.octopuses?.[0].installationMode, 'wall');
  assert.equal(restored.study?.octopuses?.[0].installationHeightM, 1.8);
});

test('legacy study octopuses without mounting behave as standard after project file load', () => {
  const octopus = createOctopus('comfort', { x: 10, y: 20 }, []);
  const rawProject = serializeProject({
    ...createEmptyProject(),
    octopuses: [octopus],
    study: {
      levels: [],
      devices: [],
      octopuses: [{ octopusId: octopus.id, servedRoomIds: [] }],
    },
  });

  const restored = deserializeProject(rawProject);

  assert.equal(restored.study?.octopuses?.[0].installationMode, undefined);
  assert.equal(restored.study?.octopuses?.[0].installationHeightM, undefined);
});

test('invalid octopus wall mounting from a project file is normalized to standard', () => {
  const octopus = createOctopus('comfort', { x: 10, y: 20 }, []);
  const rawProject = JSON.stringify({
    ...createEmptyProject(),
    octopuses: [octopus],
    study: {
      levels: [],
      devices: [],
      octopuses: [{ octopusId: octopus.id, servedRoomIds: [], installationMode: 'wall', installationHeightM: -1 }],
    },
  });

  const restored = deserializeProject(rawProject);

  assert.equal(restored.study?.octopuses?.[0].installationMode, undefined);
  assert.equal(restored.study?.octopuses?.[0].installationHeightM, undefined);
});
