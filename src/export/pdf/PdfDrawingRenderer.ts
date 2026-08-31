import type { jsPDF } from 'jspdf';
import { getApparatusCatalogItem } from '../../catalog/apparatus';
import { getApparatusImageLayout, getApparatusLabelLayout, getApparatusPixelSize } from '../../domain/apparatus';
import { getApparatusAssetUrl } from '../../domain/apparatusAssets';
import { buildQuadraticDuctGeometry, quadraticBezierPoint } from '../../domain/ductGeometry';
import { getDuctPathPoints, getLinkColorCss } from '../../domain/ducts';
import { getElectricalPanelPixelSize } from '../../domain/electricalPanel';
import { getOctopusPixelSize, OCTOPUS_MODELS } from '../../domain/octopus';
import { getOctopusLogoUrl } from '../../domain/octopusAssets';
import { calculateDuctLengthBreakdownFromPoints } from '../../domain/technicalSettings';
import type { ApparatusInstance, CpreyDrawProject, Point } from '../../types/project';
import { getPdfCartoucheItems, getPdfPlanRect } from './PdfLayout';
import type { PdfDocumentModel, PdfFitTransform, PdfPageModel, PdfPlanScope } from './PdfTypes';

const imageCache = new Map<string, Promise<string>>();
const rotatedImageCache = new Map<string, Promise<string>>();

export async function renderPdfPlanPage(
  doc: jsPDF,
  model: PdfDocumentModel,
  page: Extract<PdfPageModel, { type: 'general-plan' | 'octopus-plan' }>,
  pageNumber: number,
  totalPages: number,
): Promise<void> {
  const planRect = getPdfPlanRect(model.options);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor('#111827');
  doc.text(page.title, planRect.x, planRect.y - 4);

  doc.setDrawColor('#d1d5db');
  doc.setLineWidth(0.25);
  doc.rect(planRect.x, planRect.y, planRect.width, planRect.height);

  await drawPlanBackground(doc, page.scope, page.transform);
  drawDucts(doc, model.project, page.scope, page.transform, shouldShowDuctLengths(model, page));
  drawElectricalPanel(doc, model.project, page.scope, page.transform);
  await drawOctopuses(doc, model.project, page.scope, page.transform);
  await drawApparatus(doc, model.project, page.scope, page.transform);
  drawCartouche(doc, model, pageNumber, totalPages);
}

async function drawPlanBackground(doc: jsPDF, scope: PdfPlanScope, transform: PdfFitTransform): Promise<void> {
  const plan = scope.plan;
  if (!plan || plan.visible === false || !plan.width || !plan.height) {
    return;
  }

  const position = worldToPdf({ x: 0, y: 0 }, transform);
  const format = plan.mimeType === 'image/png' ? 'PNG' : 'JPEG';
  doc.addImage(
    plan.source,
    format,
    position.x,
    position.y,
    plan.width * transform.scale,
    plan.height * transform.scale,
    undefined,
    'FAST',
    plan.rotation,
  );
}

function drawDucts(
  doc: jsPDF,
  project: CpreyDrawProject,
  scope: PdfPlanScope,
  transform: PdfFitTransform,
  showLengthLabels: boolean,
) {
  for (const duct of scope.ducts) {
    const points = getDuctPathPoints(
      duct,
      project.octopuses,
      project.apparatus,
      project.electricalPanel,
      project.drawing.metersPerPixel,
    );
    const geometry = buildQuadraticDuctGeometry(points, duct.controls, project.drawing.metersPerPixel);
    if (!geometry) {
      continue;
    }

    doc.setDrawColor(getLinkColorCss(duct.specification.linkColor));
    doc.setLineWidth(0.55);
    for (const segment of geometry.segments) {
      let previous = worldToPdf(segment.start, transform);
      for (let sample = 1; sample <= 28; sample += 1) {
        const nextWorld = quadraticBezierPoint(segment.start, segment.control, segment.end, sample / 28);
        const next = worldToPdf(nextWorld, transform);
        doc.line(previous.x, previous.y, next.x, next.y);
        previous = next;
      }
    }

    if (showLengthLabels) {
      const labelPoint = worldToPdf(geometry.labelPoint, transform);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor('#111827');
      const length = calculateDuctLengthBreakdownFromPoints(project, duct, points, duct.controls).total;
      doc.text(`${(length ?? geometry.lengthMeters).toFixed(2).replace('.', ',')} m`, labelPoint.x + 1.2, labelPoint.y - 1.2);
    }
  }
}

function drawElectricalPanel(doc: jsPDF, project: CpreyDrawProject, scope: PdfPlanScope, transform: PdfFitTransform) {
  const panel = scope.electricalPanel;
  if (!panel || !panel.visible || project.drawing.metersPerPixel === null) {
    return;
  }

  const size = getElectricalPanelPixelSize(project.drawing.metersPerPixel);
  const center = worldToPdf(panel, transform);
  const width = size.width * transform.scale;
  const height = size.height * transform.scale;

  doc.setFillColor('#f3f4f6');
  doc.setDrawColor('#111827');
  doc.setLineWidth(0.25);
  doc.roundedRect(center.x - width / 2, center.y - height / 2, width, height, 1.2, 1.2, 'FD');
  drawLightning(doc, center, Math.min(width, height) * 0.6);
}

