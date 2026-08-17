import type { OctopusModelId } from '../types/project';

export const OCTOPUS_LOGO_FILENAMES: Record<OctopusModelId, string> = {
  kitchen: 'logo-pieuvre-cuisine.svg',
  bath: 'logo-pieuvre-bain.svg',
  other: 'logo-pieuvre-autre-zone.svg',
  comfort: 'logo-pieuvre-confort.svg',
};

export function getOctopusLogoFilename(modelId: OctopusModelId): string {
  return OCTOPUS_LOGO_FILENAMES[modelId];
}
