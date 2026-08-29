import type { jsPDF } from 'jspdf';
import { getApparatusCatalogItem } from '../../catalog/apparatus';
import { buildPdfDocumentModel } from './PdfDocumentModel';
import { formatPdfDate, formatPdfLength, getPdfCoverRows } from './PdfLayout';
import { renderPdfPlanPage } from './PdfDrawingRenderer';
import type { ApparatusCatalogId, CpreyDrawProject } from '../../types/project';
import type { PdfDocumentModel, PdfExportOptions, PdfPageModel } from './PdfTypes';

export async function exportProjectPdf(project: CpreyDrawProject, options: PdfExportOptions): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const model = buildPdfDocumentModel(project, options);
  const doc = new jsPDF({
    unit: 'mm',
    format: options.paperFormat,
    orientation: options.orientation,
  });

  for (const [index, page] of model.pages.entries()) {
    if (index > 0) {
      doc.addPage();
    }

    await renderPage(doc, model, page, index + 1, model.pages.length);
  }

  doc.save(model.filename);
}

async function renderPage(
  doc: jsPDF,
  model: PdfDocumentModel,
  page: PdfPageModel,
  pageNumber: number,
  totalPages: number,
) {
  switch (page.type) {
    case 'cover':
      renderCoverPage(doc, model);
      break;
    case 'general-plan':
    case 'octopus-plan':
      await renderPdfPlanPage(doc, model, page, pageNumber, totalPages);
      break;
    case 'nomenclature':
      renderNomenclaturePage(doc, model);
      break;
    case 'validation':
      renderValidationPage(doc, model);
      break;
  }
}

