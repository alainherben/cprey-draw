import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPECTED_OUTPUT_COUNTS,
  getOctopusCatalogModel,
  OCTOPUS_CATALOG_MODELS,
  validateOctopusCatalog,
} from './index';
import type { OctopusModelId } from '../../types/project';

const modelIds: OctopusModelId[] = ['kitchen', 'bath', 'other', 'comfort'];

function output(modelId: OctopusModelId, outputNumber: number) {
  const found = getOctopusCatalogModel(modelId).outputs.find(
    (candidate) => candidate.outputNumber === outputNumber,
  );
  assert.ok(found, `${modelId} sortie ${outputNumber} introuvable`);
  return found;
}

test('catalog contains the 4 octopus models and validates without errors', () => {
  assert.deepEqual(Object.keys(OCTOPUS_CATALOG_MODELS).sort(), [...modelIds].sort());
  assert.deepEqual(validateOctopusCatalog(), []);
});

test('each model exposes exactly outputs 1 to 16 once', () => {
  for (const modelId of modelIds) {
    const numbers = getOctopusCatalogModel(modelId)
      .outputs.map((candidate) => candidate.outputNumber)
      .sort((a, b) => a - b);

    assert.deepEqual(numbers, Array.from({ length: 16 }, (_, index) => index + 1));
  }
});

test('standard and free output counts match the validated catalog', () => {
  for (const modelId of modelIds) {
    const model = getOctopusCatalogModel(modelId);
    const standard = model.outputs.filter((candidate) => candidate.state === 'standard').length;
    const free = model.outputs.filter((candidate) => candidate.state === 'free').length;

    assert.deepEqual({ standard, free }, EXPECTED_OUTPUT_COUNTS[modelId]);
  }
});

test('checks representative Comfort outputs from the source document', () => {
  const comfort1 = output('comfort', 1);
  assert.equal(comfort1.code, 'VR4');
  assert.equal(comfort1.destination, 'VR');
  assert.equal(comfort1.duct.diameterMm, 20);
  assert.equal(comfort1.duct.lengthMeters, 16.5);
  assert.equal(comfort1.linkColor, 'Marron');

  const comfort2 = output('comfort', 2);
  assert.equal(comfort2.code, 'AL1');
  assert.equal(comfort2.destination, 'Alimentation VR');
  assert.equal(comfort2.duct.diameterMm, 20);
  assert.equal(comfort2.duct.lengthMeters, 16.5);

  const comfort15 = output('comfort', 15);
  assert.equal(comfort15.code, 'VR2');
  assert.equal(comfort15.duct.diameterMm, 20);
  assert.equal(comfort15.duct.lengthMeters, 11.5);
  assert.equal(comfort15.linkColor, 'Orange');
});

test('checks representative Kitchen outputs from the source document', () => {
  const kitchen2 = output('kitchen', 2);
  assert.equal(kitchen2.code, 'AL1');
  assert.equal(kitchen2.destination, 'Alimentation Lampes/Prises');
  assert.equal(kitchen2.duct.diameterMm, 20);
  assert.equal(kitchen2.duct.lengthMeters, 16.5);
  assert.equal(kitchen2.linkColor, 'Marron');

  const kitchen11 = output('kitchen', 11);
  assert.equal(kitchen11.code, 'SP1');
  assert.equal(kitchen11.destination, 'Prise spécialisée');
  assert.equal(kitchen11.duct.diameterMm, 20);
  assert.equal(kitchen11.duct.lengthMeters, 10.5);
  assert.equal(kitchen11.linkColor, 'Rose');

  assert.equal(output('kitchen', 16).code, 'PR1/PR2');
});

test('checks representative Bath and Other Zone outputs from the source document', () => {
  const bath2 = output('bath', 2);
  assert.equal(bath2.code, 'AL1');
  assert.equal(bath2.destination, 'Alimentation Lampes/Prises');
  assert.equal(bath2.duct.diameterMm, 20);
  assert.equal(bath2.duct.lengthMeters, 16.5);
  assert.equal(bath2.linkColor, 'Marron');

  const other1 = output('other', 1);
  assert.equal(other1.code, 'PR6x');
  assert.equal(other1.destination, 'Prise extérieur');
  assert.equal(other1.duct.diameterMm, 20);
  assert.equal(other1.duct.lengthMeters, 11.5);
  assert.equal(other1.linkColor, 'Rouge');
});

test('free outputs explicitly carry blue adapter, white cap and no installed duct length', () => {
  for (const modelId of modelIds) {
    for (const freeOutput of getOctopusCatalogModel(modelId).outputs.filter(
      (candidate) => candidate.state === 'free',
    )) {
      assert.equal(freeOutput.destination, 'Disponible');
      assert.equal(freeOutput.duct.adapterColor, 'blue');
      assert.equal(freeOutput.duct.capped, true);
      assert.equal(freeOutput.duct.capColor, 'white');
      assert.equal(freeOutput.duct.lengthMeters, 0);
      assert.deepEqual(freeOutput.conductors, []);
    }
  }
});
