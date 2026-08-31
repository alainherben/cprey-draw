import { getApparatusCatalogItem } from '../catalog/apparatus';
import { createApparatusInstance } from '../domain/apparatus';
import { getProjectLayers } from '../domain/layers';
import { createOctopus, OCTOPUS_MODELS } from '../domain/octopus';
import { createImportedStudy, mergeImportedStudyReference, syncStudyWithDrawing } from '../domain/importedStudy';
import { createDefaultTechnicalSettings } from '../domain/technicalSettings';
import { createEmptyProject } from '../storage/ProjectStorage';
import type {
  ApparatusCatalogId,
  ApparatusInstance,
  CdefImportContext,
  CpreyDrawProject,
  Octopus,
  OctopusModelId,
} from '../types/project';
import type {
  CdefImportResult,
  CdefImportSummary,
  CdefImportWarning,
  CdefNormalizedData,
  CdefNormalizedRoom,
  CdefPieuvreTotals,
} from './CdefImportTypes';
import { validateCdefProject } from './CdefImportValidator';

const APPARATUS_METRIC_MAP: Record<string, ApparatusCatalogId> = {
  prises: 'prise-16a',
  prises_spec: 'prise-16a',
  lampes: 'lampe',
  interrupteurs: 'interrupteur-simple',
  vr: 'volet-roulant',
  four: 'four',
  hotte: 'hotte',
  lave_vaisselle: 'lave-vaisselle',
  lave_linge: 'lave-linge',
  seche_linge: 'seche-linge',
  seche_serviette: 'seche-serviette',
  vmc: 'vmc',
  cumulus: 'chauffe-eau',
  pac: 'pompe-a-chaleur',
  chaudiere: 'chaudière',
  convecteur: 'radiateur',
  climatisation: 'pompe-a-chaleur',
  contact_sec: 'contact-sec',
  automatisme_garage: 'garage',
};

const PIEUVRE_MODEL_MAP = {
  cuisine: 'kitchen',
  bain: 'bath',
  confort: 'comfort',
  autre: 'other',
} satisfies Record<'cuisine' | 'bain' | 'confort' | 'autre', OctopusModelId>;

export function importCdefProject(data: unknown, currentProject?: CpreyDrawProject): CdefImportResult {
  const validation = validateCdefProject(data);
  const now = new Date().toISOString();
  const baseProject = currentProject ?? createEmptyProject();
  const warnings = [...validation.warnings];
  const pieuvreTotals = selectPieuvreTotals(validation.data, warnings);
  const octopuses = createImportedOctopuses(pieuvreTotals, now);
  const apparatus = createImportedApparatus(validation.data.rooms, warnings, now);
  const study = mergeImportedStudyReference(baseProject.study, createImportedStudy(apparatus, octopuses));
  const summary = createSummary(validation.data, pieuvreTotals, apparatus);
  const project: CpreyDrawProject = {
    ...baseProject,
    project: {
      ...baseProject.project,
      name: validation.data.projectName,
      updatedAt: now,
    },
    site: {
      ...baseProject.site,
      name: validation.data.projectName,
      projectVersion: 'V1.8',
    },
    status: 'design',
    technicalSettings: createDefaultTechnicalSettings(),
    drawing: {
      ...baseProject.drawing,
      metersPerPixel: baseProject.drawing.metersPerPixel ?? 0.01,
    },
    origin: {
      ...baseProject.origin,
      type: 'configurator',
      configuratorVersion: validation.data.header.applicationVersion,
      importedAt: now,
      sourceApplication: validation.data.header.application,
      sourceVariant: validation.data.header.variant,
      sourceVersion: validation.data.header.applicationVersion,
      exportedAt: validation.data.header.exportedAt,
      selectedScenario: validation.data.selectedScenario,
      configuratorSummary: {
        level: validation.data.selectedScenario,
        requestedOctopuses: [
          { modelId: 'kitchen', quantity: pieuvreTotals.kitchen },
          { modelId: 'bath', quantity: pieuvreTotals.bath },
          { modelId: 'comfort', quantity: pieuvreTotals.comfort },
          { modelId: 'other', quantity: pieuvreTotals.other },
        ],
        requestedApparatus: summary.apparatus.map((item) => ({
          catalogId: item.catalogId,
          type: getApparatusCatalogItem(item.catalogId).type,
          quantity: item.quantity,
        })),
      },
      cdef: {
        schemaVersion: 1,
        levels: Array.from(new Set(validation.data.rooms.map((room) => room.levelName))),
        rooms: validation.data.rooms.map((room) => ({
          levelName: room.levelName,
          roomName: room.roomName,
          profile: room.profile,
        })),
        unknownMetrics: summary.unknownMetrics.map((metric) => ({ ...metric })),
      },
    },
    octopuses,
    apparatus,
    ducts: [],
    study,
    activeLevelId: study?.levels[0]?.id,
  };

  return {
    project: syncStudyWithDrawing({
      ...project,
      layers: getProjectLayers(project),
    }),
    summary,
    warnings,
  };
}

