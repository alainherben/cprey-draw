import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from './apparatus';
import { createDuct, createDirectPanelDuct } from './ducts';
import { createElectricalPanel } from './electricalPanel';
import { createOctopus } from './octopus';
import { createOctopusOutputOverride, upsertOctopusOutputOverride } from './octopusOutputs';
import { validateProject } from './projectValidation';
import { createEmptyProject } from '../storage/ProjectStorage';
import type { ApparatusInstance, CpreyDrawProject, Duct, DuctConductor, Octopus } from '../types/project';

function mustDuct(result: ReturnType<typeof createDuct> | ReturnType<typeof createDirectPanelDuct>): Duct {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error('Création de gaine impossible');
  }
  return result.duct;
}

function baseProject(): CpreyDrawProject {
  return {
    ...createEmptyProject(),
    drawing: { ...createEmptyProject().drawing, metersPerPixel: 0.01 },
  };
}

function projectWithKitchenLamp(): {
  project: CpreyDrawProject;
  kitchen: Octopus;
  lamp: ApparatusInstance;
  duct: Duct;
} {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const lamp = createApparatusInstance('lampe', { x: 150, y: 100 }, []);
  const project = {
    ...baseProject(),
    octopuses: [kitchen],
    apparatus: [lamp],
  };
  const duct = mustDuct(createDuct(project, kitchen.id, 12, { type: 'apparatus', id: lamp.id }));

  return {
    project: { ...project, ducts: [duct] },
    kitchen,
    lamp,
    duct,
  };
}

function issueCodes(project: CpreyDrawProject): string[] {
  return validateProject(project).issues.map((issue) => issue.code);
}

test('reports unconnected apparatus and unconnected standard outputs as warnings', () => {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const outlet = createApparatusInstance('prise-16a', { x: 150, y: 100 }, []);
  const result = validateProject({
    ...baseProject(),
    octopuses: [kitchen],
    apparatus: [outlet],
  });

  assert.equal(result.errorCount, 0);
  assert.ok(result.issues.some((issue) => issue.code === 'APPARATUS_UNCONNECTED' && issue.severity === 'warning'));
  assert.ok(result.issues.some((issue) => issue.code === 'STANDARD_OUTPUT_UNCONNECTED' && issue.severity === 'warning'));
  assert.ok(result.issues.some((issue) => issue.code === 'POWER_SUPPLY_OUTPUT_UNCONNECTED' && issue.severity === 'warning'));
});

test('reports unconnected custom outputs and invalid custom outputs', () => {
  const kitchenBase = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const kitchen = upsertOctopusOutputOverride(kitchenBase, {
    ...createOctopusOutputOverride(kitchenBase, 13, 'PR'),
    code: '',
    duct: {
      diameterMm: 20,
      adapterColor: 'blue',
      capped: false,
      availableLengthMeters: -1,
    },
  });
  const result = validateProject({ ...baseProject(), octopuses: [kitchen] });

  assert.ok(result.issues.some((issue) => issue.code === 'OCTOPUS_OUTPUT_OVERRIDE_INVALID' && issue.severity === 'error'));
  assert.ok(result.issues.some((issue) => issue.code === 'CUSTOM_OUTPUT_UNCONNECTED' && issue.severity === 'warning'));
});

test('reports duct overrun, invalid conductors and missing available length', () => {
  const { project, duct } = projectWithKitchenLamp();
  const brokenDuct: Duct = {
    ...duct,
    specification: {
      ...duct.specification,
      availableLengthMeters: 1,
      conductors: [
        {
          order: 1,
          quantity: 0,
          function: '',
          color: '',
          sectionMm2: 4 as DuctConductor['sectionMm2'],
        },
      ],
    },
    controls: duct.controls.map((control) => ({ ...control, y: control.y + 600 })),
  };
  const zeroLengthDuct: Duct = {
    ...duct,
    id: 'zero-length-duct',
    source: { type: 'octopus-output', octopusId: project.octopuses[0].id, outputNumber: 10 },
    specification: { ...duct.specification, outputCode: 'LA2', availableLengthMeters: 0 },
  };
  const codes = issueCodes({ ...project, ducts: [brokenDuct, zeroLengthDuct] });

  assert.ok(codes.includes('DUCT_LENGTH_OVERRUN'));
  assert.ok(codes.includes('DUCT_CONDUCTOR_INVALID'));
  assert.ok(codes.includes('DUCT_AVAILABLE_LENGTH_MISSING'));
});

