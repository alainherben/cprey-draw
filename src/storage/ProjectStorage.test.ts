import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../domain/apparatus';
import { createConnection } from '../domain/connections';
import { buildQuadraticDuctGeometry, createDuctControlPoint } from '../domain/ductGeometry';
import { createDirectPanelDuct } from '../domain/ducts';
import { createElectricalPanel } from '../domain/electricalPanel';
import { createOctopus } from '../domain/octopus';
import { createOctopusOutputOverride, upsertOctopusOutputOverride } from '../domain/octopusOutputs';
import { createEmptyProject, ProjectStorage } from './ProjectStorage';

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
