import { getOctopusCatalogModel, getOctopusOutput } from '../catalog/octopuses';
import type { AdapterColor, OctopusOutputDefinition } from '../catalog/octopuses';
import type {
  DuctConductor,
  Octopus,
  OctopusOutputOverride,
  OctopusOverrideType,
} from '../types/project';

export const CONFIGURABLE_OUTPUT_TYPES: OctopusOverrideType[] = ['LA', 'PR', 'SP', 'IN', 'VR', 'FP', 'CS', 'HO', 'VM'];

export const DEFAULT_DESTINATION_BY_TYPE: Record<OctopusOverrideType, string> = {
  LA: 'Lampe',
  PR: 'Prise',
  SP: 'Prise spécialisée',
  IN: 'Interrupteur',
  VR: 'Volet roulant',
  FP: 'Fil pilote',
  CS: 'Contact sec',
  HO: 'Hotte',
  VM: 'VMC',
};

export interface EffectiveOctopusOutput {
  outputNumber: number;
  code: string;
  state: 'standard' | 'free' | 'custom';
  destination: string;
  duct: {
    diameterMm: 16 | 20 | 25;
    adapterColor: AdapterColor;
    capped: boolean;
    capColor?: 'white';
    lengthMeters: number;
  };
  linkColor: string;
  conductors: DuctConductor[];
  override?: OctopusOutputOverride;
  catalogOutput: OctopusOutputDefinition;
}

export function getEffectiveOctopusOutput(
  octopus: Octopus,
  outputNumber: number,
): EffectiveOctopusOutput | undefined {
  const catalogOutput = getOctopusOutput(octopus.modelId, outputNumber);
  if (!catalogOutput) {
    return undefined;
  }

  const override = (octopus.outputOverrides ?? []).find(
    (candidate) => candidate.outputNumber === outputNumber && candidate.enabled,
  );

  if (!override) {
    return {
      ...catalogOutput,
      state: catalogOutput.state,
      conductors: catalogOutput.conductors.map((conductor) => ({ ...conductor })),
      catalogOutput,
    };
  }

  return {
    outputNumber,
    code: override.code,
    state: 'custom',
    destination: override.destination,
    duct: {
      diameterMm: override.duct.diameterMm,
      adapterColor: override.duct.adapterColor,
      capped: override.duct.capped,
      capColor: override.duct.capColor,
      lengthMeters: override.duct.availableLengthMeters,
    },
    linkColor: override.linkColor,
    conductors: override.conductors.map((conductor) => ({ ...conductor })),
    override,
    catalogOutput,
  };
}

export function getEffectiveOctopusOutputs(octopus: Octopus): EffectiveOctopusOutput[] {
  return getOctopusCatalogModel(octopus.modelId).outputs
    .map((output) => getEffectiveOctopusOutput(octopus, output.outputNumber))
    .filter((output): output is EffectiveOctopusOutput => output !== undefined);
}

export function canOverrideOctopusOutput(octopus: Octopus, outputNumber: number): boolean {
  return getOctopusOutput(octopus.modelId, outputNumber)?.state === 'free';
}

export function generateNextOutputCode(octopus: Octopus, type: OctopusOverrideType): string {
  const largestIndex = getEffectiveOctopusOutputs(octopus).reduce((largest, output) => {
    const indexes = extractOutputCodeIndexes(output.code, type);
    return indexes.reduce((currentLargest, index) => Math.max(currentLargest, index), largest);
  }, 0);

  return `${type}${largestIndex + 1}`;
}

export function createOctopusOutputOverride(
  octopus: Octopus,
  outputNumber: number,
  type: OctopusOverrideType,
): OctopusOutputOverride {
  const preset = findPresetOutput(octopus, type);

  return {
    outputNumber,
    enabled: true,
    code: generateNextOutputCode(octopus, type),
    type,
    destination: DEFAULT_DESTINATION_BY_TYPE[type],
    duct: {
      diameterMm: preset?.duct.diameterMm ?? 20,
      adapterColor: adapterColorForDiameter(preset?.duct.diameterMm ?? 20),
      capped: false,
      availableLengthMeters: preset?.duct.lengthMeters ?? 0,
    },
    linkColor: preset?.linkColor || 'Bleu',
    conductors: preset?.conductors.map((conductor) => ({ ...conductor })) ?? [],
  };
}

