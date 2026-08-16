export type ToolMode =
  | 'pan'
  | 'scale'
  | 'measure'
  | 'place-electrical-panel'
  | 'place-octopus'
  | 'place-apparatus'
  | 'connect-target';

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface Plan {
  id: string;
  name: string;
  source: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  rotation: number;
  mimeType: 'image/png' | 'image/jpeg';
  width?: number;
  height?: number;
  importedAt?: string;
}

export interface ScaleReference {
  start: Point;
  end: Point;
  realMeters: number;
}

export interface DrawableObject {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  layerId: string;
  displayScale?: number;
}

export interface ElectricalPanel extends DrawableObject {
  type: 'electrical-panel';
  widthMeters: number;
  heightMeters: number;
  rows: number;
  reserveModules: number;
  comments: string;
}

export type OctopusModelId = 'kitchen' | 'bath' | 'other' | 'comfort';

export type OctopusPortSide = 'top' | 'right' | 'bottom' | 'left';

export interface OctopusPort {
  number: number;
  side: OctopusPortSide;
  orderOnSide: number;
}

export type OctopusOverrideType = 'LA' | 'PR' | 'SP' | 'IN' | 'VR' | 'FP' | 'CS' | 'HO' | 'VM';

export interface OctopusOutputOverride {
  outputNumber: number;
  enabled: boolean;
  code: string;
  type: OctopusOverrideType;
  destination: string;
  duct: {
    diameterMm: 16 | 20 | 25;
    adapterColor: 'yellow' | 'blue';
    capped: boolean;
    capColor?: 'white';
    availableLengthMeters: number;
  };
  linkColor: string;
  conductors: DuctConductor[];
}

export interface Octopus extends DrawableObject {
  type: 'octopus';
  modelId: OctopusModelId;
  catalogVersion: string;
  catalogRevision: number;
  displayScale: number;
  widthMeters: number;
  heightMeters: number;
  ports: OctopusPort[];
  outputOverrides: OctopusOutputOverride[];
  comments: string;
}

export type ApparatusCatalogId =
  | 'prise-16a'
  | 'prise_haute'
  | 'prise_double'
  | 'prise_double_haute'
  | 'lampe'
  | 'spot'
  | 'applique'
  | 'chaudière'
  | 'contact-sec'
  | 'chauffe-eau'
  | 'volet-roulant'
  | 'four'
  | 'frigo'
  | 'garage'
  | 'hotte'
  | 'interrupteur-poussoir'
  | 'interrupteur-simple'
  | 'interrupteur-double'
  | 'lave-linge'
  | 'lave-vaisselle'
  | 'plaque-cuisson'
  | 'pompe-piscine'
  | 'pompe-a-chaleur'
  | 'portail'
  | 'prise-rj45'
  | 'prise-antenne'
  | 'radiateur'
  | 'seche-linge'
  | 'seche-serviette'
  | 'verrou'
  | 'vmc'
  | 'wifi';

export type ApparatusLabelPosition = 'right' | 'left' | 'top' | 'bottom';

export interface ApparatusInstance extends DrawableObject {
  type: 'apparatus';
  catalogId: ApparatusCatalogId;
  catalogVersion: string;
  catalogRevision: number;
  identifier: string;
  connected: boolean;
  displayScale: number;
  labelPosition: ApparatusLabelPosition;
  labelFontSize: number;
  labelOffsetX: number;
  labelOffsetY: number;
  labelLocked: boolean;
  comments: string;
}

export type ConnectionTargetType = 'apparatus' | 'electrical-panel';

export interface DuctTarget {
  type: ConnectionTargetType;
  id: string;
}

export type DuctEndpoint =
  | {
      type: 'octopus-output';
      octopusId: string;
      outputNumber: number;
    }
  | {
      type: 'apparatus';
      id: string;
    }
  | {
      type: 'electrical-panel';
      id: string;
    };

export type CircuitOrigin =
  | {
      type: 'octopus-output';
      octopusId: string;
      outputNumber: number;
    }
  | {
      type: 'electrical-panel';
      id: string;
      directCircuitId?: string;
    };

export interface DuctConductor {
  order: number;
  quantity: number;
  function: string;
  color: string;
  sectionMm2: 1.5 | 2.5 | 6;
}

export interface DuctWaypoint extends Point {
  id: string;
}

export interface DuctControlPoint extends Point {
  id: string;
}

export interface DuctSpecification {
  outputCode: string;
  destination: string;
  diameterMm?: 16 | 20 | 25;
  adapterColor?: string;
  capped: boolean;
  capColor?: string;
  availableLengthMeters: number;
  linkColor: string;
  contentDescription?: string;
  conductors: DuctConductor[];
}

export interface Duct {
  id: string;
  source: DuctEndpoint;
  target: DuctEndpoint;
  circuitOrigin: CircuitOrigin;
  visible: boolean;
  locked: boolean;
  waypoints: DuctWaypoint[];
  controls: DuctControlPoint[];
  specification: DuctSpecification;
  catalogVersion: string;
  catalogRevision: number;
}

export type ConnectionTarget = DuctTarget;
export type Connection = Duct;

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  printVisible?: boolean;
}

export interface DrawingState {
  viewport: Viewport;
  metersPerPixel: number | null;
  scaleReference: ScaleReference | null;
  scaleMarkerVisible: boolean;
  zoomWheelEnabled: boolean;
  movementLocked: boolean;
  apparatusGlobalScale: number;
}

export interface ProjectInfo {
  id: string;
  name: string;
  updatedAt: string;
}

export interface CpreyDrawProject {
  schemaVersion: 1;
  project: ProjectInfo;
  drawing: DrawingState;
  plans: Plan[];
  electricalPanel?: ElectricalPanel;
  octopuses: Octopus[];
  apparatus: ApparatusInstance[];
  ducts: Duct[];
  layers: DrawingLayer[];
}
