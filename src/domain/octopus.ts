import type { Octopus, OctopusModelId, OctopusPort, Point } from '../types/project';
import { getOctopusCatalogModel } from '../catalog/octopuses';

export const OCTOPUS_LAYER_ID = 'octopuses';
export const OCTOPUS_WIDTH_METERS = 0.2;
export const OCTOPUS_HEIGHT_METERS = 0.2;

export interface OctopusModelDefinition {
  id: OctopusModelId;
  label: string;
  defaultNamePrefix: string;
  color: string;
}

export const OCTOPUS_MODELS: Record<OctopusModelId, OctopusModelDefinition> = {
  kitchen: {
    id: 'kitchen',
    label: 'Pieuvre Zone Cuisine',
    defaultNamePrefix: 'Cuisine',
    color: '#e11d48',
  },
  bath: {
    id: 'bath',
    label: 'Pieuvre Zone Bain',
    defaultNamePrefix: 'Bain',
    color: '#0284c7',
  },
  other: {
    id: 'other',
    label: 'Pieuvre Autre Zone',
    defaultNamePrefix: 'Autre Zone',
    color: '#16a34a',
  },
  comfort: {
    id: 'comfort',
    label: 'Pieuvre Zone Confort',
    defaultNamePrefix: 'Confort',
    color: '#f97316',
  },
};

export const OCTOPUS_PORTS: OctopusPort[] = [
  { number: 1, side: 'top', orderOnSide: 1 },
  { number: 2, side: 'top', orderOnSide: 2 },
  { number: 3, side: 'top', orderOnSide: 3 },
  { number: 4, side: 'top', orderOnSide: 4 },
  { number: 5, side: 'right', orderOnSide: 1 },
  { number: 6, side: 'right', orderOnSide: 2 },
  { number: 7, side: 'right', orderOnSide: 3 },
  { number: 8, side: 'right', orderOnSide: 4 },
  { number: 12, side: 'bottom', orderOnSide: 1 },
  { number: 11, side: 'bottom', orderOnSide: 2 },
  { number: 10, side: 'bottom', orderOnSide: 3 },
  { number: 9, side: 'bottom', orderOnSide: 4 },
  { number: 16, side: 'left', orderOnSide: 1 },
  { number: 15, side: 'left', orderOnSide: 2 },
  { number: 14, side: 'left', orderOnSide: 3 },
  { number: 13, side: 'left', orderOnSide: 4 },
];

let octopusIdSequence = 0;

function nextOctopusName(modelId: OctopusModelId, existingOctopuses: Octopus[]): string {
  const model = OCTOPUS_MODELS[modelId];
  const namePattern = new RegExp(`^${model.defaultNamePrefix} (\\d+)$`);
  const largestExistingIndex = existingOctopuses
    .filter((octopus) => octopus.modelId === modelId)
    .reduce((largestIndex, octopus) => {
      const match = octopus.name.match(namePattern);
      const index = match ? Number(match[1]) : 0;
      return Number.isFinite(index) ? Math.max(largestIndex, index) : largestIndex;
    }, 0);
  const nextIndex = largestExistingIndex + 1;

  return `${model.defaultNamePrefix} ${String(nextIndex).padStart(2, '0')}`;
}

export function createOctopus(
  modelId: OctopusModelId,
  position: Point,
  existingOctopuses: Octopus[],
): Octopus {
  octopusIdSequence += 1;
  const catalogModel = getOctopusCatalogModel(modelId);

  return {
    id: `octopus-${modelId}-${Date.now()}-${octopusIdSequence}`,
    type: 'octopus',
    modelId,
    catalogVersion: catalogModel.version,
    catalogRevision: catalogModel.revision,
    name: nextOctopusName(modelId, existingOctopuses),
    x: position.x,
    y: position.y,
    rotation: 0,
    visible: true,
    locked: false,
    layerId: OCTOPUS_LAYER_ID,
    displayScale: catalogModel.defaultDisplayScale,
    widthMeters: catalogModel.widthMeters,
    heightMeters: catalogModel.heightMeters,
    ports: OCTOPUS_PORTS.map((port) => ({ ...port })),
    outputOverrides: [],
    comments: '',
  };
}

export function getOctopusPixelSize(metersPerPixel: number): { width: number; height: number } {
  return {
    width: OCTOPUS_WIDTH_METERS / metersPerPixel,
    height: OCTOPUS_HEIGHT_METERS / metersPerPixel,
  };
}

export function getOctopusPortLocalPosition(
  port: OctopusPort,
  width: number,
  height: number,
): Point {
  const offset = ((port.orderOnSide - 0.5) / 4) - 0.5;

  switch (port.side) {
    case 'top':
      return { x: offset * width, y: -height / 2 };
    case 'right':
      return { x: width / 2, y: offset * height };
    case 'bottom':
      return { x: offset * width, y: height / 2 };
    case 'left':
      return { x: -width / 2, y: offset * height };
  }
}
