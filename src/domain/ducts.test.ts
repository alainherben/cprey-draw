import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateDuctLengthStatus,
  calculateDuctUsedLengthMeters,
  createApparatusChainDuct,
  createDirectPanelDuct,
  createDuct,
  getDuctGeometry,
  getExpectedApparatusType,
  getDuctPathPoints,
} from './ducts';
import { createApparatusInstance } from './apparatus';
import { createElectricalPanel } from './electricalPanel';
import { createOctopus } from './octopus';
import { createOctopusOutputOverride, upsertOctopusOutputOverride } from './octopusOutputs';
import { createEmptyProject } from '../storage/ProjectStorage';
import type { ApparatusCatalogId, CpreyDrawProject, OctopusModelId } from '../types/project';

function nearlyEqual(actual: number | null, expected: number, tolerance = 0.000001) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) <= tolerance, `${actual} !== ${expected}`);
}

test('calculates duct length for a straight line', () => {
  nearlyEqual(calculateDuctUsedLengthMeters([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0.01), 1);
});

test('calculates duct length with one waypoint', () => {
  nearlyEqual(
    calculateDuctUsedLengthMeters([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 0.01),
    2,
  );
});

test('calculates duct length with multiple waypoints', () => {
  const length = calculateDuctUsedLengthMeters(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }],
    0.01,
  );
  nearlyEqual(length, 3);
});

test('calculates remaining length and overrun', () => {
  const remaining = calculateDuctLengthStatus(10.5, 8.2);
  nearlyEqual(remaining.remainingLengthMeters, 2.3);
  assert.equal(remaining.hasOverrun, false);

  const overrun = calculateDuctLengthStatus(7.5, 8.1);
  assert.equal(overrun.hasOverrun, true);
  nearlyEqual(overrun.overrunMeters, 0.6);
});

test('extracts expected apparatus type from octopus output code', () => {
  assert.equal(getExpectedApparatusType('LA1'), 'LA');
  assert.equal(getExpectedApparatusType('LA12'), 'LA');
  assert.equal(getExpectedApparatusType('PR3'), 'PR');
  assert.equal(getExpectedApparatusType('SP1'), 'SP');
  assert.equal(getExpectedApparatusType('HO1'), 'HO');
  assert.equal(getExpectedApparatusType('IN1-1'), 'IN');
  assert.equal(getExpectedApparatusType('VR2'), 'VR');
  assert.equal(getExpectedApparatusType('VMC1'), 'VM');
  assert.equal(getExpectedApparatusType('AL1'), null);
  assert.equal(getExpectedApparatusType('Terre'), null);
});

test('connects only LA outputs to LA apparatus catalog types', () => {
  assert.equal(canConnectToApparatus('kitchen', 10, 'lampe'), true);
  assert.equal(canConnectToApparatus('kitchen', 10, 'spot'), true);
  assert.equal(canConnectToApparatus('kitchen', 10, 'applique'), true);
  assert.equal(canConnectToApparatus('kitchen', 10, 'prise-16a'), false);
});

test('connects only PR outputs to PR apparatus catalog types', () => {
  assert.equal(canConnectToApparatus('kitchen', 5, 'prise-16a'), true);
  assert.equal(canConnectToApparatus('kitchen', 5, 'prise_haute'), true);
  assert.equal(canConnectToApparatus('kitchen', 5, 'prise_double'), true);
  assert.equal(canConnectToApparatus('kitchen', 5, 'prise_double_haute'), true);
  assert.equal(canConnectToApparatus('kitchen', 5, 'spot'), false);
});

test('connects only SP outputs to SP apparatus catalog types', () => {
  assert.equal(canConnectToApparatus('kitchen', 11, 'four'), true);
  assert.equal(canConnectToApparatus('kitchen', 11, 'lave-linge'), true);
  assert.equal(canConnectToApparatus('kitchen', 11, 'pompe-piscine'), true);
  assert.equal(canConnectToApparatus('kitchen', 11, 'lampe'), false);
});

