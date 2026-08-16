import assert from 'node:assert/strict';
import test from 'node:test';
import { OCTOPUS_LOGO_FILENAMES } from './octopusAssetMap';

test('maps octopus models to their official SVG assets', () => {
  assert.equal(OCTOPUS_LOGO_FILENAMES.kitchen, 'logo-pieuvre-cuisine.svg');
  assert.equal(OCTOPUS_LOGO_FILENAMES.bath, 'logo-pieuvre-bain.svg');
  assert.equal(OCTOPUS_LOGO_FILENAMES.other, 'logo-pieuvre-autre-zone.svg');
  assert.equal(OCTOPUS_LOGO_FILENAMES.comfort, 'logo-pieuvre-confort.svg');
});
