import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQuadraticDuctGeometry,
  createDuctControlPoint,
  getQuadraticInsertion,
  normalizeDuctControlsForPoints,
  quadraticBezierLength,
  quadraticBezierPoint,
  splitQuadraticCurve,
} from './ductGeometry';

function nearlyEqual(actual: number, expected: number, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} !== ${expected}`);
}

test('a midpoint control renders a straight quadratic duct', () => {
  const start = { x: 0, y: 0 };
  const control = createDuctControlPoint({ x: 50, y: 0 });
  const end = { x: 100, y: 0 };
  const geometry = buildQuadraticDuctGeometry([start, end], [control], 0.01);

  assert.ok(geometry);
  assert.equal(geometry.pathData, 'M 0 0 Q 50 0 100 0');
  nearlyEqual(geometry.lengthMeters, 1);
  assert.deepEqual(quadraticBezierPoint(start, control, end, 0), start);
  assert.deepEqual(quadraticBezierPoint(start, control, end, 1), end);
});

test('moving the control point creates a longer curve while preserving endpoints', () => {
  const start = { x: 0, y: 0 };
  const control = createDuctControlPoint({ x: 50, y: 80 });
  const end = { x: 100, y: 0 };
  const geometry = buildQuadraticDuctGeometry([start, end], [control], 0.01);

  assert.ok(geometry);
  assert.ok(geometry.lengthMeters > 1);
  assert.deepEqual(geometry.segments[0].start, start);
  assert.deepEqual(geometry.segments[0].end, end);
});

test('two portions build two quadratic curves and sum their lengths', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const controls = [
    createDuctControlPoint({ x: 50, y: 0 }),
    createDuctControlPoint({ x: 100, y: 50 }),
  ];
  const geometry = buildQuadraticDuctGeometry(points, controls, 0.01);

  assert.ok(geometry);
  assert.equal(geometry.segments.length, 2);
  nearlyEqual(geometry.lengthMeters, 2);
});

test('splitting a quadratic curve creates two portions without endpoint drift', () => {
  const start = { x: 0, y: 0 };
  const control = { x: 50, y: 80 };
  const end = { x: 100, y: 0 };
  const split = splitQuadraticCurve(start, control, end, 0.5);
  const firstLength = quadraticBezierLength(start, split.firstControl, split.waypoint);
  const secondLength = quadraticBezierLength(split.waypoint, split.secondControl, end);
  const originalLength = quadraticBezierLength(start, control, end);

  assert.deepEqual(split.waypoint, quadraticBezierPoint(start, control, end, 0.5));
  nearlyEqual(firstLength + secondLength, originalLength);
});

test('insertion finds the nearest quadratic portion and point', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }];
  const controls = [
    createDuctControlPoint({ x: 50, y: 0 }),
    createDuctControlPoint({ x: 150, y: 80 }),
  ];
  const insertion = getQuadraticInsertion(points, controls, { x: 150, y: 40 });

  assert.equal(insertion.segmentIndex, 1);
  assert.ok(insertion.t > 0 && insertion.t < 1);
});

test('missing controls are migrated to midpoint controls', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
  const controls = normalizeDuctControlsForPoints(points, []);

  assert.equal(controls.length, 2);
  assert.deepEqual(
    controls.map(({ x, y }) => ({ x, y })),
    [{ x: 50, y: 0 }, { x: 100, y: 50 }],
  );
});
