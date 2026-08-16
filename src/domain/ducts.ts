import { getApparatusCatalogItem } from '../catalog/apparatus';
import { getOctopusCatalogModel } from '../catalog/octopuses';
import {
  calculateQuadraticDuctLengthMeters,
  createDefaultDuctControlPoint,
  createDuctControlPoint,
} from './ductGeometry';
import { getOctopusPixelSize, getOctopusPortLocalPosition } from './octopus';
import { getEffectiveOctopusOutput } from './octopusOutputs';
import type { ApparatusTypeCode } from '../catalog/apparatus';
import type {
  ApparatusCatalogId,
  ApparatusInstance,
  CircuitOrigin,
  CpreyDrawProject,
  Duct,
  DuctControlPoint,
  DuctEndpoint,
  DuctSpecification,
  DuctTarget,
  DuctWaypoint,
  ElectricalPanel,
  Octopus,
  Point,
} from '../types/project';

let ductIdSequence = 0;
let ductWaypointIdSequence = 0;

export const DUCT_LAYER_ID = 'ducts';
export const DUCT_LENGTH_MARGIN_METERS = 0;

export const LINK_COLOR_CSS: Record<string, string> = {
  Marron: '#8b5a2b',
  Bleu: '#2563eb',
  Rose: '#ec4899',
  Vert: '#16a34a',
  Orange: '#f97316',
  Rouge: '#dc2626',
  Cyan: '#06b6d4',
  Violet: '#7c3aed',
  Gris: '#6b7280',
  Noir: '#111827',
  Blanc: '#f9fafb',
  Jaune: '#eab308',
};

export type DuctResult =
  | { ok: true; duct: Duct }
  | { ok: false; reason: string };

export function getLinkColorCss(linkColor: string): string {
  return LINK_COLOR_CSS[linkColor] ?? '#374151';
}

export function isPowerSupplyOutputDestination(destination: string): boolean {
  return destination.trim().toLocaleLowerCase('fr-FR').startsWith('alimentation');
}

export function getExpectedApparatusType(outputCode: string): ApparatusTypeCode | null {
  const prefix = outputCode.trim().match(/^[A-Z]+/i)?.[0]?.toUpperCase();

  if (!prefix || prefix === 'AL') {
    return null;
  }

  if (prefix === 'VMC') {
    return 'VM';
  }

  return isKnownApparatusType(prefix) ? prefix : null;
}

export function getDuctSourceOctopusOutput(duct: Duct): Extract<DuctEndpoint, { type: 'octopus-output' }> | null {
  return duct.source.type === 'octopus-output' ? duct.source : null;
}

export function isSameOctopusOutput(
  endpoint: DuctEndpoint | CircuitOrigin,
  octopusId: string,
  outputNumber?: number,
): boolean {
  return (
    endpoint.type === 'octopus-output' &&
    endpoint.octopusId === octopusId &&
    (outputNumber === undefined || endpoint.outputNumber === outputNumber)
  );
}

export function isApparatusEndpoint(endpoint: DuctEndpoint, apparatusId: string): boolean {
  return endpoint.type === 'apparatus' && endpoint.id === apparatusId;
}

export function isElectricalPanelEndpoint(endpoint: DuctEndpoint, panelId: string): boolean {
  return endpoint.type === 'electrical-panel' && endpoint.id === panelId;
}

export function isApparatusCompatibleWithOutputCode(
  catalogId: ApparatusCatalogId,
  outputCode: string,
): boolean {
  const expectedType = getExpectedApparatusType(outputCode);
  return expectedType !== null && getApparatusCatalogItem(catalogId).type === expectedType;
}

export function createDuct(
  project: CpreyDrawProject,
  octopusId: string,
  outputNumber: number,
  target: DuctTarget,
): DuctResult {
  const source: DuctEndpoint = { type: 'octopus-output', octopusId, outputNumber };
  return createDuctFromEndpoints(project, source, target);
}

export function createDuctFromEndpoints(
  project: CpreyDrawProject,
  source: DuctEndpoint,
  target: DuctEndpoint,
  circuitOrigin?: CircuitOrigin,
): DuctResult {
  if (source.type === 'octopus-output') {
    return createOctopusOutputDuct(project, source, target);
  }

  if (source.type === 'apparatus' && target.type === 'apparatus') {
    return createApparatusChainDuct(project, source.id, target.id);
  }

  if (source.type === 'electrical-panel' && target.type === 'apparatus') {
    return createDirectPanelDuct(project, source.id, target.id, circuitOrigin);
  }

  return { ok: false, reason: 'Type de liaison non pris en charge.' };
}