async function drawOctopuses(
  doc: jsPDF,
  project: CpreyDrawProject,
  scope: PdfPlanScope,
  transform: PdfFitTransform,
): Promise<void> {
  if (project.drawing.metersPerPixel === null) {
    return;
  }

  for (const octopus of scope.octopuses) {
    if (!octopus.visible) {
      continue;
    }

    const size = getOctopusPixelSize(project.drawing.metersPerPixel);
    const displayScale = octopus.displayScale ?? 1;
    const physicalWidth = size.width * displayScale * transform.scale;
    const physicalHeight = size.height * displayScale * transform.scale;
    const naturalFrameSize = Math.min(physicalWidth, physicalHeight) * 1.8 * scope.octopusLogoFrame.sizeScale;
    const frameSize = clamp(
      naturalFrameSize,
      scope.octopusLogoFrame.minSizeMm,
      scope.octopusLogoFrame.maxSizeMm,
    );
    const logoSize = frameSize * scope.octopusLogoFrame.logoRatio;
    const center = worldToPdf(octopus, transform);
    const logoUrl = getOctopusLogoUrl(octopus.modelId);
    const color = OCTOPUS_MODELS[octopus.modelId].color;

    try {
      const dataUrl = await imageUrlToPngDataUrl(logoUrl);
      drawOctopusLogoFrame(doc, center, frameSize, color, scope.octopusLogoFrame.borderWidthMm);
      doc.addImage(dataUrl, 'PNG', center.x - logoSize / 2, center.y - logoSize / 2, logoSize, logoSize, undefined, 'FAST');
    } catch (error) {
      console.error(`Logo de pieuvre manquant ou illisible: ${octopus.modelId}`, error);
      drawOctopusLogoFrame(doc, center, frameSize, '#9ca3af', scope.octopusLogoFrame.borderWidthMm);
    }
  }
}

async function drawApparatus(
  doc: jsPDF,
  project: CpreyDrawProject,
  scope: PdfPlanScope,
  transform: PdfFitTransform,
): Promise<void> {
  if (project.drawing.metersPerPixel === null) {
    return;
  }

  for (const apparatus of scope.apparatus) {
    if (!apparatus.visible) {
      continue;
    }

    const catalogItem = getApparatusCatalogItem(apparatus.catalogId);
    const size = getApparatusPixelSize(
      project.drawing.metersPerPixel,
      apparatus.displayScale,
      project.drawing.apparatusGlobalScale,
    );
    const width = Math.max(size.width * transform.scale, (catalogItem.minDisplaySizePx ?? 22) * 0.18);
    const height = Math.max(size.height * transform.scale, (catalogItem.minDisplaySizePx ?? 22) * 0.18);
    const center = worldToPdf(apparatus, transform);
    const assetUrl = getApparatusAssetUrl(apparatus.catalogId, apparatus.connected);
    const imageLayout = getApparatusImageLayout({
      center,
      width,
      height,
      rotation: apparatus.rotation,
    });

    if (assetUrl) {
      await drawRasterAsset(doc, assetUrl, imageLayout, apparatus.catalogId);
    } else {
      doc.setDrawColor(apparatus.connected ? '#00ff00' : '#111827');
      doc.circle(center.x, center.y, Math.min(width, height) / 2, 'S');
    }
    drawApparatusLabel(doc, apparatus, center, width, height, transform);
  }
}

