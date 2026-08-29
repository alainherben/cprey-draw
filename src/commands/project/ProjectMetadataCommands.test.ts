import assert from 'node:assert/strict';
import test from 'node:test';
import { CommandManager } from '../CommandManager';
import { createEmptyProject } from '../../storage/ProjectStorage';
import { createUpdateProjectMetadataCommand } from './ProjectMetadataCommands';
import type { CpreyDrawProject } from '../../types/project';

test('updates site and status as one undoable command', () => {
  let project = createEmptyProject();
  const commandManager = new CommandManager((nextProject) => {
    project = nextProject;
  });

  commandManager.execute(
    createUpdateProjectMetadataCommand(
      project,
      {
        site: {
          name: 'Maison Dupont',
          reference: 'CP-2026-0012',
          quoteReference: 'DEV-4582',
          address: '12 rue des Pins',
        },
        status: 'design',
      },
      commandManager.setProject.bind(commandManager),
      '2026-08-17T12:00:00.000Z',
    ),
  );

  assert.equal(project.site.name, 'Maison Dupont');
  assert.equal(project.site.reference, 'CP-2026-0012');
  assert.equal(project.site.quoteReference, 'DEV-4582');
  assert.equal(project.site.address, '12 rue des Pins');
  assert.equal(project.status, 'design');
  assert.equal(project.audit.updatedAt, '2026-08-17T12:00:00.000Z');

  commandManager.undo();
  assert.equal(project.site.name, undefined);
  assert.equal(project.status, 'draft');

  commandManager.redo();
  assert.equal(project.site.name, 'Maison Dupont');
  assert.equal(project.status, 'design');
});

test('updates chantier name when current site is empty', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    site: {},
  };
  const commandManager = new CommandManager((nextProject) => {
    project = nextProject;
  });

  commandManager.execute(
    createUpdateProjectMetadataCommand(
      project,
      { site: { name: 'Test chantier' } },
      commandManager.setProject.bind(commandManager),
      '2026-08-17T12:30:00.000Z',
    ),
  );

  assert.equal(project.site.name, 'Test chantier');
  assert.equal(project.audit.updatedAt, '2026-08-17T12:30:00.000Z');
});

test('restores all chantier fields after close and reopen from current project', () => {
  let project = createEmptyProject();
  const commandManager = new CommandManager((nextProject) => {
    project = nextProject;
  });

  commandManager.execute(
    createUpdateProjectMetadataCommand(
      project,
      {
        site: {
          name: 'Test chantier',
          clientName: 'Dupont',
          city: 'Lyon',
        },
      },
      commandManager.setProject.bind(commandManager),
      '2026-08-17T12:45:00.000Z',
    ),
  );

  const reopenedPanelSource = project.site;

  assert.equal(reopenedPanelSource.name, 'Test chantier');
  assert.equal(reopenedPanelSource.clientName, 'Dupont');
  assert.equal(reopenedPanelSource.city, 'Lyon');
});

test('undo and redo restore chantier metadata snapshots', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    site: {
      name: 'Ancien chantier',
      clientName: 'Martin',
      city: 'Paris',
    },
    status: 'draft',
  };
  const commandManager = new CommandManager((nextProject) => {
    project = nextProject;
  });

  commandManager.execute(
    createUpdateProjectMetadataCommand(
      project,
      {
        site: {
          name: 'Test chantier',
          clientName: 'Dupont',
          city: 'Lyon',
        },
        status: 'review',
      },
      commandManager.setProject.bind(commandManager),
      '2026-08-17T13:15:00.000Z',
    ),
  );

  assert.equal(project.site.name, 'Test chantier');
  assert.equal(project.site.clientName, 'Dupont');
  assert.equal(project.site.city, 'Lyon');
  assert.equal(project.status, 'review');

  commandManager.undo();
  assert.equal(project.site.name, 'Ancien chantier');
  assert.equal(project.site.clientName, 'Martin');
  assert.equal(project.site.city, 'Paris');
  assert.equal(project.status, 'draft');

  commandManager.redo();
  assert.equal(project.site.name, 'Test chantier');
  assert.equal(project.site.clientName, 'Dupont');
  assert.equal(project.site.city, 'Lyon');
  assert.equal(project.status, 'review');
});

test('support update preserves installer ownership', () => {
  let project: CpreyDrawProject = {
    ...createEmptyProject(),
    ownership: {
      ownerUserId: 'installer-1',
    },
    audit: {
      createdAt: '2026-08-17T09:00:00.000Z',
      createdBy: 'installer-1',
      updatedAt: '2026-08-17T09:00:00.000Z',
      updatedBy: 'installer-1',
    },
  };
  const commandManager = new CommandManager((nextProject) => {
    project = nextProject;
  });

  commandManager.execute(
    createUpdateProjectMetadataCommand(
      project,
      { site: { name: 'Maison aidée' }, status: 'review', updatedBy: 'cprey-support-1' },
      commandManager.setProject.bind(commandManager),
      '2026-08-17T13:00:00.000Z',
    ),
  );

  assert.equal(project.ownership.ownerUserId, 'installer-1');
  assert.equal(project.audit.updatedBy, 'cprey-support-1');
  assert.equal(project.status, 'review');
});
