import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from '../../domain/apparatus';
import {
  createConnection,
  getConnectionGeometry,
  getLinkColorCss,
} from '../../domain/connections';
import {
  createApparatusChainDuct,
  createDirectPanelDuct,
  getApparatusCircuitContext,
  createDuctControlPoint,
  createDuctWaypoint,
} from '../../domain/ducts';
import { createElectricalPanel } from '../../domain/electricalPanel';
import { createOctopus } from '../../domain/octopus';
import { createOctopusOutputOverride, upsertOctopusOutputOverride } from '../../domain/octopusOutputs';
import { createEmptyProject } from '../../storage/ProjectStorage';
import type { CpreyDrawProject } from '../../types/project';
import { createDeleteApparatusCommand } from '../apparatus/ApparatusCommands';
import { createDeleteElectricalPanelCommand } from '../electricalPanel/ElectricalPanelCommands';
import { createDeleteOctopusCommand } from '../octopus/OctopusCommands';
import {
  createAddConnectionCommand,
  createAddDuctWaypointCommand,
  createDeleteConnectionCommand,
  createDeleteDuctWaypointCommand,
  createMoveDuctControlCommand,
  createMoveDuctWaypointCommand,
  createResetDuctControlCommand,
} from './ConnectionCommands';

function createConnectionProject(): CpreyDrawProject {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const apparatus = createApparatusInstance('lampe', { x: 240, y: 180 }, []);
  const electricalPanel = createElectricalPanel({ x: 40, y: 50 });

  return {
    ...createEmptyProject(),
    drawing: {
      ...createEmptyProject().drawing,
      metersPerPixel: 0.01,
    },
    electricalPanel,
    octopuses: [octopus],
    apparatus: [apparatus],
  };
}

function apparatusTarget(project: CpreyDrawProject) {
  return { type: 'apparatus' as const, id: project.apparatus[0].id };
}

function electricalPanelTarget(project: CpreyDrawProject) {
  return { type: 'electrical-panel' as const, id: project.electricalPanel?.id ?? '' };
}

test('creates a connection from an octopus output to an apparatus', () => {
  const project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.duct.source, {
    type: 'octopus-output',
    octopusId: project.octopuses[0].id,
    outputNumber: 10,
  });
  assert.deepEqual(result.duct.circuitOrigin, result.duct.source);
  assert.deepEqual(result.duct.target, apparatusTarget(project));
  assert.equal(result.duct.specification.outputCode, 'LA2');
  assert.equal(result.duct.specification.destination, 'Lampe');
  assert.equal(result.duct.specification.diameterMm, 16);
  assert.equal(result.duct.specification.adapterColor, 'yellow');
  assert.equal(result.duct.specification.availableLengthMeters, 7.5);
  assert.equal(result.duct.specification.linkColor, 'Cyan');
  assert.equal(result.duct.specification.conductors.length, 3);
  assert.equal(result.duct.catalogVersion, '2026.08');
  assert.equal(result.duct.catalogRevision, 1);
  assert.equal(getLinkColorCss(result.duct.specification.linkColor), '#06b6d4');
});