function selectPieuvreTotals(
  data: CdefNormalizedData,
  warnings: CdefImportWarning[],
): Record<OctopusModelId, number> & { total: number } {
  const source = data.scenarioTotals ?? data.calculationTotals ?? {};
  const totals = {
    kitchen: source.cuisine ?? 0,
    bath: source.bain ?? 0,
    comfort: source.confort ?? 0,
    other: source.autre ?? 0,
    total: source.total ?? 0,
  };
  const countedTotal = totals.kitchen + totals.bath + totals.comfort + totals.other;
  if (totals.total === 0) {
    totals.total = countedTotal;
  } else if (totals.total !== countedTotal) {
    warnings.push({
      code: 'pieuvre-total-mismatch',
      message: `Total pieuvres incohérent : ${totals.total} déclaré, ${countedTotal} détaillé.`,
      path: data.scenarioTotals ? 'scenario.result.totals' : 'calculations.pieuvres.totals',
    });
  }
  return totals;
}

function createImportedOctopuses(
  totals: Record<OctopusModelId, number>,
  importedAt: string,
): Octopus[] {
  const octopuses: Octopus[] = [];
  const order: OctopusModelId[] = ['kitchen', 'bath', 'comfort', 'other'];
  const spacingX = 170;
  const spacingY = 140;

  for (const modelId of order) {
    for (let index = 0; index < totals[modelId]; index += 1) {
      const sequenceIndex = octopuses.length;
      const octopus = createOctopus(modelId, {
        x: 120 + (sequenceIndex % 4) * spacingX,
        y: 100 + Math.floor(sequenceIndex / 4) * spacingY,
      }, octopuses);
      octopuses.push({
        ...octopus,
        importContext: {
          source: 'CDEF',
          importedAt,
        },
      });
    }
  }

  return octopuses;
}

function createImportedApparatus(
  rooms: CdefNormalizedRoom[],
  warnings: CdefImportWarning[],
  importedAt: string,
): ApparatusInstance[] {
  const apparatus: ApparatusInstance[] = [];
  const spacingX = 84;
  const spacingY = 78;
  const columns = 8;

  for (const room of rooms) {
    for (const metric of room.metrics) {
      const catalogId = APPARATUS_METRIC_MAP[metric.key];
      if (!catalogId) {
        warnings.push({
          code: 'unknown-apparatus-metric',
          message: `Métrique appareillage inconnue : ${metric.key}.`,
          path: `project.levels.${room.levelName}.${room.roomName}.${metric.key}`,
        });
        continue;
      }

      for (let index = 0; index < metric.quantity; index += 1) {
        const sequenceIndex = apparatus.length;
        const importContext: CdefImportContext = {
          source: 'CDEF',
          importedAt,
          levelName: room.levelName,
          roomName: room.roomName,
          roomProfile: room.profile,
          metricKey: metric.key,
        };
        const instance = createApparatusInstance(catalogId, {
          x: 120 + (sequenceIndex % columns) * spacingX,
          y: 420 + Math.floor(sequenceIndex / columns) * spacingY,
        }, apparatus);
        apparatus.push({
          ...instance,
          importContext,
          comments: formatImportContextComment(importContext),
        });
      }
    }
  }

  return apparatus;
}

function createSummary(
  data: CdefNormalizedData,
  pieuvres: Record<OctopusModelId, number> & { total: number },
  apparatus: ApparatusInstance[],
): CdefImportSummary {
  const apparatusByMetric = new Map<string, {
    metricKey: string;
    catalogId: ApparatusCatalogId;
    label: string;
    quantity: number;
  }>();
  for (const item of apparatus) {
    const metricKey = item.importContext?.metricKey ?? item.catalogId;
    const current = apparatusByMetric.get(metricKey);
    const catalogItem = getApparatusCatalogItem(item.catalogId);
    apparatusByMetric.set(metricKey, {
      metricKey,
      catalogId: item.catalogId,
      label: catalogItem.name,
      quantity: (current?.quantity ?? 0) + 1,
    });
  }

  return {
    projectName: data.projectName,
    sourceApplication: data.header.application,
    sourceVariant: data.header.variant,
    sourceVersion: data.header.applicationVersion,
    exportedAt: data.header.exportedAt,
    selectedScenario: data.selectedScenario,
    levelsCount: new Set(data.rooms.map((room) => room.levelName)).size,
    roomsCount: data.rooms.length,
    pieuvres,
    apparatus: Array.from(apparatusByMetric.values()).sort((left, right) =>
      left.label.localeCompare(right.label, 'fr'),
    ),
    unknownMetrics: data.rooms.flatMap((room) =>
      room.metrics
        .filter((metric) => !APPARATUS_METRIC_MAP[metric.key])
        .map((metric) => ({
          levelName: room.levelName,
          roomName: room.roomName,
          metricKey: metric.key,
          quantity: metric.quantity,
        })),
    ),
    rooms: data.rooms.map((room) => ({
      levelName: room.levelName,
      roomName: room.roomName,
      profile: room.profile,
    })),
  };
}

function formatImportContextComment(context: CdefImportContext): string {
  const parts = [
    `Niveau : ${context.levelName}`,
    `Pièce : ${context.roomName}`,
    context.roomProfile ? `Profil : ${context.roomProfile}` : undefined,
  ].filter(Boolean);
  return parts.join('\n');
}

export function getCdefApparatusMetricMap(): Readonly<Record<string, ApparatusCatalogId>> {
  return APPARATUS_METRIC_MAP;
}

export function getCdefPieuvreModelMap(): Readonly<Record<'cuisine' | 'bain' | 'confort' | 'autre', OctopusModelId>> {
  return PIEUVRE_MODEL_MAP;
}

export function getCdefPieuvreLabel(modelId: OctopusModelId): string {
  return OCTOPUS_MODELS[modelId].defaultNamePrefix;
}
