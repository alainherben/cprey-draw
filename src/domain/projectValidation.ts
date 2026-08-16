import { getApparatusCatalogItem } from '../catalog/apparatus';
import {
  calculateDuctLengthStatus,
  calculateDuctUsedLengthMeters,
  getDuctPathPoints,
  getExpectedApparatusType,
  isPowerSupplyOutputDestination,
} from './ducts';
import { getEffectiveOctopusOutput, getEffectiveOctopusOutputs, validateOctopusOutputOverride } from './octopusOutputs';
import type {
  ApparatusInstance,
  CpreyDrawProject,
  Duct,
  DuctConductor,
  DuctEndpoint,
  Octopus,
} from '../types/project';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationEntityType =
  | 'project'
  | 'octopus'
  | 'octopus-output'
  | 'apparatus'
  | 'duct'
  | 'electrical-panel';

export interface ProjectIssue {
  id: string;
  code: string;
  severity: ValidationSeverity;
  title: string;
  message: string;
  entityType: ValidationEntityType;
  entityId?: string;
  octopusId?: string;
  outputNumber?: number;
  relatedEntityIds?: string[];
}

export interface ProjectValidationResult {
  issues: ProjectIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  isValid: boolean;
}

const VALID_DUCT_DIAMETERS = [16, 20, 25];
const VALID_CONDUCTOR_SECTIONS = [1.5, 2.5, 6];

export function validateProject(project: CpreyDrawProject): ProjectValidationResult {
  const issues: ProjectIssue[] = [
    ...validateOverrides(project),
    ...validateDuctReferences(project),
    ...validateDuctTopology(project),
    ...validateDuctBusinessRules(project),
    ...validateOutputs(project),
    ...validateUnconnectedApparatus(project),
    ...validateCycles(project),
  ];

  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const infoCount = issues.filter((issue) => issue.severity === 'info').length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    isValid: errorCount === 0,
  };
}

function validateOverrides(project: CpreyDrawProject): ProjectIssue[] {
  return project.octopuses.flatMap((octopus) =>
    (octopus.outputOverrides ?? []).flatMap((override) =>
      validateOctopusOutputOverride(octopus, override).map((message, index) => issue({
        id: `override-invalid:${octopus.id}:${override.outputNumber}:${index}`,
        code: 'OCTOPUS_OUTPUT_OVERRIDE_INVALID',
        severity: 'error',
        title: 'Sortie personnalisée invalide',
        message: `${octopus.name} / sortie ${override.outputNumber} : ${message}`,
        entityType: 'octopus-output',
        entityId: octopus.id,
        octopusId: octopus.id,
        outputNumber: override.outputNumber,
      })),
    ),
  );
}

function validateDuctReferences(project: CpreyDrawProject): ProjectIssue[] {
  const issues: ProjectIssue[] = [];

  for (const duct of project.ducts) {
    const sourceIssue = validateEndpointReference(project, duct, duct.source, 'source');
    if (sourceIssue) {
      issues.push(sourceIssue);
    }

    const targetIssue = validateEndpointReference(project, duct, duct.target, 'cible');
    if (targetIssue) {
      issues.push(targetIssue);
    }

    if (duct.circuitOrigin.type === 'octopus-output') {
      const originOctopus = findOctopus(project, duct.circuitOrigin.octopusId);
      const originOutput = originOctopus
        ? getEffectiveOctopusOutput(originOctopus, duct.circuitOrigin.outputNumber)
        : undefined;
      if (!originOctopus || !originOutput) {
        issues.push(issue({
          id: `duct-origin-invalid:${duct.id}`,
          code: 'DUCT_CIRCUIT_ORIGIN_INVALID',
          severity: 'error',
          title: 'Origine de circuit invalide',
          message: 'La gaine référence une pieuvre ou une sortie d’origine inexistante.',
          entityType: 'duct',
          entityId: duct.id,
        }));
      }
    } else if (!project.electricalPanel || project.electricalPanel.id !== duct.circuitOrigin.id) {
      issues.push(issue({
        id: `duct-origin-panel-invalid:${duct.id}`,
        code: 'DUCT_CIRCUIT_ORIGIN_INVALID',
        severity: 'error',
        title: 'Origine tableau invalide',
        message: 'La gaine directe référence un tableau électrique absent.',
        entityType: 'duct',
        entityId: duct.id,
      }));
    }
  }

  return issues;
}

