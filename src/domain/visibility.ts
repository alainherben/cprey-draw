import {
  DIRECT_DUCTS_LAYER_ID,
  ELECTRICAL_PANEL_LAYER_ID,
  getOctopusLayerId,
  isLayerVisible,
  PLAN_LAYER_ID,
  UNASSIGNED_APPARATUS_LAYER_ID,
} from './layers';
import { getIncomingDuctForApparatus } from './ducts';
import type { ApparatusInstance, CpreyDrawProject, Duct, ElectricalPanel, Octopus, Plan } from '../types/project';

export function isPlanEffectivelyVisible(project: CpreyDrawProject, plan: Plan): boolean {
  return plan.visible && isLayerVisible(project, PLAN_LAYER_ID);
}

export function isElectricalPanelEffectivelyVisible(
  project: CpreyDrawProject,
  electricalPanel: ElectricalPanel,
): boolean {
  return electricalPanel.visible && isLayerVisible(project, ELECTRICAL_PANEL_LAYER_ID);
}

export function isOctopusEffectivelyVisible(project: CpreyDrawProject, octopus: Octopus): boolean {
  return octopus.visible && isLayerVisible(project, getOctopusLayerId(octopus.id));
}

export function isDuctEffectivelyVisible(project: CpreyDrawProject, duct: Duct): boolean {
  if (!duct.visible) {
    return false;
  }

  if (duct.circuitOrigin.type === 'octopus-output') {
    const circuitOrigin = duct.circuitOrigin;
    const sourceOctopus = project.octopuses.find((octopus) => octopus.id === circuitOrigin.octopusId);
    return Boolean(sourceOctopus && isOctopusEffectivelyVisible(project, sourceOctopus));
  }

  return isLayerVisible(project, DIRECT_DUCTS_LAYER_ID);
}

export function isApparatusEffectivelyVisible(
  project: CpreyDrawProject,
  apparatus: ApparatusInstance,
): boolean {
  if (!apparatus.visible) {
    return false;
  }

  const sourceDuct = getIncomingDuctForApparatus(project, apparatus.id);

  if (!sourceDuct) {
    return isLayerVisible(project, UNASSIGNED_APPARATUS_LAYER_ID);
  }

  if (sourceDuct.circuitOrigin.type === 'octopus-output') {
    const circuitOrigin = sourceDuct.circuitOrigin;
    const sourceOctopus = project.octopuses.find((octopus) => octopus.id === circuitOrigin.octopusId);
    return Boolean(sourceOctopus && isOctopusEffectivelyVisible(project, sourceOctopus));
  }

  return isLayerVisible(project, DIRECT_DUCTS_LAYER_ID);
}
