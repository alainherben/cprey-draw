import type { DuctControlPoint, Point } from '../types/project';

const EPSILON = 0.000001;
const DEFAULT_INTEGRATION_TOLERANCE_PIXELS = 0.001;

export interface QuadraticDuctSegment {
  start: Point;
  control: DuctControlPoint;
  end: Point;
  lengthPixels: number;
}

export interface QuadraticDuctGeometry {
  pathData: string;
  segments: QuadraticDuctSegment[];
  lengthPixels: number;
  lengthMeters: number;
  labelPoint: Point;
}

export interface DuctCurveSplit {
  waypoint: Point;
  firstControl: Point;
  secondControl: Point;
}

let ductControlIdSequence = 0;

export function createDuctControlPoint(position: Point): DuctControlPoint {
  ductControlIdSequence += 1;
  return {
    id: `duct-control-${Date.now()}-${ductControlIdSequence}`,
    x: position.x,
    y: position.y,
  };
}

export function createDefaultDuctControlPoint(start: Point, end: Point): DuctControlPoint {
  return createDuctControlPoint(midpoint(start, end));
}

export function getDuctSegmentPoints(start: Point, waypoints: Point[], end: Point): Point[] {
  return [start, ...waypoints, end];
}

export function normalizeDuctControlsForPoints(
  points: Point[],
  controls: readonly DuctControlPoint[] = [],
): DuctControlPoint[] {
  return points.slice(1).map((point, index) => controls[index] ?? createDefaultDuctControlPoint(points[index], point));
}

export function buildQuadraticDuctGeometry(
  points: Point[],
  controls: readonly DuctControlPoint[] = [],
  metersPerPixel: number | null,
): QuadraticDuctGeometry | null {
  if (metersPerPixel === null || metersPerPixel <= 0 || points.length < 2) {
    return null;
  }

  const normalizedControls = normalizeDuctControlsForPoints(points, controls);
  const segments = points.slice(1).map((end, index) => {
    const start = points[index];
    const control = normalizedControls[index];
    return {
      start,
      control,
      end,
      lengthPixels: quadraticBezierLength(start, control, end),
    };
  });
  const firstPoint = points[0];
  const pathData = segments.reduce(
    (path, segment) =>
      `${path} Q ${formatPathNumber(segment.control.x)} ${formatPathNumber(segment.control.y)} ${formatPathNumber(segment.end.x)} ${formatPathNumber(segment.end.y)}`,
    `M ${formatPathNumber(firstPoint.x)} ${formatPathNumber(firstPoint.y)}`,
  );
  const lengthPixels = segments.reduce((total, segment) => total + segment.lengthPixels, 0);

  return {
    pathData,
    segments,
    lengthPixels,
    lengthMeters: lengthPixels * metersPerPixel,
    labelPoint: getPointAtLength(segments, lengthPixels / 2) ?? firstPoint,
  };
}

export function calculateQuadraticDuctLengthMeters(
  points: Point[],
  controls: readonly DuctControlPoint[] = [],
  metersPerPixel: number | null,
): number | null {
  return buildQuadraticDuctGeometry(points, controls, metersPerPixel)?.lengthMeters ?? null;
}

export function quadraticBezierPoint(start: Point, control: Point, end: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
    y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
  };
}

export function quadraticBezierLength(start: Point, control: Point, end: Point): number {
  const speed = (t: number) => {
    const dx = 2 * ((1 - t) * (control.x - start.x) + t * (end.x - control.x));
    const dy = 2 * ((1 - t) * (control.y - start.y) + t * (end.y - control.y));
    return Math.hypot(dx, dy);
  };

  return adaptiveSimpson(speed, 0, 1, DEFAULT_INTEGRATION_TOLERANCE_PIXELS);
}

export function splitQuadraticCurve(start: Point, control: Point, end: Point, t: number): DuctCurveSplit {
  const clampedT = clamp(t, 0.05, 0.95);
  const firstControl = lerpPoint(start, control, clampedT);
  const secondControl = lerpPoint(control, end, clampedT);
  const waypoint = lerpPoint(firstControl, secondControl, clampedT);

  return { waypoint, firstControl, secondControl };
}

export function getQuadraticInsertion(
  points: Point[],
  controls: readonly DuctControlPoint[],
  position: Point,
): { segmentIndex: number; t: number; point: Point } {
  const normalizedControls = normalizeDuctControlsForPoints(points, controls);
  let best = {
    segmentIndex: 0,
    t: 0.5,
    point: quadraticBezierPoint(points[0], normalizedControls[0], points[1], 0.5),
    distance: Number.POSITIVE_INFINITY,
  };

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex];
    const control = normalizedControls[segmentIndex];
    const end = points[segmentIndex + 1];
    for (let sample = 0; sample <= 80; sample += 1) {
      const t = sample / 80;
      const point = quadraticBezierPoint(start, control, end, t);
      const currentDistance = distance(point, position);
      if (currentDistance < best.distance) {
        best = { segmentIndex, t, point, distance: currentDistance };
      }
    }
  }

  return { segmentIndex: best.segmentIndex, t: best.t, point: best.point };
}

function getPointAtLength(segments: QuadraticDuctSegment[], targetLength: number): Point | null {
  let walkedLength = 0;

  for (const segment of segments) {
    if (walkedLength + segment.lengthPixels >= targetLength) {
      const ratio = segment.lengthPixels <= EPSILON ? 0 : (targetLength - walkedLength) / segment.lengthPixels;
      return quadraticBezierPoint(segment.start, segment.control, segment.end, ratio);
    }
    walkedLength += segment.lengthPixels;
  }

  return segments.length > 0 ? segments[segments.length - 1].end : null;
}

function adaptiveSimpson(
  fn: (value: number) => number,
  start: number,
  end: number,
  tolerance: number,
  maxDepth = 16,
): number {
  function recurse(left: number, right: number, area: number, currentTolerance: number, depth: number): number {
    const center = (left + right) / 2;
    const leftArea = simpson(fn, left, center);
    const rightArea = simpson(fn, center, right);
    const delta = leftArea + rightArea - area;

    if (depth <= 0 || Math.abs(delta) <= 15 * currentTolerance) {
      return leftArea + rightArea + delta / 15;
    }

    return recurse(left, center, leftArea, currentTolerance / 2, depth - 1) +
      recurse(center, right, rightArea, currentTolerance / 2, depth - 1);
  }

  return recurse(start, end, simpson(fn, start, end), tolerance, maxDepth);
}

function simpson(fn: (value: number) => number, start: number, end: number): number {
  const middle = (start + end) / 2;
  return ((end - start) / 6) * (fn(start) + 4 * fn(middle) + fn(end));
}

function midpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function lerpPoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function distance(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPathNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}
