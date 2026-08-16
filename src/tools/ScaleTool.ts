import type { Point, ScaleReference } from '../types/project';

export interface ScaleDraft {
  start: Point | null;
  end: Point | null;
}

export function createEmptyScaleDraft(): ScaleDraft {
  return { start: null, end: null };
}

export function pixelDistance(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function calculateMetersPerPixel(start: Point, end: Point, realMeters: number): number {
  const distanceInPixels = pixelDistance(start, end);

  if (distanceInPixels <= 0 || realMeters <= 0) {
    throw new Error('La distance doit être positive.');
  }

  return realMeters / distanceInPixels;
}

export function createScaleReference(
  start: Point,
  end: Point,
  realMeters: number,
): ScaleReference {
  return {
    start,
    end,
    realMeters,
  };
}
