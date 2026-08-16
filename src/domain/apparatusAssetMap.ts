import type { ApparatusCatalogId } from '../types/project';

export type ApparatusAssetVariant = 'black' | 'green';

export interface ApparatusAssetFilenamePair {
  black: string;
  green: string;
}

export const APPARATUS_ICON_FILENAMES: Record<ApparatusCatalogId, ApparatusAssetFilenamePair> = {
  'prise-16a': { black: 'Prise_Noir.svg', green: 'Prise_Vert.svg' },
  prise_haute: { black: 'Prise_Haute_Noir.svg', green: 'Prise_Haute_Vert.svg' },
  prise_double: { black: 'Prise_double_Noir.svg', green: 'Prise_double_Vert.svg' },
  prise_double_haute: { black: 'Prise_double_Haute_Noir.svg', green: 'Prise_double_Haute_Vert.svg' },
  lampe: { black: 'Ampoule100_Noir.svg', green: 'Ampoule100_Vert.svg' },
  spot: { black: 'Spot_Noir.svg', green: 'Spot_Vert.svg' },
  applique: { black: 'Applique_Noir.svg', green: 'Applique_Vert.svg' },
  chaudière: { black: 'Chaudiere_Noir.svg', green: 'Chaudiere_Vert.svg' },
  'contact-sec': { black: 'ContactSec_Ouvert_Noir.svg', green: 'ContactSec_Ouvert_Vert.svg' },
  'chauffe-eau': { black: 'Cumulus_Noir.svg', green: 'Cumulus_Vert.svg' },
  'volet-roulant': { black: 'Fenetre50_Noir.svg', green: 'Fenetre50_Vert.svg' },
  four: { black: 'Four_Noir.svg', green: 'Four_Vert.svg' },
  frigo: { black: 'Frigo_Noir.svg', green: 'Frigo_Vert.svg' },
  garage: { black: 'GarageFermer_Noir.svg', green: 'GarageFermer_Vert.svg' },
  hotte: { black: 'Hotte_Noir.svg', green: 'Hotte_Vert.svg' },
  'interrupteur-poussoir': { black: 'InterrupteurOuvert_Noir.svg', green: 'InterrupteurOuvert_Vert.svg' },
  'interrupteur-simple': { black: 'InterrupteurFermer_Noir.svg', green: 'InterrupteurFermer_Vert.svg' },
  'interrupteur-double': { black: 'InterrupteurDouble_Noir.svg', green: 'InterrupteurDouble_Vert.svg' },
  'lave-linge': { black: 'LaveLinge_Noir.svg', green: 'LaveLinge_Vert.svg' },
  'lave-vaisselle': { black: 'LaveVaiselle_Noir.svg', green: 'LaveVaiselle_Vert.svg' },
  'plaque-cuisson': { black: 'PlaqueCuisson_Noir.svg', green: 'PlaqueCuisson_Vert.svg' },
  'pompe-piscine': { black: 'Pompe_piscine_Noir.svg', green: 'Pompe_piscine_Vert.svg' },
  'pompe-a-chaleur': { black: 'PompeChaleur_Noir.svg', green: 'PompeChaleur_Vert.svg' },
  portail: { black: 'PortailFermer_Noir.svg', green: 'PortailFermer_Vert.svg' },
  'prise-rj45': { black: 'PriseAntenneRJ45_Noir.svg', green: 'PriseAntenneRJ45_Vert.svg' },
  'prise-antenne': { black: 'PriseAntenneTV_Noir.svg', green: 'PriseAntenneTV_Vert.svg' },
  radiateur: { black: 'Radiateur_Noir.svg', green: 'Radiateur_Vert.svg' },
  'seche-linge': { black: 'SecheLinge_Noir.svg', green: 'SecheLinge_Vert.svg' },
  'seche-serviette': { black: 'SecheServiette_Noir.svg', green: 'SecheServiette_Vert.svg' },
  verrou: { black: 'Verrou_Fermer_Noir.svg', green: 'Verrou_Fermer_Vert.svg' },
  vmc: { black: 'VMC_Noir.svg', green: 'VMC_Vert.svg' },
  wifi: { black: 'Wifi_Noir.svg', green: 'Wifi_Vert.svg' },
};

export function getMissingApparatusAssetFilenames(
  availableSvgFilenames: readonly string[],
): string[] {
  return Object.entries(APPARATUS_ICON_FILENAMES).flatMap(([catalogId, filenames]) =>
    (Object.keys(filenames) as ApparatusAssetVariant[])
      .filter((variant) => !availableSvgFilenames.includes(filenames[variant]))
      .map((variant) => `${catalogId}:${filenames[variant]}`),
  );
}
