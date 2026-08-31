import { getApparatusCatalogItem } from '../catalog/apparatus';
import { getOctopusCatalogModel } from '../catalog/octopuses';
import {
  calculateDuctLengthStatus,
  getDuctPathPoints,
  getIncomingDuctForApparatus,
} from './ducts';
import { getEffectiveOctopusOutputs } from './octopusOutputs';
import { calculateDuctLengthBreakdownFromPoints } from './technicalSettings';
import type {
  ApparatusCatalogId,
  ApparatusInstance,
  CpreyDrawProject,
  Duct,
  ElectricalPanel,
  Octopus,
} from '../types/project';

export interface NomenclatureCountItem {
  key: string;
  label: string;
  count: number;
}

export interface NomenclatureLengthItem {
  diameterMm: 16 | 20 | 25;
  usedLengthMeters: number;
  availableLengthMeters: number;
  remainingLengthMeters: number;
}

export interface NomenclatureConductorItem {
  key: string;
  color: string;
  sectionMm2: 1.5 | 2.5 | 6;
  lengthMeters: number;
}

export interface NomenclatureAdapterItem {
  key: string;
  diameterMm: 16 | 20 | 25;
  adapterColor: string;
  count: number;
}

export interface NomenclatureCapItem {
  capColor: string;
  count: number;
}

export interface NomenclatureCustomOutput {
  outputNumber: number;
  code: string;
  destination: string;
  diameterMm: 16 | 20 | 25;
  availableLengthMeters: number;
}

export interface NomenclatureOctopusDetail {
  id: string;
  name: string;
  modelName: string;
  standardUsed: number;
  standardUnconnected: number;
  customOutputs: NomenclatureCustomOutput[];
  freeRemaining: number;
}

export interface NomenclatureDuctItem {
  id: string;
  label: string;
  diameterMm: 16 | 20 | 25 | null;
  usedLengthMeters: number | null;
  availableLengthMeters: number | null;
  remainingLengthMeters: number | null;
}

export interface NomenclatureDirectUnspecifiedItem {
  ductId: string;
  apparatusLabel: string;
  usedLengthMeters: number | null;
}

export interface NomenclatureReserveItem {
  octopusId: string;
  octopusName: string;
  freeOutputs: number;
}

export interface NomenclatureOverrunItem {
  ductId: string;
  label: string;
  availableLengthMeters: number;
  usedLengthMeters: number;
  overrunMeters: number;
}

export interface NomenclatureUnconnectedApparatus {
  id: string;
  identifier: string;
  name: string;
  catalogName: string;
}

export interface NomenclatureUnconnectedStandardOutput {
  octopusId: string;
  octopusName: string;
  outputNumber: number;
  code: string;
  destination: string;
}

export interface ProjectNomenclature {
  summary: {
    octopusCount: number;
    apparatusCount: number;
    ductCount: number;
    totalUsedDuctLengthMeters: number;
  };
  octopuses: {
    byModel: NomenclatureCountItem[];
    details: NomenclatureOctopusDetail[];
  };
  apparatus: {
    byCatalog: NomenclatureCountItem[];
    byType: NomenclatureCountItem[];
    unconnected: NomenclatureUnconnectedApparatus[];
  };
  ducts: {
    items: NomenclatureDuctItem[];
    byDiameter: NomenclatureLengthItem[];
    directUnspecified: NomenclatureDirectUnspecifiedItem[];
    overruns: NomenclatureOverrunItem[];
  };
  conductors: NomenclatureConductorItem[];
  adapters: NomenclatureAdapterItem[];
  caps: NomenclatureCapItem[];
  reserves: NomenclatureReserveItem[];
  unconnectedStandardOutputs: NomenclatureUnconnectedStandardOutput[];
}

