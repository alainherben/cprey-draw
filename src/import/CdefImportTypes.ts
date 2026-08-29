import type { ApparatusCatalogId, CpreyDrawProject, OctopusModelId } from '../types/project';

export type CdefSchemaVersion = 1;
export type CdefScenario = 'MIN' | 'MOY' | 'MAX';

export interface CdefImportHeader {
  application?: string;
  variant?: string;
  applicationVersion?: string;
  exportedAt?: string;
}

export interface CdefPieuvreTotals {
  cuisine?: number;
  bain?: number;
  confort?: number;
  autre?: number;
  total?: number;
}

export interface CdefImportWarning {
  code:
    | 'missing-header'
    | 'missing-scenario-result'
    | 'missing-calculations-pieuvres'
    | 'unknown-apparatus-metric'
    | 'unknown-room-profile'
    | 'invalid-quantity'
    | 'pieuvre-total-mismatch';
  message: string;
  path?: string;
}

export interface CdefRoomImportSummary {
  levelName: string;
  roomName: string;
  profile?: string;
}

export interface CdefImportSummary {
  projectName: string;
  sourceApplication?: string;
  sourceVariant?: string;
  sourceVersion?: string;
  exportedAt?: string;
  selectedScenario: CdefScenario;
  levelsCount: number;
  roomsCount: number;
  pieuvres: Record<OctopusModelId, number> & { total: number };
  apparatus: {
    metricKey: string;
    catalogId: ApparatusCatalogId;
    label: string;
    quantity: number;
  }[];
  unknownMetrics: {
    levelName: string;
    roomName: string;
    metricKey: string;
    quantity: number;
  }[];
  rooms: CdefRoomImportSummary[];
}

export interface CdefImportResult {
  project: CpreyDrawProject;
  summary: CdefImportSummary;
  warnings: CdefImportWarning[];
}

export interface CdefNormalizedRoomMetric {
  key: string;
  quantity: number;
}

export interface CdefNormalizedRoom {
  levelName: string;
  roomName: string;
  profile?: string;
  metrics: CdefNormalizedRoomMetric[];
}

export interface CdefNormalizedData {
  header: CdefImportHeader;
  projectName: string;
  rooms: CdefNormalizedRoom[];
  selectedScenario: CdefScenario;
  scenarioTotals?: CdefPieuvreTotals;
  calculationTotals?: CdefPieuvreTotals;
}
