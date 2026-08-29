import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CommandManager } from '../commands/CommandManager';
import { ProjectSnapshotCommand } from '../commands/ProjectSnapshotCommand';
import { getCompatibleCatalogItems } from '../domain/importedStudy';
import { createEmptyProject, ProjectStorage } from '../storage/ProjectStorage';
import type { CpreyDrawProject } from '../types/project';
import { importCdefProject } from './CdefProjectImporter';
import { CdefImportError } from './CdefImportValidator';

function cdef(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'CDEF',
    schemaVersion: 1,
    header: {
      application: 'smartcprey-configurator',
      variant: 'LM',
      applicationVersion: '1.8.0',
      exportedAt: '2026-08-23T10:00:00.000Z',
    },
    project: {
      projectName: 'Type_T4-AH',
      levels: {
        '0 : RDC': {
          Séjour: {
            prises: 2,
            lampes: 1,
            interrupteurs: 1,
            vr: 1,
            four: 1,
            hotte: 1,
            lave_vaisselle: 1,
            lave_linge: 1,
            seche_linge: 1,
            seche_serviette: 1,
            vmc: 1,
            cumulus: 1,
            pac: 1,
            chaudiere: 1,
            convecteur: 1,
            climatisation: 1,
            contact_sec: 1,
            automatisme_garage: 1,
            __profile: 'SEJOUR',
          },
        },
      },
    },
    calculations: {
      pieuvres: {
        totals: {
          cuisine: 9,
          bain: 0,
          confort: 0,
          autre: 0,
          total: 9,
        },
      },
    },
    scenario: {
      selected: 'MOY',
      result: {
        totals: {
          cuisine: 1,
          bain: 2,
          confort: 1,
          autre: 4,
          total: 8,
        },
      },
    },
    metadata: {
      projectName: 'Type_T4-AH',
    },
    extensions: {},
    ...overrides,
  };
}

function multiLevelCdef() {
  return cdef({
    project: {
      projectName: 'Maison multi-niveaux',
      levels: {
        '0 : RDC': {
          Salon: {
            prises: 1,
            lampes: 1,
            __profile: 'SALON',
          },
          'Salle de bain': {
            lampes: 1,
            __profile: 'SDB',
          },
        },
        '1 : Étage': {
          'Salle de bain': {
            prises: 1,
            __profile: 'SDB',
          },
        },
      },
    },
    scenario: {
      selected: 'MOY',
      result: {
        totals: {
          cuisine: 1,
          bain: 0,
          confort: 0,
          autre: 0,
          total: 1,
        },
      },
    },
    calculations: {
      pieuvres: {
        totals: {
          cuisine: 1,
          bain: 0,
          confort: 0,
          autre: 0,
          total: 1,
        },
      },
    },
  });
}

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

test('imports a minimal valid CDEF project', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.schemaVersion, 1);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.project.octopuses.length, 8);
  assert.equal(result.project.apparatus.length, 19);
});

test('rejects incorrect schema', () => {
  assert.throws(
    () => importCdefProject(cdef({ schema: 'OTHER' })),
    (error) => error instanceof CdefImportError && error.message === 'Ce fichier n’est pas un export CPREY compatible.',
  );
});

test('rejects unsupported schemaVersion', () => {
  assert.throws(
    () => importCdefProject(cdef({ schemaVersion: 2 })),
    /Version CDEF non supportée : 2\./,
  );
});

test('imports projectName', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.project.name, 'Type_T4-AH');
  assert.equal(result.project.site.name, 'Type_T4-AH');
});

test('imports levels and rooms into CDEF metadata', () => {
  const result = importCdefProject(cdef());

  assert.deepEqual(result.project.origin.cdef?.levels, ['0 : RDC']);
  assert.equal(result.project.origin.cdef?.rooms[0].roomName, 'Séjour');
});

test('creates imported study and active level from one-level CDEF', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.study?.levels.length, 1);
  assert.equal(result.project.study?.levels[0].id, 'level_001');
  assert.equal(result.project.study?.levels[0].name, 'RDC');
  assert.equal(result.project.study?.levels[0].rooms[0].name, 'Séjour');
  assert.equal(result.project.activeLevelId, 'level_001');
  assert.equal(result.project.study?.devices.length, 27);
  assert.equal(result.project.study?.devices.filter((device) => device.type === 'apparatus').length, 19);
  assert.equal(result.project.study?.devices.filter((device) => device.type === 'octopus').length, 8);
});