test('reports orphan ducts and invalid circuit origins', () => {
  const { project, duct } = projectWithKitchenLamp();
  const orphanSource: Duct = {
    ...duct,
    id: 'orphan-source',
    source: { type: 'apparatus', id: 'missing-apparatus' },
  };
  const orphanOrigin: Duct = {
    ...duct,
    id: 'orphan-origin',
    circuitOrigin: { type: 'octopus-output', octopusId: 'missing-octopus', outputNumber: 12 },
  };
  const codes = issueCodes({ ...project, ducts: [orphanSource, orphanOrigin] });

  assert.ok(codes.includes('DUCT_ENDPOINT_MISSING'));
  assert.ok(codes.includes('DUCT_CIRCUIT_ORIGIN_INVALID'));
});

test('reports apparatus type incompatibility and direct supply invalidity', () => {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const lamp = createApparatusInstance('lampe', { x: 120, y: 100 }, []);
  const outlet = createApparatusInstance('prise-16a', { x: 150, y: 100 }, []);
  const panel = createElectricalPanel({ x: 80, y: 80 });
  const project = {
    ...baseProject(),
    electricalPanel: panel,
    octopuses: [kitchen],
    apparatus: [lamp, outlet],
  };
  const validLampDuct = mustDuct(createDuct(project, kitchen.id, 12, { type: 'apparatus', id: lamp.id }));
  const incompatibleDuct: Duct = {
    ...validLampDuct,
    target: { type: 'apparatus', id: outlet.id },
    specification: {
      ...validLampDuct.specification,
      outputCode: 'LA1',
    },
  };
  const invalidDirectDuct: Duct = {
    ...incompatibleDuct,
    id: 'invalid-direct',
    source: { type: 'electrical-panel', id: panel.id },
    target: { type: 'apparatus', id: outlet.id },
    circuitOrigin: { type: 'electrical-panel', id: panel.id },
    specification: {
      outputCode: 'DIRECT',
      destination: 'Prise',
      diameterMm: 20,
      capped: false,
      availableLengthMeters: 0,
      linkColor: 'Noir',
      conductors: [],
    },
  };
  const codes = issueCodes({ ...project, ducts: [incompatibleDuct, invalidDirectDuct] });

  assert.ok(codes.includes('APPARATUS_TYPE_INCOMPATIBLE'));
  assert.ok(codes.includes('DIRECT_SUPPLY_INVALID'));
});

test('reports double incoming, double outgoing, cycle and repeated octopus output', () => {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const spot1 = createApparatusInstance('spot', { x: 150, y: 100 }, []);
  const spot2 = createApparatusInstance('spot', { x: 180, y: 100 }, [spot1]);
  const spot3 = createApparatusInstance('spot', { x: 210, y: 100 }, [spot1, spot2]);
  const project = {
    ...baseProject(),
    octopuses: [kitchen],
    apparatus: [spot1, spot2, spot3],
  };
  const first = mustDuct(createDuct(project, kitchen.id, 12, { type: 'apparatus', id: spot1.id }));
  const duplicateOutput: Duct = { ...first, id: 'duplicate-output', target: { type: 'apparatus', id: spot2.id } };
  const chainA: Duct = { ...first, id: 'chain-a', source: { type: 'apparatus', id: spot1.id }, target: { type: 'apparatus', id: spot2.id } };
  const chainB: Duct = { ...first, id: 'chain-b', source: { type: 'apparatus', id: spot1.id }, target: { type: 'apparatus', id: spot3.id } };
  const cycle: Duct = { ...first, id: 'cycle', source: { type: 'apparatus', id: spot2.id }, target: { type: 'apparatus', id: spot1.id } };
  const codes = issueCodes({ ...project, ducts: [first, duplicateOutput, chainA, chainB, cycle] });

  assert.ok(codes.includes('OCTOPUS_OUTPUT_USED_MULTIPLE_TIMES'));
  assert.ok(codes.includes('APPARATUS_MULTIPLE_INCOMING_DUCTS'));
  assert.ok(codes.includes('APPARATUS_MULTIPLE_OUTGOING_DUCTS'));
  assert.ok(codes.includes('APPARATUS_CHAIN_CYCLE'));
});

