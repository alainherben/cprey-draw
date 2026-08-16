import assert from 'node:assert/strict';
import test from 'node:test';
import { getOctopusDisplayLevel } from './display';

test('octopus display levels hide ports in general view', () => {
  assert.equal(getOctopusDisplayLevel(0.69), 'icon');
  assert.equal(getOctopusDisplayLevel(0.7), 'shape');
  assert.equal(getOctopusDisplayLevel(1.39), 'shape');
  assert.equal(getOctopusDisplayLevel(1.4), 'detailed');
});
