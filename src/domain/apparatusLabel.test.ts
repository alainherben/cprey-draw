import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateApparatusLabelSize,
  getApparatusLabelPlacement,
} from './apparatus';
import { getObjectDisplayLevel } from './display';

const defaultBounds = { x: 0, y: 0, width: 500, height: 300 };

test('places apparatus label on the right by default', () => {
  const placement = getApparatusLabelPlacement({
    center: { x: 100, y: 100 },
    iconWidth: 40,
    iconHeight: 40,
    labelWidth: 80,
    labelHeight: 18,
    visibleBounds: defaultBounds,
    gap: 8,
  });

  assert.equal(placement.side, 'right');
  assert.equal(placement.x, 128);
  assert.equal(placement.y, 91);
});

test('places apparatus label on the left when the right side exceeds the visible canvas', () => {
  const placement = getApparatusLabelPlacement({
    center: { x: 450, y: 100 },
    iconWidth: 40,
    iconHeight: 40,
    labelWidth: 80,
    labelHeight: 18,
    visibleBounds: defaultBounds,
    gap: 8,
  });

  assert.equal(placement.side, 'left');
  assert.equal(placement.x, 342);
});

test('uses top or bottom when horizontal sides do not fit', () => {
  const topPlacement = getApparatusLabelPlacement({
    center: { x: 42, y: 100 },
    iconWidth: 40,
    iconHeight: 40,
    labelWidth: 90,
    labelHeight: 18,
    visibleBounds: { x: 0, y: 0, width: 100, height: 220 },
    gap: 8,
  });
  const bottomPlacement = getApparatusLabelPlacement({
    center: { x: 42, y: 24 },
    iconWidth: 40,
    iconHeight: 40,
    labelWidth: 90,
    labelHeight: 18,
    visibleBounds: { x: 0, y: 0, width: 100, height: 220 },
    gap: 8,
  });

  assert.equal(topPlacement.side, 'top');
  assert.equal(bottomPlacement.side, 'bottom');
});

test('accounts for display scale through the rendered icon size', () => {
  const smallIcon = getApparatusLabelPlacement({
    center: { x: 100, y: 100 },
    iconWidth: 20,
    iconHeight: 20,
    labelWidth: 80,
    labelHeight: 18,
    visibleBounds: defaultBounds,
    gap: 8,
  });
  const scaledIcon = getApparatusLabelPlacement({
    center: { x: 100, y: 100 },
    iconWidth: 80,
    iconHeight: 80,
    labelWidth: 80,
    labelHeight: 18,
    visibleBounds: defaultBounds,
    gap: 8,
  });

  assert.equal(scaledIcon.x - smallIcon.x, 30);
});

test('estimates label size and hides labels only at icon display level', () => {
  const size = estimateApparatusLabelSize('Interrupteur simple', 13);

  assert.ok(size.width > 100);
  assert.equal(getObjectDisplayLevel(0.34), 'icon');
  assert.notEqual(getObjectDisplayLevel(0.35), 'icon');
});
