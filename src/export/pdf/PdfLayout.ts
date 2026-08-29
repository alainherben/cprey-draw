import { getDuctPathPoints } from '../../domain/ducts';
import { getElectricalPanelPixelSize } from '../../domain/electricalPanel';
import { getOctopusPixelSize } from '../../domain/octopus';
import { getOctopusLogoFilename } from '../../domain/octopusAssetMap';
import { getProjectDisplayName, getProjectReferenceLabel, getProjectStatusLabel } from '../../domain/site';
import {
  isApparatusEffectivelyVisible,
  isDuctEffectivelyVisible,
  isElectricalPanelEffectivelyVisible,
  isOctopusEffectivelyVisible,
  isPlanEffectivelyVisible,
} from '../../domain/visibility';
import type { CpreyDrawProject, Duct, Point } from '../../types/project';
import type { PdfExportOptions, PdfFitTransform, PdfPageRect, PdfPlanScope } from './PdfTypes';

export const PDF_MARGIN_MM = 10;
export const PDF_PLAN_TITLE_HEIGHT_MM = 12;
export const PDF_CARTOUCHE_HEIGHT_MM = 14;
export const OCTOPUS_LOGO_RENDER_SIZE_SCALE = 0.33;
export const PDF_OCTOPUS_LOGO_FRAME = {
  fill: '#ffffff',
  borderWidthMm: 0.5,
  minSizeMm: 6,
  maxSizeMm: 7,
  logoRatio: 0.66,
  sizeScale: OCTOPUS_LOGO_RENDER_SIZE_SCALE,
} as const;

const PAGE_SIZES_MM = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
};

export function getPdfPageSize(options: PdfExportOptions): { width: number; height: number } {
  const size = PAGE_SIZES_MM[options.paperFormat];
  return options.orientation === 'landscape'
    ? { width: Math.max(size.width, size.height), height: Math.min(size.width, size.height) }
    : { width: Math.min(size.width, size.height), height: Math.max(size.width, size.height) };
}

export function getPdfPlanRect(options: PdfExportOptions): PdfPageRect {
  const pageSize = getPdfPageSize(options);
  return {
    x: PDF_MARGIN_MM,
    y: PDF_MARGIN_MM + PDF_PLAN_TITLE_HEIGHT_MM,
    width: pageSize.width - PDF_MARGIN_MM * 2,
    height: pageSize.height - PDF_MARGIN_MM * 2 - PDF_PLAN_TITLE_HEIGHT_MM - PDF_CARTOUCHE_HEIGHT_MM,
  };
}

export function formatPdfLength(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Non définie' : `${value.toFixed(2).replace('.', ',')} m`;
}

export function formatPdfDate(date: Date): string {
  return date.toLocaleDateString('fr-FR');
}

export function buildPdfFilename(project: CpreyDrawProject, date: Date): string {
  const cleanedName = cleanFilenamePart(project.site.name ?? project.project.name) || 'Projet';
  const cleanedReference = cleanFilenamePart(project.site.reference);
  const isoDate = date.toISOString().slice(0, 10);
  return `CPREY_DRAW_${[cleanedName, cleanedReference, isoDate].filter(Boolean).join('_')}.pdf`;
}

export function getPdfCoverRows(project: CpreyDrawProject): [string, string][] {
  const rows: [string, string][] = [];
  addRow(rows, 'Nom chantier', project.site.name);
  addRow(rows, 'Client', project.site.clientName);
  addRow(rows, 'Adresse', formatAddress(project));
  addRow(rows, 'Référence chantier', project.site.reference);
  addRow(rows, 'Référence devis', project.site.quoteReference);
  addRow(rows, 'Électricien', project.site.electrician);
  addRow(rows, 'Magasin / Distributeur', project.site.distributor);
  addRow(rows, 'Statut', getProjectStatusLabel(project.status));
  addRow(rows, 'Version', project.site.projectVersion);

  if (project.origin.type === 'configurator') {
    addRow(rows, 'Origine', 'Configurateur CPREY');
    addRow(rows, 'Référence configurateur', project.origin.quoteId ?? project.site.quoteReference);
    addRow(rows, 'Niveau configurateur', project.origin.configuratorSummary?.level);
  }

  return rows;
}

