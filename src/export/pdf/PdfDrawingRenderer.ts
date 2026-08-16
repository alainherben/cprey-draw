import type { jsPDF } from 'jspdf';
import { getApparatusCatalogItem } from '../../catalog/apparatus';
import { estimateApparatusLabelSize, getApparatusLabelPlacement, getApparatusPixelSize } from '../../domain/apparatus';
import { getApparatusAssetUrl } from '../../domain/apparatusAssets';
import { buildQuadraticDuctGeometry, quadraticBezierPoint } from '../../domain/ductGeometry';
import { getDuctPathPoints, getLinkColorCss } from '../../domain/ducts';
import { getElectricalPanelPixelSize } from '../../domain/electricalPanel';
import { getOctopusPixelSize, getOctopusPortLocalPosition, OCTOPUS_MODELS } from '../../domain/octopus';
import { OCTOPUS_LOGO_URLS } from '../../domain/octopusAssets';
import type { ApparatusInstance, CpreyDrawProject, Duct, Octopus, Point } from '../../types/project';
import { getPdfPlanRect, formatPdfDate } from './PdfLayout';
import type { PdfDocumentModel, PdfFitTransform, PdfPageModel, PdfPlanScope } from './PdfTypes';

const imageCache = new Map<string, Promise<string>>();

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
  drawDucts(doc, model.project, page.scope, page.transform);
  drawElectricalPanel(doc, model.project, page.scope, page.transform);
  await drawOctopuses(doc, model.project, page.scope, page.transform, page.type === 'octopus-plan');
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

function drawDucts(doc: jsPDF, project: CpreyDrawProject, scope: PdfPlanScope, transform: PdfFitTransform) {
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

    const labelPoint = worldToPdf(geometry.labelPoint, transform);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor('#111827');
    doc.text(`${geometry.lengthMeters.toFixed(2).replace('.', ',')} m`, labelPoint.x + 1.2, labelPoint.y - 1.2);
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
  detailed: boolean,
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
    const width = size.width * displayScale * transform.scale;
    const height = size.height * displayScale * transform.scale;
    const center = worldToPdf(octopus, transform);
    const color = OCTOPUS_MODELS[octopus.modelId].color;

    doc.setFillColor('#ffffff');
    doc.setDrawColor(color);
    doc.setLineWidth(0.45);
    doc.roundedRect(center.x - width / 2, center.y - height / 2, width, height, 1.4, 1.4, 'FD');

    const logoUrl = OCTOPUS_LOGO_URLS[octopus.modelId];
    const logoSize = Math.min(width, height) * 0.62;
    await drawRasterAsset(doc, logoUrl, center.x - logoSize / 2, center.y - logoSize / 2, logoSize, logoSize);

    if (detailed) {
      drawOctopusPorts(doc, octopus, center, width, height);
    }
  }
}

function drawOctopusPorts(doc: jsPDF, octopus: Octopus, center: Point, width: number, height: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor('#111827');
  doc.setDrawColor('#111827');
  doc.setFillColor('#ffffff');

  for (const port of octopus.ports) {
    const local = getOctopusPortLocalPosition(port, width, height);
    const angle = (octopus.rotation * Math.PI) / 180;
    const rotated = {
      x: center.x + local.x * Math.cos(angle) - local.y * Math.sin(angle),
      y: center.y + local.x * Math.sin(angle) + local.y * Math.cos(angle),
    };
    doc.circle(rotated.x, rotated.y, 1.2, 'FD');
    doc.text(String(port.number), rotated.x, rotated.y - 1.8, { align: 'center' });
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

    if (assetUrl) {
      await drawRasterAsset(doc, assetUrl, center.x - width / 2, center.y - height / 2, width, height, apparatus.rotation);
    } else {
      doc.setDrawColor(apparatus.connected ? '#00ff00' : '#111827');
      doc.circle(center.x, center.y, Math.min(width, height) / 2, 'S');
    }
    drawApparatusLabel(doc, apparatus, center, width, height);
  }
}

function drawApparatusLabel(doc: jsPDF, apparatus: ApparatusInstance, center: Point, iconWidth: number, iconHeight: number) {
  const fontSizeMm = Math.max(2.6, apparatus.labelFontSize * 0.28);
  const labelSize = estimateApparatusLabelSize(apparatus.identifier, fontSizeMm);
  const placement = getApparatusLabelPlacement({
    center,
    iconWidth,
    iconHeight,
    labelWidth: labelSize.width,
    labelHeight: labelSize.height,
    gap: 1.8,
    visibleBounds: { x: -10000, y: -10000, width: 20000, height: 20000 },
    overrideSide: apparatus.labelPosition,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSizeMm);
  doc.setTextColor('#111827');
  doc.text(apparatus.identifier, placement.x, placement.y + labelSize.height * 0.74, {
    align: placement.align,
  });
}

function drawCartouche(doc: jsPDF, model: PdfDocumentModel, pageNumber: number, totalPages: number) {
  const pageSize = doc.internal.pageSize;
  const y = pageSize.getHeight() - 16;
  doc.setDrawColor('#d1d5db');
  doc.line(10, y - 3, pageSize.getWidth() - 10, y - 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor('#374151');
  doc.text('CPREY DRAW', 10, y + 2);
  doc.text(`Projet : ${model.project.project.name}`, 52, y + 2);
  doc.text(`Date : ${formatPdfDate(model.generatedAt)}`, 10, y + 7);
  doc.text(model.project.drawing.metersPerPixel === null ? 'Échelle non définie' : 'Plan calibré', 52, y + 7);
  doc.text(`Page ${pageNumber} / ${totalPages}`, pageSize.getWidth() - 10, y + 2, { align: 'right' });
}

async function drawRasterAsset(
  doc: jsPDF,
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
): Promise<void> {
  try {
    const dataUrl = await imageUrlToPngDataUrl(url);
    doc.addImage(dataUrl, 'PNG', x, y, width, height, undefined, 'FAST', rotation);
  } catch {
    doc.setDrawColor('#111827');
    doc.setFillColor('#ffffff');
    doc.circle(x + width / 2, y + height / 2, Math.min(width, height) / 2, 'S');
  }
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
      context.drawImage(image, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error(`Asset PDF introuvable: ${url}`));
    image.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

function worldToPdf(point: Point, transform: PdfFitTransform): Point {
  return {
    x: transform.x + point.x * transform.scale,
    y: transform.y + point.y * transform.scale,
  };
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