export function createApparatusChainDuct(
  project: CpreyDrawProject,
  sourceApparatusId: string,
  targetApparatusId: string,
): DuctResult {
  if (sourceApparatusId === targetApparatusId) {
    return { ok: false, reason: 'Sélectionnez un autre appareillage.' };
  }

  const sourceApparatus = project.apparatus.find((apparatus) => apparatus.id === sourceApparatusId);
  const targetApparatus = project.apparatus.find((apparatus) => apparatus.id === targetApparatusId);
  if (!sourceApparatus || !targetApparatus) {
    return { ok: false, reason: 'Appareillage introuvable.' };
  }

  const incomingDuct = getIncomingDuctForApparatus(project, sourceApparatusId);
  if (!incomingDuct) {
    return { ok: false, reason: 'Cet appareillage n’appartient pas encore à un circuit.' };
  }

  if (project.ducts.some((duct) => isApparatusEndpoint(duct.source, sourceApparatusId))) {
    return { ok: false, reason: 'Cet appareillage possède déjà une liaison sortante.' };
  }

  if (getIncomingDuctForApparatus(project, targetApparatusId)) {
    return { ok: false, reason: 'Cet appareillage est déjà raccordé.' };
  }

  const expectedType = getCircuitExpectedApparatusType(incomingDuct);
  const targetType = getApparatusCatalogItem(targetApparatus.catalogId).type;
  if (expectedType === null || targetType !== expectedType) {
    return {
      ok: false,
      reason: [
        'Connexion impossible.',
        `Circuit : ${incomingDuct.specification.outputCode}`,
        `Type attendu : ${expectedType ?? 'aucun appareillage'}`,
        `Appareillage : ${getApparatusCatalogItem(targetApparatus.catalogId).name}`,
        `Type : ${targetType}`,
      ].join('\n'),
    };
  }

  return createDuctWithGeometry(project, {
    source: { type: 'apparatus', id: sourceApparatusId },
    target: { type: 'apparatus', id: targetApparatusId },
    circuitOrigin: incomingDuct.circuitOrigin,
    specification: { ...incomingDuct.specification, conductors: incomingDuct.specification.conductors.map((conductor) => ({ ...conductor })) },
    catalogVersion: incomingDuct.catalogVersion,
    catalogRevision: incomingDuct.catalogRevision,
  });
}

export function createDirectPanelDuct(
  project: CpreyDrawProject,
  panelId: string,
  targetApparatusId: string,
  circuitOrigin: CircuitOrigin = { type: 'electrical-panel', id: panelId },
): DuctResult {
  if (!project.electricalPanel || project.electricalPanel.id !== panelId) {
    return { ok: false, reason: 'Tableau électrique introuvable.' };
  }

  const targetApparatus = project.apparatus.find((apparatus) => apparatus.id === targetApparatusId);
  if (!targetApparatus) {
    return { ok: false, reason: 'Appareillage introuvable.' };
  }

  const catalogItem = getApparatusCatalogItem(targetApparatus.catalogId);
  if (!catalogItem.directSupply) {
    return { ok: false, reason: 'Cet appareillage ne prévoit pas d’alimentation directe.' };
  }

  if (getIncomingDuctForApparatus(project, targetApparatusId)) {
    return { ok: false, reason: 'Cet appareillage est déjà raccordé.' };
  }

  const directSpecification = catalogItem.directDuctSpecification;
  const specification: DuctSpecification = {
    outputCode: 'DIRECT',
    destination: catalogItem.name,
    diameterMm: directSpecification?.diameterMm,
    adapterColor: undefined,
    capped: false,
    availableLengthMeters: 0,
    linkColor: 'Noir',
    conductors: directSpecification?.conductors.map((conductor) => ({ ...conductor })) ?? [],
  };

  return createDuctWithGeometry(project, {
    source: { type: 'electrical-panel', id: panelId },
    target: { type: 'apparatus', id: targetApparatusId },
    circuitOrigin,
    specification,
    catalogVersion: catalogItem.id,
    catalogRevision: catalogItem.revision,
  });
}

export function getIncomingDuctForApparatus(
  project: CpreyDrawProject,
  apparatusId: string,
): Duct | undefined {
  return project.ducts.find((duct) => isApparatusEndpoint(duct.target, apparatusId));
}

export function getCircuitExpectedApparatusType(duct: Duct): ApparatusTypeCode | null {
  return getExpectedApparatusType(duct.specification.outputCode);
}

export function getSynchronizableApparatusIdentifierFromDuct(duct: Duct): string | null {
  if (duct.source.type !== 'octopus-output' || duct.target.type !== 'apparatus') {
    return null;
  }

  const code = duct.specification.outputCode.trim().toUpperCase();
  return /^[A-Z]+\d+$/.test(code) ? code : null;
}

