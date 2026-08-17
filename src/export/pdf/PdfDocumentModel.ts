import { buildProjectNomenclature } from '../../domain/bom';
import { validateProject } from '../../domain/projectValidation';
import type { CpreyDrawProject } from '../../types/project';
import {
  buildPdfFilename,
  createGeneralPlanScope,
  createOctopusPlanScope,
  fitDrawingToPdfPage,
  getPdfPlanRect,
  getScopeDrawingBounds,
} from './PdfLayout';
import type { PdfDocumentModel, PdfExportOptions, PdfPageModel } from './PdfTypes';

export function buildPdfDocumentModel(
  project: CpreyDrawProject,
  options: PdfExportOptions,
  generatedAt = new Date(),
): PdfDocumentModel {
  const nomenclature = buildProjectNomenclature(project);
  const validation = validateProject(project);
  const pages: PdfPageModel[] = [];
  const planRect = getPdfPlanRect(options);

  if (options.includeCover) {
    pages.push({ type: 'cover', title: 'CPREY DRAW' });
  }

  if (options.includeGeneralPlan) {
    const scope = createGeneralPlanScope(project, options.visibleLayersOnly);
    pages.push({
      type: 'general-plan',
      title: 'PLAN GÉNÉRAL',
      scope,
      transform: fitDrawingToPdfPage(getScopeDrawingBounds(project, scope), planRect),
    });
  }

  if (options.includeOctopusPlans) {
    for (const octopus of project.octopuses.filter((candidate) => candidate.visible)) {
      const scope = createOctopusPlanScope(project, octopus.id);
      pages.push({
        type: 'octopus-plan',
        title: `PIEUVRE ${octopus.name.toUpperCase()}`,
        octopusId: octopus.id,
        scope,
        transform: fitDrawingToPdfPage(getScopeDrawingBounds(project, scope), planRect),
      });
    }
  }

  if (options.includeNomenclature || options.includeApparatus || options.includeReserves) {
    pages.push({ type: 'nomenclature', title: 'NOMENCLATURE' });
  }

  if (options.includeValidation || validation.errorCount > 0) {
    pages.push({ type: 'validation', title: 'CONTRÔLES DU PROJET' });
  }

  return {
    project,
    options,
    generatedAt,
    filename: buildPdfFilename(project.project.name, generatedAt),
    pages,
    nomenclature,
    validation,
  };
}
