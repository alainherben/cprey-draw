import type {
  AdapterColor,
  ConductorDefinition,
  DuctDiameterMm,
  OctopusCatalogModel,
  OctopusOutputDefinition,
  WireColor,
} from './types';
import { OCTOPUS_CATALOG_VERSION } from './types';
import type { OctopusModelId } from '../../types/project';

export function conductor(
  order: number,
  fn: string,
  color: WireColor,
  sectionMm2: 1.5 | 2.5,
  quantity = 1,
): ConductorDefinition {
  return { order, quantity, function: fn, color, sectionMm2 };
}

export function standardOutput(
  outputNumber: number,
  code: string,
  destination: string,
  diameterMm: DuctDiameterMm,
  adapterColor: AdapterColor,
  lengthMeters: number,
  linkColor: string,
  conductors: ConductorDefinition[],
): OctopusOutputDefinition {
  return {
    outputNumber,
    code,
    state: 'standard',
    destination,
    duct: {
      diameterMm,
      adapterColor,
      capped: false,
      lengthMeters,
    },
    linkColor,
    conductors,
  };
}

export function freeOutput(outputNumber: number, code = `LIBRE${outputNumber}`): OctopusOutputDefinition {
  return {
    outputNumber,
    code,
    state: 'free',
    destination: 'Disponible',
    duct: {
      diameterMm: 20,
      adapterColor: 'blue',
      capped: true,
      capColor: 'white',
      lengthMeters: 0,
    },
    linkColor: '',
    conductors: [],
  };
}

export function catalogModel(
  id: OctopusModelId,
  name: string,
  outputs: OctopusOutputDefinition[],
): OctopusCatalogModel {
  return {
    id,
    name,
    version: OCTOPUS_CATALOG_VERSION,
    revision: 1,
    widthMeters: 0.2,
    heightMeters: 0.2,
    defaultDisplayScale: 1,
    outputs,
  };
}

export function adapterColorForDiameter(diameterMm: DuctDiameterMm): AdapterColor {
  return diameterMm === 16 ? 'yellow' : 'blue';
}
