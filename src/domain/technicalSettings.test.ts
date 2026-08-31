import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from './apparatus';
import { createDirectPanelDuct } from './ducts';
import { createElectricalPanel } from './electricalPanel';
import { createImportedStudy } from './importedStudy';
import { createOctopus } from './octopus';
import {
  calculateDuctLengthBreakdown,
  createDefaultTechnicalSettings,
  getDuctRouteMode,
  getRoomCeilingHeight,
  normalizeTechnicalSettings,
} from './technicalSettings';
import { buildProjectNomenclature } from './bom';
import { createEmptyProject } from '../storage/ProjectStorage';
import type { CpreyDrawProject, Duct } from '../types/project';

function nearlyEqual(actual: number | null, expected: number, tolerance = 0.000001) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual ?? 0) - expected) <= tolerance, `${actual} !== ${expected}`);
}

test('technical settings defaults and legacy normalization are stable', () => {
  assert.deepEqual(createDefaultTechnicalSettings(), {
    defaultCeilingHeight: 2.5,
    panelCenterHeightFromFloor: 1.3,
    ductConnectionMargin: 0.5,
    crawlSpaceHeight: 0.6,
    roomCeilingHeights: {},
  });

  assert.deepEqual(normalizeTechnicalSettings(undefined), createDefaultTechnicalSettings());
  assert.deepEqual(normalizeTechnicalSettings({
    defaultCeilingHeight: 2.7,
    panelCenterHeightFromFloor: 1.4,
    ductConnectionMargin: 0.6,
    crawlSpaceHeight: 0.8,
    roomCeilingHeights: { room_001: 2.9 },
  }), {
    defaultCeilingHeight: 2.7,
    panelCenterHeightFromFloor: 1.4,
    ductConnectionMargin: 0.6,
    crawlSpaceHeight: 0.8,
    roomCeilingHeights: { room_001: 2.9 },
  });
});

test('legacy panel distance is migrated to panel center height without overriding explicit center height', () => {
  assert.equal(normalizeTechnicalSettings({
    defaultCeilingHeight: 2.5,
    panelDistanceFromCeiling: 0.3,
  }).panelCenterHeightFromFloor, 2.2);
  assert.equal(normalizeTechnicalSettings({
    defaultCeilingHeight: 2.5,
    panelCenterHeightFromFloor: 1.3,
    panelDistanceFromCeiling: 0.3,
  }).panelCenterHeightFromFloor, 1.3);
});

test('room ceiling heights use room ids and fall back to default without requiring an imported study', () => {
  const project = {
    ...createEmptyProject(),
    technicalSettings: {
      ...createDefaultTechnicalSettings(),
      defaultCeilingHeight: 2.5,
      roomCeilingHeights: {
        room_001: 2.7,
        room_002: 2.3,
      },
    },
  };

  nearlyEqual(getRoomCeilingHeight(project, undefined), 2.5);
  nearlyEqual(getRoomCeilingHeight(project, 'unknown'), 2.5);
  nearlyEqual(getRoomCeilingHeight(project, 'room_001'), 2.7);
  nearlyEqual(getRoomCeilingHeight(project, 'room_002'), 2.3);
});

test('apparatus vertical adjustment uses catalog height and study room id', () => {
  const salonOutlet = {
    ...createApparatusInstance('prise-16a', { x: 100, y: 0 }, []),
    id: 'salon-outlet',
    importContext: {
      source: 'CDEF' as const,
      importedAt: '2026-08-29T10:00:00.000Z',
      levelName: '0 : RDC',
      roomName: 'Salon',
    },
  };
  const kitchenOutlet = {
    ...createApparatusInstance('prise-16a', { x: 100, y: 0 }, [salonOutlet]),
    id: 'kitchen-outlet',
    importContext: {
      ...salonOutlet.importContext,
      roomName: 'Cuisine',
    },
  };
  const study = createImportedStudy([salonOutlet, kitchenOutlet], []);
  assert.ok(study);

  const roomByName = new Map(study.levels.flatMap((level) => level.rooms.map((room) => [room.name, room.id])));
  const project = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    technicalSettings: {
      ...createDefaultTechnicalSettings(),
      defaultCeilingHeight: 2.5,
      roomCeilingHeights: {
        [roomByName.get('Cuisine') as string]: 2.7,
      },
    },
    apparatus: [salonOutlet, kitchenOutlet],
    study,
  };
  const salonDuct = createDuctToApparatus(project, salonOutlet.id);
  const kitchenDuct = createDuctToApparatus(project, kitchenOutlet.id);

  nearlyEqual(calculateDuctLengthBreakdown(project, salonDuct).verticalAdjustment, 2.2);
  nearlyEqual(calculateDuctLengthBreakdown(project, kitchenDuct).verticalAdjustment, 2.4);
  assert.notEqual(
    calculateDuctLengthBreakdown(project, salonDuct).verticalAdjustment,
    calculateDuctLengthBreakdown(project, kitchenDuct).verticalAdjustment,
  );
});