function validateEndpointReference(
  project: CpreyDrawProject,
  duct: Duct,
  endpoint: DuctEndpoint,
  role: 'source' | 'cible',
): ProjectIssue | null {
  if (endpoint.type === 'apparatus') {
    return findApparatus(project, endpoint.id) ? null : issue({
      id: `duct-${role}-apparatus-missing:${duct.id}:${endpoint.id}`,
      code: 'DUCT_ENDPOINT_MISSING',
      severity: 'error',
      title: 'Gaine orpheline',
      message: `L’appareillage ${role} de cette gaine est introuvable.`,
      entityType: 'duct',
      entityId: duct.id,
      relatedEntityIds: [endpoint.id],
    });
  }

  if (endpoint.type === 'electrical-panel') {
    return project.electricalPanel?.id === endpoint.id ? null : issue({
      id: `duct-${role}-panel-missing:${duct.id}:${endpoint.id}`,
      code: 'DUCT_ENDPOINT_MISSING',
      severity: 'error',
      title: 'Gaine orpheline',
      message: `Le tableau électrique ${role} de cette gaine est introuvable.`,
      entityType: 'duct',
      entityId: duct.id,
      relatedEntityIds: [endpoint.id],
    });
  }

  const octopus = findOctopus(project, endpoint.octopusId);
  const output = octopus ? getEffectiveOctopusOutput(octopus, endpoint.outputNumber) : undefined;
  return octopus && output ? null : issue({
    id: `duct-${role}-octopus-output-missing:${duct.id}:${endpoint.octopusId}:${endpoint.outputNumber}`,
    code: 'DUCT_ENDPOINT_MISSING',
    severity: 'error',
    title: 'Gaine orpheline',
    message: `La pieuvre ou la sortie ${role} de cette gaine est introuvable.`,
    entityType: 'duct',
    entityId: duct.id,
    octopusId: endpoint.octopusId,
    outputNumber: endpoint.outputNumber,
  });
}

function validateDuctTopology(project: CpreyDrawProject): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const incomingByApparatus = new Map<string, Duct[]>();
  const outgoingByApparatus = new Map<string, Duct[]>();
  const ductsByOutput = new Map<string, Duct[]>();

  for (const duct of project.ducts) {
    if (duct.target.type === 'apparatus') {
      pushMap(incomingByApparatus, duct.target.id, duct);
    }
    if (duct.source.type === 'apparatus') {
      pushMap(outgoingByApparatus, duct.source.id, duct);
    }
    if (duct.source.type === 'octopus-output') {
      pushMap(ductsByOutput, `${duct.source.octopusId}:${duct.source.outputNumber}`, duct);
    }
  }

  for (const [apparatusId, ducts] of incomingByApparatus) {
    if (ducts.length > 1) {
      issues.push(issue({
        id: `apparatus-multiple-incoming:${apparatusId}`,
        code: 'APPARATUS_MULTIPLE_INCOMING_DUCTS',
        severity: 'error',
        title: 'Double raccordement entrant',
        message: `${getApparatusLabel(project, apparatusId)} possède plusieurs gaines entrantes.`,
        entityType: 'apparatus',
        entityId: apparatusId,
        relatedEntityIds: ducts.map((duct) => duct.id),
      }));
    }
  }

  for (const [apparatusId, ducts] of outgoingByApparatus) {
    if (ducts.length > 1) {
      issues.push(issue({
        id: `apparatus-multiple-outgoing:${apparatusId}`,
        code: 'APPARATUS_MULTIPLE_OUTGOING_DUCTS',
        severity: 'error',
        title: 'Double prolongement',
        message: `${getApparatusLabel(project, apparatusId)} possède plusieurs gaines sortantes.`,
        entityType: 'apparatus',
        entityId: apparatusId,
        relatedEntityIds: ducts.map((duct) => duct.id),
      }));
    }
  }

  for (const [outputKey, ducts] of ductsByOutput) {
    if (ducts.length > 1) {
      const [octopusId, outputNumberText] = outputKey.split(':');
      issues.push(issue({
        id: `octopus-output-used-multiple:${outputKey}`,
        code: 'OCTOPUS_OUTPUT_USED_MULTIPLE_TIMES',
        severity: 'error',
        title: 'Sortie utilisée plusieurs fois',
        message: 'Une même sortie de pieuvre ne peut alimenter qu’une seule gaine directe.',
        entityType: 'octopus-output',
        entityId: octopusId,
        octopusId,
        outputNumber: Number(outputNumberText),
        relatedEntityIds: ducts.map((duct) => duct.id),
      }));
    }
  }

  return issues;
}