test('connects only IN outputs to IN apparatus catalog types', () => {
  assert.equal(canConnectToApparatus('bath', 13, 'interrupteur-simple'), true);
  assert.equal(canConnectToApparatus('bath', 14, 'interrupteur-double'), true);
  assert.equal(canConnectToApparatus('bath', 13, 'interrupteur-poussoir'), true);
  assert.equal(canConnectToApparatus('bath', 13, 'prise-16a'), false);
});

test('connects only dedicated VM, HO and VR outputs to matching apparatus catalog types', () => {
  assert.equal(canConnectToApparatus('bath', 11, 'vmc'), true);
  assert.equal(canConnectToApparatus('bath', 11, 'lampe'), false);
  assert.equal(canConnectToApparatus('kitchen', 4, 'hotte'), true);
  assert.equal(canConnectToApparatus('kitchen', 4, 'prise-16a'), false);
  assert.equal(canConnectToApparatus('comfort', 12, 'volet-roulant'), true);
  assert.equal(canConnectToApparatus('comfort', 12, 'lampe'), false);
});

test('keeps power supply outputs dedicated to the electrical panel', () => {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const lamp = createApparatusInstance('lampe', { x: 240, y: 100 }, []);
  const electricalPanel = createElectricalPanel({ x: 20, y: 20 });
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    apparatus: [lamp],
    electricalPanel,
  };

  assert.equal(createDuct(project, octopus.id, 2, { type: 'electrical-panel', id: electricalPanel.id }).ok, true);
  assert.equal(createDuct(project, octopus.id, 3, { type: 'electrical-panel', id: electricalPanel.id }).ok, true);
  assert.equal(createDuct(project, octopus.id, 2, { type: 'apparatus', id: lamp.id }).ok, false);
});

test('connects a customized free output using the effective override type', () => {
  const baseOctopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const override = {
    ...createOctopusOutputOverride(baseOctopus, 13, 'LA'),
    code: 'LA4',
    destination: 'Lampe chambre',
    duct: {
      diameterMm: 20 as const,
      adapterColor: 'blue' as const,
      capped: false,
      availableLengthMeters: 10.5,
    },
    linkColor: 'Orange',
  };
  const octopus = upsertOctopusOutputOverride(baseOctopus, override);
  const spot = createApparatusInstance('spot', { x: 240, y: 100 }, []);
  const prise = createApparatusInstance('prise-16a', { x: 260, y: 100 }, [spot]);
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    apparatus: [spot, prise],
  };

  const result = createDuct(project, octopus.id, 13, { type: 'apparatus', id: spot.id });
  const refused = createDuct(project, octopus.id, 13, { type: 'apparatus', id: prise.id });

  assert.equal(result.ok, true);
  assert.equal(refused.ok, false);
  if (!result.ok) {
    return;
  }

  assert.equal(result.duct.specification.outputCode, 'LA4');
  assert.equal(result.duct.specification.destination, 'Lampe chambre');
  assert.equal(result.duct.specification.diameterMm, 20);
  assert.equal(result.duct.specification.adapterColor, 'blue');
  assert.equal(result.duct.specification.capped, false);
  assert.equal(result.duct.specification.availableLengthMeters, 10.5);
  assert.equal(result.duct.specification.linkColor, 'Orange');
});

test('snapshots a customized output and does not reread later override changes', () => {
  const baseOctopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const firstOverride = {
    ...createOctopusOutputOverride(baseOctopus, 13, 'LA'),
    code: 'LA4',
    destination: 'Lampe initiale',
    linkColor: 'Cyan',
  };
  const octopus = upsertOctopusOutputOverride(baseOctopus, firstOverride);
  const spot = createApparatusInstance('spot', { x: 240, y: 100 }, []);
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    apparatus: [spot],
  };
  const result = createDuct(project, octopus.id, 13, { type: 'apparatus', id: spot.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const changedOctopus = upsertOctopusOutputOverride(octopus, {
    ...firstOverride,
    destination: 'Lampe modifiée',
    linkColor: 'Rouge',
  });

  assert.equal(changedOctopus.outputOverrides[0]?.destination, 'Lampe modifiée');
  assert.equal(result.duct.specification.destination, 'Lampe initiale');
  assert.equal(result.duct.specification.linkColor, 'Cyan');
});

function canConnectToApparatus(
  modelId: OctopusModelId,
  outputNumber: number,
  catalogId: ApparatusCatalogId,
): boolean {
  const octopus = createOctopus(modelId, { x: 100, y: 100 }, []);
  const apparatus = createApparatusInstance(catalogId, { x: 240, y: 100 }, []);
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    octopuses: [octopus],
    apparatus: [apparatus],
  };

  return createDuct(project, octopus.id, outputNumber, { type: 'apparatus', id: apparatus.id }).ok;
}