test('chains apparatus on the same circuit origin', () => {
  const firstSpot = createApparatusInstance('spot', { x: 240, y: 180 }, []);
  const secondSpot = createApparatusInstance('spot', { x: 280, y: 180 }, [firstSpot]);
  const thirdSpot = createApparatusInstance('spot', { x: 320, y: 180 }, [firstSpot, secondSpot]);
  const project = {
    ...createConnectionProject(),
    apparatus: [firstSpot, secondSpot, thirdSpot],
  };
  const firstResult = createConnection(project, project.octopuses[0].id, 10, { type: 'apparatus', id: firstSpot.id });
  assert.equal(firstResult.ok, true);
  if (!firstResult.ok) {
    return;
  }

  const withFirstDuct = { ...project, ducts: [firstResult.duct] };
  const secondResult = createApparatusChainDuct(withFirstDuct, firstSpot.id, secondSpot.id);
  assert.equal(secondResult.ok, true);
  if (!secondResult.ok) {
    return;
  }

  const withSecondDuct = { ...withFirstDuct, ducts: [...withFirstDuct.ducts, secondResult.duct] };
  const thirdResult = createApparatusChainDuct(withSecondDuct, secondSpot.id, thirdSpot.id);
  assert.equal(thirdResult.ok, true);
  if (!thirdResult.ok) {
    return;
  }

  assert.deepEqual(secondResult.duct.source, { type: 'apparatus', id: firstSpot.id });
  assert.deepEqual(secondResult.duct.target, { type: 'apparatus', id: secondSpot.id });
  assert.deepEqual(secondResult.duct.circuitOrigin, firstResult.duct.circuitOrigin);
  assert.deepEqual(thirdResult.duct.circuitOrigin, firstResult.duct.circuitOrigin);
});

test('refuses incompatible apparatus when extending a circuit', () => {
  const spot = createApparatusInstance('spot', { x: 240, y: 180 }, []);
  const outlet = createApparatusInstance('prise-16a', { x: 280, y: 180 }, [spot]);
  const project = {
    ...createConnectionProject(),
    apparatus: [spot, outlet],
  };
  const firstResult = createConnection(project, project.octopuses[0].id, 10, { type: 'apparatus', id: spot.id });
  assert.equal(firstResult.ok, true);
  if (!firstResult.ok) {
    return;
  }

  assert.equal(createApparatusChainDuct({ ...project, ducts: [firstResult.duct] }, spot.id, outlet.id).ok, false);
});

test('creates a direct electrical panel duct to cooktop with 25 mm and 6 mm² conductors', () => {
  const cooktop = createApparatusInstance('plaque-cuisson', { x: 240, y: 180 }, []);
  const project = {
    ...createConnectionProject(),
    apparatus: [cooktop],
  };
  const result = createDirectPanelDuct(project, project.electricalPanel?.id ?? '', cooktop.id);

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.deepEqual(result.duct.source, { type: 'electrical-panel', id: project.electricalPanel?.id });
  assert.deepEqual(result.duct.target, { type: 'apparatus', id: cooktop.id });
  assert.equal(result.duct.specification.diameterMm, 25);
  assert.deepEqual(
    result.duct.specification.conductors.map(({ color, sectionMm2 }) => ({ color, sectionMm2 })),
    [
      { color: 'Rouge', sectionMm2: 6 },
      { color: 'Bleu', sectionMm2: 6 },
      { color: 'Vert/Jaune', sectionMm2: 6 },
    ],
  );
});

test('creates a direct electrical panel duct to RJ45 without invented specification', () => {
  const rj45 = createApparatusInstance('prise-rj45', { x: 240, y: 180 }, []);
  const project = {
    ...createConnectionProject(),
    apparatus: [rj45],
  };
  const result = createDirectPanelDuct(project, project.electricalPanel?.id ?? '', rj45.id);

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.duct.specification.diameterMm, undefined);
  assert.deepEqual(result.duct.specification.conductors, []);
});

test('refuses free outputs, reused outputs and already connected apparatus', () => {
  const project = createConnectionProject();
  const freeResult = createConnection(project, project.octopuses[0].id, 7, apparatusTarget(project));
  assert.equal(freeResult.ok, false);

  const firstResult = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(firstResult.ok, true);
  if (!firstResult.ok) {
    return;
  }

  const secondApparatus = createApparatusInstance('spot', { x: 260, y: 210 }, project.apparatus);
  const projectWithConnection: CpreyDrawProject = {
    ...project,
    apparatus: [...project.apparatus, secondApparatus],
    ducts: [firstResult.duct],
  };

  assert.equal(
    createConnection(projectWithConnection, project.octopuses[0].id, 10, { type: 'apparatus', id: secondApparatus.id }).ok,
    false,
  );
  assert.equal(createConnection(projectWithConnection, project.octopuses[0].id, 12, apparatusTarget(project)).ok, false);
});