test('ceiling-referenced apparatus does not create a false descent and unknown room uses default ceiling', () => {
  const spot = createApparatusInstance('spot', { x: 100, y: 0 }, []);
  const outlet = createApparatusInstance('prise-16a', { x: 120, y: 0 }, [spot]);
  const project = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    technicalSettings: { ...createDefaultTechnicalSettings(), defaultCeilingHeight: 2.8 },
    apparatus: [spot, outlet],
  };

  nearlyEqual(calculateDuctLengthBreakdown(project, createDuctToApparatus(project, spot.id)).verticalAdjustment, 0);
  nearlyEqual(calculateDuctLengthBreakdown(project, createDuctToApparatus(project, outlet.id)).verticalAdjustment, 2.5);
});

test('standard direct panel duct uses ceiling minus panel center and one connection margin', () => {
  const panel = createElectricalPanel({ x: 0, y: 0 });
  const spot = createApparatusInstance('spot', { x: 100, y: 0 }, []);
  const project = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    technicalSettings: {
      ...createDefaultTechnicalSettings(),
      defaultCeilingHeight: 2.5,
      panelCenterHeightFromFloor: 1.3,
      ductConnectionMargin: 0.5,
      crawlSpaceHeight: 0.6,
    },
    electricalPanel: panel,
    apparatus: [spot],
  };
  const duct = createPanelToApparatusDuct(panel.id, spot.id);

  const standardBreakdown = calculateDuctLengthBreakdown(project, duct);
  nearlyEqual(standardBreakdown.geometricLength, 1);
  nearlyEqual(standardBreakdown.startVerticalAdjustment, 1.2);
  nearlyEqual(standardBreakdown.endVerticalAdjustment, 0);
  nearlyEqual(standardBreakdown.verticalAdjustment, 1.2);
  nearlyEqual(standardBreakdown.connectionMargin, 0.5);
  nearlyEqual(standardBreakdown.crawlSpaceAdjustment, 0);
  nearlyEqual(standardBreakdown.total, 2.7);
  nearlyEqual(
    standardBreakdown.startVerticalAdjustment + standardBreakdown.connectionMargin,
    1.7,
  );

  const routeModeAbsent: Duct = { ...duct, routeMode: undefined };
  nearlyEqual(calculateDuctLengthBreakdown(project, routeModeAbsent).startVerticalAdjustment, 1.2);

  const higherPanel = {
    ...project,
    technicalSettings: { ...project.technicalSettings, panelCenterHeightFromFloor: 1.4 },
  };
  nearlyEqual(calculateDuctLengthBreakdown(higherPanel, duct).startVerticalAdjustment, 1.1);
});

test('crawl-space direct panel duct uses panel center from floor and counts crawl height once', () => {
  const panel = createElectricalPanel({ x: 0, y: 0 });
  const cooktop = createApparatusInstance('plaque-cuisson', { x: 100, y: 0 }, []);
  const project = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    technicalSettings: {
      ...createDefaultTechnicalSettings(),
      defaultCeilingHeight: 2.5,
      panelCenterHeightFromFloor: 1.3,
      ductConnectionMargin: 0.5,
      crawlSpaceHeight: 0.6,
    },
    electricalPanel: panel,
    apparatus: [cooktop],
  };
  const result = createDirectPanelDuct(project, panel.id, cooktop.id);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const crawlSpaceDuct: Duct = { ...result.duct, routeMode: 'crawl-space' };
  const crawlSpaceBreakdown = calculateDuctLengthBreakdown(project, crawlSpaceDuct);
  nearlyEqual(crawlSpaceBreakdown.startVerticalAdjustment, 1.3);
  nearlyEqual(crawlSpaceBreakdown.endVerticalAdjustment, 0.3);
  nearlyEqual(crawlSpaceBreakdown.crawlSpaceAdjustment, 1.2);
  nearlyEqual(crawlSpaceBreakdown.startVerticalAdjustment + crawlSpaceBreakdown.crawlSpaceAdjustment, 2.5);
  nearlyEqual(
    crawlSpaceBreakdown.startVerticalAdjustment +
      crawlSpaceBreakdown.crawlSpaceAdjustment +
      crawlSpaceBreakdown.connectionMargin,
    3,
  );
  nearlyEqual(crawlSpaceBreakdown.total, 4.3);

  const higherCrawlSpace = {
    ...project,
    technicalSettings: { ...project.technicalSettings, crawlSpaceHeight: 0.8 },
  };
  nearlyEqual(calculateDuctLengthBreakdown(higherCrawlSpace, crawlSpaceDuct).crawlSpaceAdjustment, 1.6);

  const higherPanel = {
    ...project,
    technicalSettings: { ...project.technicalSettings, panelCenterHeightFromFloor: 1.4 },
  };
  nearlyEqual(calculateDuctLengthBreakdown(higherPanel, crawlSpaceDuct).startVerticalAdjustment, 1.4);
});

