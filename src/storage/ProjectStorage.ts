import type {
  ApparatusInstance,
  ApparatusCatalogId,
  CircuitOrigin,
  CpreyDrawProject,
  Duct,
  DuctEndpoint,
  ElectricalPanel,
  Octopus,
  Plan,
} from '../types/project';
import { OCTOPUS_HEIGHT_METERS, OCTOPUS_LAYER_ID, OCTOPUS_PORTS, OCTOPUS_WIDTH_METERS } from '../domain/octopus';
import { getOctopusCatalogModel } from '../catalog/octopuses';
import { APPARATUS_LAYER_ID } from '../domain/apparatus';
import { APPARATUS_CATALOG_VERSION, getApparatusCatalogItem } from '../catalog/apparatus';
import { createBaseLayers, getProjectLayers } from '../domain/layers';
import { normalizeDuctControlsForPoints } from '../domain/ductGeometry';
import { getDuctPathPoints } from '../domain/ducts';
import { getEffectiveOctopusOutput } from '../domain/octopusOutputs';

const STORAGE_KEY = 'cprey-draw.current-project.v1';

function createProjectId(): string {
  return `project-${Date.now()}`;
}

export function createEmptyProject(): CpreyDrawProject {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    project: {
      id: createProjectId(),
      name: 'Projet CPREY DRAW',
      updatedAt: now,
    },
    drawing: {
      viewport: { x: 0, y: 0, scale: 1 },
      metersPerPixel: null,
      scaleReference: null,
      scaleMarkerVisible: true,
      zoomWheelEnabled: true,
      movementLocked: false,
      showDuctLengths: true,
      apparatusGlobalScale: 1,
    },
    plans: [],
    octopuses: [],
    apparatus: [],
    ducts: [],
    layers: createBaseLayers(),
  };
}

interface LegacyPlanImage {
  id: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg';
  dataUrl: string;
  width: number;
  height: number;
  createdAt: string;
}

function normalizePlan(plan: Plan | LegacyPlanImage): Plan {
  if ('source' in plan) {
    return {
      ...plan,
      visible: plan.visible ?? true,
      locked: plan.locked ?? false,
      opacity: plan.opacity ?? 1,
      rotation: plan.rotation ?? 0,
    };
  }

  return {
    id: plan.id,
    name: plan.name,
    source: plan.dataUrl,
    visible: true,
    locked: false,
    opacity: 1,
    rotation: 0,
    mimeType: plan.mimeType,
    width: plan.width,
    height: plan.height,
    importedAt: plan.createdAt,
  };
}

type LegacyProject = CpreyDrawProject & { connections?: LegacyDuct[] };

function normalizeProject(project: LegacyProject): CpreyDrawProject {
  const rawApparatus = Array.isArray(project.apparatus) ? project.apparatus : [];
  const rawDucts = Array.isArray(project.ducts) && project.ducts.length > 0
    ? project.ducts
    : Array.isArray(project.connections)
      ? project.connections
      : [];

  const normalizedProject: CpreyDrawProject = {
    ...project,
    drawing: {
      viewport: project.drawing.viewport,
      metersPerPixel: project.drawing.metersPerPixel,
      scaleReference: project.drawing.scaleReference,
      scaleMarkerVisible: project.drawing.scaleMarkerVisible ?? project.drawing.scaleReference !== null,
      zoomWheelEnabled: project.drawing.zoomWheelEnabled ?? true,
      movementLocked: project.drawing.movementLocked ?? false,
      showDuctLengths: project.drawing.showDuctLengths ?? true,
      apparatusGlobalScale: project.drawing.apparatusGlobalScale ?? 1,
    },
    plans: project.plans.map((plan) => normalizePlan(plan as Plan | LegacyPlanImage)),
    electricalPanel: project.electricalPanel
      ? normalizeElectricalPanel(project.electricalPanel)
      : undefined,
    octopuses: Array.isArray(project.octopuses)
      ? project.octopuses.map(normalizeOctopus)
      : [],
    apparatus: rawApparatus.map((apparatus, index) =>
      normalizeApparatus(apparatus, rawApparatus.slice(0, index)),
    ),
    ducts: rawDucts.map((duct) => normalizeDuct(duct, project)),
    layers: Array.isArray(project.layers) ? project.layers : createBaseLayers(),
  };

  return {
    ...normalizedProject,
    layers: getProjectLayers(normalizedProject),
  };
}

