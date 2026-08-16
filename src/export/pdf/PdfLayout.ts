import { getDuctPathPoints } from '../../domain/ducts';
import { getElectricalPanelPixelSize } from '../../domain/electricalPanel';
import { getOctopusPixelSize } from '../../domain/octopus';
import type { CpreyDrawProject, Duct, Point } from '../../types/project';
import type { PdfExportOptions, PdfFitTransform, PdfPageRect, PdfPlanScope } from './PdfTypes';

export const PDF_MARGIN_MM = 10;
export const PDF_PLAN_TITLE_HEIGHT_MM = 12;
export const PDF_CARTOUCHE_HEIGHT_MM = 14;

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

export function buildPdfFilename(projectName: string | undefined, date: Date): string {
  const rawName = projectName?.trim() || 'Projet';
  const cleanedName = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'Projet';
  const isoDate = date.toISOString().slice(0, 10);
  return `CPREY-DRAW_${cleanedName}_${isoDate}.pdf`;
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

export function createGeneralPlanScope(project: CpreyDrawProject): PdfPlanScope {
  return {
    plan: project.plans[0],
    electricalPanel: project.electricalPanel,
    octopuses: project.octopuses.filter((octopus) => octopus.visible),
    apparatus: project.apparatus.filter((apparatus) => apparatus.visible),
    ducts: project.ducts.filter((duct) => duct.visible),
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

function addObjectBounds(points: Point[], x: number, y: number, width: number, height: number) {
  points.push(
    { x: x - width / 2, y: y - height / 2 },
    { x: x + width / 2, y: y + height / 2 },
  );
}
