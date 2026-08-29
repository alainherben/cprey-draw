import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultProjectAccess,
  createDefaultProjectOrigin,
  createDefaultProjectOwnership,
  createDefaultSiteInformation,
  createProjectAudit,
  getProjectDisplayName,
  getProjectStatusLabel,
  normalizeProjectAudit,
  normalizeProjectOrigin,
  normalizeProjectStatus,
  normalizeSiteInformation,
} from './site';
import { createEmptyProject } from '../storage/ProjectStorage';

test('creates default site and web preparation metadata', () => {
  const audit = createProjectAudit('2026-08-17T10:00:00.000Z');

  assert.deepEqual(createDefaultSiteInformation(), {});
  assert.deepEqual(createDefaultProjectOrigin(), { type: 'manual' });
  assert.equal(normalizeProjectStatus(undefined), 'draft');
  assert.deepEqual(createDefaultProjectOwnership(), {});
  assert.deepEqual(createDefaultProjectAccess(), {});
  assert.deepEqual(audit, {
    createdAt: '2026-08-17T10:00:00.000Z',
    updatedAt: '2026-08-17T10:00:00.000Z',
  });
});

test('normalizes chantier information without keeping empty strings', () => {
  const site = normalizeSiteInformation({
    name: ' Maison Dupont ',
    reference: '',
    clientName: 'M. Dupont',
  });

  assert.equal(site.name, ' Maison Dupont ');
  assert.equal(site.reference, undefined);
  assert.equal(site.clientName, 'M. Dupont');
});

test('normalizes manual and configurator origins', () => {
  assert.deepEqual(normalizeProjectOrigin(undefined), { type: 'manual' });
  assert.deepEqual(normalizeProjectOrigin({ type: 'manual', quoteId: 'DEV-1' }), { type: 'manual' });
  assert.deepEqual(normalizeProjectOrigin({
    type: 'configurator',
    quoteId: 'DEV-2026-00125',
    configuratorSummary: {
      level: 'MOY',
      requestedOctopuses: [{ modelId: 'kitchen', quantity: 1 }],
      requestedApparatus: [{ catalogId: 'spot', type: 'LA', quantity: 8 }],
    },
  }), {
    type: 'configurator',
    quoteId: 'DEV-2026-00125',
    configuratorVersion: undefined,
    importedAt: undefined,
    sourceFile: undefined,
    sourceHash: undefined,
    configuratorSummary: {
      level: 'MOY',
      requestedOctopuses: [{ modelId: 'kitchen', quantity: 1 }],
      requestedApparatus: [{ catalogId: 'spot', type: 'LA', quantity: 8 }],
    },
  });
});

test('normalizes audit dates with migration fallback', () => {
  assert.deepEqual(normalizeProjectAudit(undefined, '2026-08-17T10:00:00.000Z'), {
    createdAt: '2026-08-17T10:00:00.000Z',
    updatedAt: '2026-08-17T10:00:00.000Z',
    createdBy: undefined,
    updatedBy: undefined,
  });
});

test('formats project display metadata', () => {
  const project = {
    ...createEmptyProject(),
    site: { name: 'Maison Dupont' },
    status: 'validated' as const,
  };

  assert.equal(getProjectDisplayName(project), 'Maison Dupont');
  assert.equal(getProjectStatusLabel(project.status), 'Validé');
});