function normalizeElectricalPanel(panel: ElectricalPanel): ElectricalPanel {
  return {
    ...panel,
    type: 'electrical-panel',
    visible: panel.visible ?? true,
    locked: panel.locked ?? false,
    layerId: panel.layerId ?? 'electrical-panel',
    widthMeters: panel.widthMeters ?? 0.25,
    heightMeters: panel.heightMeters ?? 0.1,
    rows: panel.rows ?? 3,
    reserveModules: panel.reserveModules ?? 0,
    comments: panel.comments ?? '',
  };
}

function normalizeOctopus(octopus: Octopus): Octopus {
  const catalogModel = getOctopusCatalogModel(octopus.modelId);

  return {
    ...octopus,
    type: 'octopus',
    catalogVersion: octopus.catalogVersion ?? catalogModel.version,
    catalogRevision: octopus.catalogRevision ?? catalogModel.revision,
    visible: octopus.visible ?? true,
    locked: octopus.locked ?? false,
    layerId: octopus.layerId ?? OCTOPUS_LAYER_ID,
    displayScale: octopus.displayScale ?? catalogModel.defaultDisplayScale,
    widthMeters: octopus.widthMeters ?? catalogModel.widthMeters ?? OCTOPUS_WIDTH_METERS,
    heightMeters: octopus.heightMeters ?? catalogModel.heightMeters ?? OCTOPUS_HEIGHT_METERS,
    ports: Array.isArray(octopus.ports) && octopus.ports.length === 16
      ? octopus.ports
      : OCTOPUS_PORTS.map((port) => ({ ...port })),
    outputOverrides: Array.isArray(octopus.outputOverrides)
      ? octopus.outputOverrides.map((override) => ({
          ...override,
          enabled: override.enabled ?? true,
          duct: {
            ...override.duct,
            capped: override.duct.capped ?? false,
          },
          conductors: Array.isArray(override.conductors)
            ? override.conductors.map((conductor) => ({ ...conductor }))
            : [],
        }))
      : [],
    comments: octopus.comments ?? '',
  };
}

function normalizeApparatus(
  apparatus: ApparatusInstance,
  previousApparatus: ApparatusInstance[] = [],
): ApparatusInstance {
  const catalogId = normalizeApparatusCatalogId(apparatus.catalogId);
  const catalogItem = getApparatusCatalogItem(catalogId);
  const normalizedApparatus = { ...apparatus, catalogId };
  const identifier = normalizedApparatus.identifier ?? createLegacyApparatusIdentifier(normalizedApparatus, previousApparatus);

  return {
    ...normalizedApparatus,
    type: 'apparatus',
    catalogVersion: apparatus.catalogVersion ?? APPARATUS_CATALOG_VERSION,
    catalogRevision: apparatus.catalogRevision ?? catalogItem.revision,
    identifier,
    visible: apparatus.visible ?? true,
    locked: apparatus.locked ?? false,
    layerId: apparatus.layerId ?? APPARATUS_LAYER_ID,
    connected: apparatus.connected ?? catalogItem.connectedDefault,
    displayScale: apparatus.displayScale ?? catalogItem.defaultDisplayScale,
    labelPosition: apparatus.labelPosition ?? 'right',
    labelFontSize: apparatus.labelFontSize ?? 12,
    labelOffsetX: apparatus.labelOffsetX ?? 0,
    labelOffsetY: apparatus.labelOffsetY ?? 0,
    labelLocked: apparatus.labelLocked ?? false,
    comments: apparatus.comments ?? '',
  };
}

function normalizeApparatusCatalogId(catalogId: string): ApparatusCatalogId {
  return catalogId === 'prise-16Ha' ? 'prise_haute' : catalogId as ApparatusCatalogId;
}

function createLegacyApparatusIdentifier(
  apparatus: ApparatusInstance,
  previousApparatus: ApparatusInstance[],
): string {
  const catalogItem = getApparatusCatalogItem(normalizeApparatusCatalogId(apparatus.catalogId));
  const sameTypeCount = previousApparatus.filter(
    (previous) => getApparatusCatalogItem(normalizeApparatusCatalogId(previous.catalogId)).type === catalogItem.type,
  ).length;

  return `${catalogItem.type}${sameTypeCount + 1}`;
}

