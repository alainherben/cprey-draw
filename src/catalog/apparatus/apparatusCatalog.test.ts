import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import test from 'node:test';
import {
  APPARATUS_CATALOG,
  getApparatusCatalogMenuItems,
  getApparatusCatalogItem,
  validateApparatusCatalog,
} from './index';

const pictos = readdirSync('src/assets/pictos');

test('apparatus catalog contains the 32 official items', () => {
  assert.equal(APPARATUS_CATALOG.length, 32);
  assert.deepEqual(validateApparatusCatalog(pictos), []);
});

test('apparatus catalog exposes representative PDF values', () => {
  const lamp = getApparatusCatalogItem('lampe');
  assert.equal(lamp.type, 'LA');
  assert.equal(lamp.name, 'Lampe');
  assert.equal(lamp.category, 'Light');
  assert.equal(lamp.svg, 'Ampoule100_Gris.svg');
  assert.equal(lamp.connectedDefault, false);
  assert.equal(lamp.defaultDisplayScale, 4);
  assert.equal(lamp.minDisplaySizePx, 22);
  assert.equal(lamp.defaultHeightMeters, 1.2);
  assert.equal(lamp.heightReference, 'floor');
  assert.equal(lamp.directSupply, false);
  assert.equal(lamp.revision, 1);

  const cooktop = getApparatusCatalogItem('plaque-cuisson');
  assert.equal(cooktop.name, '32A Plaque cuisson');
  assert.equal(cooktop.directSupply, true);
  assert.equal(cooktop.svg, 'PlaqueCuisson_Gris.svg');
  assert.equal(cooktop.directDuctSpecification?.diameterMm, 25);
  assert.deepEqual(
    cooktop.directDuctSpecification?.conductors.map(({ function: role, color, sectionMm2 }) => ({
      role,
      color,
      sectionMm2,
    })),
    [
      { role: 'Phase', color: 'Rouge', sectionMm2: 6 },
      { role: 'Neutre', color: 'Bleu', sectionMm2: 6 },
      { role: 'Terre', color: 'Vert/Jaune', sectionMm2: 6 },
    ],
  );

  const wifi = getApparatusCatalogItem('wifi');
  assert.equal(wifi.name, 'WiFi');
  assert.equal(wifi.directSupply, true);
  assert.equal(wifi.svg, 'Wifi_Gris.svg');
  assert.equal(wifi.directDuctSpecification, undefined);
});

test('apparatus catalog exposes the four PR socket variants', () => {
  const sockets = [
    ['prise-16a', 'Prise', 'Prise_Gris.svg'],
    ['prise_haute', 'Prise haute', 'Prise_Haute_Noir.svg'],
    ['prise_double', 'Prise double', 'Prise_double_Noir.svg'],
    ['prise_double_haute', 'Prise double haute', 'Prise_double_Haute_Noir.svg'],
  ] as const;

  for (const [catalogId, name, svg] of sockets) {
    const item = getApparatusCatalogItem(catalogId);
    assert.equal(item.type, 'PR');
    assert.equal(item.name, name);
    assert.equal(item.category, 'outlet');
    assert.equal(item.svg, svg);
    assert.equal(item.directSupply, false);
  }
});

test('apparatus catalog exposes Spot and Applique values from the reference document', () => {
  const spot = getApparatusCatalogItem('spot');
  assert.equal(spot.type, 'LA');
  assert.equal(spot.name, 'Spot');
  assert.equal(spot.category, 'Light');
  assert.equal(spot.svg, 'Spot_Noir.svg');
  assert.equal(spot.connectedDefault, false);
  assert.equal(spot.defaultDisplayScale, 2);
  assert.equal(spot.defaultHeightMeters, 0);
  assert.equal(spot.heightReference, 'ceiling');
  assert.equal(spot.directSupply, false);
  assert.equal(spot.revision, 1);

  const applique = getApparatusCatalogItem('applique');
  assert.equal(applique.type, 'LA');
  assert.equal(applique.name, 'Applique');
  assert.equal(applique.category, 'Light');
  assert.equal(applique.svg, 'Applique_Noir.svg');
  assert.equal(applique.connectedDefault, false);
  assert.equal(applique.defaultDisplayScale, 2);
  assert.equal(applique.defaultHeightMeters, 2);
  assert.equal(applique.heightReference, 'floor');
  assert.equal(applique.directSupply, false);
  assert.equal(applique.revision, 1);
});

test('apparatus insertion menu keeps socket variants in logical order before alphabetical items', () => {
  const names = getApparatusCatalogMenuItems().map((catalogItem) => catalogItem.name);
  assert.deepEqual(
    names.slice(0, 4),
    ['Prise', 'Prise haute', 'Prise double', 'Prise double haute'],
  );
  assert.ok(names.indexOf('Applique') < names.indexOf('Spot'));
});

test('every catalog SVG exists in src/assets/pictos', () => {
  for (const catalogItem of APPARATUS_CATALOG) {
    assert.ok(pictos.includes(catalogItem.svg), `${catalogItem.svg} missing`);
  }
});
