import assert from 'node:assert/strict';
import test from 'node:test';
import { createApparatusInstance } from './apparatus';
import { createApparatusChainDuct, createDirectPanelDuct, createDuct } from './ducts';
import { createElectricalPanel } from './electricalPanel';
import { createOctopus } from './octopus';
import { getOctopusLayerId, setLayerVisible } from './layers';
import {
  isApparatusEffectivelyVisible,
  isDuctEffectivelyVisible,
  isElectricalPanelEffectivelyVisible,
  isOctopusEffectivelyVisible,
  isPlanEffectivelyVisible,
} from './visibility';
import { createEmptyProject } from '../storage/ProjectStorage';
import type { CpreyDrawProject } from '../types/project';

function createVisibilityProject(): CpreyDrawProject {
  const octopus = createOctopus('kitchen', { x: 100, y: 100 }, []);
  const linkedApparatus = createApparatusInstance('lampe', { x: 180, y: 160 }, []);
  const unassignedApparatus = createApparatusInstance('prise-16a', { x: 260, y: 180 }, [linkedApparatus]);
  const electricalPanel = createElectricalPanel({ x: 30, y: 40 });
  const baseProject = {
    ...createEmptyProject(),
    plans: [
      {
        id: 'plan-1',
        name: 'Plan',
        source: 'data:image/png;base64,',
        visible: true,
        locked: false,
        opacity: 1,
        rotation: 0,
        mimeType: 'image/png' as const,
      },
    ],
    electricalPanel,
    octopuses: [octopus],
    apparatus: [linkedApparatus, unassignedApparatus],
  };
  const result = createDuct(baseProject, octopus.id, 10, { type: 'apparatus', id: linkedApparatus.id });
  assert.equal(result.ok, true);

  return result.ok ? { ...baseProject, ducts: [result.duct] } : baseProject;
}

test('hierarchical visibility follows octopus without mutating child object visibility', () => {
  const project = createVisibilityProject();
  const octopus = project.octopuses[0];
  const linkedApparatus = project.apparatus[0];
  const duct = project.ducts[0];

  assert.equal(isOctopusEffectivelyVisible(project, octopus), true);
  assert.equal(isDuctEffectivelyVisible(project, duct), true);
  assert.equal(isApparatusEffectivelyVisible(project, linkedApparatus), true);
  assert.equal(isElectricalPanelEffectivelyVisible(project, project.electricalPanel!), true);

  const hiddenOctopusProject = {
    ...project,
    octopuses: [{ ...octopus, visible: false }],
  };

  assert.equal(isOctopusEffectivelyVisible(hiddenOctopusProject, hiddenOctopusProject.octopuses[0]), false);
  assert.equal(isDuctEffectivelyVisible(hiddenOctopusProject, duct), false);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusProject, linkedApparatus), false);
  assert.equal(isElectricalPanelEffectivelyVisible(hiddenOctopusProject, hiddenOctopusProject.electricalPanel!), true);
  assert.equal(hiddenOctopusProject.apparatus[0].visible, true);

  const shownAgainProject = {
    ...hiddenOctopusProject,
    octopuses: [{ ...hiddenOctopusProject.octopuses[0], visible: true }],
  };

  assert.equal(isDuctEffectivelyVisible(shownAgainProject, duct), true);
  assert.equal(isApparatusEffectivelyVisible(shownAgainProject, linkedApparatus), true);
});

test('hidden apparatus stays hidden when its octopus is hidden and shown again', () => {
  const project = createVisibilityProject();
  const hiddenApparatusProject = {
    ...project,
    apparatus: [{ ...project.apparatus[0], visible: false }, project.apparatus[1]],
  };
  const hiddenOctopusProject = {
    ...hiddenApparatusProject,
    octopuses: [{ ...project.octopuses[0], visible: false }],
  };
  const shownAgainProject = {
    ...hiddenOctopusProject,
    octopuses: [{ ...hiddenOctopusProject.octopuses[0], visible: true }],
  };

  assert.equal(isApparatusEffectivelyVisible(hiddenApparatusProject, hiddenApparatusProject.apparatus[0]), false);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusProject, hiddenOctopusProject.apparatus[0]), false);
  assert.equal(isApparatusEffectivelyVisible(shownAgainProject, shownAgainProject.apparatus[0]), false);
});