export function getApparatusCircuitContext(
  project: CpreyDrawProject,
  apparatusId: string,
): { octopusName: string; outputCode: string; label: string } | null {
  const duct = getIncomingDuctForApparatus(project, apparatusId);
  if (!duct || duct.circuitOrigin.type !== 'octopus-output') {
    return null;
  }

  const circuitOrigin = duct.circuitOrigin;
  const octopus = project.octopuses.find((candidate) => candidate.id === circuitOrigin.octopusId);
  if (!octopus) {
    return null;
  }

  const outputCode = duct.specification.outputCode;
  return {
    octopusName: octopus.name,
    outputCode,
    label: `${octopus.name} / ${outputCode}`,
  };
}

function createOctopusOutputDuct(
  project: CpreyDrawProject,
  source: Extract<DuctEndpoint, { type: 'octopus-output' }>,
  target: DuctEndpoint,
): DuctResult {
  const octopus = project.octopuses.find((currentOctopus) => currentOctopus.id === source.octopusId);
  if (!octopus) {
    return { ok: false, reason: 'Pieuvre introuvable.' };
  }

  const output = getEffectiveOctopusOutput(octopus, source.outputNumber);
  if (!output) {
    return { ok: false, reason: 'Sortie introuvable dans le catalogue.' };
  }

  if (output.state === 'free') {
    return { ok: false, reason: 'Sortie libre — configuration non disponible dans cette version.' };
  }

  if (project.ducts.some((duct) => isSameOctopusOutput(duct.source, source.octopusId, source.outputNumber))) {
    return { ok: false, reason: 'Cette sortie est déjà connectée.' };
  }

  const isPowerSupplyOutput = isPowerSupplyOutputDestination(output.destination);

  if (target.type === 'electrical-panel') {
    if (!isPowerSupplyOutput) {
      return { ok: false, reason: 'Cette sortie doit être connectée à un appareillage.' };
    }

    if (!project.electricalPanel || project.electricalPanel.id !== target.id) {
      return { ok: false, reason: 'Tableau électrique introuvable.' };
    }
  } else if (target.type === 'apparatus') {
    if (isPowerSupplyOutput) {
      return { ok: false, reason: 'Cette sortie d’alimentation doit être connectée au tableau électrique.' };
    }

    const targetApparatus = project.apparatus.find((currentApparatus) => currentApparatus.id === target.id);
    if (!targetApparatus) {
      return { ok: false, reason: 'Appareillage introuvable.' };
    }

    const expectedType = getExpectedApparatusType(output.code);
    const apparatusType = getApparatusCatalogItem(targetApparatus.catalogId).type;
    if (expectedType === null || apparatusType !== expectedType) {
      return {
        ok: false,
        reason: [
          'Connexion impossible.',
          `Sortie : ${output.code}`,
          `Type attendu : ${expectedType ?? 'aucun appareillage'}`,
          `Appareillage : ${getApparatusCatalogItem(targetApparatus.catalogId).name}`,
          `Type : ${apparatusType}`,
        ].join('\n'),
      };
    }

    if (getIncomingDuctForApparatus(project, target.id)) {
      return { ok: false, reason: 'Cet appareillage est déjà raccordé.' };
    }
  } else {
    return { ok: false, reason: 'Type de cible non pris en charge.' };
  }

  const catalogModel = getOctopusCatalogModel(octopus.modelId);

  return createDuctWithGeometry(project, {
    source,
    target,
    circuitOrigin: source,
    catalogVersion: catalogModel.version,
    catalogRevision: catalogModel.revision,
    specification: {
      outputCode: output.code,
      destination: output.destination,
      diameterMm: output.duct.diameterMm,
      adapterColor: output.duct.adapterColor,
      capped: output.duct.capped,
      capColor: output.duct.capColor,
      availableLengthMeters: output.duct.lengthMeters,
      linkColor: output.linkColor,
      conductors: output.conductors.map((conductor) => ({ ...conductor })),
    },
  });
}

function createDuctWithGeometry(
  project: CpreyDrawProject,
  properties: Omit<Duct, 'id' | 'visible' | 'locked' | 'waypoints' | 'controls'>,
): DuctResult {
  ductIdSequence += 1;
  const duct: Duct = {
    id: `duct-${Date.now()}-${ductIdSequence}`,
    ...properties,
    visible: true,
    locked: false,
    waypoints: [],
    controls: [],
  };
  const geometry = getDuctGeometry(
    duct,
    project.octopuses,
    project.apparatus,
    project.electricalPanel,
    project.drawing.metersPerPixel,
  );

  return {
    ok: true,
    duct: geometry ? { ...duct, controls: [createDefaultDuctControlPoint(geometry.start, geometry.end)] } : duct,
  };
}

function isKnownApparatusType(value: string): value is ApparatusTypeCode {
  return ['PR', 'LA', 'SP', 'CS', 'VR', 'HO', 'IN', 'DR', 'FP', 'VM'].includes(value);
}