function drawApparatusLabel(
  doc: jsPDF,
  apparatus: ApparatusInstance,
  center: Point,
  iconWidth: number,
  iconHeight: number,
  transform: PdfFitTransform,
) {
  const fontSizeMm = Math.max(2.6, apparatus.labelFontSize * 0.28);
  const placement = getApparatusLabelLayout({
    apparatus: {
      ...apparatus,
      labelOffsetX: apparatus.labelOffsetX * transform.scale,
      labelOffsetY: apparatus.labelOffsetY * transform.scale,
    },
    center,
    iconWidth,
    iconHeight,
    gap: 1.8,
    visibleBounds: { x: -10000, y: -10000, width: 20000, height: 20000 },
    fontSize: fontSizeMm,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizeMm);
  doc.setTextColor('#111827');
  doc.text(apparatus.identifier, placement.x, placement.y + placement.height * 0.74, {
    align: placement.align,
  });
}

function shouldShowDuctLengths(
  model: PdfDocumentModel,
  page: Extract<PdfPageModel, { type: 'general-plan' | 'octopus-plan' }>,
): boolean {
  return page.type === 'general-plan'
    ? model.options.showDuctLengthsGeneralPlan
    : model.options.showDuctLengthsOctopusPlans;
}

function drawCartouche(doc: jsPDF, model: PdfDocumentModel, pageNumber: number, totalPages: number) {
  const pageSize = doc.internal.pageSize;
  const y = pageSize.getHeight() - 16;
  const cartouche = getPdfCartoucheItems(model.project, model.generatedAt, pageNumber, totalPages);
  const firstLine = [
    `Projet : ${cartouche[0][1]}`,
    `Réf. : ${cartouche[1][1]}`,
    `Version : ${cartouche[2][1]}`,
    `Statut : ${cartouche[3][1]}`,
  ].join('   ');
  const secondLine = [
    `Date : ${cartouche[4][1]}`,
    model.project.drawing.metersPerPixel === null ? 'Échelle non définie' : 'Plan calibré',
  ].join('   ');

  doc.setDrawColor('#d1d5db');
  doc.line(10, y - 3, pageSize.getWidth() - 10, y - 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#374151');
  doc.text('CPREY DRAW', 10, y + 2);
  doc.text(firstLine, 42, y + 2, { maxWidth: pageSize.getWidth() - 92 });
  doc.text(secondLine, 42, y + 7, { maxWidth: pageSize.getWidth() - 92 });
  doc.text(`Page ${cartouche[5][1]}`, pageSize.getWidth() - 10, y + 2, { align: 'right' });
}

async function drawRasterAsset(
  doc: jsPDF,
  url: string,
  layout: ReturnType<typeof getApparatusImageLayout>,
  label = url,
): Promise<void> {
  try {
    const dataUrl = await imageUrlToRotatedPngDataUrl(url, layout.rotation);
    doc.addImage(
      dataUrl,
      'PNG',
      layout.x - layout.offsetX,
      layout.y - layout.offsetY,
      layout.width,
      layout.height,
      undefined,
      'FAST',
    );
  } catch (error) {
    console.error(`Asset PDF introuvable ou illisible: ${label}`, error);
    doc.setDrawColor('#111827');
    doc.setFillColor('#ffffff');
    doc.circle(layout.x, layout.y, Math.min(layout.width, layout.height) / 2, 'S');
  }
}

function imageUrlToRotatedPngDataUrl(url: string, rotation: number): Promise<string> {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const cacheKey = `${url}#rotation=${normalizedRotation}`;
  const cached = rotatedImageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = imageUrlToPngDataUrl(url).then((dataUrl) =>
    rotatePngDataUrlAroundCenter(dataUrl, normalizedRotation),
  );
  rotatedImageCache.set(cacheKey, promise);
  return promise;
}

function rotatePngDataUrlAroundCenter(dataUrl: string, rotation: number): Promise<string> {
  if (rotation === 0) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const side = Math.max(image.naturalWidth, image.naturalHeight, 1);
      const canvas = document.createElement('canvas');
      canvas.width = side;
      canvas.height = side;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas PDF indisponible'));
        return;
      }

      context.translate(side / 2, side / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(image, -side / 2, -side / 2, side, side);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Image rasterisée illisible'));
    image.src = dataUrl;
  });
}

function imageUrlToPngDataUrl(url: string): Promise<string> {
  const cached = imageCache.get(url);
  if (cached) {
    return cached;
  }

  const promise = new Promise<string>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 768;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas PDF indisponible.'));
        return;
      }
      context.clearRect(0, 0, size, size);
      const ratio = image.naturalWidth > 0 && image.naturalHeight > 0
        ? image.naturalWidth / image.naturalHeight
        : 1;
      const drawWidth = ratio >= 1 ? size : size * ratio;
      const drawHeight = ratio >= 1 ? size / ratio : size;
      context.drawImage(image, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error(`Asset PDF introuvable: ${url}`));
    image.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

function drawOctopusLogoFrame(doc: jsPDF, center: Point, size: number, color: string, borderWidthMm: number) {
  doc.setFillColor('#ffffff');
  doc.setDrawColor(color || '#9ca3af');
  doc.setLineWidth(borderWidthMm);
  doc.roundedRect(center.x - size / 2, center.y - size / 2, size, size, 2, 2, 'FD');
}

function worldToPdf(point: Point, transform: PdfFitTransform): Point {
  return {
    x: transform.x + point.x * transform.scale,
    y: transform.y + point.y * transform.scale,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function drawLightning(doc: jsPDF, center: Point, size: number) {
  const half = size / 2;
  const points: Point[] = [
    { x: center.x + half * 0.1, y: center.y - half },
    { x: center.x - half * 0.45, y: center.y + half * 0.05 },
    { x: center.x - half * 0.02, y: center.y + half * 0.05 },
    { x: center.x - half * 0.18, y: center.y + half },
    { x: center.x + half * 0.48, y: center.y - half * 0.16 },
    { x: center.x + half * 0.06, y: center.y - half * 0.16 },
  ];
  doc.setFillColor('#111827');
  doc.setDrawColor('#111827');
  doc.triangle(points[0].x, points[0].y, points[1].x, points[1].y, points[2].x, points[2].y, 'F');
  doc.triangle(points[2].x, points[2].y, points[3].x, points[3].y, points[4].x, points[4].y, 'F');
  doc.triangle(points[0].x, points[0].y, points[4].x, points[4].y, points[5].x, points[5].y, 'F');
}