export function upsertOctopusOutputOverride(
  octopus: Octopus,
  override: OctopusOutputOverride,
): Octopus {
  return {
    ...octopus,
    outputOverrides: [
      ...(octopus.outputOverrides ?? []).filter((candidate) => candidate.outputNumber !== override.outputNumber),
      override,
    ].sort((left, right) => left.outputNumber - right.outputNumber),
  };
}

export function removeOctopusOutputOverride(octopus: Octopus, outputNumber: number): Octopus {
  return {
    ...octopus,
    outputOverrides: (octopus.outputOverrides ?? []).filter((override) => override.outputNumber !== outputNumber),
  };
}

export function validateOctopusOutputOverride(octopus: Octopus, override: OctopusOutputOverride): string[] {
  const errors: string[] = [];

  if (!canOverrideOctopusOutput(octopus, override.outputNumber)) {
    errors.push('Une sortie standard ne peut pas être personnalisée ; seules les sorties libres peuvent l’être.');
  }

  if (!CONFIGURABLE_OUTPUT_TYPES.includes(override.type)) {
    errors.push('Type de sortie invalide.');
  }

  if (!override.code.trim()) {
    errors.push('Code de sortie obligatoire.');
  }

  const duplicate = getEffectiveOctopusOutputs(removeOctopusOutputOverride(octopus, override.outputNumber))
    .some((output) => output.code.trim().toUpperCase() === override.code.trim().toUpperCase());
  if (duplicate) {
    errors.push('Ce code doit être unique dans la pieuvre.');
  }

  if (![16, 20, 25].includes(override.duct.diameterMm)) {
    errors.push('Diamètre invalide.');
  }

  if (override.duct.availableLengthMeters < 0 || !Number.isFinite(override.duct.availableLengthMeters)) {
    errors.push('Longueur de gaine positive ou nulle obligatoire.');
  }

  if (!override.linkColor.trim()) {
    errors.push('Couleur de liaison obligatoire.');
  }

  for (const conductor of override.conductors) {
    if (!Number.isInteger(conductor.order) || conductor.order < 1) {
      errors.push('Ordre conducteur invalide.');
    }
    if (!Number.isInteger(conductor.quantity) || conductor.quantity < 1) {
      errors.push('quantité conducteur invalide.');
    }
    if (!conductor.function.trim()) {
      errors.push('fonction conducteur obligatoire.');
    }
    if (![1.5, 2.5, 6].includes(conductor.sectionMm2)) {
      errors.push('Section conducteur invalide.');
    }
  }

  return errors;
}

export function getOctopusOutputCounts(octopus: Octopus): { standard: number; custom: number; free: number } {
  return getEffectiveOctopusOutputs(octopus).reduce(
    (counts, output) => ({
      standard: counts.standard + (output.state === 'standard' ? 1 : 0),
      custom: counts.custom + (output.state === 'custom' ? 1 : 0),
      free: counts.free + (output.state === 'free' ? 1 : 0),
    }),
    { standard: 0, custom: 0, free: 0 },
  );
}

function findPresetOutput(octopus: Octopus, type: OctopusOverrideType): OctopusOutputDefinition | undefined {
  return getOctopusCatalogModel(octopus.modelId).outputs.find(
    (output) => output.state === 'standard' && output.code.toUpperCase().startsWith(type),
  );
}

function adapterColorForDiameter(diameterMm: 16 | 20 | 25): AdapterColor {
  return diameterMm === 16 ? 'yellow' : 'blue';
}

function extractOutputCodeIndexes(code: string, type: OctopusOverrideType): number[] {
  const pattern = new RegExp(`${type}(\\d+)`, 'gi');
  const indexes: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    const index = Number(match[1]);
    if (Number.isFinite(index)) {
      indexes.push(index);
    }
  }

  return indexes;
}
