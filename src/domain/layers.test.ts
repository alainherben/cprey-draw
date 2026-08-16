import assert from 'node:assert/strict';
import test from 'node:test';
import { createOctopus } from './octopus';
import { getOctopusLayerId, getProjectLayers, setLayerVisible } from './layers';
import { createEmptyProject } from '../storage/ProjectStorage';

test('project layers derive octopus layers dynamically and keep renamed labels current', () => {
  const kitchen = createOctopus('kitchen', { x: 10, y: 20 }, []);
  const bath = createOctopus('bath', { x: 30, y: 40 }, [kitchen]);
  const project = {
    ...createEmptyProject(),
    octopuses: [kitchen, bath],
  };

  assert.deepEqual(
    getProjectLayers(project).map((layer) => layer.name),
    ['Plan', 'Tableau électrique', 'Cuisine 01', 'Bain 01', 'Câbles directs', 'Appareillages non affectés'],
  );

  const hiddenKitchenProject = setLayerVisible(project, getOctopusLayerId(kitchen.id), false);
  assert.equal(
    getProjectLayers(hiddenKitchenProject).find((layer) => layer.id === getOctopusLayerId(kitchen.id))?.visible,
    false,
  );

  const renamedProject = {
    ...hiddenKitchenProject,
    octopuses: [{ ...kitchen, name: 'Cuisine RDC' }, bath],
  };
  const renamedLayer = getProjectLayers(renamedProject).find((layer) => layer.id === getOctopusLayerId(kitchen.id));
  assert.equal(renamedLayer?.name, 'Cuisine RDC');
  assert.equal(renamedLayer?.visible, false);

  const deletedProject = {
    ...renamedProject,
    octopuses: [bath],
  };
  assert.equal(getProjectLayers(deletedProject).some((layer) => layer.id === getOctopusLayerId(kitchen.id)), false);

  const undoDeleteProject = {
    ...deletedProject,
    octopuses: [renamedProject.octopuses[0], bath],
    layers: renamedProject.layers,
  };
  assert.equal(getProjectLayers(undoDeleteProject).some((layer) => layer.id === getOctopusLayerId(kitchen.id)), true);
});