test('connects power supply outputs AL1 and AL2 to the electrical panel', () => {
  const project = createConnectionProject();
  const al1 = createConnection(project, project.octopuses[0].id, 2, electricalPanelTarget(project));
  const al2 = createConnection(project, project.octopuses[0].id, 3, electricalPanelTarget(project));

  assert.equal(al1.ok, true);
  assert.equal(al2.ok, true);
  if (!al1.ok || !al2.ok) {
    return;
  }

  assert.deepEqual(al1.duct.target, electricalPanelTarget(project));
  assert.deepEqual(al2.duct.target, electricalPanelTarget(project));
  assert.equal(al1.duct.specification.linkColor, 'Marron');
  assert.equal(al2.duct.specification.linkColor, 'Marron');
});

test('refuses a lamp output to the electrical panel and a power output to an apparatus', () => {
  const project = createConnectionProject();

  assert.equal(createConnection(project, project.octopuses[0].id, 10, electricalPanelTarget(project)).ok, false);
  assert.equal(createConnection(project, project.octopuses[0].id, 2, apparatusTarget(project)).ok, false);
});

test('adds, undoes and redoes a connection', () => {
  let project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const command = createAddConnectionCommand(project, result.duct, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.ducts.length, 1);
  command.undo();
  assert.equal(project.ducts.length, 0);
  command.redo();
  assert.equal(project.ducts.length, 1);
});

