import { bathCatalogModel } from './bath';
import { comfortCatalogModel } from './comfort';
import { kitchenCatalogModel } from './kitchen';
import { otherCatalogModel } from './other';
import type { OctopusCatalogModel, OctopusOutputDefinition } from './types';
import { OCTOPUS_CATALOG_VERSION } from './types';
import type { OctopusModelId } from '../../types/project';

export { OCTOPUS_CATALOG_VERSION } from './types';
export type {
  AdapterColor,
  CapColor,
  ConductorDefinition,
  DuctDiameterMm,
  OctopusCatalogModel,
  OctopusOutputDefinition,
  OctopusOutputState,
  WireColor,
} from './types';
export {
  ADAPTER_COLOR_LABELS,
  CAP_COLOR_LABELS,
  OUTPUT_STATE_LABELS,
  WIRE_COLOR_LABELS,
} from './types';

export const OCTOPUS_CATALOG_MODELS: Record<OctopusModelId, OctopusCatalogModel> = {
  kitchen: kitchenCatalogModel,
  bath: bathCatalogModel,
  other: otherCatalogModel,
  comfort: comfortCatalogModel,
};

export const EXPECTED_OUTPUT_COUNTS: Record<OctopusModelId, { standard: number; free: number }> = {
  kitchen: { standard: 12, free: 4 },
  bath: { standard: 12, free: 4 },
  other: { standard: 12, free: 4 },
  comfort: { standard: 5, free: 11 },
};

export function getOctopusCatalogModel(modelId: OctopusModelId): OctopusCatalogModel {
  return OCTOPUS_CATALOG_MODELS[modelId];
}

export function getOctopusOutput(
  modelId: OctopusModelId,
  outputNumber: number,
): OctopusOutputDefinition | undefined {
  return getOctopusCatalogModel(modelId).outputs.find((output) => output.outputNumber === outputNumber);
}

export function validateOctopusCatalog(): string[] {
  const errors: string[] = [];
  const modelIds = Object.keys(OCTOPUS_CATALOG_MODELS) as OctopusModelId[];

  if (modelIds.length !== 4) {
    errors.push(`Le catalogue doit contenir 4 modèles, ${modelIds.length} trouvés.`);
  }

  for (const modelId of modelIds) {
    const model = OCTOPUS_CATALOG_MODELS[modelId];
    const expectedCounts = EXPECTED_OUTPUT_COUNTS[modelId];
    const sortedNumbers = model.outputs.map((output) => output.outputNumber).sort((a, b) => a - b);
    const expectedNumbers = Array.from({ length: 16 }, (_, index) => index + 1);

    if (model.version !== OCTOPUS_CATALOG_VERSION) {
      errors.push(`${model.id}: version catalogue inattendue.`);
    }

    if (model.outputs.length !== 16) {
      errors.push(`${model.id}: ${model.outputs.length} sorties au lieu de 16.`);
    }

    if (sortedNumbers.join(',') !== expectedNumbers.join(',')) {
      errors.push(`${model.id}: numéros de sorties invalides (${sortedNumbers.join(',')}).`);
    }

    const standardCount = model.outputs.filter((output) => output.state === 'standard').length;
    const freeCount = model.outputs.filter((output) => output.state === 'free').length;
    if (standardCount !== expectedCounts.standard || freeCount !== expectedCounts.free) {
      errors.push(`${model.id}: répartition ${standardCount} standard / ${freeCount} libres invalide.`);
    }

    for (const output of model.outputs) {
      if (![16, 20, 25].includes(output.duct.diameterMm)) {
        errors.push(`${model.id} sortie ${output.outputNumber}: diamètre non autorisé.`);
      }

      if (output.state === 'standard' && output.conductors.length === 0) {
        errors.push(`${model.id} sortie ${output.outputNumber}: conducteurs manquants.`);
      }

      if (output.state === 'free') {
        if (output.duct.adapterColor !== 'blue' || !output.duct.capped || output.duct.capColor !== 'white') {
          errors.push(`${model.id} sortie ${output.outputNumber}: sortie libre matériellement invalide.`);
        }
        if (output.duct.lengthMeters !== 0) {
          errors.push(`${model.id} sortie ${output.outputNumber}: sortie libre avec longueur non nulle.`);
        }
      }

      for (const conductor of output.conductors) {
        if (!Number.isInteger(conductor.order) || conductor.order < 1) {
          errors.push(`${model.id} sortie ${output.outputNumber}: ordre conducteur invalide.`);
        }
        if (!Number.isInteger(conductor.quantity) || conductor.quantity < 1) {
          errors.push(`${model.id} sortie ${output.outputNumber}: quantité conducteur invalide.`);
        }
        if (!conductor.function.trim()) {
          errors.push(`${model.id} sortie ${output.outputNumber}: fonction conducteur manquante.`);
        }
        if (![1.5, 2.5].includes(conductor.sectionMm2)) {
          errors.push(`${model.id} sortie ${output.outputNumber}: section conducteur invalide.`);
        }
      }
    }
  }

  return errors;
}