function validateDuctBusinessRules(project: CpreyDrawProject): ProjectIssue[] {
  return project.ducts.flatMap((duct) => [
    ...validateDuctCompatibility(project, duct),
    ...validateDuctSpecification(project, duct),
    ...validateDuctLength(project, duct),
  ]);
}

function validateDuctCompatibility(project: CpreyDrawProject, duct: Duct): ProjectIssue[] {
  const issues: ProjectIssue[] = [];

  if (duct.source.type === 'octopus-output') {
    const octopus = findOctopus(project, duct.source.octopusId);
    const output = octopus ? getEffectiveOctopusOutput(octopus, duct.source.outputNumber) : undefined;
    if (!octopus || !output) {
      return issues;
    }

    if (output.state === 'free') {
      issues.push(issue({
        id: `free-output-connected:${duct.id}`,
        code: 'FREE_OUTPUT_CONNECTED',
        severity: 'error',
        title: 'Sortie libre raccordée',
        message: `${octopus.name} / sortie ${output.outputNumber} est encore libre mais possède une gaine.`,
        entityType: 'octopus-output',
        entityId: octopus.id,
        octopusId: octopus.id,
        outputNumber: output.outputNumber,
        relatedEntityIds: [duct.id],
      }));
    }

    const isPowerSupply = isPowerSupplyOutputDestination(output.destination);
    if (duct.target.type === 'electrical-panel') {
      if (!isPowerSupply) {
        issues.push(issue({
          id: `non-al-to-panel:${duct.id}`,
          code: 'OUTPUT_TARGET_TYPE_INVALID',
          severity: 'error',
          title: 'Cible incorrecte',
          message: `${octopus.name} / ${output.code} doit être raccordée à un appareillage, pas au tableau.`,
          entityType: 'duct',
          entityId: duct.id,
          octopusId: octopus.id,
          outputNumber: output.outputNumber,
        }));
      }
      if (!project.electricalPanel) {
        issues.push(missingPanelIssue(duct.id));
      }
    }

    if (duct.target.type === 'apparatus') {
      if (isPowerSupply) {
        issues.push(issue({
          id: `al-to-apparatus:${duct.id}`,
          code: 'OUTPUT_TARGET_TYPE_INVALID',
          severity: 'error',
          title: 'Cible incorrecte',
          message: `${octopus.name} / ${output.code} est une alimentation et doit être raccordée au tableau.`,
          entityType: 'duct',
          entityId: duct.id,
          octopusId: octopus.id,
          outputNumber: output.outputNumber,
        }));
      }

      const apparatus = findApparatus(project, duct.target.id);
      const expectedType = getExpectedApparatusType(output.code);
      if (apparatus && expectedType !== null && getApparatusCatalogItem(apparatus.catalogId).type !== expectedType) {
        issues.push(incompatibleTypeIssue(project, duct, output.code, expectedType, apparatus));
      }
    }
  }

  if (duct.source.type === 'apparatus' && duct.target.type === 'apparatus') {
    const targetApparatus = findApparatus(project, duct.target.id);
    const expectedType = getExpectedApparatusType(duct.specification.outputCode);
    if (targetApparatus && expectedType !== null && getApparatusCatalogItem(targetApparatus.catalogId).type !== expectedType) {
      issues.push(incompatibleTypeIssue(project, duct, duct.specification.outputCode, expectedType, targetApparatus));
    }
  }

  if (duct.source.type === 'electrical-panel' && duct.target.type === 'apparatus') {
    if (!project.electricalPanel) {
      issues.push(missingPanelIssue(duct.id));
    }

    const targetApparatus = findApparatus(project, duct.target.id);
    if (targetApparatus) {
      const catalogItem = getApparatusCatalogItem(targetApparatus.catalogId);
      if (!catalogItem.directSupply) {
        issues.push(issue({
          id: `direct-supply-invalid:${duct.id}`,
          code: 'DIRECT_SUPPLY_INVALID',
          severity: 'error',
          title: 'Alimentation directe non autorisée',
          message: `${targetApparatus.identifier} — ${catalogItem.name} ne prévoit pas d’alimentation directe tableau.`,
          entityType: 'duct',
          entityId: duct.id,
          relatedEntityIds: [targetApparatus.id],
        }));
      } else if (!catalogItem.directDuctSpecification) {
        issues.push(issue({
          id: `direct-spec-missing:${duct.id}`,
          code: 'DIRECT_DUCT_SPECIFICATION_MISSING',
          severity: 'warning',
          title: 'Liaison directe sans spécification',
          message: `${targetApparatus.identifier} — ${catalogItem.name} est raccordé directement au tableau sans spécification de gaine renseignée.`,
          entityType: 'duct',
          entityId: duct.id,
          relatedEntityIds: [targetApparatus.id],
        }));
      } else if (!matchesDirectSpecification(duct, catalogItem.directDuctSpecification)) {
        issues.push(issue({
          id: `direct-spec-mismatch:${duct.id}`,
          code: 'DIRECT_DUCT_SPECIFICATION_MISMATCH',
          severity: 'error',
          title: 'Spécification directe incohérente',
          message: `${targetApparatus.identifier} — ${catalogItem.name} ne correspond pas au snapshot attendu du catalogue.`,
          entityType: 'duct',
          entityId: duct.id,
          relatedEntityIds: [targetApparatus.id],
        }));
      }
    }
  }

  return issues;
}

