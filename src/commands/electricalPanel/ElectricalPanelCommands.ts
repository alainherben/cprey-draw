import type { CpreyDrawProject, ElectricalPanel, Point } from '../../types/project';
import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';
import { isElectricalPanelEndpoint } from '../../domain/ducts';

export function createAddElectricalPanelCommand(
  before: CpreyDrawProject,
  electricalPanel: ElectricalPanel,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = before.electricalPanel
    ? before
    : {
        ...before,
        electricalPanel,
      };

  return new ProjectSnapshotCommand('Ajouter le tableau électrique', before, after, applyProject);
}

export function createMoveElectricalPanelCommand(
  before: CpreyDrawProject,
  from: Point,
  to: Point,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = before.electricalPanel
    ? {
        ...before,
        electricalPanel: {
          ...before.electricalPanel,
          x: to.x,
          y: to.y,
        },
      }
    : before;

  const normalizedBefore: CpreyDrawProject = before.electricalPanel
    ? {
        ...before,
        electricalPanel: {
          ...before.electricalPanel,
          x: from.x,
          y: from.y,
        },
      }
    : before;

  return new ProjectSnapshotCommand(
    'Déplacer le tableau électrique',
    normalizedBefore,
    after,
    applyProject,
  );
}

export function createUpdateElectricalPanelCommand(
  before: CpreyDrawProject,
  updates: Partial<
    Pick<
      ElectricalPanel,
      'name' | 'x' | 'y' | 'rotation' | 'rows' | 'reserveModules' | 'comments' | 'visible' | 'locked'
    >
  >,
  applyProject: ApplyProject,
  label = 'Modifier le tableau électrique',
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = before.electricalPanel
    ? {
        ...before,
        electricalPanel: {
          ...before.electricalPanel,
          ...updates,
        },
      }
    : before;

  return new ProjectSnapshotCommand(label, before, after, applyProject);
}

export function createDeleteElectricalPanelCommand(
  before: CpreyDrawProject,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const { electricalPanel: _removed, ...projectWithoutPanel } = before;
  const after: CpreyDrawProject = {
    ...projectWithoutPanel,
    ducts: before.ducts.filter(
      (duct) =>
        !isElectricalPanelEndpoint(duct.source, before.electricalPanel?.id ?? '') &&
        !isElectricalPanelEndpoint(duct.target, before.electricalPanel?.id ?? '') &&
        !(duct.circuitOrigin.type === 'electrical-panel' && duct.circuitOrigin.id === before.electricalPanel?.id),
    ),
  };
  return new ProjectSnapshotCommand('Supprimer le tableau électrique', before, after, applyProject);
}