test('layer visibility controls plan, panel, octopus group and unassigned apparatus independently', () => {
  const project = createVisibilityProject();
  const octopus = project.octopuses[0];
  const linkedApparatus = project.apparatus[0];
  const unassignedApparatus = project.apparatus[1];
  const duct = project.ducts[0];

  const hiddenOctopusLayerProject = setLayerVisible(project, getOctopusLayerId(octopus.id), false);
  assert.equal(isOctopusEffectivelyVisible(hiddenOctopusLayerProject, octopus), false);
  assert.equal(isDuctEffectivelyVisible(hiddenOctopusLayerProject, duct), false);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusLayerProject, linkedApparatus), false);
  assert.equal(isElectricalPanelEffectivelyVisible(hiddenOctopusLayerProject, hiddenOctopusLayerProject.electricalPanel!), true);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusLayerProject, unassignedApparatus), true);

  const restoredOctopusLayerProject = setLayerVisible(hiddenOctopusLayerProject, getOctopusLayerId(octopus.id), true);
  assert.equal(isOctopusEffectivelyVisible(restoredOctopusLayerProject, octopus), true);
  assert.equal(isApparatusEffectivelyVisible(restoredOctopusLayerProject, linkedApparatus), true);

  const hiddenPanelLayerProject = setLayerVisible(project, 'electrical-panel', false);
  assert.equal(isElectricalPanelEffectivelyVisible(hiddenPanelLayerProject, hiddenPanelLayerProject.electricalPanel!), false);
  assert.equal(isOctopusEffectivelyVisible(hiddenPanelLayerProject, octopus), true);

  const hiddenPlanLayerProject = setLayerVisible(project, 'plan', false);
  assert.equal(isPlanEffectivelyVisible(hiddenPlanLayerProject, hiddenPlanLayerProject.plans[0]), false);
  assert.equal(isOctopusEffectivelyVisible(hiddenPlanLayerProject, octopus), true);

  const hiddenUnassignedProject = setLayerVisible(project, 'unassigned-apparatus', false);
  assert.equal(isApparatusEffectivelyVisible(hiddenUnassignedProject, unassignedApparatus), false);
  assert.equal(isApparatusEffectivelyVisible(hiddenUnassignedProject, linkedApparatus), true);
});

test('octopus visibility controls chained apparatus through circuit origin', () => {
  const project = createVisibilityProject();
  const secondSpot = createApparatusInstance('spot', { x: 220, y: 160 }, project.apparatus);
  const thirdSpot = createApparatusInstance('spot', { x: 260, y: 160 }, [...project.apparatus, secondSpot]);
  const chainProject = {
    ...project,
    apparatus: [project.apparatus[0], secondSpot, thirdSpot, project.apparatus[1]],
  };
  const secondResult = createApparatusChainDuct(chainProject, project.apparatus[0].id, secondSpot.id);
  assert.equal(secondResult.ok, true);
  if (!secondResult.ok) {
    return;
  }
  const withSecond = { ...chainProject, ducts: [...chainProject.ducts, secondResult.duct] };
  const thirdResult = createApparatusChainDuct(withSecond, secondSpot.id, thirdSpot.id);
  assert.equal(thirdResult.ok, true);
  if (!thirdResult.ok) {
    return;
  }
  const withChain = { ...withSecond, ducts: [...withSecond.ducts, thirdResult.duct] };
  const hiddenOctopusProject = {
    ...withChain,
    octopuses: [{ ...withChain.octopuses[0], visible: false }],
  };

  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusProject, hiddenOctopusProject.apparatus[0]), false);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusProject, secondSpot), false);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusProject, thirdSpot), false);
  assert.equal(isDuctEffectivelyVisible(hiddenOctopusProject, secondResult.duct), false);
  assert.equal(isDuctEffectivelyVisible(hiddenOctopusProject, thirdResult.duct), false);
});

test('direct panel ducts stay independent from octopus visibility', () => {
  const project = createVisibilityProject();
  const cooktop = createApparatusInstance('plaque-cuisson', { x: 320, y: 160 }, project.apparatus);
  const directProject = { ...project, apparatus: [...project.apparatus, cooktop] };
  const directResult = createDirectPanelDuct(directProject, project.electricalPanel?.id ?? '', cooktop.id);
  assert.equal(directResult.ok, true);
  if (!directResult.ok) {
    return;
  }
  const withDirect = { ...directProject, ducts: [...directProject.ducts, directResult.duct] };
  const hiddenOctopusProject = {
    ...withDirect,
    octopuses: [{ ...withDirect.octopuses[0], visible: false }],
  };

  assert.equal(isDuctEffectivelyVisible(hiddenOctopusProject, directResult.duct), true);
  assert.equal(isApparatusEffectivelyVisible(hiddenOctopusProject, cooktop), true);
});