export function getPdfCartoucheItems(
  project: CpreyDrawProject,
  generatedAt: Date,
  pageNumber: number,
  totalPages: number,
): [string, string][] {
  return [
    ['Projet', getProjectDisplayName(project)],
    ['Référence', getProjectReferenceLabel(project) ?? 'Non renseignée'],
    ['Version', project.site.projectVersion ?? 'Non renseignée'],
    ['Statut', getProjectStatusLabel(project.status)],
    ['Date', formatPdfDate(generatedAt)],
    ['Page', `${pageNumber} / ${totalPages}`],
  ];
}

function cleanFilenamePart(value: string | undefined): string {
  const rawName = value?.trim() ?? '';
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 70);
}

function formatAddress(project: CpreyDrawProject): string | undefined {
  const addressParts = [
    project.site.address,
    [project.site.postalCode, project.site.city].filter(Boolean).join(' '),
  ].filter(Boolean);

  return addressParts.length > 0 ? addressParts.join(', ') : undefined;
}

function addRow(rows: [string, string][], label: string, value: string | undefined) {
  if (value && value.trim().length > 0) {
    rows.push([label, value]);
  }
}

export function fitDrawingToPdfPage(bounds: PdfPageRect, pageRect: PdfPageRect): PdfFitTransform {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      scale: 1,
      x: pageRect.x + pageRect.width / 2,
      y: pageRect.y + pageRect.height / 2,
    };
  }

  const scale = Math.min(pageRect.width / bounds.width, pageRect.height / bounds.height);
  return {
    scale,
    x: pageRect.x + (pageRect.width - bounds.width * scale) / 2 - bounds.x * scale,
    y: pageRect.y + (pageRect.height - bounds.height * scale) / 2 - bounds.y * scale,
  };
}

export function createGeneralPlanScope(project: CpreyDrawProject, visibleLayersOnly = false): PdfPlanScope {
  const plan = project.plans[0];
  const electricalPanel = project.electricalPanel;

  return {
    plan: plan && isPlanVisibleForPdf(project, plan, visibleLayersOnly) ? plan : undefined,
    electricalPanel: electricalPanel && isElectricalPanelVisibleForPdf(project, electricalPanel, visibleLayersOnly)
      ? electricalPanel
      : undefined,
    octopuses: project.octopuses.filter((octopus) => isOctopusVisibleForPdf(project, octopus, visibleLayersOnly)),
    octopusLogoAssets: Object.fromEntries(
      project.octopuses.map((octopus) => [octopus.id, getOctopusLogoFilename(octopus.modelId)]),
    ),
    octopusRenderMode: 'official-logo-framed',
    octopusLogoFrame: PDF_OCTOPUS_LOGO_FRAME,
    apparatus: project.apparatus.filter((apparatus) => isApparatusVisibleForPdf(project, apparatus, visibleLayersOnly)),
    ducts: project.ducts.filter((duct) => isDuctVisibleForPdf(project, duct, visibleLayersOnly)),
  };
}

export function createOctopusPlanScope(project: CpreyDrawProject, octopusId: string): PdfPlanScope {
  const octopus = project.octopuses.find((candidate) => candidate.id === octopusId);
  const ducts = project.ducts.filter(
    (duct) => duct.visible && duct.circuitOrigin.type === 'octopus-output' && duct.circuitOrigin.octopusId === octopusId,
  );
  const apparatusIds = new Set<string>();
  let includeElectricalPanel = false;

  for (const duct of ducts) {
    collectApparatusEndpoint(duct.source, apparatusIds);
    collectApparatusEndpoint(duct.target, apparatusIds);
    includeElectricalPanel = includeElectricalPanel || duct.source.type === 'electrical-panel' || duct.target.type === 'electrical-panel';
  }

  return {
    octopus,
    plan: project.plans[0],
    electricalPanel: includeElectricalPanel ? project.electricalPanel : undefined,
    octopuses: octopus && octopus.visible ? [octopus] : [],
    octopusLogoAssets: octopus ? { [octopus.id]: getOctopusLogoFilename(octopus.modelId) } : {},
    octopusRenderMode: 'official-logo-framed',
    octopusLogoFrame: PDF_OCTOPUS_LOGO_FRAME,
    apparatus: project.apparatus.filter((apparatus) => apparatus.visible && apparatusIds.has(apparatus.id)),
    ducts,
  };
}

