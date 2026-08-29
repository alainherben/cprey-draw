import type {
  CpreyDrawProject,
  ProjectAccess,
  ProjectAudit,
  ProjectOrigin,
  ProjectOwnership,
  ProjectRole,
  ProjectStatus,
  SiteInformation,
} from '../types/project';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Brouillon',
  design: 'En conception',
  review: 'À valider',
  validated: 'Validé',
  'in-progress': 'En travaux',
  archived: 'Archivé',
};

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({
  value: value as ProjectStatus,
  label,
}));

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  installer: 'Installateur',
  'cprey-support': 'Support CPREY',
  admin: 'Administrateur',
  viewer: 'Lecture seule',
};

const PROJECT_STATUSES = new Set<ProjectStatus>([
  'draft',
  'design',
  'review',
  'validated',
  'in-progress',
  'archived',
]);

export function createDefaultSiteInformation(): SiteInformation {
  return {};
}

export function createDefaultProjectOrigin(): ProjectOrigin {
  return { type: 'manual' };
}

export function createDefaultProjectOwnership(): ProjectOwnership {
  return {};
}

export function createDefaultProjectAccess(): ProjectAccess {
  return {};
}

export function createProjectAudit(now = new Date().toISOString()): ProjectAudit {
  return {
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSiteInformation(site: Partial<SiteInformation> | undefined): SiteInformation {
  if (!site || typeof site !== 'object') {
    return createDefaultSiteInformation();
  }

  const normalized = {
    name: normalizeOptionalText(site.name),
    reference: normalizeOptionalText(site.reference),
    quoteReference: normalizeOptionalText(site.quoteReference),
    clientName: normalizeOptionalText(site.clientName),
    address: normalizeOptionalText(site.address),
    postalCode: normalizeOptionalText(site.postalCode),
    city: normalizeOptionalText(site.city),
    phone: normalizeOptionalText(site.phone),
    email: normalizeOptionalText(site.email),
    builder: normalizeOptionalText(site.builder),
    electrician: normalizeOptionalText(site.electrician),
    distributor: normalizeOptionalText(site.distributor),
    projectVersion: normalizeOptionalText(site.projectVersion),
    comments: normalizeOptionalText(site.comments),
  };

  return Object.fromEntries(
    Object.entries(normalized).filter(([, value]) => value !== undefined),
  ) as SiteInformation;
}

export function normalizeProjectOrigin(origin: Partial<ProjectOrigin> | undefined): ProjectOrigin {
  if (!origin || origin.type !== 'configurator') {
    return createDefaultProjectOrigin();
  }

  const normalizedOrigin: ProjectOrigin = {
    type: 'configurator',
    quoteId: normalizeOptionalText(origin.quoteId),
    configuratorVersion: normalizeOptionalText(origin.configuratorVersion),
    importedAt: normalizeOptionalText(origin.importedAt),
    sourceFile: normalizeOptionalText(origin.sourceFile),
    sourceHash: normalizeOptionalText(origin.sourceHash),
    configuratorSummary: origin.configuratorSummary
      ? {
          level: origin.configuratorSummary.level,
          requestedOctopuses: Array.isArray(origin.configuratorSummary.requestedOctopuses)
            ? origin.configuratorSummary.requestedOctopuses.map((item) => ({ ...item }))
            : undefined,
          requestedApparatus: Array.isArray(origin.configuratorSummary.requestedApparatus)
            ? origin.configuratorSummary.requestedApparatus.map((item) => ({ ...item }))
            : undefined,
        }
      : undefined,
  };

  const sourceApplication = normalizeOptionalText(origin.sourceApplication);
  const sourceVariant = normalizeOptionalText(origin.sourceVariant);
  const sourceVersion = normalizeOptionalText(origin.sourceVersion);
  const exportedAt = normalizeOptionalText(origin.exportedAt);
  const selectedScenario = normalizeScenario(origin.selectedScenario);
  if (sourceApplication) normalizedOrigin.sourceApplication = sourceApplication;
  if (sourceVariant) normalizedOrigin.sourceVariant = sourceVariant;
  if (sourceVersion) normalizedOrigin.sourceVersion = sourceVersion;
  if (exportedAt) normalizedOrigin.exportedAt = exportedAt;
  if (selectedScenario) normalizedOrigin.selectedScenario = selectedScenario;

  if (origin.cdef) {
    normalizedOrigin.cdef = {
      schemaVersion: 1,
      levels: Array.isArray(origin.cdef.levels) ? origin.cdef.levels.filter(isNonEmptyString) : [],
      rooms: Array.isArray(origin.cdef.rooms)
        ? origin.cdef.rooms
            .filter((room) => isNonEmptyString(room.levelName) && isNonEmptyString(room.roomName))
            .map((room) => ({
              levelName: room.levelName,
              roomName: room.roomName,
              profile: normalizeOptionalText(room.profile),
            }))
        : [],
      unknownMetrics: Array.isArray(origin.cdef.unknownMetrics)
        ? origin.cdef.unknownMetrics
            .filter((metric) =>
              isNonEmptyString(metric.levelName) &&
              isNonEmptyString(metric.roomName) &&
              isNonEmptyString(metric.metricKey),
            )
            .map((metric) => ({
              levelName: metric.levelName,
              roomName: metric.roomName,
              metricKey: metric.metricKey,
              quantity: Number.isFinite(metric.quantity) ? metric.quantity : 0,
            }))
        : undefined,
    };
  }

  return normalizedOrigin;
}

export function normalizeProjectStatus(status: unknown): ProjectStatus {
  return typeof status === 'string' && PROJECT_STATUSES.has(status as ProjectStatus)
    ? status as ProjectStatus
    : 'draft';
}

export function normalizeProjectOwnership(ownership: Partial<ProjectOwnership> | undefined): ProjectOwnership {
  if (!ownership || typeof ownership !== 'object') {
    return createDefaultProjectOwnership();
  }

  return {
    ownerUserId: normalizeOptionalText(ownership.ownerUserId),
    ownerOrganizationId: normalizeOptionalText(ownership.ownerOrganizationId),
  };
}

export function normalizeProjectAccess(access: Partial<ProjectAccess> | undefined): ProjectAccess {
  if (!access || typeof access !== 'object') {
    return createDefaultProjectAccess();
  }

  return {
    editableBy: Array.isArray(access.editableBy) ? access.editableBy.filter(isNonEmptyString) : undefined,
    viewableBy: Array.isArray(access.viewableBy) ? access.viewableBy.filter(isNonEmptyString) : undefined,
  };
}

export function normalizeProjectAudit(
  audit: Partial<ProjectAudit> | undefined,
  fallbackDate = new Date().toISOString(),
): ProjectAudit {
  const createdAt = isNonEmptyString(audit?.createdAt) ? audit.createdAt : fallbackDate;
  const updatedAt = isNonEmptyString(audit?.updatedAt) ? audit.updatedAt : fallbackDate;

  return {
    createdAt,
    createdBy: normalizeOptionalText(audit?.createdBy),
    updatedAt,
    updatedBy: normalizeOptionalText(audit?.updatedBy),
  };
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status];
}

export function getProjectDisplayName(project: CpreyDrawProject): string {
  return project.site.name?.trim() || project.project.name || 'Projet CPREY DRAW';
}

export function getProjectReferenceLabel(project: CpreyDrawProject): string | undefined {
  return project.site.reference?.trim() || undefined;
}

function normalizeOptionalText(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeScenario(value: unknown): 'MIN' | 'MOY' | 'MAX' | undefined {
  return value === 'MIN' || value === 'MOY' || value === 'MAX' ? value : undefined;
}