export function buildProjectNomenclature(project: CpreyDrawProject): ProjectNomenclature {
  const octopusDetails = project.octopuses.map((octopus) => buildOctopusNomenclature(project, octopus.id));
  const ductItems = project.ducts.map((duct) => buildDuctItem(project, duct));
  const byDiameter = buildDuctLengthsByDiameter(ductItems);
  const conductors = buildConductorItems(project, ductItems);
  const adapters = buildAdapterItems(project);
  const caps = buildCapItems(project.octopuses);
  const apparatusByCatalog = countApparatusByCatalog(project.apparatus);
  const apparatusByType = countApparatusByType(project.apparatus);
  const unconnectedApparatus = buildUnconnectedApparatus(project);
  const directUnspecified = buildDirectUnspecifiedItems(project, ductItems);
  const overruns = buildOverrunItems(ductItems);

  return {
    summary: {
      octopusCount: project.octopuses.length,
      apparatusCount: project.apparatus.length,
      ductCount: project.ducts.length,
      totalUsedDuctLengthMeters: ductItems.reduce((total, duct) => total + (duct.usedLengthMeters ?? 0), 0),
    },
    octopuses: {
      byModel: countOctopusesByModel(project.octopuses),
      details: octopusDetails,
    },
    apparatus: {
      byCatalog: apparatusByCatalog,
      byType: apparatusByType,
      unconnected: unconnectedApparatus,
    },
    ducts: {
      items: ductItems,
      byDiameter,
      directUnspecified,
      overruns,
    },
    conductors,
    adapters,
    caps,
    reserves: octopusDetails.map((detail) => ({
      octopusId: detail.id,
      octopusName: detail.name,
      freeOutputs: detail.freeRemaining,
    })),
    unconnectedStandardOutputs: buildUnconnectedStandardOutputs(project),
  };
}

export function buildOctopusNomenclature(
  project: CpreyDrawProject,
  octopusId: string,
): NomenclatureOctopusDetail {
  const octopus = project.octopuses.find((candidate) => candidate.id === octopusId);
  if (!octopus) {
    throw new Error(`Pieuvre introuvable: ${octopusId}`);
  }

  const outputs = getEffectiveOctopusOutputs(octopus);
  const usedOutputNumbers = new Set(
    project.ducts
      .filter((duct) => duct.source.type === 'octopus-output' && duct.source.octopusId === octopus.id)
      .map((duct) => duct.source.type === 'octopus-output' ? duct.source.outputNumber : 0),
  );

  return {
    id: octopus.id,
    name: octopus.name,
    modelName: getOctopusCatalogModel(octopus.modelId).name,
    standardUsed: outputs.filter((output) => output.state === 'standard' && usedOutputNumbers.has(output.outputNumber)).length,
    standardUnconnected: outputs.filter((output) => output.state === 'standard' && !usedOutputNumbers.has(output.outputNumber)).length,
    customOutputs: outputs
      .filter((output) => output.state === 'custom')
      .map((output) => ({
        outputNumber: output.outputNumber,
        code: output.code,
        destination: output.destination,
        diameterMm: output.duct.diameterMm,
        availableLengthMeters: output.duct.lengthMeters,
      })),
    freeRemaining: outputs.filter((output) => output.state === 'free').length,
  };
}

function buildDuctItem(project: CpreyDrawProject, duct: Duct): NomenclatureDuctItem {
  const pathPoints = getDuctPathPoints(
    duct,
    project.octopuses,
    project.apparatus,
    project.electricalPanel,
    project.drawing.metersPerPixel,
  );
  const usedLengthMeters = calculateDuctLengthBreakdownFromPoints(project, duct, pathPoints, duct.controls).total;
  const availableLengthMeters = duct.specification.availableLengthMeters > 0
    ? duct.specification.availableLengthMeters
    : null;
  const remainingLengthMeters = availableLengthMeters !== null && usedLengthMeters !== null
    ? availableLengthMeters - usedLengthMeters
    : null;

  return {
    id: duct.id,
    label: getDuctNomenclatureLabel(project, duct),
    diameterMm: duct.specification.diameterMm ?? null,
    usedLengthMeters,
    availableLengthMeters,
    remainingLengthMeters,
  };
}

function buildDuctLengthsByDiameter(ductItems: NomenclatureDuctItem[]): NomenclatureLengthItem[] {
  const byDiameter = new Map<16 | 20 | 25, NomenclatureLengthItem>();

  for (const duct of ductItems) {
    if (!duct.diameterMm) {
      continue;
    }

    const current = byDiameter.get(duct.diameterMm) ?? {
      diameterMm: duct.diameterMm,
      usedLengthMeters: 0,
      availableLengthMeters: 0,
      remainingLengthMeters: 0,
    };

    current.usedLengthMeters += duct.usedLengthMeters ?? 0;
    current.availableLengthMeters += duct.availableLengthMeters ?? 0;
    current.remainingLengthMeters = current.availableLengthMeters - current.usedLengthMeters;
    byDiameter.set(duct.diameterMm, current);
  }

  return [...byDiameter.values()].sort((left, right) => left.diameterMm - right.diameterMm);
}