function validateDuctSpecification(project: CpreyDrawProject, duct: Duct): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const diameter = duct.specification.diameterMm;
  const isDirectWithoutSpecification =
    duct.source.type === 'electrical-panel' &&
    duct.target.type === 'apparatus' &&
    diameter === undefined &&
    duct.specification.conductors.length === 0;

  if (diameter !== undefined && !VALID_DUCT_DIAMETERS.includes(diameter)) {
    issues.push(issue({
      id: `duct-diameter-invalid:${duct.id}`,
      code: 'DUCT_DIAMETER_INVALID',
      severity: 'error',
      title: 'Diamètre de gaine invalide',
      message: `La gaine ${getDuctLabel(project, duct)} possède un diamètre non autorisé.`,
      entityType: 'duct',
      entityId: duct.id,
    }));
  }

  if (!isDirectWithoutSpecification && diameter !== undefined && duct.specification.conductors.length === 0) {
    issues.push(issue({
      id: `duct-no-conductors:${duct.id}`,
      code: 'DUCT_CONDUCTORS_MISSING',
      severity: 'warning',
      title: 'Conducteurs non renseignés',
      message: `La gaine ${getDuctLabel(project, duct)} possède un diamètre mais aucun conducteur.`,
      entityType: 'duct',
      entityId: duct.id,
    }));
  }

  for (const [index, conductor] of duct.specification.conductors.entries()) {
    const conductorIssues = validateConductor(conductor);
    for (const conductorIssue of conductorIssues) {
      issues.push(issue({
        id: `duct-conductor-invalid:${duct.id}:${index}:${conductorIssue}`,
        code: 'DUCT_CONDUCTOR_INVALID',
        severity: 'error',
        title: 'Conducteur invalide',
        message: `${getDuctLabel(project, duct)} : ${conductorIssue}`,
        entityType: 'duct',
        entityId: duct.id,
      }));
    }
  }

  if (
    duct.source.type !== 'electrical-panel' &&
    diameter !== undefined &&
    (!Number.isFinite(duct.specification.availableLengthMeters) || duct.specification.availableLengthMeters <= 0)
  ) {
    issues.push(issue({
      id: `duct-available-length-missing:${duct.id}`,
      code: 'DUCT_AVAILABLE_LENGTH_MISSING',
      severity: 'warning',
      title: 'Longueur disponible non définie',
      message: `La gaine ${getDuctLabel(project, duct)} possède une spécification mais aucune longueur disponible exploitable.`,
      entityType: 'duct',
      entityId: duct.id,
    }));
  }

  return issues;
}

