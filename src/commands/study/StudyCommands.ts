import type { ApparatusCatalogId, CpreyDrawProject, OctopusInstallationMode } from '../../types/project';
import {
  addStudyLevel,
  addStudyRoom,
  assignStudyDeviceToOctopusPort,
  configureStudyPhysicalRepresentation,
  dissociateStudyPhysicalGroup,
  moveStudyDeviceOctopusPortAssignment,
  removeStudyLevel,
  removeStudyRoom,
  renameStudyLevel,
  renameStudyRoom,
  setManualApparatusLocation,
  setStudyOctopusInstallation,
  setStudyOctopusMounting,
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

export function createAddStudyLevelCommand(
  before: CpreyDrawProject,
  name: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Ajouter un niveau',
    before,
    addStudyLevel(before, name),
    applyProject,
  );
}

export function createRenameStudyLevelCommand(
  before: CpreyDrawProject,
  levelId: string,
  name: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Renommer un niveau',
    before,
    renameStudyLevel(before, levelId, name),
    applyProject,
  );
}

export function createRemoveStudyLevelCommand(
  before: CpreyDrawProject,
  levelId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Supprimer un niveau',
    before,
    removeStudyLevel(before, levelId),
    applyProject,
  );
}

export function createAddStudyRoomCommand(
  before: CpreyDrawProject,
  levelId: string,
  name: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Ajouter une pièce',
    before,
    addStudyRoom(before, levelId, name),
    applyProject,
  );
}

export function createRenameStudyRoomCommand(
  before: CpreyDrawProject,
  roomId: string,
  name: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Renommer une pièce',
    before,
    renameStudyRoom(before, roomId, name),
    applyProject,
  );
}

export function createRemoveStudyRoomCommand(
  before: CpreyDrawProject,
  roomId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Supprimer une pièce',
    before,
    removeStudyRoom(before, roomId),
    applyProject,
  );
}

export function createSetManualApparatusLocationCommand(
  before: CpreyDrawProject,
  apparatusId: string,
  levelId: string | undefined,
  roomId: string | undefined,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Localiser un appareillage',
    before,
    setManualApparatusLocation(before, apparatusId, levelId, roomId),
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

export function createSetStudyOctopusMountingCommand(
  before: CpreyDrawProject,
  octopusId: string,
  installationMode: OctopusInstallationMode,
  installationHeightM: number | undefined,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Modifier implantation pieuvre',
    before,
    setStudyOctopusMounting(before, octopusId, installationMode, installationHeightM),
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
