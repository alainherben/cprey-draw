import type { ApparatusCatalogId } from '../types/project';
import ampouleNoirUrl from '../assets/pictos/Ampoule100_Noir.svg';
import ampouleVertUrl from '../assets/pictos/Ampoule100_Vert.svg';
import appliqueNoirUrl from '../assets/pictos/Applique_Noir.svg';
import appliqueVertUrl from '../assets/pictos/Applique_Vert.svg';
import chaudiereNoirUrl from '../assets/pictos/Chaudiere_Noir.svg';
import chaudiereVertUrl from '../assets/pictos/Chaudiere_Vert.svg';
import contactSecNoirUrl from '../assets/pictos/ContactSec_Ouvert_Noir.svg';
import contactSecVertUrl from '../assets/pictos/ContactSec_Ouvert_Vert.svg';
import cumulusNoirUrl from '../assets/pictos/Cumulus_Noir.svg';
import cumulusVertUrl from '../assets/pictos/Cumulus_Vert.svg';
import fenetreNoirUrl from '../assets/pictos/Fenetre50_Noir.svg';
import fenetreVertUrl from '../assets/pictos/Fenetre50_Vert.svg';
import fourNoirUrl from '../assets/pictos/Four_Noir.svg';
import fourVertUrl from '../assets/pictos/Four_Vert.svg';
import frigoNoirUrl from '../assets/pictos/Frigo_Noir.svg';
import frigoVertUrl from '../assets/pictos/Frigo_Vert.svg';
import garageNoirUrl from '../assets/pictos/GarageFermer_Noir.svg';
import garageVertUrl from '../assets/pictos/GarageFermer_Vert.svg';
import hotteNoirUrl from '../assets/pictos/Hotte_Noir.svg';
import hotteVertUrl from '../assets/pictos/Hotte_Vert.svg';
import interrupteurDoubleNoirUrl from '../assets/pictos/InterrupteurDouble_Noir.svg';
import interrupteurDoubleVertUrl from '../assets/pictos/InterrupteurDouble_Vert.svg';
import interrupteurFermerNoirUrl from '../assets/pictos/InterrupteurFermer_Noir.svg';
import interrupteurFermerVertUrl from '../assets/pictos/InterrupteurFermer_Vert.svg';
import interrupteurOuvertNoirUrl from '../assets/pictos/InterrupteurOuvert_Noir.svg';
import interrupteurOuvertVertUrl from '../assets/pictos/InterrupteurOuvert_Vert.svg';
import laveLingeNoirUrl from '../assets/pictos/LaveLinge_Noir.svg';
import laveLingeVertUrl from '../assets/pictos/LaveLinge_Vert.svg';
import laveVaisselleNoirUrl from '../assets/pictos/LaveVaiselle_Noir.svg';
import laveVaisselleVertUrl from '../assets/pictos/LaveVaiselle_Vert.svg';
import plaqueCuissonNoirUrl from '../assets/pictos/PlaqueCuisson_Noir.svg';
import plaqueCuissonVertUrl from '../assets/pictos/PlaqueCuisson_Vert.svg';
import pompeChaleurNoirUrl from '../assets/pictos/PompeChaleur_Noir.svg';
import pompeChaleurVertUrl from '../assets/pictos/PompeChaleur_Vert.svg';
import pompePiscineNoirUrl from '../assets/pictos/Pompe_piscine_Noir.svg';
import pompePiscineVertUrl from '../assets/pictos/Pompe_piscine_Vert.svg';
import portailNoirUrl from '../assets/pictos/PortailFermer_Noir.svg';
import portailVertUrl from '../assets/pictos/PortailFermer_Vert.svg';
import priseRj45NoirUrl from '../assets/pictos/PriseAntenneRJ45_Noir.svg';
import priseRj45VertUrl from '../assets/pictos/PriseAntenneRJ45_Vert.svg';
import priseAntenneNoirUrl from '../assets/pictos/PriseAntenneTV_Noir.svg';
import priseAntenneVertUrl from '../assets/pictos/PriseAntenneTV_Vert.svg';
import priseNoirUrl from '../assets/pictos/Prise_Noir.svg';
import priseVertUrl from '../assets/pictos/Prise_Vert.svg';
import priseHauteNoirUrl from '../assets/pictos/Prise_Haute_Noir.svg';
import priseHauteVertUrl from '../assets/pictos/Prise_Haute_Vert.svg';
import priseDoubleNoirUrl from '../assets/pictos/Prise_double_Noir.svg';
import priseDoubleVertUrl from '../assets/pictos/Prise_double_Vert.svg';
import priseDoubleHauteNoirUrl from '../assets/pictos/Prise_double_Haute_Noir.svg';
import priseDoubleHauteVertUrl from '../assets/pictos/Prise_double_Haute_Vert.svg';
import radiateurNoirUrl from '../assets/pictos/Radiateur_Noir.svg';
import radiateurVertUrl from '../assets/pictos/Radiateur_Vert.svg';
import secheLingeNoirUrl from '../assets/pictos/SecheLinge_Noir.svg';
import secheLingeVertUrl from '../assets/pictos/SecheLinge_Vert.svg';
import secheServietteNoirUrl from '../assets/pictos/SecheServiette_Noir.svg';
import secheServietteVertUrl from '../assets/pictos/SecheServiette_Vert.svg';
import spotNoirUrl from '../assets/pictos/Spot_Noir.svg';
import spotVertUrl from '../assets/pictos/Spot_Vert.svg';
import vmcNoirUrl from '../assets/pictos/VMC_Noir.svg';
import vmcVertUrl from '../assets/pictos/VMC_Vert.svg';
import verrouNoirUrl from '../assets/pictos/Verrou_Fermer_Noir.svg';
import verrouVertUrl from '../assets/pictos/Verrou_Fermer_Vert.svg';
import wifiNoirUrl from '../assets/pictos/Wifi_Noir.svg';
import wifiVertUrl from '../assets/pictos/Wifi_Vert.svg';

