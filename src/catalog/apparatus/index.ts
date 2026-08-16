import type { ApparatusCatalogId } from '../../types/project';
import {
  APPARATUS_CATALOG_VERSION,
  type ApparatusCatalogItem,
  type ApparatusHeightReference,
} from './types';

export { APPARATUS_CATALOG_VERSION } from './types';
export type {
  ApparatusCatalogItem,
  ApparatusCategory,
  ApparatusDirectDuctSpecification,
  ApparatusHeightReference,
  ApparatusTypeCode,
} from './types';

const connectedDefault = false;
const defaultDisplayScale = 4;
const minDisplaySizePx = 22;
const heightReference: ApparatusHeightReference = 'floor';

export const APPARATUS_CATALOG: ApparatusCatalogItem[] = [
  item('prise-16a', 'PR', 'Prise', 'outlet', 'Prise_Gris.svg', 0.3, false),
  item('prise_haute', 'PR', 'Prise haute', 'outlet', 'Prise_Haute_Noir.svg', 1.2, false),
  item('prise_double', 'PR', 'Prise double', 'outlet', 'Prise_double_Noir.svg', 0.3, false),
  item('prise_double_haute', 'PR', 'Prise double haute', 'outlet', 'Prise_double_Haute_Noir.svg', 1.2, false),
  item('lampe', 'LA', 'Lampe', 'Light', 'Ampoule100_Gris.svg', 1.2, false),
  item('spot', 'LA', 'Spot', 'Light', 'Spot_Noir.svg', 0, false, {
    defaultDisplayScale: 2,
    heightReference: 'ceiling',
  }),
  item('applique', 'LA', 'Applique', 'Light', 'Applique_Noir.svg', 2, false, {
    defaultDisplayScale: 2,
  }),
  item('chaudière', 'SP', 'Chaudière', 'outlet', 'Chaudiere_Gris.svg', 1, false),
  item('contact-sec', 'CS', 'Contact Sec', 'dry contact', 'ContactSec_Ouvert_Gris.svg', 1.2, false),
  item('chauffe-eau', 'SP', 'Chauffe eau', 'water heater', 'Cumulus_Gris.svg', 0.3, false),
  item('volet-roulant', 'VR', 'Volet roulant', 'roller shutter', 'Fenetre50_Gris.svg', 1.2, false),
  item('four', 'SP', 'Four', 'furnace', 'Four_Gris.svg', 0.3, false),
  item('frigo', 'PR', 'Frigo', 'Fridge', 'Frigo_Gris.svg', 0.3, false),
  item('garage', 'PR', 'Garage', 'Garage', 'GarageFermer_Gris.svg', 1.2, false),
  item('hotte', 'HO', 'Hotte', 'hood', 'Hotte_Gris.svg', 2, false),
  item('interrupteur-poussoir', 'IN', 'Poussoir', 'Switch', 'InterrupteurOuvert_Gris.svg', 1.2, false),
  item('interrupteur-simple', 'IN', 'Interrupteur simple', 'Switch', 'InterrupteurFermer_Gris.svg', 1.2, false),
  item('interrupteur-double', 'IN', 'Interrupteur double', 'Switch', 'InterrupteurDouble_Gris.svg', 1.2, false),
  item('lave-linge', 'SP', 'Lave linge', 'Washing machine', 'LaveLinge_Gris.svg', 0.3, false),
  item('lave-vaisselle', 'SP', 'Lave vaisselle', 'Dishwasher', 'LaveVaiselle_Gris.svg', 0.3, false),
  item('plaque-cuisson', 'SP', '32A Plaque cuisson', 'cooktop', 'PlaqueCuisson_Gris.svg', 0.3, true, {
    directDuctSpecification: {
      diameterMm: 25,
      conductors: [
        { order: 1, quantity: 1, function: 'Phase', color: 'Rouge', sectionMm2: 6 },
        { order: 2, quantity: 1, function: 'Neutre', color: 'Bleu', sectionMm2: 6 },
        { order: 3, quantity: 1, function: 'Terre', color: 'Vert/Jaune', sectionMm2: 6 },
      ],
    },
  }),
  item('pompe-piscine', 'SP', 'Pompe piscine', 'pool pump', 'Pompe_piscine_Gris.svg', 0.3, false),
  item('pompe-a-chaleur', 'SP', 'Pompe à chaleur', 'Heat pump', 'PompeChaleur_Gris.svg', 0.3, false),
  item('portail', 'PR', 'Portail', 'portal', 'PortailFermer_Gris.svg', 0.3, false),
  item('prise-rj45', 'DR', 'Prise RJ45', 'RJ45 socket', 'PriseAntenneRJ45_Gris.svg', 0.3, true),
  item('prise-antenne', 'DR', 'Prise antenne', 'Antenna socket', 'PriseAntenneTV_Gris.svg', 0.3, true),
  item('radiateur', 'FP', 'Convecteur', 'Convector', 'Radiateur_Gris.svg', 0.3, false),
  item('seche-linge', 'SP', 'Sèche linge', 'Tumble dryer', 'SecheLinge_Gris.svg', 0.3, false),
  item('seche-serviette', 'FP', 'Sèche serviette', 'heated towel rail', 'SecheServiette_Gris.svg', 0.3, false),
  item('verrou', 'CS', 'Vérrou', 'lock', 'Verrou_Fermer_Gris.svg', 1, false),
  item('vmc', 'VM', 'VMC', 'CMV', 'VMC_Gris.svg', 2, false),
  item('wifi', 'DR', 'WiFi', 'WiFi', 'Wifi_Gris.svg', 1, true),
];