function validateDuctLength(project: CpreyDrawProject, duct: Duct): ProjectIssue[] {
  if (!Number.isFinite(duct.specification.availableLengthMeters) || duct.specification.availableLengthMeters <= 0) {
    return [];
  }

  const pathPoints = getDuctPathPoints(
    duct,
    project.octopuses,
    project.apparatus,
    project.electricalPanel,
    project.drawing.metersPerPixel,
  );
  const usedLengthMeters = calculateDuctUsedLengthMeters(pathPoints, project.drawing.metersPerPixel, duct.controls);
  const status = calculateDuctLengthStatus(duct.specification.availableLengthMeters, usedLengthMeters);
  return status.hasOverrun && status.usedLengthMeters !== null
    ? [issue({
        id: `duct-overrun:${duct.id}`,
        code: 'DUCT_LENGTH_OVERRUN',
        severity: 'error',
        title: 'Gaine trop courte',
        message: [
          `${getDuctLabel(project, duct)} dépasse la longueur disponible.`,
          `Disponible : ${formatMeters(status.availableLengthMeters)}`,
          `Utilisée : ${formatMeters(status.usedLengthMeters)}`,
          `Dépassement : ${formatMeters(status.overrunMeters)}`,
        ].join('\n'),
        entityType: 'duct',
        entityId: duct.id,
      })]
    : [];
}

function validateOutputs(project: CpreyDrawProject): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  const usedOutputs = new Set(
    project.ducts
      .filter((duct) => duct.source.type === 'octopus-output')
      .map((duct) => duct.source.type === 'octopus-output' ? `${duct.source.octopusId}:${duct.source.outputNumber}` : ''),
  );

  for (const octopus of project.octopuses) {
    for (const output of getEffectiveOctopusOutputs(octopus)) {
      if (output.state === 'free') {
        continue;
      }

      const outputKey = `${octopus.id}:${output.outputNumber}`;
      if (usedOutputs.has(outputKey)) {
        continue;
      }

      const isPowerSupply = isPowerSupplyOutputDestination(output.destination);
      issues.push(issue({
        id: `output-unconnected:${outputKey}`,
        code: output.state === 'custom'
          ? 'CUSTOM_OUTPUT_UNCONNECTED'
          : isPowerSupply
            ? 'POWER_SUPPLY_OUTPUT_UNCONNECTED'
            : 'STANDARD_OUTPUT_UNCONNECTED',
        severity: 'warning',
        title: output.state === 'custom'
          ? 'Sortie personnalisée non raccordée'
          : isPowerSupply
            ? 'Alimentation non raccordée'
            : 'Sortie standard non raccordée',
        message: `${octopus.name} / ${output.code} n’est raccordée à aucune gaine.`,
        entityType: 'octopus-output',
        entityId: octopus.id,
        octopusId: octopus.id,
        outputNumber: output.outputNumber,
      }));
    }
  }

  return issues;
}

