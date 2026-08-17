import type { ProjectNomenclature } from '../../domain/bom';
import type { ProjectValidationResult } from '../../domain/projectValidation';
import type {
  ApparatusInstance,
  CpreyDrawProject,
  Duct,
  ElectricalPanel,
  Octopus,
  Plan,
} from '../../types/project';

export type PdfPaperFormat = 'a4' | 'a3';
export type PdfOrientation = 'portrait' | 'landscape';

export interface PdfExportOptions {
  includeCover: boolean;
  includeGeneralPlan: boolean;
  includeOctopusPlans: boolean;
  includeNomenclature: boolean;
  includeValidation: boolean;
  includeReserves: boolean;
  includeApparatus: boolean;
  paperFormat: PdfPaperFormat;
  orientation: PdfOrientation;
  visibleLayersOnly: boolean;
  showDuctLengthsGeneralPlan: boolean;
  showDuctLengthsOctopusPlans: boolean;
}

export interface PdfPageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfFitTransform {
  scale: number;
  x: number;
  y: number;
}

export type PdfPageModel =
  | { type: 'cover'; title: string }
  | { type: 'general-plan'; title: string; scope: PdfPlanScope; transform: PdfFitTransform }
  | { type: 'octopus-plan'; title: string; octopusId: string; scope: PdfPlanScope; transform: PdfFitTransform }
  | { type: 'nomenclature'; title: string }
  | { type: 'validation'; title: string };

export interface PdfDocumentModel {
  project: CpreyDrawProject;
  options: PdfExportOptions;
  generatedAt: Date;
  filename: string;
  pages: PdfPageModel[];
  nomenclature: ProjectNomenclature;
  validation: ProjectValidationResult;
}

export interface PdfPlanScope {
  octopus?: Octopus;
  plan?: Plan;
  electricalPanel?: ElectricalPanel;
  octopuses: Octopus[];
  octopusLogoAssets: Record<string, string>;
  octopusRenderMode: 'official-logo-framed';
  octopusLogoFrame: {
    fill: '#ffffff';
    borderWidthMm: number;
    minSizeMm: number;
    maxSizeMm: number;
    logoRatio: number;
    sizeScale: number;
  };
  apparatus: ApparatusInstance[];
  ducts: Duct[];
}

export const DEFAULT_PDF_EXPORT_OPTIONS: PdfExportOptions = {
  includeCover: true,
  includeGeneralPlan: true,
  includeOctopusPlans: true,
  includeNomenclature: true,
  includeValidation: true,
  includeReserves: true,
  includeApparatus: true,
  paperFormat: 'a3',
  orientation: 'landscape',
  visibleLayersOnly: false,
  showDuctLengthsGeneralPlan: false,
  showDuctLengthsOctopusPlans: true,
};
