import { getApparatusCatalogItem } from '../catalog/apparatus';
import { calculateQuadraticDuctLengthMeters } from './ductGeometry';
import { getDuctPathPoints } from './ducts';
import { getStudyDevicesForDrawingObject } from './importedStudy';
import type {
  ApparatusInstance,
  CpreyDrawProject,
  Duct,
  DuctControlPoint,
  DuctEndpoint,
  DuctRouteMode,
  Point,
  ProjectTechnicalSettings,
} from '../types/project';

type LegacyTechnicalSettings = Partial<ProjectTechnicalSettings> & {
  panelDistanceFromCeiling?: number;
};

export const DEFAULT_TECHNICAL_SETTINGS: ProjectTechnicalSettings = {
  defaultCeilingHeight: 2.5,
  panelCenterHeightFromFloor: 1.3,
  ductConnectionMargin: 0.5,
  crawlSpaceHeight: 0.6,
};

export interface DuctLengthBreakdown {
  geometricLength: number | null;
  startVerticalAdjustment: number;
  endVerticalAdjustment: number;
  verticalAdjustment: number;
  connectionMargin: number;
  crawlSpaceAdjustment: number;
  total: number | null;
}

export function createDefaultTechnicalSettings(): ProjectTechnicalSettings {
  return {
    ...DEFAULT_TECHNICAL_SETTINGS,
    roomCeilingHeights: {},
  };
}

export function normalizeTechnicalSettings(
  settings: LegacyTechnicalSettings | undefined,
): ProjectTechnicalSettings {
  const defaults = createDefaultTechnicalSettings();
  const defaultCeilingHeight = normalizeNonNegativeNumber(settings?.defaultCeilingHeight, defaults.defaultCeilingHeight);
  return {
    defaultCeilingHeight,
    panelCenterHeightFromFloor: normalizePanelCenterHeightFromFloor(settings, defaultCeilingHeight),
    ductConnectionMargin: normalizeNonNegativeNumber(settings?.ductConnectionMargin, defaults.ductConnectionMargin),
    crawlSpaceHeight: normalizeNonNegativeNumber(settings?.crawlSpaceHeight, defaults.crawlSpaceHeight),
    roomCeilingHeights: normalizeRoomCeilingHeights(settings?.roomCeilingHeights),
  };
}

export function getRoomCeilingHeight(project: CpreyDrawProject, roomId: string | undefined): number {
  const settings = normalizeTechnicalSettings(project.technicalSettings);
  if (roomId && settings.roomCeilingHeights?.[roomId] !== undefined) {
    return settings.roomCeilingHeights[roomId];
  }

  return settings.defaultCeilingHeight;
}

export function getApparatusRoomId(project: CpreyDrawProject, apparatusId: string): string | undefined {
  const apparatus = project.apparatus.find((candidate) => candidate.id === apparatusId);
  if (!apparatus) {
    return undefined;
  }

  const linkedDevices = getStudyDevicesForDrawingObject(project.study, apparatus.id);
  const linkedDevice = linkedDevices.find((device) => device.roomId);
  if (linkedDevice?.roomId) {
    return linkedDevice.roomId;
  }

  for (const studyDeviceId of apparatus.studyDeviceIds ?? []) {
    const device = project.study?.devices.find((candidate) => candidate.id === studyDeviceId);
    if (device?.roomId) {
      return device.roomId;
    }
  }

  if (apparatus.roomId) {
    return apparatus.roomId;
  }

  return undefined;
}

export function getDuctRouteMode(duct: Duct): DuctRouteMode {
  return duct.routeMode === 'crawl-space' ? 'crawl-space' : 'standard';
}

export function calculateDuctLengthBreakdown(
  project: CpreyDrawProject,
  duct: Duct,
): DuctLengthBreakdown {
  const points = getDuctPathPoints(
    duct,
    project.octopuses,
    project.apparatus,
    project.electricalPanel,
    project.drawing.metersPerPixel,
  );

  return calculateDuctLengthBreakdownFromPoints(project, duct, points, duct.controls);
}