test('duct length changes when source or target moves while waypoints stay fixed', () => {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const apparatus = createApparatusInstance('lampe', { x: 240, y: 100 }, []);
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    octopuses: [octopus],
    apparatus: [apparatus],
  };
  const result = createDuct(project, octopus.id, 10, { type: 'apparatus', id: apparatus.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const duct = { ...result.duct, waypoints: [{ id: 'w1', x: 180, y: 160 }] };
  const initialLength = calculateDuctUsedLengthMeters(
    getDuctPathPoints(duct, project.octopuses, project.apparatus, project.electricalPanel, 0.01),
    0.01,
  );
  const movedTargetProject = {
    ...project,
    apparatus: [{ ...apparatus, x: 320 }],
  };
  const movedTargetLength = calculateDuctUsedLengthMeters(
    getDuctPathPoints(duct, movedTargetProject.octopuses, movedTargetProject.apparatus, undefined, 0.01),
    0.01,
  );
  const movedSourceProject = {
    ...project,
    octopuses: [{ ...octopus, x: 140 }],
  };
  const movedSourceLength = calculateDuctUsedLengthMeters(
    getDuctPathPoints(duct, movedSourceProject.octopuses, movedSourceProject.apparatus, undefined, 0.01),
    0.01,
  );
  const rotatedSourceProject = {
    ...project,
    octopuses: [{ ...octopus, rotation: 90 }],
  };
  const rotatedSourceLength = calculateDuctUsedLengthMeters(
    getDuctPathPoints(duct, rotatedSourceProject.octopuses, rotatedSourceProject.apparatus, undefined, 0.01),
    0.01,
  );

  assert.deepEqual(duct.waypoints, [{ id: 'w1', x: 180, y: 160 }]);
  assert.notEqual(initialLength, movedTargetLength);
  assert.notEqual(initialLength, movedSourceLength);
  assert.notEqual(initialLength, rotatedSourceLength);
});

test('resolves geometry for octopus, apparatus and electrical panel endpoints', () => {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const firstSpot = createApparatusInstance('spot', { x: 240, y: 100 }, []);
  const secondSpot = createApparatusInstance('spot', { x: 300, y: 120 }, [firstSpot]);
  const cooktop = createApparatusInstance('plaque-cuisson', { x: 360, y: 160 }, [firstSpot, secondSpot]);
  const electricalPanel = createElectricalPanel({ x: 20, y: 20 });
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    electricalPanel,
    octopuses: [octopus],
    apparatus: [firstSpot, secondSpot, cooktop],
  };

  const primary = createDuct(project, octopus.id, 10, { type: 'apparatus', id: firstSpot.id });
  assert.equal(primary.ok, true);
  if (!primary.ok) {
    return;
  }
  const chained = createApparatusChainDuct({ ...project, ducts: [primary.duct] }, firstSpot.id, secondSpot.id);
  const direct = createDirectPanelDuct(project, electricalPanel.id, cooktop.id);
  assert.equal(chained.ok, true);
  assert.equal(direct.ok, true);
  if (!chained.ok || !direct.ok) {
    return;
  }

  assert.deepEqual(
    getDuctGeometry(chained.duct, project.octopuses, project.apparatus, electricalPanel, 0.01),
    { start: { x: firstSpot.x, y: firstSpot.y }, end: { x: secondSpot.x, y: secondSpot.y } },
  );
  assert.deepEqual(
    getDuctGeometry(direct.duct, project.octopuses, project.apparatus, electricalPanel, 0.01),
    { start: { x: electricalPanel.x, y: electricalPanel.y }, end: { x: cooktop.x, y: cooktop.y } },
  );
});
