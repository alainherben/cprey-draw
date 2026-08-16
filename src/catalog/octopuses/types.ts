import type { OctopusModelId } from '../../types/project';

export const OCTOPUS_CATALOG_VERSION = '2026.08';

export type OctopusOutputState = 'standard' | 'free';
export type DuctDiameterMm = 16 | 20 | 25;
export type AdapterColor = 'yellow' | 'blue';
export type CapColor = 'white';
export type WireColor =
  | 'red'
  | 'green-yellow'
  | 'light-blue'
  | 'dark-blue'
  | 'blue'
  | 'black'
  | 'white'
  | 'orange'
  | 'brown'
  | 'violet'
  | 'gray';

export interface ConductorDefinition {
  order: number;
  quantity: number;
  function: string;
  color: WireColor;
  sectionMm2: 1.5 | 2.5;
}

export interface OctopusOutputDefinition {
  outputNumber: number;
  code: string;
  state: OctopusOutputState;
  destination: string;
  duct: {
    diameterMm: DuctDiameterMm;
    adapterColor: AdapterColor;
    capped: boolean;
    capColor?: CapColor;
    lengthMeters: number;
  };
  linkColor: string;
  conductors: ConductorDefinition[];
}

export interface OctopusCatalogModel {
  id: OctopusModelId;
  name: string;
  version: string;
  revision: number;
  widthMeters: number;
  heightMeters: number;
  defaultDisplayScale: number;
  outputs: OctopusOutputDefinition[];
}

export const WIRE_COLOR_LABELS: Record<WireColor, string> = {
  red: 'Rouge',
  'green-yellow': 'Vert/Jaune',
  'light-blue': 'Bleu Clair',
  'dark-blue': 'Bleu Foncé',
  blue: 'Bleu',
  black: 'Noir',
  white: 'Blanc',
  orange: 'Orange',
  brown: 'Marron',
  violet: 'Violet',
  gray: 'Gris',
};

export const ADAPTER_COLOR_LABELS: Record<AdapterColor, string> = {
  yellow: 'Jaune',
  blue: 'Bleu',
};

export const CAP_COLOR_LABELS: Record<CapColor, string> = {
  white: 'Blanc',
};

export const OUTPUT_STATE_LABELS: Record<OctopusOutputState, string> = {
  standard: 'Standard',
  free: 'Libre',
};
