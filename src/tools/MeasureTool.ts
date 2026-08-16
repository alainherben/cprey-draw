import type { Point } from '../types/project';

export interface Measurement {
  id: string;
  start: Point;
  end: Point;
}
import { pixelDistance } from './ScaleTool';

export interface MeasureDraft {
  start: Point | null;
  end: Point | null;
}

export function createEmptyMeasureDraft(): MeasureDraft {
  return { start: null, end: null };
}

export function createMeasurement(start: Point, end: Point): Measurement {
  return {
    id: `measure-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    start,
    end,
  };
}

export function measurementMeters(
  measurement: Pick<Measurement, 'start' | 'end'>,
  metersPerPixel: number | null,
): number | null {
  if (metersPerPixel === null) {
    return null;
  }

  return pixelDistance(measurement.start, measurement.end) * metersPerPixel;
}
