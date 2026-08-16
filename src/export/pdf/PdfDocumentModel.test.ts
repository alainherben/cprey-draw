import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../../domain/apparatus';
import { createDuct } from '../../domain/ducts';
import { createElectricalPanel } from '../../domain/electricalPanel';
import { createOctopus } from '../../domain/octopus';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { CpreyDrawProject, Duct } from '../../types/project';
import { buildPdfDocumentModel } from './PdfDocumentModel';
import {
  buildPdfFilename,
  createOctopusPlanScope,
  fitDrawingToPdfPage,
  formatPdfLength,
  getPdfPageSize,
} from './PdfLayout';
import { DEFAULT_PDF_EXPORT_OPTIONS } from './PdfTypes';

function mustDuct(result: ReturnType<typeof createDuct>): Duct {
  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error('Création de gaine impossible');
  }
  return result.duct;
}

function createPdfProject(): CpreyDrawProject {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const bath = createOctopus('bath', { x: 400, y: 100 }, [kitchen]);
  const kitchenLamp = createApparatusInstance('lampe', { x: 160, y: 100 }, []);
  const bathLamp = createApparatusInstance('lampe', { x: 460, y: 100 }, [kitchenLamp]);
  const looseOutlet = createApparatusInstance('prise-16a', { x: 600, y: 200 }, [kitchenLamp, bathLamp]);
  const electricalPanel = createElectricalPanel({ x: 80, y: 220 });
  const project: CpreyDrawProject = {
    ...createEmptyProject(),
    project: {
      ...createEmptyProject().project,
      name: 'Maison Test',
    },
    drawing: {
      ...createEmptyProject().drawing,
      metersPerPixel: 0.01,
    },
    electricalPanel,
    plans: [
      {
        id: 'plan-1',
        name: 'plan.png',
        source: 'data:image/png;base64,',
        visible: true,
        locked: false,
        opacity: 1,
        rotation: 0,
        mimeType: 'image/png',
        width: 800,
        height: 500,
      },
    ],
    octopuses: [kitchen, bath],
    apparatus: [kitchenLamp, bathLamp, looseOutlet],
  };

  return {
    ...project,
    ducts: [
      mustDuct(createDuct(project, kitchen.id, 12, { type: 'apparatus', id: kitchenLamp.id })),
      mustDuct(createDuct(project, bath.id, 12, { type: 'apparatus', id: bathLamp.id })),
    ],
  };
}

test('builds the PDF page order for a complete chantier dossier', () => {
  const model = buildPdfDocumentModel(createPdfProject(), DEFAULT_PDF_EXPORT_OPTIONS, new Date('2026-08-16T08:00:00.000Z'));

  assert.deepEqual(
    model.pages.map((page) => page.type),
    ['cover', 'general-plan', 'octopus-plan', 'octopus-plan', 'nomenclature', 'validation'],
  );
  assert.equal(model.pages.find((page) => page.type === 'octopus-plan' && page.octopusId)?.title.startsWith('PIEUVRE'), true);
});

test('filters octopus plan scope to the selected pieuvre circuit', () => {
  const project = createPdfProject();
  const kitchen = project.octopuses[0];
  const scope = createOctopusPlanScope(project, kitchen.id);

  assert.equal(scope.octopuses.length, 1);
  assert.equal(scope.octopuses[0].id, kitchen.id);
  assert.equal(scope.ducts.length, 1);
  assert.equal(scope.ducts[0].circuitOrigin.type, 'octopus-output');
  assert.equal(scope.ducts[0].circuitOrigin.type === 'octopus-output' && scope.ducts[0].circuitOrigin.octopusId, kitchen.id);
  assert.equal(scope.apparatus.length, 1);
});

test('injects nomenclature and validation results into the document model', () => {
  const model = buildPdfDocumentModel(createPdfProject(), DEFAULT_PDF_EXPORT_OPTIONS);

  assert.equal(model.nomenclature.summary.octopusCount, 2);
  assert.equal(model.nomenclature.summary.apparatusCount, 3);
  assert.equal(model.nomenclature.summary.ductCount, 2);
  assert.ok(model.validation.warningCount > 0);
  assert.ok(model.validation.issues.some((issue) => issue.code === 'APPARATUS_UNCONNECTED'));
});

test('generates a safe deterministic PDF filename', () => {
  assert.equal(
    buildPdfFilename('Maison / Rue de l’Église: Lot 2', new Date('2026-08-16T10:15:00.000Z')),
    'CPREY-DRAW_Maison-Rue-de-lEglise-Lot-2_2026-08-16.pdf',
  );
});

test('formats lengths with two decimals for French display', () => {
  assert.equal(formatPdfLength(18.4), '18,40 m');
  assert.equal(formatPdfLength(null), 'Non définie');
});

test('computes page size and fit transform without using the current viewport', () => {
  assert.deepEqual(getPdfPageSize(DEFAULT_PDF_EXPORT_OPTIONS), { width: 420, height: 297 });

  const transform = fitDrawingToPdfPage(
    { x: 100, y: 50, width: 400, height: 200 },
    { x: 10, y: 20, width: 200, height: 100 },
  );
  assert.equal(transform.scale, 0.5);
  assert.equal(transform.x, -40);
  assert.equal(transform.y, -5);
});
