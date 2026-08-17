import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateApparatusLabelSize,
  getApparatusLabelLayout,
  getApparatusLabelPlacement,
} from './apparatus';
import { getObjectDisplayLevel } from './display';
import type { ApparatusInstance } from '../types/project';

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

function labelApparatus(
  identifier: string,
  labelPosition: ApparatusInstance['labelPosition'],
  overrides: Partial<Pick<ApparatusInstance, 'labelOffsetX' | 'labelOffsetY' | 'labelLocked' | 'rotation' | 'displayScale'>> = {},
): Pick<
  ApparatusInstance,
  'identifier' | 'labelPosition' | 'labelFontSize' | 'labelOffsetX' | 'labelOffsetY' | 'labelLocked' | 'rotation' | 'displayScale'
> {
  return {
    identifier,
    labelPosition,
    labelFontSize: 12,
    labelOffsetX: overrides.labelOffsetX ?? 0,
    labelOffsetY: overrides.labelOffsetY ?? 0,
    labelLocked: overrides.labelLocked ?? false,
    rotation: overrides.rotation ?? 0,
    displayScale: overrides.displayScale ?? 1,
  };
}

test('uses stored label side without PDF-style automatic repositioning for composite identifiers', () => {
  const placement = getApparatusLabelLayout({
    apparatus: labelApparatus('PR1/2', 'right'),
    center: { x: 490, y: 100 },
    iconWidth: 40,
    iconHeight: 40,
    visibleBounds: defaultBounds,
    gap: 8,
  });

  assert.equal(placement.side, 'right');
  assert.equal(placement.x, 518);
});

test('places saved label sides consistently for LA3 LA4 and LA5 style identifiers', () => {
  const center = { x: 100, y: 100 };
  const base = {
    center,
    iconWidth: 40,
    iconHeight: 40,
    visibleBounds: defaultBounds,
    gap: 8,
  };

  assert.equal(getApparatusLabelLayout({ ...base, apparatus: labelApparatus('LA3', 'top') }).side, 'top');
  assert.equal(getApparatusLabelLayout({ ...base, apparatus: labelApparatus('LA4', 'bottom') }).side, 'bottom');
  assert.equal(getApparatusLabelLayout({ ...base, apparatus: labelApparatus('LA5', 'left') }).side, 'left');
  assert.equal(getApparatusLabelLayout({ ...base, apparatus: labelApparatus('PR4/6', 'right') }).side, 'right');
});

test('applies manual label offsets and keeps label layout independent from apparatus rotation', () => {
  const rotated = getApparatusLabelLayout({
    apparatus: labelApparatus('LA3', 'right', {
      labelOffsetX: 14,
      labelOffsetY: -6,
      labelLocked: true,
      rotation: 90,
    }),
    center: { x: 100, y: 100 },
    iconWidth: 40,
    iconHeight: 40,
    visibleBounds: defaultBounds,
    gap: 8,
  });

  assert.equal(rotated.side, 'right');
  assert.equal(rotated.x, 142);
  assert.equal(rotated.y, 85.9);
});

test('uses display scale only through rendered icon size to keep labels outside the pictogram', () => {
  const small = getApparatusLabelLayout({
    apparatus: labelApparatus('PR4/6', 'right', { displayScale: 1 }),
    center: { x: 100, y: 100 },
    iconWidth: 30,
    iconHeight: 30,
    visibleBounds: defaultBounds,
    gap: 8,
  });
  const large = getApparatusLabelLayout({
    apparatus: labelApparatus('PR4/6', 'right', { displayScale: 3 }),
    center: { x: 100, y: 100 },
    iconWidth: 90,
    iconHeight: 90,
    visibleBounds: defaultBounds,
    gap: 8,
  });

  assert.equal(large.x - small.x, 30);
  assert.equal(large.y, small.y);
});