test('syncs directly connected apparatus identifier with simple octopus output code and undo restores it', () => {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const outlet = {
    ...createApparatusInstance('prise-16a', { x: 240, y: 180 }, []),
    identifier: 'PR5',
  };
  let project: CpreyDrawProject = {
    ...createConnectionProject(),
    octopuses: [octopus],
    apparatus: [outlet],
  };
  const result = createConnection(project, octopus.id, 5, { type: 'apparatus', id: outlet.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const command = createAddConnectionCommand(project, result.duct, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.apparatus[0]?.identifier, 'PR3');
  assert.equal(getApparatusCircuitContext(project, outlet.id)?.label, 'Cuisine 01 / PR3');
  command.undo();
  assert.equal(project.apparatus[0]?.identifier, 'PR5');
  assert.equal(project.ducts.length, 0);
  command.redo();
  assert.equal(project.apparatus[0]?.identifier, 'PR3');
});

test('keeps existing apparatus identifier for composite octopus output codes', () => {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const outlet = {
    ...createApparatusInstance('prise-16a', { x: 240, y: 180 }, []),
    identifier: 'PR9',
  };
  let project: CpreyDrawProject = {
    ...createConnectionProject(),
    octopuses: [octopus],
    apparatus: [outlet],
  };
  const result = createConnection(project, octopus.id, 1, { type: 'apparatus', id: outlet.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  createAddConnectionCommand(project, result.duct, (nextProject) => {
    project = nextProject;
  }).execute();

  assert.equal(result.duct.specification.outputCode, 'PR5/PR6');
  assert.equal(project.apparatus[0]?.identifier, 'PR9');
});

test('allows same identifier in different octopus contexts', () => {
  const kitchen = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const bath = createOctopus('bath', { x: 300, y: 100 }, [kitchen]);
  const kitchenLamp = {
    ...createApparatusInstance('lampe', { x: 180, y: 180 }, []),
    identifier: 'LA9',
  };
  const bathLamp = {
    ...createApparatusInstance('lampe', { x: 380, y: 180 }, [kitchenLamp]),
    identifier: 'LA10',
  };
  let project: CpreyDrawProject = {
    ...createConnectionProject(),
    octopuses: [kitchen, bath],
    apparatus: [kitchenLamp, bathLamp],
  };
  const kitchenResult = createConnection(project, kitchen.id, 12, { type: 'apparatus', id: kitchenLamp.id });
  assert.equal(kitchenResult.ok, true);
  if (!kitchenResult.ok) {
    return;
  }
  createAddConnectionCommand(project, kitchenResult.duct, (nextProject) => {
    project = nextProject;
  }).execute();

  const bathResult = createConnection(project, bath.id, 12, { type: 'apparatus', id: bathLamp.id });
  assert.equal(bathResult.ok, true);
  if (!bathResult.ok) {
    return;
  }
  createAddConnectionCommand(project, bathResult.duct, (nextProject) => {
    project = nextProject;
  }).execute();

  assert.deepEqual(project.apparatus.map((apparatus) => apparatus.identifier), ['LA1', 'LA1']);
  assert.equal(getApparatusCircuitContext(project, kitchenLamp.id)?.label, 'Cuisine 01 / LA1');
  assert.equal(getApparatusCircuitContext(project, bathLamp.id)?.label, 'Bain 01 / LA1');
});

test('syncs apparatus identifier from a customized free output code', () => {
  const baseOctopus = createOctopus('other', { x: 100, y: 100 }, []);
  const octopus = upsertOctopusOutputOverride(baseOctopus, {
    ...createOctopusOutputOverride(baseOctopus, 7, 'LA'),
    code: 'LA4',
  });
  const spot = {
    ...createApparatusInstance('spot', { x: 240, y: 180 }, []),
    identifier: 'LA9',
  };
  let project: CpreyDrawProject = {
    ...createConnectionProject(),
    octopuses: [octopus],
    apparatus: [spot],
  };
  const result = createConnection(project, octopus.id, 7, { type: 'apparatus', id: spot.id });
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  createAddConnectionCommand(project, result.duct, (nextProject) => {
    project = nextProject;
  }).execute();

  assert.equal(project.apparatus[0]?.identifier, 'LA4');
  assert.equal(getApparatusCircuitContext(project, spot.id)?.label, 'Autre Zone 01 / LA4');
});

test('deletes a connection and undo restores it', () => {
  let project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  project = { ...project, ducts: [result.duct] };
  const command = createDeleteConnectionCommand(project, result.duct.id, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.ducts.length, 0);
  command.undo();
  assert.equal(project.ducts[0]?.id, result.duct.id);
});

test('connection geometry follows octopus rotation and apparatus anchor', () => {
  const project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const geometry = getConnectionGeometry(
    result.duct,
    project.octopuses,
    project.apparatus,
    project.electricalPanel,
    0.01,
  );
  assert.ok(geometry);
  assert.deepEqual(geometry?.end, { x: project.apparatus[0].x, y: project.apparatus[0].y });

  const rotatedProject = {
    ...project,
    octopuses: [{ ...project.octopuses[0], rotation: 90 }],
  };
  const rotatedGeometry = getConnectionGeometry(
    result.duct,
    rotatedProject.octopuses,
    project.apparatus,
    project.electricalPanel,
    0.01,
  );
  assert.ok(rotatedGeometry);
  assert.notDeepEqual(rotatedGeometry?.start, geometry?.start);
});

test('deleting a connected apparatus removes its connection and undo restores both', () => {
  let project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  project = { ...project, ducts: [result.duct] };
  const command = createDeleteApparatusCommand(project, project.apparatus[0].id, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.apparatus.length, 0);
  assert.equal(project.ducts.length, 0);
  command.undo();
  assert.equal(project.apparatus.length, 1);
  assert.equal(project.ducts.length, 1);
});

test('deleting a connected octopus removes its connection and undo restores both', () => {
  let project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  project = { ...project, ducts: [result.duct] };
  const command = createDeleteOctopusCommand(project, project.octopuses[0].id, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.octopuses.length, 0);
  assert.equal(project.ducts.length, 0);
  command.undo();
  assert.equal(project.octopuses.length, 1);
  assert.equal(project.ducts.length, 1);
});

test('deleting the electrical panel removes panel connections and undo restores both', () => {
  let project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 2, electricalPanelTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  project = { ...project, ducts: [result.duct] };
  const command = createDeleteElectricalPanelCommand(project, (nextProject) => {
    project = nextProject;
  });

  command.execute();
  assert.equal(project.electricalPanel, undefined);
  assert.equal(project.ducts.length, 0);
  command.undo();
  assert.ok(project.electricalPanel);
  assert.equal(project.ducts.length, 1);
});

test('adds, moves and deletes duct waypoints with undo and redo', () => {
  let project = createConnectionProject();
  const result = createConnection(project, project.octopuses[0].id, 10, apparatusTarget(project));
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  project = { ...project, ducts: [result.duct] };
  const waypoint = createDuctWaypoint({ x: 150, y: 160 });
  const firstControl = createDuctControlPoint({ x: 130, y: 120 });
  const secondControl = createDuctControlPoint({ x: 200, y: 170 });
  const addCommand = createAddDuctWaypointCommand(project, result.duct.id, waypoint, 0, [firstControl, secondControl], (nextProject) => {
    project = nextProject;
  });

  addCommand.execute();
  assert.equal(project.ducts[0]?.waypoints.length, 1);
  assert.equal(project.ducts[0]?.controls.length, 2);
  addCommand.undo();
  assert.equal(project.ducts[0]?.waypoints.length, 0);
  assert.equal(project.ducts[0]?.controls.length, 1);
  addCommand.redo();
  assert.equal(project.ducts[0]?.waypoints[0]?.id, waypoint.id);
  assert.deepEqual(project.ducts[0]?.controls.map((control) => control.id), [firstControl.id, secondControl.id]);

  const moveCommand = createMoveDuctWaypointCommand(
    project,
    result.duct.id,
    waypoint.id,
    { x: 150, y: 160 },
    { x: 190, y: 220 },
    (nextProject) => {
      project = nextProject;
    },
  );

  moveCommand.execute();
  assert.deepEqual(project.ducts[0]?.waypoints[0], { ...waypoint, x: 190, y: 220 });
  assert.deepEqual(project.ducts[0]?.controls.map((control) => control.id), [firstControl.id, secondControl.id]);
  moveCommand.undo();
  assert.deepEqual(project.ducts[0]?.waypoints[0], waypoint);

  const moveControlCommand = createMoveDuctControlCommand(
    project,
    result.duct.id,
    firstControl.id,
    { x: 130, y: 120 },
    { x: 140, y: 150 },
    (nextProject) => {
      project = nextProject;
    },
  );
  moveControlCommand.execute();
  assert.deepEqual(project.ducts[0]?.controls[0], { ...firstControl, x: 140, y: 150 });
  assert.deepEqual(project.ducts[0]?.waypoints[0], waypoint);
  moveControlCommand.undo();
  assert.deepEqual(project.ducts[0]?.controls[0], firstControl);

  const resetControl = { ...firstControl, x: 150, y: 190 };
  const resetControlCommand = createResetDuctControlCommand(
    project,
    result.duct.id,
    firstControl.id,
    resetControl,
    (nextProject) => {
      project = nextProject;
    },
  );
  resetControlCommand.execute();
  assert.deepEqual(project.ducts[0]?.controls[0], resetControl);
  resetControlCommand.undo();
  assert.deepEqual(project.ducts[0]?.controls[0], firstControl);

  const mergedControl = createDuctControlPoint({ x: 170, y: 150 });
  const deleteCommand = createDeleteDuctWaypointCommand(project, result.duct.id, waypoint.id, mergedControl, (nextProject) => {
    project = nextProject;
  });
  deleteCommand.execute();
  assert.equal(project.ducts[0]?.waypoints.length, 0);
  assert.deepEqual(project.ducts[0]?.controls, [mergedControl]);
  deleteCommand.undo();
  assert.equal(project.ducts[0]?.waypoints[0]?.id, waypoint.id);
  assert.equal(project.ducts[0]?.controls.length, 2);
});