function validateUnconnectedApparatus(project: CpreyDrawProject): ProjectIssue[] {
  const connectedTargets = new Set(
    project.ducts
      .filter((duct) => duct.target.type === 'apparatus')
      .map((duct) => duct.target.type === 'apparatus' ? duct.target.id : ''),
  );

  return project.apparatus
    .filter((apparatus) => !connectedTargets.has(apparatus.id))
    .map((apparatus) => {
      const catalogItem = getApparatusCatalogItem(apparatus.catalogId);
      return issue({
        id: `apparatus-unconnected:${apparatus.id}`,
        code: 'APPARATUS_UNCONNECTED',
        severity: 'warning',
        title: 'Appareillage non raccordé',
        message: `${apparatus.identifier} — ${catalogItem.name} n’est raccordé à aucune gaine.`,
        entityType: 'apparatus',
        entityId: apparatus.id,
      });
    });
}

function validateCycles(project: CpreyDrawProject): ProjectIssue[] {
  const graph = new Map<string, string[]>();
  for (const duct of project.ducts) {
    if (duct.source.type === 'apparatus' && duct.target.type === 'apparatus') {
      pushMap(graph, duct.source.id, duct.target.id);
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycleNodes = new Set<string>();

  const visit = (apparatusId: string): boolean => {
    if (visiting.has(apparatusId)) {
      cycleNodes.add(apparatusId);
      return true;
    }
    if (visited.has(apparatusId)) {
      return false;
    }

    visiting.add(apparatusId);
    for (const next of graph.get(apparatusId) ?? []) {
      if (visit(next)) {
        cycleNodes.add(apparatusId);
        return true;
      }
    }
    visiting.delete(apparatusId);
    visited.add(apparatusId);
    return false;
  };

  for (const apparatusId of graph.keys()) {
    visit(apparatusId);
  }

  return cycleNodes.size > 0
    ? [issue({
        id: `apparatus-cycle:${[...cycleNodes].sort().join(':')}`,
        code: 'APPARATUS_CHAIN_CYCLE',
        severity: 'error',
        title: 'Boucle de circuit',
        message: 'Un chaînage d’appareillages contient une boucle.',
        entityType: 'apparatus',
        entityId: [...cycleNodes][0],
        relatedEntityIds: [...cycleNodes],
      })]
    : [];
}

function incompatibleTypeIssue(
  project: CpreyDrawProject,
  duct: Duct,
  outputCode: string,
  expectedType: string,
  apparatus: ApparatusInstance,
): ProjectIssue {
  const catalogItem = getApparatusCatalogItem(apparatus.catalogId);
  return issue({
    id: `apparatus-type-incompatible:${duct.id}`,
    code: 'APPARATUS_TYPE_INCOMPATIBLE',
    severity: 'error',
    title: 'Type d’appareillage incompatible',
    message: [
      'La gaine raccorde une sortie à un appareillage incompatible.',
      `Sortie : ${outputCode}`,
      `Type attendu : ${expectedType}`,
      `Appareillage : ${apparatus.identifier} — ${catalogItem.name}`,
      `Type : ${catalogItem.type}`,
    ].join('\n'),
    entityType: 'duct',
    entityId: duct.id,
    relatedEntityIds: [apparatus.id, ...getDuctRelatedEntityIds(project, duct)],
  });
}

function missingPanelIssue(ductId: string): ProjectIssue {
  return issue({
    id: `electrical-panel-missing:${ductId}`,
    code: 'ELECTRICAL_PANEL_MISSING',
    severity: 'error',
    title: 'Tableau électrique absent',
    message: 'Une gaine nécessite le tableau électrique, mais aucun tableau n’est présent dans le projet.',
    entityType: 'electrical-panel',
    entityId: undefined,
    relatedEntityIds: [ductId],
  });
}

function validateConductor(conductor: DuctConductor): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(conductor.order) || conductor.order < 1) {
    errors.push('ordre conducteur invalide');
  }
  if (!Number.isInteger(conductor.quantity) || conductor.quantity <= 0) {
    errors.push('quantité conducteur invalide');
  }
  if (!conductor.function.trim()) {
    errors.push('fonction conducteur manquante');
  }
  if (!conductor.color.trim()) {
    errors.push('couleur conducteur manquante');
  }
  if (!VALID_CONDUCTOR_SECTIONS.includes(conductor.sectionMm2)) {
    errors.push('section conducteur invalide');
  }
  return errors;
}