test('reports free outputs connected and missing electrical panel for panel ducts', () => {
  const { project, duct } = projectWithKitchenLamp();
  const freeDuct: Duct = {
    ...duct,
    id: 'free-output-duct',
    source: { type: 'octopus-output', octopusId: project.octopuses[0].id, outputNumber: 7 },
    specification: { ...duct.specification, outputCode: 'LIBRE7' },
  };
  const panelDuct: Duct = {
    ...duct,
    id: 'missing-panel-duct',
    source: { type: 'electrical-panel', id: 'panel-missing' },
    circuitOrigin: { type: 'electrical-panel', id: 'panel-missing' },
  };
  const codes = issueCodes({ ...project, ducts: [freeDuct, panelDuct] });

  assert.ok(codes.includes('FREE_OUTPUT_CONNECTED'));
  assert.ok(codes.includes('ELECTRICAL_PANEL_MISSING'));
});

test('reports direct ducts without specification and validates cooktop direct snapshot', () => {
  const panel = createElectricalPanel({ x: 100, y: 100 });
  const rj45 = createApparatusInstance('prise-rj45', { x: 160, y: 100 }, []);
  const cooktop = createApparatusInstance('plaque-cuisson', { x: 200, y: 100 }, [rj45]);
  const project = {
    ...baseProject(),
    electricalPanel: panel,
    apparatus: [rj45, cooktop],
  };
  const rj45Duct = mustDuct(createDirectPanelDuct(project, panel.id, rj45.id));
  const cooktopDuct = mustDuct(createDirectPanelDuct(project, panel.id, cooktop.id));
  const validResult = validateProject({ ...project, ducts: [rj45Duct, cooktopDuct] });
  const invalidCooktopResult = validateProject({
    ...project,
    ducts: [
      rj45Duct,
      {
        ...cooktopDuct,
        specification: {
          ...cooktopDuct.specification,
          diameterMm: 20,
        },
      },
    ],
  });

  assert.ok(validResult.issues.some((issue) => issue.code === 'DIRECT_DUCT_SPECIFICATION_MISSING' && issue.severity === 'warning'));
  assert.equal(validResult.issues.some((issue) => issue.code === 'DIRECT_DUCT_SPECIFICATION_MISMATCH'), false);
  assert.ok(invalidCooktopResult.issues.some((issue) => issue.code === 'DIRECT_DUCT_SPECIFICATION_MISMATCH' && issue.severity === 'error'));
});

test('allows duplicate identifiers between different octopus contexts', () => {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const bath = createOctopus('bath', { x: 300, y: 100 }, [kitchen]);
  const kitchenLamp = { ...createApparatusInstance('lampe', { x: 150, y: 100 }, []), identifier: 'LA1' };
  const bathLamp = { ...createApparatusInstance('lampe', { x: 350, y: 100 }, [kitchenLamp]), identifier: 'LA1' };
  const project = {
    ...baseProject(),
    octopuses: [kitchen, bath],
    apparatus: [kitchenLamp, bathLamp],
  };
  const kitchenDuct = mustDuct(createDuct(project, kitchen.id, 12, { type: 'apparatus', id: kitchenLamp.id }));
  const bathDuct = mustDuct(createDuct(project, bath.id, 12, { type: 'apparatus', id: bathLamp.id }));
  const result = validateProject({ ...project, ducts: [kitchenDuct, bathDuct] });

  assert.equal(result.issues.some((issue) => issue.code.includes('IDENTIFIER')), false);
  assert.equal(result.errorCount, 0);
});

test('validation ignores visibility and layer states', () => {
  const { project } = projectWithKitchenLamp();
  const hiddenProject = {
    ...project,
    layers: project.layers.map((layer) => ({ ...layer, visible: false })),
    octopuses: project.octopuses.map((octopus) => ({ ...octopus, visible: false })),
    apparatus: project.apparatus.map((apparatus) => ({ ...apparatus, visible: false })),
  };

  assert.deepEqual(
    validateProject(hiddenProject).issues.map((issue) => issue.code),
    validateProject(project).issues.map((issue) => issue.code),
  );
});