test('creates imported study across multiple CDEF levels', () => {
  const result = importCdefProject(multiLevelCdef());
  const study = result.project.study;

  assert.equal(study?.levels.length, 2);
  assert.deepEqual(study?.levels.map((level) => level.id), ['level_001', 'level_002']);
  assert.deepEqual(study?.levels.map((level) => level.name), ['RDC', 'Étage']);
  assert.equal(study?.levels[0].rooms.length, 2);
  assert.equal(study?.levels[1].rooms.length, 1);
  assert.notEqual(study?.levels[0].rooms[1].id, study?.levels[1].rooms[0].id);
  assert.equal(study?.devices.find((device) => device.identifier === 'PR1')?.levelId, 'level_001');
  assert.equal(study?.devices.find((device) => device.identifier === 'PR1')?.roomId, 'room_001');
});

test('imports room profile on apparatus metadata', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.apparatus[0].importContext?.roomProfile, 'SEJOUR');
});

test('imports prises', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.apparatus.filter((item) => item.catalogId === 'prise-16a').length, 2);
});

test('imports lampes', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.apparatus.filter((item) => item.catalogId === 'lampe').length, 1);
});

test('imports interrupteurs', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.apparatus.filter((item) => item.catalogId === 'interrupteur-simple').length, 1);
});

test('imported IN study devices can be specialized with all v2 switch catalog items', () => {
  const result = importCdefProject(cdef());
  const device = result.project.study?.devices.find((candidate) => candidate.identifier === 'IN1');
  if (!result.project.study || !device) {
    assert.fail('Imported IN study device should exist');
  }

  assert.deepEqual(
    getCompatibleCatalogItems(result.project.study, device).map((item) => item.id),
    [
      'interrupteur-poussoir',
      'interrupteur-simple',
      'interrupteur-v&v',
      'interrupteur-double',
      'Interrupteur-double-v',
      'Interrupteur-double-vV',
    ],
  );
});

test('imports VR', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.apparatus.filter((item) => item.catalogId === 'volet-roulant').length, 1);
});

test('imports technical equipment', () => {
  const result = importCdefProject(cdef());
  const catalogIds = new Set(result.project.apparatus.map((item) => item.catalogId));

  assert.equal(catalogIds.has('four'), true);
  assert.equal(catalogIds.has('hotte'), true);
  assert.equal(catalogIds.has('lave-vaisselle'), true);
  assert.equal(catalogIds.has('chauffe-eau'), true);
  assert.equal(catalogIds.has('pompe-a-chaleur'), true);
  assert.equal(catalogIds.has('radiateur'), true);
});

test('warns on unknown apparatus metric without failing', () => {
  const data = cdef({
    project: {
      projectName: 'Unknown metric',
      levels: {
        '0 : RDC': {
          Bureau: {
            prises: 1,
            alarme: 2,
            __profile: 'BUREAU',
          },
        },
      },
    },
  });

  const result = importCdefProject(data);

  assert.equal(result.project.apparatus.length, 1);
  assert.equal(result.warnings.some((warning) => warning.code === 'unknown-apparatus-metric'), true);
  assert.deepEqual(result.summary.unknownMetrics, [{
    levelName: '0 : RDC',
    roomName: 'Bureau',
    metricKey: 'alarme',
    quantity: 2,
  }]);
});

test('prioritizes scenario.result.totals over calculations pieuvres totals', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.summary.pieuvres.total, 8);
  assert.equal(result.project.octopuses.length, 8);
});

test('falls back to calculations.pieuvres.totals', () => {
  const data = cdef({
    scenario: {
      selected: 'MIN',
      result: {},
    },
  });

  const result = importCdefProject(data);

  assert.equal(result.summary.pieuvres.kitchen, 9);
  assert.equal(result.project.octopuses.length, 9);
});