export function calculateDuctLengthBreakdownFromPoints(
  project: CpreyDrawProject,
  duct: Duct,
  points: Point[],
  controls: readonly DuctControlPoint[] = [],
): DuctLengthBreakdown {
  const settings = normalizeTechnicalSettings(project.technicalSettings);
  const geometricLength = calculateQuadraticDuctLengthMeters(points, controls, project.drawing.metersPerPixel);
  const routeMode = getDuctRouteMode(duct);
  const startVerticalAdjustment = getEndpointVerticalAdjustment(project, duct, duct.source, routeMode);
  const endVerticalAdjustment = getEndpointVerticalAdjustment(project, duct, duct.target, routeMode);
  const verticalAdjustment = startVerticalAdjustment + endVerticalAdjustment;
  const connectionMargin = settings.ductConnectionMargin;
  const crawlSpaceAdjustment = routeMode === 'crawl-space' ? settings.crawlSpaceHeight * 2 : 0;
  const total = geometricLength === null
    ? null
    : geometricLength + verticalAdjustment + connectionMargin + crawlSpaceAdjustment;

  return {
    geometricLength,
    startVerticalAdjustment,
    endVerticalAdjustment,
    verticalAdjustment,
    connectionMargin,
    crawlSpaceAdjustment,
    total,
  };
}

function getEndpointVerticalAdjustment(
  project: CpreyDrawProject,
  duct: Duct,
  endpoint: DuctEndpoint,
  routeMode: DuctRouteMode,
): number {
  if (endpoint.type === 'electrical-panel') {
    return getPanelVerticalAdjustment(project, duct, routeMode);
  }

  if (endpoint.type !== 'apparatus') {
    return 0;
  }

  const apparatus = project.apparatus.find((candidate) => candidate.id === endpoint.id);
  return apparatus ? getApparatusVerticalAdjustment(project, apparatus, routeMode) : 0;
}

function getPanelVerticalAdjustment(project: CpreyDrawProject, duct: Duct, routeMode: DuctRouteMode): number {
  const settings = normalizeTechnicalSettings(project.technicalSettings);
  if (routeMode === 'crawl-space') {
    return settings.panelCenterHeightFromFloor;
  }

  const ceilingHeight = getRoomCeilingHeight(project, getDuctContextRoomId(project, duct));
  return Math.max(ceilingHeight - settings.panelCenterHeightFromFloor, 0);
}

function getApparatusVerticalAdjustment(
  project: CpreyDrawProject,
  apparatus: ApparatusInstance,
  routeMode: DuctRouteMode,
): number {
  const catalogItem = getApparatusCatalogItem(apparatus.catalogId);
  const ceilingHeight = getRoomCeilingHeight(project, getApparatusRoomId(project, apparatus.id));

  if (routeMode === 'crawl-space') {
    return catalogItem.heightReference === 'ceiling'
      ? ceilingHeight
      : catalogItem.defaultHeightMeters;
  }

  if (catalogItem.heightReference === 'ceiling') {
    return 0;
  }

  return Math.max(ceilingHeight - catalogItem.defaultHeightMeters, 0);
}

function getDuctContextRoomId(project: CpreyDrawProject, duct: Duct): string | undefined {
  return getEndpointRoomId(project, duct.source) ?? getEndpointRoomId(project, duct.target);
}

function getEndpointRoomId(project: CpreyDrawProject, endpoint: DuctEndpoint): string | undefined {
  if (endpoint.type === 'apparatus') {
    return getApparatusRoomId(project, endpoint.id);
  }

  if (endpoint.type !== 'octopus-output') {
    return undefined;
  }

  const studyOctopus = project.study?.octopuses?.find((candidate) => candidate.octopusId === endpoint.octopusId);
  if (studyOctopus?.installationRoomId) {
    return studyOctopus.installationRoomId;
  }

  const linkedDevice = getStudyDevicesForDrawingObject(project.study, endpoint.octopusId).find((device) => device.roomId);
  return linkedDevice?.roomId;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizePanelCenterHeightFromFloor(
  settings: LegacyTechnicalSettings | undefined,
  defaultCeilingHeight: number,
): number {
  if (typeof settings?.panelCenterHeightFromFloor === 'number' &&
    Number.isFinite(settings.panelCenterHeightFromFloor) &&
    settings.panelCenterHeightFromFloor >= 0
  ) {
    return settings.panelCenterHeightFromFloor;
  }

  if (typeof settings?.panelDistanceFromCeiling === 'number' &&
    Number.isFinite(settings.panelDistanceFromCeiling) &&
    settings.panelDistanceFromCeiling >= 0
  ) {
    return Math.max(defaultCeilingHeight - settings.panelDistanceFromCeiling, 0);
  }

  return DEFAULT_TECHNICAL_SETTINGS.panelCenterHeightFromFloor;
}

function normalizeRoomCeilingHeights(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([roomId, height]) =>
        typeof roomId === 'string' &&
        typeof height === 'number' &&
        Number.isFinite(height) &&
        height >= 0
      ),
  );
}
