import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import {
  APPARATUS_ICON_FILENAMES,
  getMissingApparatusAssetFilenames,
} from './apparatusAssetMap';
import { APPARATUS_CATALOG } from '../catalog/apparatus';

const pictos = readdirSync('src/assets/pictos');

test('maps every apparatus catalog item to explicit black and green asset names', () => {
  assert.deepEqual(
    Object.keys(APPARATUS_ICON_FILENAMES).sort(),
    APPARATUS_CATALOG.map((catalogItem) => catalogItem.id).sort(),
  );

  for (const [catalogId, filenames] of Object.entries(APPARATUS_ICON_FILENAMES)) {
    assert.match(filenames.black, /_Noir\.svg$/);
    assert.match(filenames.green, /_(Vert|vert)\.svg$/);
    assert.equal(filenames.black.includes('_Gris.svg'), false, catalogId);
    assert.equal(filenames.green.includes('_Gris.svg'), false, catalogId);
  }
});

test('connected state maps to black when false and green when true', () => {
  assert.equal(APPARATUS_ICON_FILENAMES.lampe.black, 'Ampoule100_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.lampe.green, 'Ampoule100_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.spot.black, 'Spot_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.spot.green, 'Spot_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.applique.black, 'Applique_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.applique.green, 'Applique_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['prise-16a'].black, 'Prise_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['prise-16a'].green, 'Prise_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.prise_haute.black, 'Prise_Haute_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.prise_haute.green, 'Prise_Haute_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.prise_double.black, 'Prise_double_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.prise_double.green, 'Prise_double_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.prise_double_haute.black, 'Prise_double_Haute_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES.prise_double_haute.green, 'Prise_double_Haute_Vert.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['interrupteur-poussoir'].black, 'InterrupteurPoussoir_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['interrupteur-simple'].black, 'InterrupteurSimple_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['interrupteur-v&v'].black, 'InterrupteurVa&Vient_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['interrupteur-double'].black, 'InterrupteurDoubleS_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['Interrupteur-double-v'].black, 'InterrupteurDoubleV_Noir.svg');
  assert.equal(APPARATUS_ICON_FILENAMES['Interrupteur-double-vV'].black, 'InterrupteurDoubleVV_Noir.svg');
});

test('finds all official black and green apparatus assets', () => {
  assert.deepEqual(getMissingApparatusAssetFilenames(pictos), []);
});
