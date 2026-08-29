import type {
  CdefImportHeader,
  CdefImportWarning,
  CdefNormalizedData,
  CdefNormalizedRoom,
  CdefPieuvreTotals,
  CdefScenario,
} from './CdefImportTypes';

const SUPPORTED_SCHEMA = 'CDEF';
const SUPPORTED_SCHEMA_VERSION = 1;
const SCENARIOS = new Set<CdefScenario>(['MIN', 'MOY', 'MAX']);
const PROFILE_KEYS = new Set([
  'SEJOUR',
  'SALON',
  'CUISINE',
  'CHAMBRE',
  'SALLE_DE_BAIN',
  'SDB',
  'WC',
  'COULOIR',
  'ENTREE',
  'GARAGE',
  'CELLIER',
  'BUANDERIE',
  'BUREAU',
  'EXTERIEUR',
]);

export class CdefImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CdefImportError';
  }
}

export interface CdefValidationResult {
  data: CdefNormalizedData;
  warnings: CdefImportWarning[];
}

export function validateCdefProject(input: unknown): CdefValidationResult {
  if (!isRecord(input)) {
    throw new CdefImportError('Ce fichier n’est pas un export CPREY compatible.');
  }
  if (input.schema !== SUPPORTED_SCHEMA) {
    throw new CdefImportError('Ce fichier n’est pas un export CPREY compatible.');
  }
  if (input.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new CdefImportError(`Version CDEF non supportée : ${String(input.schemaVersion ?? 'absente')}.`);
  }

  const warnings: CdefImportWarning[] = [];
  const header = readHeader(input.header, warnings);
  const project = readRequiredRecord(input.project, 'Le fichier ne contient pas de projet.');
  const projectName = readProjectName(project, input.metadata);
  const levels = readRequiredRecord(project.levels, 'Le projet ne contient aucun niveau.');
  const rooms = readRooms(levels, warnings);
  if (rooms.length === 0) {
    throw new CdefImportError('Le projet ne contient aucune pièce.');
  }

  const scenario = readRequiredRecord(input.scenario, 'Le fichier ne contient pas de scénario.');
  const selectedScenario = readScenario(scenario.selected);
  const scenarioTotals = readPieuvreTotals(readOptionalRecord(scenario.result)?.totals);
  if (!scenarioTotals) {
    warnings.push({
      code: 'missing-scenario-result',
      message: 'Le résultat du scénario est absent, les calculs de pieuvres seront utilisés.',
      path: 'scenario.result.totals',
    });
  }

  const calculationTotals = readPieuvreTotals(
    readOptionalRecord(readOptionalRecord(input.calculations)?.pieuvres)?.totals,
  );
  if (!calculationTotals) {
    warnings.push({
      code: 'missing-calculations-pieuvres',
      message: 'Le calcul global des pieuvres est absent.',
      path: 'calculations.pieuvres.totals',
    });
  }
  if (!scenarioTotals && !calculationTotals) {
    throw new CdefImportError('Le fichier ne contient aucun total de pieuvres exploitable.');
  }

  return {
    data: {
      header,
      projectName,
      rooms,
      selectedScenario,
      scenarioTotals,
      calculationTotals,
    },
    warnings,
  };
}

function readHeader(value: unknown, warnings: CdefImportWarning[]): CdefImportHeader {
  if (!isRecord(value)) {
    warnings.push({
      code: 'missing-header',
      message: 'L’en-tête CDEF est absent.',
      path: 'header',
    });
    return {};
  }

  return {
    application: readOptionalString(value.application),
    variant: readOptionalString(value.variant),
    applicationVersion: readOptionalString(value.applicationVersion),
    exportedAt: readOptionalString(value.exportedAt),
  };
}

function readProjectName(project: Record<string, unknown>, metadata: unknown): string {
  const metadataRecord = readOptionalRecord(metadata);
  return (
    readOptionalString(project.projectName) ??
    readOptionalString(metadataRecord?.projectName) ??
    'Projet CPREY DRAW'
  );
}

function readRooms(levels: Record<string, unknown>, warnings: CdefImportWarning[]): CdefNormalizedRoom[] {
  const rooms: CdefNormalizedRoom[] = [];

  for (const [levelName, levelValue] of Object.entries(levels)) {
    if (!isRecord(levelValue)) {
      continue;
    }

    for (const [roomName, roomValue] of Object.entries(levelValue)) {
      if (!isRecord(roomValue)) {
        continue;
      }

      const profile = readOptionalString(roomValue.__profile);
      if (profile && !PROFILE_KEYS.has(profile)) {
        warnings.push({
          code: 'unknown-room-profile',
          message: `Profil de pièce inconnu : ${profile}.`,
          path: `project.levels.${levelName}.${roomName}.__profile`,
        });
      }

      const metrics = Object.entries(roomValue)
        .filter(([key]) => !key.startsWith('__'))
        .map(([key, rawQuantity]) => ({
          key,
          quantity: readQuantity(rawQuantity, warnings, `project.levels.${levelName}.${roomName}.${key}`),
        }))
        .filter((metric) => metric.quantity > 0);

      rooms.push({
        levelName,
        roomName,
        profile,
        metrics,
      });
    }
  }

  if (rooms.length === 0) {
    throw new CdefImportError('Le projet ne contient aucune pièce exploitable.');
  }

  return rooms;
}

function readScenario(value: unknown): CdefScenario {
  if (typeof value !== 'string' || !SCENARIOS.has(value as CdefScenario)) {
    throw new CdefImportError(`Scénario inconnu : ${String(value ?? 'absent')}.`);
  }
  return value as CdefScenario;
}

function readPieuvreTotals(value: unknown): CdefPieuvreTotals | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    cuisine: readPositiveInteger(value.cuisine),
    bain: readPositiveInteger(value.bain),
    confort: readPositiveInteger(value.confort),
    autre: readPositiveInteger(value.autre),
    total: readPositiveInteger(value.total),
  };
}

function readQuantity(value: unknown, warnings: CdefImportWarning[], path: string): number {
  const quantity = readPositiveInteger(value);
  if (quantity === undefined && value !== undefined && value !== null && value !== '') {
    warnings.push({
      code: 'invalid-quantity',
      message: `Quantité invalide ignorée pour ${path}.`,
      path,
    });
  }
  return quantity ?? 0;
}

function readPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function readRequiredRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new CdefImportError(message);
  }
  return value;
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
