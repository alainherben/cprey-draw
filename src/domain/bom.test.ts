import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from './apparatus';
import { buildProjectNomenclature } from './bom';
import { createApparatusChainDuct, createDirectPanelDuct, createDuct } from './ducts';
import { createElectricalPanel } from './electricalPanel';
import { createOctopus } from './octopus';
import { createOctopusOutputOverride, upsertOctopusOutputOverride } from './octopusOutputs';
import { createEmptyProject } from '../storage/ProjectStorage';
import type { CpreyDrawProject, Duct } from '../types/project';

function nearlyEqual(actual: number, expected: number, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} !== ${expected}`);
}

function createBomProject(): CpreyDrawProject {
  const kitchenBase = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const kitchen = upsertOctopusOutputOverride(kitchenBase, {
    ...createOctopusOutputOverride(kitchenBase, 13, 'LA'),
    code: 'LA4',
    destination: 'Lampe dressing',
    duct: {
      diameterMm: 20,
      adapterColor: 'blue',
      capped: false,
      availableLengthMeters: 10.5,
    },
    linkColor: 'Orange',
  });
  const bath = createOctopus('bath', { x: 300, y: 100 }, [kitchen]);
  const firstSpot = createApparatusInstance('spot', { x: 150, y: 100 }, []);
  const secondSpot = createApparatusInstance('spot', { x: 170, y: 100 }, [firstSpot]);
  const outlet = createApparatusInstance('prise-16a', { x: 130, y: 100 }, [firstSpot, secondSpot]);
  const cooktop = createApparatusInstance('plaque-cuisson', { x: 120, y: 200 }, [firstSpot, secondSpot, outlet]);
  const rj45 = createApparatusInstance('prise-rj45', { x: 140, y: 200 }, [firstSpot, secondSpot, outlet, cooktop]);
  const bathLamp = createApparatusInstance('lampe', { x: 360, y: 100 }, [firstSpot, secondSpot, outlet, cooktop, rj45]);
  const unconnectedAppliance = createApparatusInstance('applique', { x: 500, y: 500 }, [firstSpot, secondSpot, outlet, cooktop, rj45, bathLamp]);
  const electricalPanel = createElectricalPanel({ x: 100, y: 200 });
  const baseProject: CpreyDrawProject = {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
    electricalPanel,
    octopuses: [kitchen, bath],
    apparatus: [firstSpot, secondSpot, outlet, cooktop, rj45, bathLamp, unconnectedAppliance],
  };

  const spotDuct = mustCreateDuct(createDuct(baseProject, kitchen.id, 13, { type: 'apparatus', id: firstSpot.id }));
  const chainedDuct = mustCreateDuct(createApparatusChainDuct({ ...baseProject, ducts: [spotDuct] }, firstSpot.id, secondSpot.id));
  const outletDuct = mustCreateDuct(createDuct(baseProject, kitchen.id, 5, { type: 'apparatus', id: outlet.id }));
  const bathDuct = mustCreateDuct(createDuct(baseProject, bath.id, 12, { type: 'apparatus', id: bathLamp.id }));
  const cooktopDuct = mustCreateDuct(createDirectPanelDuct(baseProject, electricalPanel.id, cooktop.id));
  const rj45Duct = mustCreateDuct(createDirectPanelDuct(baseProject, electricalPanel.id, rj45.id));

  return {
    ...baseProject,
    layers: baseProject.layers.map((layer) => ({ ...layer, visible: false })),
    octopuses: baseProject.octopuses.map((octopus) => ({ ...octopus, visible: false })),
    apparatus: baseProject.apparatus.map((apparatus) => ({ ...apparatus, visible: false })),
    ducts: [
      spotDuct,
      chainedDuct,
      {
        ...outletDuct,
        specification: { ...outletDuct.specification, availableLengthMeters: 1 },
        controls: outletDuct.controls.map((control) => ({ ...control, y: control.y + 800 })),
      },
      bathDuct,
      cooktopDuct,
      rj45Duct,
    ],
  };
}

function mustCreateDuct(result: ReturnType<typeof createDuct> | ReturnType<typeof createApparatusChainDuct> | ReturnType<typeof createDirectPanelDuct>): Duct {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error('Création de gaine impossible');
  }

  return result.duct;
}

test('groups octopuses, apparatus by catalog and apparatus by type', () => {
  const nomenclature = buildProjectNomenclature(createBomProject());

  assert.deepEqual(
    nomenclature.octopuses.byModel.map((item) => [item.key, item.count]),
    [['bath', 1], ['kitchen', 1]],
  );
  assert.equal(nomenclature.apparatus.byCatalog.find((item) => item.key === 'spot')?.count, 2);
  assert.equal(nomenclature.apparatus.byCatalog.find((item) => item.key === 'prise-16a')?.count, 1);
  assert.equal(nomenclature.apparatus.byCatalog.find((item) => item.key === 'applique')?.count, 1);
  assert.equal(nomenclature.apparatus.byCatalog.find((item) => item.key === 'lampe')?.count, 1);
  assert.equal(nomenclature.apparatus.byType.find((item) => item.key === 'LA')?.count, 4);
  assert.equal(nomenclature.apparatus.byType.find((item) => item.key === 'SP')?.count, 1);
  assert.equal(nomenclature.apparatus.byType.find((item) => item.key === 'DR')?.count, 1);
});

test('includes customized outputs, reserves and white caps without mutating the catalog', () => {
  const nomenclature = buildProjectNomenclature(createBomProject());
  const kitchen = nomenclature.octopuses.details.find((detail) => detail.name === 'Cuisine 01');

  assert.equal(kitchen?.customOutputs.length, 1);
  assert.deepEqual(kitchen?.customOutputs[0], {
    outputNumber: 13,
    code: 'LA4',
    destination: 'Lampe dressing',
    diameterMm: 20,
    availableLengthMeters: 10.5,
  });
  assert.equal(kitchen?.freeRemaining, 3);
  assert.equal(nomenclature.caps.find((cap) => cap.capColor === 'white')?.count, 7);
  assert.equal(nomenclature.reserves.find((reserve) => reserve.octopusName === 'Cuisine 01')?.freeOutputs, 3);
});

test('sums used and available duct lengths by diameter including chains and direct panel ducts', () => {
  const nomenclature = buildProjectNomenclature(createBomProject());
  const diameter16 = nomenclature.ducts.byDiameter.find((item) => item.diameterMm === 16);
  const diameter20 = nomenclature.ducts.byDiameter.find((item) => item.diameterMm === 20);
  const diameter25 = nomenclature.ducts.byDiameter.find((item) => item.diameterMm === 25);

  assert.ok(diameter16);
  assert.ok(diameter20);
  assert.ok(diameter25);
  assert.equal(diameter16?.availableLengthMeters, 9.5);
  assert.equal(diameter20?.availableLengthMeters, 22);
  assert.equal(diameter25?.availableLengthMeters, 0);
  assert.ok((diameter16?.usedLengthMeters ?? 0) > 0);
  assert.ok((diameter20?.usedLengthMeters ?? 0) > 0);
  assert.ok((diameter25?.usedLengthMeters ?? 0) > 0);
});

test('sums conductors by color and section using duct length times quantity', () => {
  const nomenclature = buildProjectNomenclature(createBomProject());
  const lightBlue15 = nomenclature.conductors.find((item) => item.color === 'light-blue' && item.sectionMm2 === 1.5);
  const blue6 = nomenclature.conductors.find((item) => item.color === 'Bleu' && item.sectionMm2 === 6);
  const greenYellow6 = nomenclature.conductors.find((item) => item.color === 'Vert/Jaune' && item.sectionMm2 === 6);

  assert.ok(lightBlue15);
  assert.ok(blue6);
  assert.ok(greenYellow6);
  assert.ok(lightBlue15.lengthMeters > (blue6?.lengthMeters ?? 0));
  nearlyEqual(blue6?.lengthMeters ?? 0, greenYellow6?.lengthMeters ?? 0);
});

test('counts adapters from actual ducts and lists direct ducts without specification separately', () => {
  const nomenclature = buildProjectNomenclature(createBomProject());

  assert.equal(nomenclature.adapters.find((item) => item.adapterColor === 'yellow' && item.diameterMm === 16)?.count, 1);
  assert.equal(nomenclature.adapters.find((item) => item.adapterColor === 'blue' && item.diameterMm === 20)?.count, 3);
  assert.equal(nomenclature.ducts.directUnspecified.length, 1);
  assert.equal(nomenclature.ducts.directUnspecified[0]?.apparatusLabel.includes('Prise RJ45'), true);
});

test('detects overruns and ignores visibility and layers in totals', () => {
  const hiddenProject = createBomProject();
  const visibleProject = {
    ...hiddenProject,
    layers: hiddenProject.layers.map((layer) => ({ ...layer, visible: true })),
    octopuses: hiddenProject.octopuses.map((octopus) => ({ ...octopus, visible: true })),
    apparatus: hiddenProject.apparatus.map((apparatus) => ({ ...apparatus, visible: true })),
  };
  const hiddenNomenclature = buildProjectNomenclature(hiddenProject);
  const visibleNomenclature = buildProjectNomenclature(visibleProject);

  assert.ok(hiddenNomenclature.ducts.overruns.some((overrun) => overrun.label === 'Cuisine 01 / PR3'));
  assert.deepEqual(hiddenNomenclature.ducts.byDiameter, visibleNomenclature.ducts.byDiameter);
  assert.equal(hiddenNomenclature.apparatus.unconnected.length, 1);
  assert.equal(hiddenNomenclature.unconnectedStandardOutputs.some((output) => output.code === 'LA1'), true);
});