function buildConductorItems(
  project: CpreyDrawProject,
  ductItems: NomenclatureDuctItem[],
): NomenclatureConductorItem[] {
  const ductLengths = new Map(ductItems.map((duct) => [duct.id, duct.usedLengthMeters]));
  const conductors = new Map<string, NomenclatureConductorItem>();

  for (const duct of project.ducts) {
    const usedLengthMeters = ductLengths.get(duct.id);
    if (usedLengthMeters === null || usedLengthMeters === undefined) {
      continue;
    }

    for (const conductor of duct.specification.conductors) {
      const key = `${conductor.color}|${conductor.sectionMm2}`;
      const current = conductors.get(key) ?? {
        key,
        color: conductor.color,
        sectionMm2: conductor.sectionMm2,
        lengthMeters: 0,
      };
      current.lengthMeters += usedLengthMeters * conductor.quantity;
      conductors.set(key, current);
    }
  }

  return [...conductors.values()].sort((left, right) =>
    left.color.localeCompare(right.color, 'fr') || left.sectionMm2 - right.sectionMm2,
  );
}

function buildAdapterItems(project: CpreyDrawProject): NomenclatureAdapterItem[] {
  const adapters = new Map<string, NomenclatureAdapterItem>();

  for (const duct of project.ducts) {
    const diameterMm = duct.specification.diameterMm;
    const adapterColor = duct.specification.adapterColor;
    if (!diameterMm || !adapterColor) {
      continue;
    }

    const key = `${adapterColor}|${diameterMm}`;
    const current = adapters.get(key) ?? {
      key,
      diameterMm,
      adapterColor,
      count: 0,
    };
    current.count += 1;
    adapters.set(key, current);
  }

  return [...adapters.values()].sort((left, right) =>
    left.diameterMm - right.diameterMm || left.adapterColor.localeCompare(right.adapterColor, 'fr'),
  );
}

function buildCapItems(octopuses: Octopus[]): NomenclatureCapItem[] {
  const caps = new Map<string, NomenclatureCapItem>();

  for (const octopus of octopuses) {
    for (const output of getEffectiveOctopusOutputs(octopus)) {
      if (output.state !== 'free' || !output.duct.capped || !output.duct.capColor) {
        continue;
      }

      const current = caps.get(output.duct.capColor) ?? {
        capColor: output.duct.capColor,
        count: 0,
      };
      current.count += 1;
      caps.set(output.duct.capColor, current);
    }
  }

  return [...caps.values()].sort((left, right) => left.capColor.localeCompare(right.capColor, 'fr'));
}

function countOctopusesByModel(octopuses: Octopus[]): NomenclatureCountItem[] {
  const counts = new Map<string, NomenclatureCountItem>();

  for (const octopus of octopuses) {
    const catalogModel = getOctopusCatalogModel(octopus.modelId);
    const current = counts.get(octopus.modelId) ?? {
      key: octopus.modelId,
      label: catalogModel.name.replace('Pieuvre ', ''),
      count: 0,
    };
    current.count += 1;
    counts.set(octopus.modelId, current);
  }

  return [...counts.values()].sort((left, right) => left.label.localeCompare(right.label, 'fr'));
}

function countApparatusByCatalog(apparatus: ApparatusInstance[]): NomenclatureCountItem[] {
  const counts = new Map<ApparatusCatalogId, NomenclatureCountItem>();

  for (const item of apparatus) {
    const catalogItem = getApparatusCatalogItem(item.catalogId);
    const current = counts.get(item.catalogId) ?? {
      key: item.catalogId,
      label: catalogItem.name,
      count: 0,
    };
    current.count += 1;
    counts.set(item.catalogId, current);
  }

  return [...counts.values()].sort((left, right) => left.label.localeCompare(right.label, 'fr'));
}

