import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandManager } from '../commands/CommandManager';
import { createUpdateProjectMetadataCommand } from '../commands/project/ProjectMetadataCommands';
import { createEmptyProject, ProjectStorage } from '../storage/ProjectStorage';
import type { CpreyDrawProject } from '../types/project';
import { cleanOptionalText, fromSiteDraft, toSiteDraft } from './SiteInformationPanelModel';

function installMemoryStorage(storage = new Map<string, string>()) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });

  return storage;
}

test('builds a fully controlled draft from legacy site information without optional fields', () => {
  const draft = toSiteDraft({});

  for (const [field, value] of Object.entries(draft)) {
    assert.equal(value, '', `${field} should default to an empty string`);
  }
});

test('builds a fully controlled draft when optional fields are explicitly undefined', () => {
  const draft = toSiteDraft({
    name: undefined,
    reference: undefined,
    quoteReference: undefined,
    clientName: undefined,
    address: undefined,
    postalCode: undefined,
    city: undefined,
    phone: undefined,
    email: undefined,
    builder: undefined,
    electrician: undefined,
    distributor: undefined,
    projectVersion: undefined,
    comments: undefined,
  });

  for (const [field, value] of Object.entries(draft)) {
    assert.equal(typeof value, 'string', `${field} should stay controlled`);
    assert.equal(value, '');
  }
});

test('cleans optional text values for chantier save payloads', () => {
  assert.equal(cleanOptionalText(undefined), undefined);
  assert.equal(cleanOptionalText(''), undefined);
  assert.equal(cleanOptionalText('   '), undefined);
  assert.equal(cleanOptionalText(' TEST '), 'TEST');
});

test('converts draft fields to save payload without trimming undefined directly', () => {
  const site = fromSiteDraft({
    name: ' TEST123 ',
    clientName: undefined,
    city: '   ',
  });

  assert.equal(site.name, 'TEST123');
  assert.equal(site.clientName, undefined);
  assert.equal(site.city, undefined);
});

test('saves multiple chantier fields after draft conversion reaches project command', () => {
  installMemoryStorage();
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    site: {},
  };
  const commandManager = new CommandManager((nextProject) => {
    project = nextProject;
    ProjectStorage.save(nextProject);
  });

  commandManager.execute(
    createUpdateProjectMetadataCommand(
      project,
      {
        site: fromSiteDraft({
          name: ' TEST123 ',
          clientName: ' Dupont ',
          city: ' Lyon ',
        }),
        status: 'review',
      },
      commandManager.setProject.bind(commandManager),
      '2026-08-17T14:00:00.000Z',
    ),
  );

  assert.equal(project.site.name, 'TEST123');
  assert.equal(project.site.clientName, 'Dupont');
  assert.equal(project.site.city, 'Lyon');

  const restored = ProjectStorage.load();

  assert.equal(restored.site.name, 'TEST123');
  assert.equal(restored.site.clientName, 'Dupont');
  assert.equal(restored.site.city, 'Lyon');
  assert.equal(restored.status, 'review');
});
