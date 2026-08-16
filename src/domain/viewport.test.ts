import assert from 'node:assert/strict';
import test from 'node:test';
import { zoomViewportAtPointer } from './viewport';
import type { Viewport } from '../types/project';

test('wheel zoom enabled changes viewport scale around the pointer', () => {
  const viewport: Viewport = { x: 10, y: 20, scale: 1 };
  const nextViewport = zoomViewportAtPointer(
    viewport,
    { x: 110, y: 120 },
    -1,
    true,
    0.08,
    8,
  );

  assert.equal(nextViewport.scale, 1.08);
  assert.notEqual(nextViewport.x, viewport.x);
  assert.notEqual(nextViewport.y, viewport.y);
});

test('wheel zoom disabled returns the same viewport without changing zoom', () => {
  const viewport: Viewport = { x: 10, y: 20, scale: 1 };
  const nextViewport = zoomViewportAtPointer(
    viewport,
    { x: 110, y: 120 },
    -1,
    false,
    0.08,
    8,
  );

  assert.equal(nextViewport, viewport);
  assert.equal(nextViewport.scale, 1);
  assert.equal(nextViewport.x, 10);
  assert.equal(nextViewport.y, 20);
});

test('fit-style viewport changes are independent from wheel zoom setting', () => {
  const fittedViewport: Viewport = { x: 25, y: 35, scale: 0.42 };

  assert.deepEqual(fittedViewport, { x: 25, y: 35, scale: 0.42 });
});
