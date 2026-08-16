import type { CpreyDrawProject, Plan, ScaleReference, Viewport } from '../../types/project';
import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';

function replacePlans(project: CpreyDrawProject, plans: Plan[]): CpreyDrawProject {
  return {
    ...project,
    plans,
  };
}

export function createImportPlanCommand(
  before: CpreyDrawProject,
  plan: Plan,
  viewport: Viewport,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...replacePlans(before, [plan]),
    electricalPanel: undefined,
    octopuses: [],
    drawing: {
      ...before.drawing,
      viewport,
      metersPerPixel: null,
      scaleReference: null,
      scaleMarkerVisible: true,
    },
  };

  return new ProjectSnapshotCommand(before.plans.length > 0 ? 'Remplacer le plan' : 'Importer un plan', before, after, applyProject);
}

export function createDeletePlanCommand(
  before: CpreyDrawProject,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...replacePlans(before, []),
    electricalPanel: undefined,
    octopuses: [],
    drawing: {
      ...before.drawing,
      metersPerPixel: null,
      scaleReference: null,
      scaleMarkerVisible: true,
    },
  };

  return new ProjectSnapshotCommand('Supprimer le plan', before, after, applyProject);
}

export function createUpdatePlanCommand(
  before: CpreyDrawProject,
  planId: string,
  updates: Partial<Pick<Plan, 'visible' | 'locked' | 'opacity' | 'rotation'>>,
  applyProject: ApplyProject,
  label = 'Modifier le plan',
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    plans: before.plans.map((plan) => (plan.id === planId ? { ...plan, ...updates } : plan)),
  };

  return new ProjectSnapshotCommand(label, before, after, applyProject);
}

export function createSetScaleCommand(
  before: CpreyDrawProject,
  metersPerPixel: number,
  scaleReference: ScaleReference,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    drawing: {
      ...before.drawing,
      metersPerPixel,
      scaleReference,
      scaleMarkerVisible: true,
    },
  };

  return new ProjectSnapshotCommand('Définir l’échelle', before, after, applyProject);
}
