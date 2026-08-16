import type { ApparatusCatalogId } from '../../types/project';

export const APPARATUS_CATALOG_VERSION = '2026.08';

export type ApparatusTypeCode = 'PR' | 'LA' | 'SP' | 'CS' | 'VR' | 'HO' | 'IN' | 'DR' | 'FP' | 'VM';

export type ApparatusCategory =
  | 'outlet'
  | 'Light'
  | 'dry contact'
  | 'water heater'
  | 'roller shutter'
  | 'furnace'
  | 'Fridge'
  | 'Garage'
  | 'hood'
  | 'Switch'
  | 'Washing machine'
  | 'Dishwasher'
  | 'cooktop'
  | 'pool pump'
  | 'Heat pump'
  | 'portal'
  | 'RJ45 socket'
  | 'Antenna socket'
  | 'Convector'
  | 'Tumble dryer'
  | 'heated towel rail'
  | 'lock'
  | 'CMV'
  | 'WiFi';

export type ApparatusHeightReference = 'floor' | 'ceiling';

export interface ApparatusDirectDuctConductor {
  order: number;
  quantity: number;
  function: string;
  color: string;
  sectionMm2: 1.5 | 2.5 | 6;
}

export interface ApparatusDirectDuctSpecification {
  diameterMm: 16 | 20 | 25;
  conductors: ApparatusDirectDuctConductor[];
}

export interface ApparatusCatalogItem {
  id: ApparatusCatalogId;
  type: ApparatusTypeCode;
  name: string;
  category: ApparatusCategory;
  svg: string;
  revision: number;
  connectedDefault: boolean;
  defaultDisplayScale: number;
  minDisplaySizePx: number;
  defaultHeightMeters: number;
  heightReference: ApparatusHeightReference;
  directSupply: boolean;
  directDuctSpecification?: ApparatusDirectDuctSpecification;
}
