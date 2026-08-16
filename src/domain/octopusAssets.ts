import type { OctopusModelId } from '../types/project';
import kitchenLogoUrl from '../assets/logos/logo-pieuvre-cuisine.svg';
import bathLogoUrl from '../assets/logos/logo-pieuvre-bain.svg';
import otherLogoUrl from '../assets/logos/logo-pieuvre-autre-zone.svg';
import comfortLogoUrl from '../assets/logos/logo-pieuvre-confort.svg';

export const OCTOPUS_LOGO_URLS: Record<OctopusModelId, string> = {
  kitchen: kitchenLogoUrl,
  bath: bathLogoUrl,
  other: otherLogoUrl,
  comfort: comfortLogoUrl,
};