function renderCoverPage(doc: jsPDF, model: PdfDocumentModel) {
  const pageSize = doc.internal.pageSize;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor('#111827');
  doc.text('CPREY DRAW', 20, 34);

  doc.setFontSize(18);
  doc.text('DOSSIER CHANTIER', 20, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const coverRows = getPdfCoverRows(model.project);
  renderKeyValueRows(doc, 20, 66, [
    ...coverRows,
    ['Date', formatPdfDate(model.generatedAt)],
    ['Version CPREY DRAW', 'V1.8'],
  ]);

  const warningText = model.validation.errorCount > 0
    ? 'Projet comportant des erreurs'
    : model.validation.warningCount > 0
      ? 'Projet cohérent avec avertissements'
      : 'Projet cohérent';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(model.validation.errorCount > 0 ? '#b91c1c' : '#166534');
  doc.text(warningText, 20, 122);

  doc.setTextColor('#111827');
  doc.setFontSize(12);
  doc.text('Résumé', 20, 140);
  renderKeyValueRows(doc, 20, 150, [
    ['Pieuvres', String(model.nomenclature.summary.octopusCount)],
    ['Appareillages', String(model.nomenclature.summary.apparatusCount)],
    ['Gaines', String(model.nomenclature.summary.ductCount)],
    ['Erreurs', String(model.validation.errorCount)],
    ['Avertissements', String(model.validation.warningCount)],
  ]);

  doc.setFontSize(8);
  doc.setTextColor('#6b7280');
  doc.text('Document généré automatiquement depuis les données du projet.', 20, pageSize.getHeight() - 20);
}

function renderNomenclaturePage(doc: jsPDF, model: PdfDocumentModel) {
  let y = renderPageHeader(doc, 'NOMENCLATURE');
  const nomenclature = model.nomenclature;

  y = renderSection(doc, 'Pieuvres', y);
  y = renderSimpleTable(doc, y, ['Modèle', 'Quantité'], nomenclature.octopuses.byModel.map((item) => [item.label, String(item.count)]));

  y = renderSection(doc, 'Appareillages', y + 4);
  y = renderSimpleTable(
    doc,
    y,
    ['Référence', 'Type', 'Quantité'],
    nomenclature.apparatus.byCatalog.map((item) => {
      const catalogItem = getApparatusCatalogItem(item.key as ApparatusCatalogId);
      return [item.label, catalogItem.type, String(item.count)];
    }),
  );

  y = renderSection(doc, 'Gaines par diamètre', y + 4);
  y = renderSimpleTable(
    doc,
    y,
    ['Diamètre', 'Utilisée', 'Disponible', 'Restante'],
    nomenclature.ducts.byDiameter.map((item) => [
      `Ø${item.diameterMm}`,
      formatPdfLength(item.usedLengthMeters),
      formatPdfLength(item.availableLengthMeters),
      formatPdfLength(item.remainingLengthMeters),
    ]),
  );

  y = renderSection(doc, 'Conducteurs', y + 4);
  y = renderSimpleTable(
    doc,
    y,
    ['Couleur', 'Section', 'Longueur'],
    nomenclature.conductors.map((item) => [item.color, `${item.sectionMm2} mm²`, formatPdfLength(item.lengthMeters)]),
  );

  y = renderSection(doc, 'Adaptateurs / bouchons', y + 4);
  y = renderSimpleTable(
    doc,
    y,
    ['Élément', 'Quantité'],
    [
      ...nomenclature.adapters.map((item) => [`${item.adapterColor} Ø${item.diameterMm}`, String(item.count)]),
      ...nomenclature.caps.map((item) => [`Bouchon ${item.capColor}`, String(item.count)]),
    ],
  );

  y = renderSection(doc, 'Réserves disponibles', y + 4);
  y = renderSimpleTable(
    doc,
    y,
    ['Pieuvre', 'Sorties libres'],
    nomenclature.reserves.map((item) => [item.octopusName, String(item.freeOutputs)]),
  );

  y = renderSection(doc, 'Dépassements', y + 4);
  renderSimpleTable(
    doc,
    y,
    ['Circuit', 'Disponible', 'Utilisée', 'Dépassement'],
    nomenclature.ducts.overruns.length === 0
      ? [['Aucun dépassement', '', '', '']]
      : nomenclature.ducts.overruns.map((item) => [
          item.label,
          formatPdfLength(item.availableLengthMeters),
          formatPdfLength(item.usedLengthMeters),
          formatPdfLength(item.overrunMeters),
        ]),
  );
}

function renderValidationPage(doc: jsPDF, model: PdfDocumentModel) {
  let y = renderPageHeader(doc, 'CONTRÔLES DU PROJET');
  const result = model.validation;
  renderKeyValueRows(doc, 20, y, [
    ['Erreurs', String(result.errorCount)],
    ['Avertissements', String(result.warningCount)],
    ['Informations', String(result.infoCount)],
  ]);
  y += 26;

  if (result.issues.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Projet cohérent.', 20, y);
    return;
  }

  for (const issue of result.issues.slice(0, 45)) {
    const severityLabel = issue.severity === 'error' ? 'Erreur' : issue.severity === 'warning' ? 'Avertissement' : 'Info';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(issue.severity === 'error' ? '#b91c1c' : issue.severity === 'warning' ? '#92400e' : '#1d4ed8');
    doc.text(`${severityLabel} - ${issue.title}`, 20, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#374151');
    const lines = doc.splitTextToSize(issue.message, 255) as string[];
    doc.text(lines, 20, y);
    y += Math.max(lines.length * 4.2, 6) + 2;
    if (y > 185) {
      doc.addPage();
      y = renderPageHeader(doc, 'CONTRÔLES DU PROJET');
    }
  }
}

function renderPageHeader(doc: jsPDF, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor('#111827');
  doc.text(title, 20, 24);
  doc.setDrawColor('#d1d5db');
  doc.line(20, 30, doc.internal.pageSize.getWidth() - 20, 30);
  return 42;
}

function renderSection(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor('#111827');
  doc.text(title, 20, y);
  return y + 6;
}

function renderKeyValueRows(doc: jsPDF, x: number, y: number, rows: Array<[string, string]>) {
  doc.setFontSize(10);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#4b5563');
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#111827');
    doc.text(value, x + 52, y);
    y += 7;
  }
}

function renderSimpleTable(doc: jsPDF, y: number, headers: string[], rows: string[][]): number {
  const x = 20;
  const widths = [85, 45, 45, 45, 45].slice(0, headers.length);
  const rowHeight = 6;

  doc.setFillColor('#f3f4f6');
  doc.rect(x, y - 4.5, widths.reduce((total, width) => total + width, 0), rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor('#111827');
  headers.forEach((header, index) => doc.text(header, x + widths.slice(0, index).reduce((total, width) => total + width, 0) + 2, y));
  y += rowHeight;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor('#374151');
  for (const row of rows.slice(0, 22)) {
    row.forEach((cell, index) => {
      const cellX = x + widths.slice(0, index).reduce((total, width) => total + width, 0) + 2;
      doc.text(String(cell), cellX, y);
    });
    y += rowHeight;
  }

  if (rows.length > 22) {
    doc.setTextColor('#6b7280');
    doc.text(`... ${rows.length - 22} lignes supplémentaires`, x + 2, y);
    y += rowHeight;
  }

  return y + 2;
}
