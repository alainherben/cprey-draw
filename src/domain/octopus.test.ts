import assert from 'node:assert/strict';
import test from 'node:test';
import { OCTOPUS_MODELS } from './octopus';

test('maps octopus models to their expected colors', () => {
  assert.equal(OCTOPUS_MODELS.kitchen.color, '#e11d48');
  assert.equal(OCTOPUS_MODELS.bath.color, '#0284c7');
  assert.equal(OCTOPUS_MODELS.other.color, '#16a34a');
  assert.equal(OCTOPUS_MODELS.comfort.color, '#f97316');
});