export function resolveDuctEndpointPosition(
  endpoint: DuctEndpoint,
  octopuses: Octopus[],
  apparatus: ApparatusInstance[],
  electricalPanel: ElectricalPanel | undefined,
  metersPerPixel: number | null,
): Point | null {
  if (metersPerPixel === null) {
    return null;
  }

  if (endpoint.type === 'apparatus') {
    const targetApparatus = apparatus.find((currentApparatus) => currentApparatus.id === endpoint.id);
    return targetApparatus ? { x: targetApparatus.x, y: targetApparatus.y } : null;
  }

  if (endpoint.type === 'electrical-panel') {
    return electricalPanel?.id === endpoint.id ? { x: electricalPanel.x, y: electricalPanel.y } : null;
  }

  const octopus = octopuses.find((currentOctopus) => currentOctopus.id === endpoint.octopusId);
  const port = octopus?.ports.find((currentPort) => currentPort.number === endpoint.outputNumber);
  if (!octopus || !port) {
    return null;
  }

  const { width: physicalWidth, height: physicalHeight } = getOctopusPixelSize(metersPerPixel);
  const displayScale = octopus.displayScale ?? 1;
  const localPortPosition = getOctopusPortLocalPosition(
    port,
    physicalWidth * displayScale,
    physicalHeight * displayScale,
  );
  const rotationRadians = (octopus.rotation * Math.PI) / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);

  return {
    x: octopus.x + localPortPosition.x * cos - localPortPosition.y * sin,
    y: octopus.y + localPortPosition.x * sin + localPortPosition.y * cos,
  };
}

export function getDuctGeometry(
  duct: Duct,
  octopuses: Octopus[],
  apparatus: ApparatusInstance[],
  electricalPanel: ElectricalPanel | undefined,
  metersPerPixel: number | null,
): { start: Point; end: Point } | null {
  const start = resolveDuctEndpointPosition(duct.source, octopuses, apparatus, electricalPanel, metersPerPixel);
  const end = resolveDuctEndpointPosition(duct.target, octopuses, apparatus, electricalPanel, metersPerPixel);
  return start && end ? { start, end } : null;
}

export function getDuctPathPoints(
  duct: Duct,
  octopuses: Octopus[],
  apparatus: ApparatusInstance[],
  electricalPanel: ElectricalPanel | undefined,
  metersPerPixel: number | null,
): Point[] {
  const geometry = getDuctGeometry(duct, octopuses, apparatus, electricalPanel, metersPerPixel);
  return geometry ? [geometry.start, ...duct.waypoints, geometry.end] : [];
}

export function calculateDuctUsedLengthMeters(
  points: Point[],
  metersPerPixel: number | null,
  controls: readonly DuctControlPoint[] = [],
): number | null {
  return calculateQuadraticDuctLengthMeters(points, controls, metersPerPixel);
}

export function calculateDuctLengthStatus(
  availableLengthMeters: number,
  usedLengthMeters: number | null,
): {
  usedLengthMeters: number | null;
  availableLengthMeters: number;
  remainingLengthMeters: number | null;
  overrunMeters: number;
  hasOverrun: boolean;
} {
  if (availableLengthMeters <= 0 || usedLengthMeters === null) {
    return {
      usedLengthMeters,
      availableLengthMeters,
      remainingLengthMeters: availableLengthMeters <= 0 ? null : null,
      overrunMeters: 0,
      hasOverrun: false,
    };
  }

  const remainingLengthMeters = availableLengthMeters - usedLengthMeters - DUCT_LENGTH_MARGIN_METERS;
  const overrunMeters = Math.max(-remainingLengthMeters, 0);

  return {
    usedLengthMeters,
    availableLengthMeters,
    remainingLengthMeters,
    overrunMeters,
    hasOverrun: overrunMeters > 0,
  };
}

export function createDuctWaypoint(position: Point): DuctWaypoint {
  ductWaypointIdSequence += 1;
  return {
    id: `duct-waypoint-${Date.now()}-${ductWaypointIdSequence}`,
    x: position.x,
    y: position.y,
  };
}

export { createDuctControlPoint };

export function getWaypointInsertionIndex(pathPoints: Point[], position: Point): number {
  if (pathPoints.length < 2) {
    return 0;
  }

  return pathPoints.slice(1).reduce(
    (best, point, index) => {
      const previous = pathPoints[index];
      const distanceToSegment = distancePointToSegment(position, previous, point);
      return distanceToSegment < best.distance ? { index, distance: distanceToSegment } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
}

function distance(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function distancePointToSegment(point: Point, start: Point, end: Point): number {
  const segmentLengthSquared = Math.max(distance(start, end) ** 2, Number.EPSILON);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
        segmentLengthSquared,
    ),
  );
  const projection = {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  };

  return distance(point, projection);
}