export type { ApparatusAssetVariant } from './apparatusAssetMap';

export interface ApparatusAssetPair {
  black?: string;
  green?: string;
}

export const APPARATUS_ICON_URLS: Record<ApparatusCatalogId, ApparatusAssetPair> = {
  'prise-16a': { black: priseNoirUrl, green: priseVertUrl },
  prise_haute: { black: priseHauteNoirUrl, green: priseHauteVertUrl },
  prise_double: { black: priseDoubleNoirUrl, green: priseDoubleVertUrl },
  prise_double_haute: { black: priseDoubleHauteNoirUrl, green: priseDoubleHauteVertUrl },
  lampe: { black: ampouleNoirUrl, green: ampouleVertUrl },
  spot: { black: spotNoirUrl, green: spotVertUrl },
  applique: { black: appliqueNoirUrl, green: appliqueVertUrl },
  chaudière: { black: chaudiereNoirUrl, green: chaudiereVertUrl },
  'contact-sec': { black: contactSecNoirUrl, green: contactSecVertUrl },
  'chauffe-eau': { black: cumulusNoirUrl, green: cumulusVertUrl },
  'volet-roulant': { black: fenetreNoirUrl, green: fenetreVertUrl },
  four: { black: fourNoirUrl, green: fourVertUrl },
  frigo: { black: frigoNoirUrl, green: frigoVertUrl },
  garage: { black: garageNoirUrl, green: garageVertUrl },
  hotte: { black: hotteNoirUrl, green: hotteVertUrl },
  'interrupteur-poussoir': { black: interrupteurOuvertNoirUrl, green: interrupteurOuvertVertUrl },
  'interrupteur-simple': { black: interrupteurFermerNoirUrl, green: interrupteurFermerVertUrl },
  'interrupteur-double': { black: interrupteurDoubleNoirUrl, green: interrupteurDoubleVertUrl },
  'lave-linge': { black: laveLingeNoirUrl, green: laveLingeVertUrl },
  'lave-vaisselle': { black: laveVaisselleNoirUrl, green: laveVaisselleVertUrl },
  'plaque-cuisson': { black: plaqueCuissonNoirUrl, green: plaqueCuissonVertUrl },
  'pompe-piscine': { black: pompePiscineNoirUrl, green: pompePiscineVertUrl },
  'pompe-a-chaleur': { black: pompeChaleurNoirUrl, green: pompeChaleurVertUrl },
  portail: { black: portailNoirUrl, green: portailVertUrl },
  'prise-rj45': { black: priseRj45NoirUrl, green: priseRj45VertUrl },
  'prise-antenne': { black: priseAntenneNoirUrl, green: priseAntenneVertUrl },
  radiateur: { black: radiateurNoirUrl, green: radiateurVertUrl },
  'seche-linge': { black: secheLingeNoirUrl, green: secheLingeVertUrl },
  'seche-serviette': { black: secheServietteNoirUrl, green: secheServietteVertUrl },
  verrou: { black: verrouNoirUrl, green: verrouVertUrl },
  vmc: { black: vmcNoirUrl, green: vmcVertUrl },
  wifi: { black: wifiNoirUrl, green: wifiVertUrl },
};

export function getApparatusAssetUrl(
  catalogId: ApparatusCatalogId,
  connected: boolean,
): string | null {
  const variant = connected ? 'green' : 'black';
  return APPARATUS_ICON_URLS[catalogId][variant] ?? null;
}
