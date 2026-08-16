import type { ApparatusInstance, CpreyDrawProject, Point } from '../../types/project';
import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';
import { isApparatusEndpoint } from '../../domain/ducts';

export function createAddApparatusCommand(
  before: CpreyDrawProject,
  apparatus: ApparatusInstance,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Ajouter un appareillage',
    before,
    { ...before, apparatus: [...before.apparatus, apparatus] },
    applyProject,
  );
}

export function createMoveApparatusCommand(
  before: CpreyDrawProject,
  apparatusId: string,
  from: Point,
  to: Point,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const normalizedBefore: CpreyDrawProject = {
    ...before,
    apparatus: before.apparatus.map((apparatus) =>
      apparatus.id === apparatusId ? { ...apparatus, x: from.x, y: from.y } : apparatus,
    ),
  };
  const after: CpreyDrawProject = {
    ...before,
    apparatus: before.apparatus.map((apparatus) =>
      apparatus.id === apparatusId ? { ...apparatus, x: to.x, y: to.y } : apparatus,
    ),
  };

  return new ProjectSnapshotCommand('Déplacer un appareillage', normalizedBefore, after, applyProject);
}

export function createUpdateApparatusCommand(
  before: CpreyDrawProject,
  apparatusId: string,
  updates: Partial<
    Pick<
      ApparatusInstance,
      | 'name'
      | 'identifier'
      | 'x'
      | 'y'
      | 'rotation'
      | 'comments'
      | 'visible'
      | 'locked'
      | 'connected'
      | 'displayScale'
      | 'labelPosition'
      | 'labelFontSize'
      | 'labelOffsetX'
      | 'labelOffsetY'
      | 'labelLocked'
    >
  >,
  applyProject: ApplyProject,
  label = 'Modifier un appareillage',
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    apparatus: before.apparatus.map((apparatus) =>
      apparatus.id === apparatusId ? { ...apparatus, ...updates } : apparatus,
    ),
  };

  return new ProjectSnapshotCommand(label, before, after, applyProject);
}

export function createDeleteApparatusCommand(
  before: CpreyDrawProject,
  apparatusId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    apparatus: before.apparatus.filter((apparatus) => apparatus.id !== apparatusId),
    ducts: before.ducts.filter(
      (duct) => !isApparatusEndpoint(duct.source, apparatusId) && !isApparatusEndpoint(duct.target, apparatusId),
    ),
  };

  return new ProjectSnapshotCommand('Supprimer un appareillage', before, after, applyProject);
}
