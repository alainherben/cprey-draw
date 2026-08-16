import type { CpreyDrawProject, Duct, DuctControlPoint, DuctWaypoint, Point } from '../../types/project';
import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';
import { getSynchronizableApparatusIdentifierFromDuct } from '../../domain/ducts';

export function createAddConnectionCommand(
  before: CpreyDrawProject,
  duct: Duct,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const synchronizedIdentifier = getSynchronizableApparatusIdentifierFromDuct(duct);
  const after: CpreyDrawProject = {
    ...before,
    ducts: [...before.ducts, duct],
    apparatus: synchronizedIdentifier
      ? before.apparatus.map((apparatus) =>
          duct.target.type === 'apparatus' && apparatus.id === duct.target.id
            ? { ...apparatus, identifier: synchronizedIdentifier }
            : apparatus,
        )
      : before.apparatus,
  };

  return new ProjectSnapshotCommand(
    'Créer gaine',
    before,
    after,
    applyProject,
  );
}

export function createDeleteConnectionCommand(
  before: CpreyDrawProject,
  ductId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.filter((duct) => duct.id !== ductId),
  };

  return new ProjectSnapshotCommand('Supprimer gaine', before, after, applyProject);
}

export const createAddDuctCommand = createAddConnectionCommand;
export const createDeleteDuctCommand = createDeleteConnectionCommand;

export function createAddDuctWaypointCommand(
  before: CpreyDrawProject,
  ductId: string,
  waypoint: DuctWaypoint,
  insertionIndex: number,
  controls: [DuctControlPoint, DuctControlPoint],
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId
        ? {
            ...duct,
            waypoints: [
              ...duct.waypoints.slice(0, insertionIndex),
              waypoint,
              ...duct.waypoints.slice(insertionIndex),
            ],
            controls: [
              ...duct.controls.slice(0, insertionIndex),
              ...controls,
              ...duct.controls.slice(insertionIndex + 1),
            ],
          }
        : duct,
    ),
  };

  return new ProjectSnapshotCommand('Ajouter un point de gaine', before, after, applyProject);
}

export function createMoveDuctWaypointCommand(
  before: CpreyDrawProject,
  ductId: string,
  waypointId: string,
  from: Point,
  to: Point,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const normalizedBefore: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId
        ? {
            ...duct,
            waypoints: duct.waypoints.map((waypoint) =>
              waypoint.id === waypointId ? { ...waypoint, x: from.x, y: from.y } : waypoint,
            ),
          }
        : duct,
    ),
  };
  const after: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId
        ? {
            ...duct,
            waypoints: duct.waypoints.map((waypoint) =>
              waypoint.id === waypointId ? { ...waypoint, x: to.x, y: to.y } : waypoint,
            ),
          }
        : duct,
    ),
  };

  return new ProjectSnapshotCommand('Déplacer un point de gaine', normalizedBefore, after, applyProject);
}

export function createDeleteDuctWaypointCommand(
  before: CpreyDrawProject,
  ductId: string,
  waypointId: string,
  mergedControl: DuctControlPoint,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId ? deleteDuctWaypoint(duct, waypointId, mergedControl) : duct,
    ),
  };

  return new ProjectSnapshotCommand('Supprimer un point de gaine', before, after, applyProject);
}

export function createMoveDuctControlCommand(
  before: CpreyDrawProject,
  ductId: string,
  controlId: string,
  from: Point,
  to: Point,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const normalizedBefore: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId
        ? {
            ...duct,
            controls: duct.controls.map((control) =>
              control.id === controlId ? { ...control, x: from.x, y: from.y } : control,
            ),
          }
        : duct,
    ),
  };
  const after: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId
        ? {
            ...duct,
            controls: duct.controls.map((control) =>
              control.id === controlId ? { ...control, x: to.x, y: to.y } : control,
            ),
          }
        : duct,
    ),
  };

  return new ProjectSnapshotCommand('Déplacer un contrôle de gaine', normalizedBefore, after, applyProject);
}

export function createResetDuctControlCommand(
  before: CpreyDrawProject,
  ductId: string,
  controlId: string,
  nextControl: DuctControlPoint,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    ducts: before.ducts.map((duct) =>
      duct.id === ductId
        ? {
            ...duct,
            controls: duct.controls.map((control) => (control.id === controlId ? nextControl : control)),
          }
        : duct,
    ),
  };

  return new ProjectSnapshotCommand('Réinitialiser une courbe de gaine', before, after, applyProject);
}

function deleteDuctWaypoint(duct: Duct, waypointId: string, mergedControl: DuctControlPoint): Duct {
  const waypointIndex = duct.waypoints.findIndex((waypoint) => waypoint.id === waypointId);
  if (waypointIndex < 0) {
    return duct;
  }

  return {
    ...duct,
    waypoints: duct.waypoints.filter((waypoint) => waypoint.id !== waypointId),
    controls: [
      ...duct.controls.slice(0, waypointIndex),
      mergedControl,
      ...duct.controls.slice(waypointIndex + 2),
    ],
  };
}
