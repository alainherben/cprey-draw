import type { ApparatusCatalogId, CpreyDrawProject } from '../../types/project';
import {
  assignStudyDeviceToOctopusPort,
  configureStudyPhysicalRepresentation,
  dissociateStudyPhysicalGroup,
  moveStudyDeviceOctopusPortAssignment,
  setStudyOctopusInstallation,
  setStudyOctopusServedRooms,
  unassignOctopusPort,
} from '../../domain/importedStudy';
import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';

export function createConfigureStudyRepresentationCommand(
  before: CpreyDrawProject,
  studyDeviceIds: string[],
  drawingCatalogId: ApparatusCatalogId,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Choisir un appareillage',
    before,
    configureStudyPhysicalRepresentation(before, studyDeviceIds, drawingCatalogId),
    applyProject,
  );
}

export function createDissociateStudyGroupCommand(
  before: CpreyDrawProject,
  physicalGroupId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Dissocier un appareillage',
    before,
    dissociateStudyPhysicalGroup(before, physicalGroupId),
    applyProject,
  );
}

export function createSetStudyOctopusInstallationCommand(
  before: CpreyDrawProject,
  octopusId: string,
  installationLevelId: string | undefined,
  installationRoomId: string | undefined,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Définir installation pieuvre',
    before,
    setStudyOctopusInstallation(before, octopusId, installationLevelId, installationRoomId),
    applyProject,
  );
}

export function createSetStudyOctopusServedRoomsCommand(
  before: CpreyDrawProject,
  octopusId: string,
  servedRoomIds: string[],
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Modifier pièces desservies',
    before,
    setStudyOctopusServedRooms(before, octopusId, servedRoomIds),
    applyProject,
  );
}

export function createAssignStudyDeviceToOctopusPortCommand(
  before: CpreyDrawProject,
  octopusId: string,
  portNumber: number,
  studyDeviceId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Affecter sortie pieuvre',
    before,
    assignStudyDeviceToOctopusPort(before, octopusId, portNumber, studyDeviceId, 'manual'),
    applyProject,
  );
}

export function createUnassignOctopusPortCommand(
  before: CpreyDrawProject,
  octopusId: string,
  portNumber: number,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Libérer sortie pieuvre',
    before,
    unassignOctopusPort(before, octopusId, portNumber),
    applyProject,
  );
}

export function createMoveStudyDeviceOctopusPortAssignmentCommand(
  before: CpreyDrawProject,
  studyDeviceId: string,
  toOctopusId: string,
  toPortNumber: number,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Déplacer sortie pieuvre',
    before,
    moveStudyDeviceOctopusPortAssignment(before, studyDeviceId, toOctopusId, toPortNumber),
    applyProject,
  );
}