function countApparatusByType(apparatus: ApparatusInstance[]): NomenclatureCountItem[] {
  const counts = new Map<string, NomenclatureCountItem>();

  for (const item of apparatus) {
    const catalogItem = getApparatusCatalogItem(item.catalogId);
    const current = counts.get(catalogItem.type) ?? {
      key: catalogItem.type,
      label: catalogItem.type,
      count: 0,
    };
    current.count += 1;
    counts.set(catalogItem.type, current);
  }

  return [...counts.values()].sort((left, right) => left.label.localeCompare(right.label, 'fr'));
}

function buildUnconnectedApparatus(project: CpreyDrawProject): NomenclatureUnconnectedApparatus[] {
  return project.apparatus
    .filter((apparatus) => !getIncomingDuctForApparatus(project, apparatus.id))
    .map((apparatus) => ({
      id: apparatus.id,
      identifier: apparatus.identifier,
      name: apparatus.name,
      catalogName: getApparatusCatalogItem(apparatus.catalogId).name,
    }))
    .sort((left, right) => left.identifier.localeCompare(right.identifier, 'fr'));
}

function buildDirectUnspecifiedItems(
  project: CpreyDrawProject,
  ductItems: NomenclatureDuctItem[],
): NomenclatureDirectUnspecifiedItem[] {
  const itemById = new Map(ductItems.map((duct) => [duct.id, duct]));

  return project.ducts
    .filter((duct) =>
      duct.source.type === 'electrical-panel' &&
      duct.target.type === 'apparatus' &&
      !duct.specification.diameterMm,
    )
    .map((duct) => ({
      ductId: duct.id,
      apparatusLabel: duct.target.type === 'apparatus'
        ? getEndpointApparatusLabel(project.apparatus, duct.target.id)
        : 'Appareillage introuvable',
      usedLengthMeters: itemById.get(duct.id)?.usedLengthMeters ?? null,
    }));
}

function buildOverrunItems(ductItems: NomenclatureDuctItem[]): NomenclatureOverrunItem[] {
  return ductItems.flatMap((duct) => {
    if (duct.availableLengthMeters === null || duct.usedLengthMeters === null) {
      return [];
    }

    const status = calculateDuctLengthStatus(duct.availableLengthMeters, duct.usedLengthMeters);
    return status.hasOverrun
      ? [{
          ductId: duct.id,
          label: duct.label,
          availableLengthMeters: duct.availableLengthMeters,
          usedLengthMeters: duct.usedLengthMeters,
          overrunMeters: status.overrunMeters,
        }]
      : [];
  });
}

function buildUnconnectedStandardOutputs(project: CpreyDrawProject): NomenclatureUnconnectedStandardOutput[] {
  return project.octopuses.flatMap((octopus) => {
    const usedOutputNumbers = new Set(
      project.ducts
        .filter((duct) => duct.source.type === 'octopus-output' && duct.source.octopusId === octopus.id)
        .map((duct) => duct.source.type === 'octopus-output' ? duct.source.outputNumber : 0),
    );

    return getEffectiveOctopusOutputs(octopus)
      .filter((output) => output.state === 'standard' && !usedOutputNumbers.has(output.outputNumber))
      .map((output) => ({
        octopusId: octopus.id,
        octopusName: octopus.name,
        outputNumber: output.outputNumber,
        code: output.code,
        destination: output.destination,
      }));
  });
}

function getDuctNomenclatureLabel(project: CpreyDrawProject, duct: Duct): string {
  if (duct.circuitOrigin.type === 'octopus-output') {
    const circuitOrigin = duct.circuitOrigin;
    const octopus = project.octopuses.find((candidate) => candidate.id === circuitOrigin.octopusId);
    return `${octopus?.name ?? 'Pieuvre introuvable'} / ${duct.specification.outputCode}`;
  }

  const targetLabel = duct.target.type === 'apparatus'
    ? getEndpointApparatusLabel(project.apparatus, duct.target.id)
    : 'Appareillage introuvable';
  return `${getPanelLabel(project.electricalPanel)} / ${targetLabel}`;
}

function getPanelLabel(electricalPanel: ElectricalPanel | undefined): string {
  return electricalPanel?.name ?? 'Tableau électrique';
}

function getEndpointApparatusLabel(apparatus: ApparatusInstance[], apparatusId: string): string {
  const item = apparatus.find((candidate) => candidate.id === apparatusId);
  if (!item) {
    return 'Appareillage introuvable';
  }

  return `${item.identifier} — ${getApparatusCatalogItem(item.catalogId).name}`;
}