test('creates kitchen bath comfort and other octopuses', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.octopuses.filter((item) => item.modelId === 'kitchen').length, 1);
  assert.equal(result.project.octopuses.filter((item) => item.modelId === 'bath').length, 2);
  assert.equal(result.project.octopuses.filter((item) => item.modelId === 'comfort').length, 1);
  assert.equal(result.project.octopuses.filter((item) => item.modelId === 'other').length, 4);
});

test('does not invent octopus port assignments from current CDEF data', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.study?.octopuses?.length, result.project.octopuses.length);
  assert.equal(result.project.study?.portAssignments, undefined);
});

test('uses sequential octopus naming', () => {
  const result = importCdefProject(cdef());

  assert.deepEqual(
    result.project.octopuses.map((item) => item.name),
    ['Cuisine 01', 'Bain 01', 'Bain 02', 'Confort 01', 'Autre Zone 01', 'Autre Zone 02', 'Autre Zone 03', 'Autre Zone 04'],
  );
});

test('imports LM origin metadata', () => {
  const result = importCdefProject(cdef());

  assert.equal(result.project.origin.type, 'configurator');
  assert.equal(result.project.origin.sourceApplication, 'smartcprey-configurator');
  assert.equal(result.project.origin.sourceVariant, 'LM');
  assert.equal(result.project.origin.sourceVersion, '1.8.0');
});

test('imports MAX MOY and MIN scenarios', () => {
  assert.equal(importCdefProject(cdef({ scenario: { selected: 'MAX', result: { totals: { total: 0 } } } })).summary.selectedScenario, 'MAX');
  assert.equal(importCdefProject(cdef()).summary.selectedScenario, 'MOY');
  assert.equal(importCdefProject(cdef({ scenario: { selected: 'MIN', result: { totals: { total: 0 } } } })).summary.selectedScenario, 'MIN');
});

test('persists after ProjectStorage save and reload', () => {
  installMemoryStorage();
  const imported = importCdefProject(cdef()).project;

  ProjectStorage.save(imported);
  const restored = ProjectStorage.load();

  assert.equal(restored.project.name, 'Type_T4-AH');
  assert.equal(restored.origin.selectedScenario, 'MOY');
  assert.equal(restored.octopuses.length, 8);
  assert.equal(restored.apparatus.length, 19);
  assert.equal(restored.apparatus[0].importContext?.levelName, '0 : RDC');
});

test('imports CDEF after creating and persisting a new empty project', () => {
  installMemoryStorage();
  const newProject = ProjectStorage.createNew();
  const imported = importCdefProject(cdef(), newProject).project;

  ProjectStorage.save(imported);
  const restored = ProjectStorage.load();

  assert.equal(restored.origin.type, 'configurator');
  assert.equal(restored.project.name, 'Type_T4-AH');
  assert.equal(restored.status, 'design');
  assert.equal(restored.octopuses.length, 8);
  assert.equal(restored.apparatus.length, 19);
  assert.equal(restored.ducts.length, 0);
  assert.equal(restored.origin.cdef?.rooms.some((room) => room.roomName === 'Séjour'), true);
});

test('undo and redo import as a single project snapshot', () => {
  let currentProject: CpreyDrawProject = createEmptyProject();
  const commandManager = new CommandManager((project) => {
    currentProject = project;
  });
  const imported = importCdefProject(cdef(), currentProject).project;

  commandManager.execute(new ProjectSnapshotCommand('Importer CDEF', currentProject, imported, commandManager.setProject.bind(commandManager)));
  assert.equal(currentProject.octopuses.length, 8);

  commandManager.undo();
  assert.equal(currentProject.octopuses.length, 0);

  commandManager.redo();
  assert.equal(currentProject.octopuses.length, 8);
});

test('imports examples/maison-t4.json', () => {
  const data = JSON.parse(readFileSync('examples/maison-t4.json', 'utf8'));
  const result = importCdefProject(data);

  assert.equal(result.summary.projectName, 'Type_T4-AH');
  assert.equal(result.summary.pieuvres.total, 8);
  assert.equal(result.project.apparatus.some((item) => item.importContext?.roomName === 'Cuisine 1'), true);
});
