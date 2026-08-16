import assert from 'node:assert/strict';
import test from 'node:test';
import { createOctopus } from './octopus';
import {
  createOctopusOutputOverride,
  generateNextOutputCode,
  getEffectiveOctopusOutput,
  getOctopusOutputCounts,
  removeOctopusOutputOverride,
  upsertOctopusOutputOverride,
  validateOctopusOutputOverride,
} from './octopusOutputs';

test('creates an override only for a catalog free output', () => {
  const octopus = createOctopus('kitchen', { x: 0, y: 0 }, []);
  const override = createOctopusOutputOverride(octopus, 13, 'LA');
  const updated = upsertOctopusOutputOverride(octopus, override);
  const effective = getEffectiveOctopusOutput(updated, 13);

  assert.equal(effective?.state, 'custom');
  assert.equal(effective?.code, 'LA3');
  assert.equal(effective?.destination, 'Lampe');
  assert.equal(effective?.duct.diameterMm, 16);
  assert.equal(effective?.duct.adapterColor, 'yellow');
  assert.equal(effective?.duct.capped, false);
  assert.equal(effective?.conductors.length, 3);
  assert.deepEqual(validateOctopusOutputOverride(octopus, override), []);

  const standardOverride = { ...override, outputNumber: 10 };
  assert.ok(validateOctopusOutputOverride(octopus, standardOverride).some((error) => error.includes('standard')));
});

test('generates unique output codes from catalog and instance overrides', () => {
  const octopus = createOctopus('kitchen', { x: 0, y: 0 }, []);
  const la3 = createOctopusOutputOverride(octopus, 13, 'LA');
  const withLa3 = upsertOctopusOutputOverride(octopus, la3);
  const pr7 = createOctopusOutputOverride(withLa3, 15, 'PR');
  const withPr7 = upsertOctopusOutputOverride(withLa3, pr7);

  assert.equal(generateNextOutputCode(octopus, 'LA'), 'LA3');
  assert.equal(generateNextOutputCode(withLa3, 'LA'), 'LA4');
  assert.equal(pr7.code, 'PR7');
  assert.equal(generateNextOutputCode(withPr7, 'PR'), 'PR8');
});

test('validates override uniqueness, diameter, length and conductors', () => {
  const octopus = createOctopus('kitchen', { x: 0, y: 0 }, []);
  const override = {
    ...createOctopusOutputOverride(octopus, 13, 'PR'),
    code: 'PR3',
    duct: {
      diameterMm: 20 as const,
      adapterColor: 'blue' as const,
      capped: false,
      availableLengthMeters: -1,
    },
    conductors: [
      {
        order: 1,
        quantity: 0,
        function: '',
        color: 'Rouge',
        sectionMm2: 6 as const,
      },
    ],
  };
  const errors = validateOctopusOutputOverride(octopus, override);

  assert.ok(errors.some((error) => error.includes('unique')));
  assert.ok(errors.some((error) => error.includes('positive')));
  assert.ok(errors.some((error) => error.includes('fonction')));
  assert.ok(errors.some((error) => error.includes('quantité')));
});

test('resets a custom output back to the immutable catalog free output', () => {
  const octopus = createOctopus('comfort', { x: 0, y: 0 }, []);
  const override = createOctopusOutputOverride(octopus, 3, 'VR');
  const updated = upsertOctopusOutputOverride(octopus, override);
  const reset = removeOctopusOutputOverride(updated, 3);
  const effective = getEffectiveOctopusOutput(reset, 3);
  const counts = getOctopusOutputCounts(updated);

  assert.equal(counts.custom, 1);
  assert.equal(counts.free, 10);
  assert.equal(effective?.state, 'free');
  assert.equal(effective?.code, 'LIBRE3');
  assert.equal(effective?.duct.capped, true);
  assert.equal(effective?.duct.capColor, 'white');
});