function matchesDirectSpecification(
  duct: Duct,
  directSpecification: {
    diameterMm: 16 | 20 | 25;
    conductors: DuctConductor[];
  },
): boolean {
  return duct.specification.diameterMm === directSpecification.diameterMm &&
    sameConductors(duct.specification.conductors, directSpecification.conductors);
}

function sameConductors(left: DuctConductor[], right: DuctConductor[]): boolean {
  const normalize = (conductors: DuctConductor[]) =>
    conductors
      .map((conductor) => `${conductor.order}|${conductor.quantity}|${conductor.function}|${conductor.color}|${conductor.sectionMm2}`)
      .sort();

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function getDuctLabel(project: CpreyDrawProject, duct: Duct): string {
  if (duct.circuitOrigin.type === 'octopus-output') {
    const octopus = findOctopus(project, duct.circuitOrigin.octopusId);
    return `${octopus?.name ?? 'Pieuvre introuvable'} / ${duct.specification.outputCode}`;
  }

  return `${project.electricalPanel?.name ?? 'Tableau électrique'} / ${duct.specification.destination}`;
}

function getApparatusLabel(project: CpreyDrawProject, apparatusId: string): string {
  const apparatus = findApparatus(project, apparatusId);
  if (!apparatus) {
    return `Appareillage ${apparatusId}`;
  }

  return `${apparatus.identifier} — ${getApparatusCatalogItem(apparatus.catalogId).name}`;
}

function getDuctRelatedEntityIds(project: CpreyDrawProject, duct: Duct): string[] {
  const ids: string[] = [];
  for (const endpoint of [duct.source, duct.target]) {
    if (endpoint.type === 'apparatus' || endpoint.type === 'electrical-panel') {
      ids.push(endpoint.id);
    } else {
      ids.push(endpoint.octopusId);
    }
  }
  if (duct.circuitOrigin.type === 'octopus-output') {
    ids.push(duct.circuitOrigin.octopusId);
  } else {
    ids.push(duct.circuitOrigin.id);
  }
  return ids.filter((id) => id && (findApparatus(project, id) || findOctopus(project, id) || project.electricalPanel?.id === id));
}

function findOctopus(project: CpreyDrawProject, octopusId: string): Octopus | undefined {
  return project.octopuses.find((octopus) => octopus.id === octopusId);
}

function findApparatus(project: CpreyDrawProject, apparatusId: string): ApparatusInstance | undefined {
  return project.apparatus.find((apparatus) => apparatus.id === apparatusId);
}

function pushMap<TKey, TValue>(map: Map<TKey, TValue[]>, key: TKey, value: TValue) {
  const current = map.get(key) ?? [];
  current.push(value);
  map.set(key, current);
}

function formatMeters(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} m`;
}

function issue(issueValue: ProjectIssue): ProjectIssue {
  return issueValue;
}