type LegacyDuct = Partial<Duct> & {
  id: string;
  octopusId?: string;
  outputNumber?: number;
  color?: string;
  apparatusId?: string;
};

function normalizeDuct(duct: LegacyDuct, project: LegacyProject): Duct {
  const source = normalizeDuctSource(duct);
  const sourceOctopus = source.type === 'octopus-output' ? source : null;
  const octopus = sourceOctopus
    ? project.octopuses.find((currentOctopus) => currentOctopus.id === sourceOctopus.octopusId)
    : undefined;
  const catalogModel = octopus ? getOctopusCatalogModel(octopus.modelId) : null;
  const output = octopus && sourceOctopus ? getEffectiveOctopusOutput(octopus, sourceOctopus.outputNumber) : undefined;
  const target = duct.target ?? {
    type: 'apparatus' as const,
    id: duct.apparatusId ?? '',
  };
  const circuitOrigin: CircuitOrigin = duct.circuitOrigin ?? (
    source.type === 'octopus-output'
      ? { ...source }
      : { type: 'electrical-panel', id: source.type === 'electrical-panel' ? source.id : project.electricalPanel?.id ?? '' }
  );

  const normalizedDuct: Duct = {
    id: duct.id,
    source,
    target,
    circuitOrigin,
    visible: duct.visible ?? true,
    locked: duct.locked ?? false,
    waypoints: Array.isArray(duct.waypoints)
      ? duct.waypoints.map((waypoint) => ({ id: waypoint.id, x: waypoint.x, y: waypoint.y }))
      : [],
    controls: Array.isArray(duct.controls)
      ? duct.controls.map((control) => ({ id: control.id, x: control.x, y: control.y }))
      : [],
    catalogVersion: duct.catalogVersion ?? catalogModel?.version ?? 'unknown',
    catalogRevision: duct.catalogRevision ?? catalogModel?.revision ?? 0,
    specification: duct.specification ?? {
      outputCode: output?.code ?? '',
      destination: output?.destination ?? '',
      diameterMm: output?.duct.diameterMm ?? 20,
      adapterColor: output?.duct.adapterColor ?? 'blue',
      capped: output?.duct.capped ?? false,
      capColor: output?.duct.capColor,
      availableLengthMeters: output?.duct.lengthMeters ?? 0,
      linkColor: output?.linkColor ?? duct.color ?? 'Gris',
      conductors: output?.conductors.map((conductor) => ({ ...conductor })) ?? [],
    },
  };
  const pathPoints = getDuctPathPoints(
    normalizedDuct,
    project.octopuses,
    Array.isArray(project.apparatus) ? project.apparatus : [],
    project.electricalPanel,
    project.drawing?.metersPerPixel ?? null,
  );

  return {
    ...normalizedDuct,
    controls: pathPoints.length >= 2
      ? normalizeDuctControlsForPoints(pathPoints, normalizedDuct.controls)
      : normalizedDuct.controls,
  };
}

function normalizeDuctSource(duct: LegacyDuct): DuctEndpoint {
  if (duct.source) {
    return duct.source;
  }

  return {
    type: 'octopus-output',
    octopusId: duct.octopusId ?? '',
    outputNumber: duct.outputNumber ?? 0,
  };
}

function isProject(value: unknown): value is CpreyDrawProject {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeProject = value as Partial<CpreyDrawProject>;
  return (
    maybeProject.schemaVersion === 1 &&
    typeof maybeProject.project?.id === 'string' &&
    typeof maybeProject.drawing?.viewport?.scale === 'number' &&
    Array.isArray(maybeProject.plans)
  );
}

export const ProjectStorage = {
  load(): CpreyDrawProject {
    const rawProject = window.localStorage.getItem(STORAGE_KEY);

    if (!rawProject) {
      return createEmptyProject();
    }

    try {
      const parsed: unknown = JSON.parse(rawProject);
      return isProject(parsed) ? normalizeProject(parsed) : createEmptyProject();
    } catch {
      return createEmptyProject();
    }
  },

  save(project: CpreyDrawProject): void {
    const projectToSave: CpreyDrawProject = {
      ...project,
      project: {
        ...project.project,
        updatedAt: new Date().toISOString(),
      },
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projectToSave));
  },

  clear(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  },
};
