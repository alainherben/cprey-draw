import type { Point, Viewport } from '../types/project';

export function viewportPointToWorld(point: Point, viewport: Viewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

export function clampViewportScale(value: number, minZoom: number, maxZoom: number): number {
  return Math.max(minZoom, Math.min(maxZoom, value));
}

export function zoomViewportAtPointer(
  viewport: Viewport,
  pointer: Point,
  deltaY: number,
  wheelZoomEnabled: boolean,
  minZoom: number,
  maxZoom: number,
): Viewport {
  if (!wheelZoomEnabled) {
    return viewport;
  }

  const zoomFactor = deltaY > 0 ? 0.92 : 1.08;
  const nextScale = clampViewportScale(viewport.scale * zoomFactor, minZoom, maxZoom);
  const worldPoint = viewportPointToWorld(pointer, viewport);

  return {
    scale: nextScale,
    x: pointer.x - worldPoint.x * nextScale,
    y: pointer.y - worldPoint.y * nextScale,
  };
}