export function getScopeDrawingBounds(project: CpreyDrawProject, scope: PdfPlanScope): PdfPageRect {
  const points: Point[] = [];
  const plan = scope.plan;

  if (plan?.visible !== false && plan?.width && plan.height) {
    points.push({ x: 0, y: 0 }, { x: plan.width, y: plan.height });
  }

  if (project.drawing.metersPerPixel !== null) {
    for (const octopus of scope.octopuses) {
      const size = getOctopusPixelSize(project.drawing.metersPerPixel);
      const displayScale = octopus.displayScale ?? 1;
      addObjectBounds(points, octopus.x, octopus.y, size.width * displayScale, size.height * displayScale);
    }

    if (scope.electricalPanel) {
      const size = getElectricalPanelPixelSize(project.drawing.metersPerPixel);
      addObjectBounds(points, scope.electricalPanel.x, scope.electricalPanel.y, size.width, size.height);
    }
  }

  for (const apparatus of scope.apparatus) {
    addObjectBounds(points, apparatus.x, apparatus.y, 120, 120);
  }

  for (const duct of scope.ducts) {
    points.push(
      ...getDuctPathPoints(
        duct,
        project.octopuses,
        project.apparatus,
        project.electricalPanel,
        project.drawing.metersPerPixel,
      ),
    );
    points.push(...duct.controls);
  }

  if (points.length === 0) {
    return { x: 0, y: 0, width: 1000, height: 700 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const padding = Math.max((maxX - minX) * 0.04, 80);

  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(maxX - minX + padding * 2, 1),
    height: Math.max(maxY - minY + padding * 2, 1),
  };
}

function collectApparatusEndpoint(endpoint: Duct['source'] | Duct['target'], apparatusIds: Set<string>) {
  if (endpoint.type === 'apparatus') {
    apparatusIds.add(endpoint.id);
  }
}

function isPlanVisibleForPdf(
  project: CpreyDrawProject,
  plan: NonNullable<CpreyDrawProject['plans'][number]>,
  visibleLayersOnly: boolean,
): boolean {
  return visibleLayersOnly ? isPlanEffectivelyVisible(project, plan) : plan.visible;
}

function isElectricalPanelVisibleForPdf(
  project: CpreyDrawProject,
  electricalPanel: NonNullable<CpreyDrawProject['electricalPanel']>,
  visibleLayersOnly: boolean,
): boolean {
  return visibleLayersOnly
    ? isElectricalPanelEffectivelyVisible(project, electricalPanel)
    : electricalPanel.visible;
}

function isOctopusVisibleForPdf(
  project: CpreyDrawProject,
  octopus: CpreyDrawProject['octopuses'][number],
  visibleLayersOnly: boolean,
): boolean {
  return visibleLayersOnly ? isOctopusEffectivelyVisible(project, octopus) : octopus.visible;
}

function isApparatusVisibleForPdf(
  project: CpreyDrawProject,
  apparatus: CpreyDrawProject['apparatus'][number],
  visibleLayersOnly: boolean,
): boolean {
  return visibleLayersOnly ? isApparatusEffectivelyVisible(project, apparatus) : apparatus.visible;
}

function isDuctVisibleForPdf(
  project: CpreyDrawProject,
  duct: CpreyDrawProject['ducts'][number],
  visibleLayersOnly: boolean,
): boolean {
  return visibleLayersOnly ? isDuctEffectivelyVisible(project, duct) : duct.visible;
}

function addObjectBounds(points: Point[], x: number, y: number, width: number, height: number) {
  points.push(
    { x: x - width / 2, y: y - height / 2 },
    { x: x + width / 2, y: y + height / 2 },
  );
}