test('pieuvre to panel keeps octopus correction at ceiling and applies panel standard correction plus margin', () => {
  const octopus = createOctopus('kitchen', { x: 0, y: 0 }, []);
  const panel = createElectricalPanel({ x: 100, y: 0 });
  const project = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    technicalSettings: {
      ...createDefaultTechnicalSettings(),
      defaultCeilingHeight: 2.5,
      panelCenterHeightFromFloor: 1.3,
      ductConnectionMargin: 0.5,
    },
    electricalPanel: panel,
    octopuses: [octopus],
  };
  const duct: Duct = {
    ...createBaseDuct(),
    source: { type: 'octopus-output', octopusId: octopus.id, outputNumber: 1 },
    target: { type: 'electrical-panel', id: panel.id },
    specification: {
      ...createBaseDuct().specification,
      outputCode: 'AL1',
      destination: 'Alimentation tableau',
    },
  };

  const breakdown = calculateDuctLengthBreakdown(project, duct);

  nearlyEqual(breakdown.startVerticalAdjustment, 0);
  nearlyEqual(breakdown.endVerticalAdjustment, 1.2);
  nearlyEqual(breakdown.verticalAdjustment + breakdown.connectionMargin, 1.7);
});

test('route mode defaults to standard for legacy ducts', () => {
  assert.equal(getDuctRouteMode({ routeMode: undefined } as Duct), 'standard');
  assert.equal(getDuctRouteMode({ routeMode: 'crawl-space' } as Duct), 'crawl-space');
});

test('breakdown total is the sum consumed by nomenclature', () => {
  const panel = createElectricalPanel({ x: 0, y: 0 });
  const outlet = createApparatusInstance('prise-rj45', { x: 100, y: 0 }, []);
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    electricalPanel: panel,
    apparatus: [outlet],
  };
  const result = createDirectPanelDuct(project, panel.id, outlet.id);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }
  const duct = { ...result.duct, routeMode: 'crawl-space' as const };
  const projectWithDuct = { ...project, ducts: [duct] };
  const breakdown = calculateDuctLengthBreakdown(projectWithDuct, duct);

  nearlyEqual(
    breakdown.total,
    (breakdown.geometricLength ?? 0) +
      breakdown.verticalAdjustment +
      breakdown.connectionMargin +
      breakdown.crawlSpaceAdjustment,
  );
  nearlyEqual(buildProjectNomenclature(projectWithDuct).ducts.items[0]?.usedLengthMeters ?? null, breakdown.total ?? 0);
});

function createDuctToApparatus(project: CpreyDrawProject, apparatusId: string): Duct {
  const apparatus = project.apparatus.find((candidate) => candidate.id === apparatusId);
  assert.ok(apparatus);

  return {
    id: `duct-${apparatusId}`,
    source: { type: 'octopus-output', octopusId: 'octopus-1', outputNumber: 1 },
    target: { type: 'apparatus', id: apparatusId },
    circuitOrigin: { type: 'octopus-output', octopusId: 'octopus-1', outputNumber: 1 },
    routeMode: 'standard',
    visible: true,
    locked: false,
    waypoints: [],
    controls: [],
    specification: {
      outputCode: 'PR1',
      destination: apparatus.name,
      diameterMm: 20,
      adapterColor: 'blue',
      capped: false,
      availableLengthMeters: 0,
      linkColor: 'Noir',
      conductors: [],
    },
    catalogVersion: 'test',
    catalogRevision: 1,
  };
}

function createPanelToApparatusDuct(panelId: string, apparatusId: string): Duct {
  return {
    ...createBaseDuct(),
    source: { type: 'electrical-panel', id: panelId },
    target: { type: 'apparatus', id: apparatusId },
    circuitOrigin: { type: 'electrical-panel', id: panelId },
  };
}

function createBaseDuct(): Duct {
  return {
    id: 'duct-test',
    source: { type: 'octopus-output', octopusId: 'octopus-1', outputNumber: 1 },
    target: { type: 'apparatus', id: 'apparatus-1' },
    circuitOrigin: { type: 'octopus-output', octopusId: 'octopus-1', outputNumber: 1 },
    routeMode: 'standard',
    visible: true,
    locked: false,
    waypoints: [],
    controls: [],
    specification: {
      outputCode: 'PR1',
      destination: 'Test',
      diameterMm: 20,
      adapterColor: 'blue',
      capped: false,
      availableLengthMeters: 0,
      linkColor: 'Noir',
      conductors: [],
    },
    catalogVersion: 'test',
    catalogRevision: 1,
  };
}