export const APPARATUS_CATALOG_BY_ID: Record<ApparatusCatalogId, ApparatusCatalogItem> =
  APPARATUS_CATALOG.reduce(
    (itemsById, catalogItem) => ({
      ...itemsById,
      [catalogItem.id]: catalogItem,
    }),
    {} as Record<ApparatusCatalogId, ApparatusCatalogItem>,
  );

export function getApparatusCatalogItem(catalogId: ApparatusCatalogId): ApparatusCatalogItem {
  return APPARATUS_CATALOG_BY_ID[catalogId];
}

export function getApparatusCatalogMenuItems(): ApparatusCatalogItem[] {
  return [...APPARATUS_CATALOG].sort((left, right) => {
    const leftOrder = APPARATUS_MENU_ORDER[left.id] ?? Number.POSITIVE_INFINITY;
    const rightOrder = APPARATUS_MENU_ORDER[right.id] ?? Number.POSITIVE_INFINITY;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name, 'fr');
  });
}

export function validateApparatusCatalog(availableSvgFilenames: readonly string[]): string[] {
  const errors: string[] = [];
  const ids = APPARATUS_CATALOG.map((catalogItem) => catalogItem.id);
  const uniqueIds = new Set(ids);

  if (APPARATUS_CATALOG.length !== 32) {
    errors.push(`Le catalogue doit contenir 32 appareillages, ${APPARATUS_CATALOG.length} trouvés.`);
  }

  if (ids.length !== uniqueIds.size) {
    errors.push('Le catalogue contient des IDs en doublon.');
  }

  for (const catalogItem of APPARATUS_CATALOG) {
    if (!availableSvgFilenames.includes(catalogItem.svg)) {
      errors.push(`${catalogItem.id}: SVG introuvable (${catalogItem.svg}).`);
    }
    if (catalogItem.connectedDefault !== false) {
      errors.push(`${catalogItem.id}: connectedDefault doit être false.`);
    }
    if (catalogItem.defaultDisplayScale <= 0) {
      errors.push(`${catalogItem.id}: defaultDisplayScale invalide.`);
    }
    if (catalogItem.defaultHeightMeters < 0) {
      errors.push(`${catalogItem.id}: defaultHeightMeters invalide.`);
    }
    if (!['floor', 'ceiling'].includes(catalogItem.heightReference)) {
      errors.push(`${catalogItem.id}: heightReference invalide.`);
    }
    if (!Number.isInteger(catalogItem.revision) || catalogItem.revision < 1) {
      errors.push(`${catalogItem.id}: revision invalide.`);
    }
    if (catalogItem.directDuctSpecification) {
      if (![16, 20, 25].includes(catalogItem.directDuctSpecification.diameterMm)) {
        errors.push(`${catalogItem.id}: diamètre direct invalide.`);
      }
      for (const conductor of catalogItem.directDuctSpecification.conductors) {
        if (![1.5, 2.5, 6].includes(conductor.sectionMm2)) {
          errors.push(`${catalogItem.id}: section directe invalide.`);
        }
      }
    }
  }

  return errors;
}

const APPARATUS_MENU_ORDER: Partial<Record<ApparatusCatalogId, number>> = {
  'prise-16a': 100,
  prise_haute: 101,
  prise_double: 102,
  prise_double_haute: 103,
};

function item(
  id: ApparatusCatalogId,
  type: ApparatusCatalogItem['type'],
  name: string,
  category: ApparatusCatalogItem['category'],
  svg: string,
  defaultHeightMeters: number,
  directSupply: boolean,
  options: Partial<Pick<ApparatusCatalogItem, 'defaultDisplayScale' | 'heightReference' | 'directDuctSpecification'>> = {},
): ApparatusCatalogItem {
  return {
    id,
    type,
    name,
    category,
    svg,
    revision: 1,
    connectedDefault,
    defaultDisplayScale: options.defaultDisplayScale ?? defaultDisplayScale,
    minDisplaySizePx,
    defaultHeightMeters,
    heightReference: options.heightReference ?? heightReference,
    directSupply,
    directDuctSpecification: options.directDuctSpecification,
  };
}
