import { APPARATUS_CATALOG, getApparatusCatalogItem, type ApparatusCatalogItem } from '../catalog/apparatus';
import type {
  ApparatusCatalogId,
  ApparatusInstance,
  CdefImportContext,
  CpreyDrawProject,
  Duct,
  DuctEndpoint,
  ImportedStudy,
  Octopus,
  OctopusPortAssignment,
  OctopusPortAssignmentSource,
  StudyDevice,
  StudyDeviceStatus,
  StudyLevel,
  StudyOctopus,
  StudyPhysicalGroup,
  StudyRoom,
} from '../types/project';

export interface ParsedStudyLocation {
  levelCode?: string;
  levelName?: string;
  roomName?: string;
  profile?: string;
}

export interface StudyProgress {
  total: number;
  placed: number;
  unplaced: number;
}

export interface RoomStudyProgress extends StudyProgress {
  roomId: string;
}

export interface StudyPlacementTarget {
  id: string;
  kind: 'device' | 'group';
  studyDeviceIds: string[];
  identifiers: string[];
  drawingCatalogId?: ApparatusCatalogId;
  drawingObjectId?: string;
  status: StudyDeviceStatus;
  levelId?: string;
  roomId?: string;
}

interface LevelDraft {
  id: string;
  code?: string;
  name: string;
  rooms: StudyRoom[];
}

const UNPLACED_STATUS: StudyDeviceStatus = 'unplaced';
const PLACED_STATUS: StudyDeviceStatus = 'placed';

export function parseStudyLocation(text: string): ParsedStudyLocation {
  const result: ParsedStudyLocation = {};
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*(niveau|pi[eè]ce|piece|profil)\s*:\s*(.+?)\s*$/i);
    if (!match) {
      continue;
    }

    const key = removeAccents(match[1]).toLowerCase();
    const value = match[2].trim();
    if (!value) {
      continue;
    }

    if (key === 'niveau') {
      const levelMatch = value.match(/^([^:]+?)\s*:\s*(.+)$/);
      if (levelMatch) {
        result.levelCode = levelMatch[1].trim();
        result.levelName = levelMatch[2].trim();
      } else {
        result.levelName = value;
      }
    } else if (key === 'piece') {
      result.roomName = value;
    } else if (key === 'profil') {
      result.profile = value;
    }
  }

  return result;
}

export function createImportedStudy(
  apparatus: ApparatusInstance[],
  octopuses: Octopus[],
): ImportedStudy | undefined {
  const levels: LevelDraft[] = [];
  const levelKeys = new Map<string, LevelDraft>();
  const roomKeys = new Map<string, StudyRoom>();
  const devices: StudyDevice[] = [];

  for (const apparatusItem of apparatus) {
    const location = locationFromImportContext(apparatusItem.importContext, apparatusItem.comments);
    const sourceType = inferDeviceSourceType(apparatusItem);
    const level = location.levelName ? ensureLevel(levels, levelKeys, location.levelName, location.levelCode) : undefined;
    const room = level && location.roomName
      ? ensureRoom(level, roomKeys, location.roomName, location.profile)
      : undefined;

    devices.push({
      id: nextDeviceId(devices.length),
      type: 'apparatus',
      catalogId: apparatusItem.catalogId,
      identifier: apparatusItem.identifier,
      sourceType,
      drawingCatalogId: getApparatusCatalogItem(apparatusItem.catalogId).type === sourceType
        ? apparatusItem.catalogId
        : undefined,
      levelId: level?.id,
      roomId: room?.id,
      drawingObjectId: apparatusItem.id,
      status: PLACED_STATUS,
      metricKey: apparatusItem.importContext?.metricKey,
    });
  }

  for (const octopus of octopuses) {
    const location = locationFromImportContext(octopus.importContext, octopus.comments);
    const level = location.levelName ? ensureLevel(levels, levelKeys, location.levelName, location.levelCode) : undefined;
    const room = level && location.roomName
      ? ensureRoom(level, roomKeys, location.roomName, location.profile)
      : undefined;

    devices.push({
      id: nextDeviceId(devices.length),
      type: 'octopus',
      modelId: octopus.modelId,
      identifier: octopus.name,
      levelId: level?.id,
      roomId: room?.id,
      drawingObjectId: octopus.id,
      status: PLACED_STATUS,
    });
  }

  if (levels.length === 0 && devices.length === 0) {
    return undefined;
  }

  return {
    levels: levels.map((level) => ({
      id: level.id,
      code: level.code,
      name: level.name,
      rooms: level.rooms,
    })),
    devices,
    octopuses: octopuses.map((octopus) => ({ octopusId: octopus.id })),
  };
}

export function normalizeImportedStudy(study: ImportedStudy | undefined): ImportedStudy | undefined {
  if (!study || !Array.isArray(study.levels) || !Array.isArray(study.devices)) {
    return undefined;
  }

  const levels = study.levels
    .filter((level) => typeof level.id === 'string' && typeof level.name === 'string')
    .map((level) => ({
      id: level.id,
      code: typeof level.code === 'string' ? level.code : undefined,
      name: level.name,
      rooms: Array.isArray(level.rooms)
        ? level.rooms
            .filter((room) =>
              typeof room.id === 'string' &&
              typeof room.levelId === 'string' &&
              typeof room.name === 'string'
            )
            .map((room) => ({
              id: room.id,
              levelId: room.levelId,
              name: room.name,
              profile: typeof room.profile === 'string' ? room.profile : undefined,
            }))
        : [],
    }));
  const levelIds = new Set(levels.map((level) => level.id));
  const roomIds = new Set(levels.flatMap((level) => level.rooms.map((room) => room.id)));
  const devices = study.devices
    .filter((device) =>
      typeof device.id === 'string' &&
      (device.type === 'apparatus' || device.type === 'octopus')
    )
    .map((device) => ({
      id: device.id,
      type: device.type,
      catalogId: typeof device.catalogId === 'string' ? device.catalogId : undefined,
      modelId: typeof device.modelId === 'string' ? device.modelId : undefined,
      identifier: typeof device.identifier === 'string' ? device.identifier : undefined,
      sourceType: typeof device.sourceType === 'string' ? device.sourceType : inferDeviceSourceType(device),
      drawingCatalogId: isApparatusCatalogId(device.drawingCatalogId) ? device.drawingCatalogId : undefined,
      physicalGroupId: typeof device.physicalGroupId === 'string' ? device.physicalGroupId : undefined,
      levelId: typeof device.levelId === 'string' && levelIds.has(device.levelId) ? device.levelId : undefined,
      roomId: typeof device.roomId === 'string' && roomIds.has(device.roomId) ? device.roomId : undefined,
      drawingObjectId: typeof device.drawingObjectId === 'string' ? device.drawingObjectId : undefined,
      status: device.status === PLACED_STATUS ? PLACED_STATUS : UNPLACED_STATUS,
      metricKey: typeof device.metricKey === 'string' ? device.metricKey : undefined,
    }));
  const deviceIds = new Set(devices.map((device) => device.id));
  const physicalGroups = Array.isArray(study.physicalGroups)
    ? study.physicalGroups
        .filter((group) =>
          typeof group.id === 'string' &&
          Array.isArray(group.studyDeviceIds) &&
          isApparatusCatalogId(group.drawingCatalogId)
        )
        .map((group) => ({
          id: group.id,
          drawingCatalogId: group.drawingCatalogId,
          drawingObjectId: typeof group.drawingObjectId === 'string' ? group.drawingObjectId : undefined,
          studyDeviceIds: group.studyDeviceIds.filter((deviceId) => deviceIds.has(deviceId)),
        }))
        .filter((group) => group.studyDeviceIds.length > 1)
    : [];
  const physicalGroupIdsByDeviceId = new Map<string, string>();
  for (const group of physicalGroups) {
    for (const deviceId of group.studyDeviceIds) {
      physicalGroupIdsByDeviceId.set(deviceId, group.id);
    }
  }
  const normalizedDevices = devices.map((device) => ({
    ...device,
    physicalGroupId: device.physicalGroupId && physicalGroupIdsByDeviceId.get(device.id) === device.physicalGroupId
      ? device.physicalGroupId
      : undefined,
  }));
  const octopusIdsFromDevices = new Set(
    normalizedDevices
      .filter((device) => device.type === 'octopus' && device.drawingObjectId)
      .map((device) => device.drawingObjectId as string),
  );
  const octopuses = [
    ...(Array.isArray(study.octopuses)
      ? study.octopuses
          .filter((octopus) => typeof octopus.octopusId === 'string')
          .map((octopus) => ({
            octopusId: octopus.octopusId,
            installationLevelId: typeof octopus.installationLevelId === 'string' && levelIds.has(octopus.installationLevelId)
              ? octopus.installationLevelId
              : undefined,
            installationRoomId: typeof octopus.installationRoomId === 'string' && roomIds.has(octopus.installationRoomId)
              ? octopus.installationRoomId
              : undefined,
            servedRoomIds: Array.isArray(octopus.servedRoomIds)
              ? Array.from(new Set(octopus.servedRoomIds.filter((roomId) => roomIds.has(roomId))))
              : [],
          }))
      : []),
    ...Array.from(octopusIdsFromDevices)
      .filter((octopusId) => !(study.octopuses ?? []).some((octopus) => octopus.octopusId === octopusId))
      .map((octopusId) => ({ octopusId, servedRoomIds: [] })),
  ];
  const normalizedOctopuses = dedupeStudyOctopuses(octopuses);
  const studyOctopusIds = new Set(normalizedOctopuses.map((octopus) => octopus.octopusId));
  const portKeys = new Set<string>();
  const assignedDeviceIds = new Set<string>();
  const portAssignments = Array.isArray(study.portAssignments)
    ? study.portAssignments
        .filter((assignment) =>
          typeof assignment.id === 'string' &&
          typeof assignment.octopusId === 'string' &&
          Number.isInteger(assignment.portNumber) &&
          assignment.portNumber >= 1 &&
          assignment.portNumber <= 16 &&
          typeof assignment.studyDeviceId === 'string' &&
          deviceIds.has(assignment.studyDeviceId)
        )
        .filter((assignment) => {
          const portKey = createPortAssignmentKey(assignment.octopusId, assignment.portNumber);
          if (portKeys.has(portKey) || assignedDeviceIds.has(assignment.studyDeviceId)) {
            return false;
          }
          portKeys.add(portKey);
          assignedDeviceIds.add(assignment.studyDeviceId);
          return true;
        })
        .map((assignment) => ({
          id: assignment.id,
          octopusId: assignment.octopusId,
          portNumber: assignment.portNumber,
          studyDeviceId: assignment.studyDeviceId,
          source: assignment.source === 'imported' ? 'imported' as const : 'manual' as const,
        }))
    : [];

  return levels.length > 0 || normalizedDevices.length > 0
    ? {
        levels,
        devices: normalizedDevices,
        physicalGroups: physicalGroups.length > 0 ? physicalGroups : undefined,
        octopuses: normalizedOctopuses.length > 0 ? normalizedOctopuses : undefined,
        portAssignments: portAssignments.filter((assignment) => studyOctopusIds.has(assignment.octopusId)).length > 0
          ? portAssignments.filter((assignment) => studyOctopusIds.has(assignment.octopusId))
          : undefined,
      }
    : undefined;
}

export function syncStudyWithDrawing(project: CpreyDrawProject): CpreyDrawProject {
  if (!project.study) {
    return project;
  }

  const apparatusIds = new Set(project.apparatus.map((apparatus) => apparatus.id));
  const octopusIds = new Set(project.octopuses.map((octopus) => octopus.id));
  const devices = project.study.devices.map((device) => {
    if (!device.drawingObjectId) {
      return { ...device, status: UNPLACED_STATUS };
    }

    const exists = device.type === 'apparatus'
      ? apparatusIds.has(device.drawingObjectId)
      : octopusIds.has(device.drawingObjectId);

    return exists
      ? { ...device, status: PLACED_STATUS }
      : { ...device, drawingObjectId: undefined, status: UNPLACED_STATUS };
  });

  const studyOctopuses = dedupeStudyOctopuses([
    ...(project.study.octopuses ?? []),
    ...project.study.devices
      .filter((device) => device.type === 'octopus' && device.drawingObjectId && octopusIds.has(device.drawingObjectId))
      .map((device) => ({ octopusId: device.drawingObjectId as string, servedRoomIds: [] })),
  ]).filter((octopus) => octopusIds.has(octopus.octopusId));
  const studyDeviceIds = new Set(devices.map((device) => device.id));
  const portAssignments = (project.study.portAssignments ?? []).filter(
    (assignment) =>
      octopusIds.has(assignment.octopusId) &&
      studyDeviceIds.has(assignment.studyDeviceId) &&
      assignment.portNumber >= 1 &&
      assignment.portNumber <= 16,
  );

  return {
    ...project,
    study: {
      ...project.study,
      physicalGroups: project.study.physicalGroups?.map((group) => ({
        ...group,
        drawingObjectId: group.drawingObjectId && apparatusIds.has(group.drawingObjectId)
          ? group.drawingObjectId
          : undefined,
      })),
      devices,
      octopuses: studyOctopuses.length > 0 ? studyOctopuses : undefined,
      portAssignments: dedupePortAssignments(portAssignments),
    },
  };
}

export function markStudyDevicePlaced(
  project: CpreyDrawProject,
  studyDeviceId: string | undefined,
  drawingObjectId: string,
): CpreyDrawProject {
  return markStudyDevicesPlaced(project, studyDeviceId ? [studyDeviceId] : [], drawingObjectId);
}

export function markStudyDevicesPlaced(
  project: CpreyDrawProject,
  studyDeviceIds: string[],
  drawingObjectId: string,
): CpreyDrawProject {
  if (!project.study || studyDeviceIds.length === 0) {
    return project;
  }

  const deviceIds = new Set(studyDeviceIds);
  return {
    ...project,
    study: {
      ...project.study,
      physicalGroups: project.study.physicalGroups?.map((group) =>
        group.studyDeviceIds.some((deviceId) => deviceIds.has(deviceId))
          ? { ...group, drawingObjectId }
          : group,
      ),
      devices: project.study.devices.map((device) =>
        deviceIds.has(device.id)
          ? {
              ...device,
              drawingObjectId,
              status: PLACED_STATUS,
            }
          : device,
      ),
    },
  };
}

export function configureStudyPhysicalRepresentation(
  project: CpreyDrawProject,
  studyDeviceIds: string[],
  drawingCatalogId: ApparatusCatalogId,
): CpreyDrawProject {
  if (!project.study || studyDeviceIds.length === 0) {
    return project;
  }

  const devices = studyDeviceIds
    .map((deviceId) => project.study?.devices.find((device) => device.id === deviceId))
    .filter((device): device is StudyDevice => Boolean(device));
  const validationError = validateStudyPhysicalSelection(devices, drawingCatalogId);
  if (validationError) {
    throw new Error(validationError);
  }

  const previousGroupIds = new Set(devices.map((device) => device.physicalGroupId).filter(Boolean) as string[]);
  const remainingGroups = (project.study.physicalGroups ?? []).filter((group) => !previousGroupIds.has(group.id));
  const groupCapacity = getCatalogGroupCapacity(drawingCatalogId);
  const nextGroupId = groupCapacity > 1 ? nextPhysicalGroupId(getNextPhysicalGroupIndex(remainingGroups)) : undefined;
  const selectedIds = new Set(studyDeviceIds);

  return {
    ...project,
    study: {
      ...project.study,
      physicalGroups: nextGroupId
        ? [
            ...remainingGroups,
            {
              id: nextGroupId,
              studyDeviceIds: [...studyDeviceIds],
              drawingCatalogId,
            },
          ]
        : remainingGroups.length > 0
          ? remainingGroups
          : undefined,
      devices: project.study.devices.map((device) => {
        if (!selectedIds.has(device.id)) {
          return previousGroupIds.has(device.physicalGroupId ?? '')
            ? { ...device, physicalGroupId: undefined }
            : device;
        }

        return {
          ...device,
          drawingCatalogId,
          physicalGroupId: nextGroupId,
        };
      }),
    },
  };
}

export function dissociateStudyPhysicalGroup(
  project: CpreyDrawProject,
  physicalGroupId: string,
): CpreyDrawProject {
  if (!project.study) {
    return project;
  }

  const group = project.study.physicalGroups?.find((candidate) => candidate.id === physicalGroupId);
  if (!group) {
    return project;
  }
  if (group.drawingObjectId || group.studyDeviceIds.some((deviceId) =>
    project.study?.devices.find((device) => device.id === deviceId)?.drawingObjectId
  )) {
    throw new Error("Supprimez d'abord l'appareillage placé avant de dissocier.");
  }

  const groupDeviceIds = new Set(group.studyDeviceIds);
  const remainingGroups = project.study.physicalGroups?.filter((candidate) => candidate.id !== physicalGroupId) ?? [];

  return {
    ...project,
    study: {
      ...project.study,
      physicalGroups: remainingGroups.length > 0 ? remainingGroups : undefined,
      devices: project.study.devices.map((device) =>
        groupDeviceIds.has(device.id)
          ? { ...device, physicalGroupId: undefined, drawingCatalogId: undefined }
          : device,
      ),
    },
  };
}

export function getCompatibleCatalogItems(study: ImportedStudy | undefined, device: StudyDevice): ApparatusCatalogItem[] {
  const sourceType = getStudyDeviceSourceType(study, device);
  if (!sourceType) {
    return device.catalogId && isApparatusCatalogId(device.catalogId)
      ? [getApparatusCatalogItem(device.catalogId)]
      : [];
  }

  return APPARATUS_CATALOG.filter((catalogItem) => catalogItem.type === sourceType);
}

export function getCatalogGroupCapacity(catalogId: ApparatusCatalogId): number {
  if (
    catalogId === 'prise_double' ||
    catalogId === 'prise_double_haute' ||
    catalogId === 'interrupteur-double' ||
    catalogId === 'Interrupteur-double-v' ||
    catalogId === 'Interrupteur-double-vV'
  ) {
    return 2;
  }

  return 1;
}

export function getStudyDeviceDrawingCatalogId(device: StudyDevice): ApparatusCatalogId | undefined {
  if (device.drawingCatalogId) {
    return device.drawingCatalogId;
  }

  return isApparatusCatalogId(device.catalogId) ? device.catalogId : undefined;
}

export function getStudyPlacementTargetsForRoom(
  study: ImportedStudy | undefined,
  roomId: string | undefined,
): StudyPlacementTarget[] {
  if (!study || !roomId) {
    return [];
  }

  return getStudyPlacementTargetsFromDevices(study, study.devices.filter((device) => device.roomId === roomId));
}

export function getUnassignedStudyPlacementTargets(study: ImportedStudy | undefined): StudyPlacementTarget[] {
  if (!study) {
    return [];
  }

  return getStudyPlacementTargetsFromDevices(study, study.devices.filter((device) => !device.levelId));
}

export function getStudyPlacementTarget(
  study: ImportedStudy | undefined,
  targetId: string,
): StudyPlacementTarget | undefined {
  return getStudyPlacementTargetsFromDevices(study, study?.devices ?? []).find((target) => target.id === targetId);
}

export function getCompatibleStudyDeviceCandidates(
  study: ImportedStudy | undefined,
  device: StudyDevice,
): StudyDevice[] {
  if (!study || device.type !== 'apparatus') {
    return [];
  }

  const sourceType = getStudyDeviceSourceType(study, device);
  return study.devices
    .filter((candidate) =>
      candidate.type === 'apparatus' &&
      candidate.status === UNPLACED_STATUS &&
      !candidate.drawingObjectId &&
      (!candidate.physicalGroupId || candidate.id === device.id) &&
      candidate.levelId === device.levelId &&
      candidate.roomId === device.roomId &&
      getStudyDeviceSourceType(study, candidate) === sourceType
    )
    .sort(compareStudyDeviceIdentifiers);
}

export function getStudyDevicesForDrawingObject(
  study: ImportedStudy | undefined,
  drawingObjectId: string | undefined,
): StudyDevice[] {
  if (!study || !drawingObjectId) {
    return [];
  }

  return study.devices.filter((device) => device.drawingObjectId === drawingObjectId);
}

export function getActiveStudyLevel(project: CpreyDrawProject): StudyLevel | undefined {
  return project.study?.levels.find((level) => level.id === project.activeLevelId);
}

export function getRoomsForLevel(study: ImportedStudy | undefined, levelId: string | undefined): StudyRoom[] {
  if (!study || !levelId) {
    return [];
  }

  return study.levels.find((level) => level.id === levelId)?.rooms ?? [];
}

export function getStudyDevicesForLevel(
  study: ImportedStudy | undefined,
  levelId: string | undefined,
): StudyDevice[] {
  if (!study || !levelId) {
    return [];
  }

  return study.devices.filter((device) => device.levelId === levelId);
}

export function getStudyDevicesForRoom(
  study: ImportedStudy | undefined,
  roomId: string | undefined,
): StudyDevice[] {
  if (!study || !roomId) {
    return [];
  }

  return study.devices.filter((device) => device.roomId === roomId);
}

export function getStudyProgress(study: ImportedStudy | undefined): StudyProgress {
  return getProgress(study?.devices ?? []);
}

export function getStudyProgressForRoom(
  study: ImportedStudy | undefined,
  roomId: string | undefined,
): RoomStudyProgress {
  return {
    roomId: roomId ?? '',
    ...getProgress(getStudyDevicesForRoom(study, roomId)),
  };
}

export function getStudyDeviceSelectionObjectId(device: StudyDevice): string | undefined {
  return device.drawingObjectId;
}

export function getStudyOctopus(
  study: ImportedStudy | undefined,
  octopusId: string | undefined,
): StudyOctopus | undefined {
  if (!study || !octopusId) {
    return undefined;
  }

  return study.octopuses?.find((octopus) => octopus.octopusId === octopusId);
}

export function getOctopusPortAssignments(
  study: ImportedStudy | undefined,
  octopusId: string | undefined,
): OctopusPortAssignment[] {
  if (!study || !octopusId) {
    return [];
  }

  return (study.portAssignments ?? [])
    .filter((assignment) => assignment.octopusId === octopusId)
    .sort((left, right) => left.portNumber - right.portNumber);
}

export function getStudyDevicePortAssignment(
  study: ImportedStudy | undefined,
  studyDeviceId: string | undefined,
): OctopusPortAssignment | undefined {
  if (!study || !studyDeviceId) {
    return undefined;
  }

  return study.portAssignments?.find((assignment) => assignment.studyDeviceId === studyDeviceId);
}

export function getFreeOctopusPorts(
  project: CpreyDrawProject,
  octopusId: string,
): number[] {
  const octopus = project.octopuses.find((candidate) => candidate.id === octopusId);
  if (!octopus) {
    return [];
  }

  const occupiedPorts = new Set(getOctopusPortAssignments(project.study, octopusId).map((assignment) => assignment.portNumber));
  return octopus.ports
    .map((port) => port.number)
    .filter((portNumber) => !occupiedPorts.has(portNumber))
    .sort((left, right) => left - right);
}

export function setStudyOctopusInstallation(
  project: CpreyDrawProject,
  octopusId: string,
  installationLevelId: string | undefined,
  installationRoomId: string | undefined,
): CpreyDrawProject {
  if (!project.study) {
    return project;
  }
  ensureProjectOctopus(project, octopusId);

  const level = installationLevelId
    ? project.study.levels.find((candidate) => candidate.id === installationLevelId)
    : undefined;
  if (installationLevelId && !level) {
    throw new Error('Niveau d’installation introuvable.');
  }
  const room = installationRoomId ? findStudyRoom(project.study, installationRoomId) : undefined;
  if (installationRoomId && !room) {
    throw new Error('Pièce d’installation introuvable.');
  }
  if (room && installationLevelId && room.levelId !== installationLevelId) {
    throw new Error("La pièce d'installation doit appartenir au niveau choisi.");
  }

  return updateStudyOctopus(project, octopusId, {
    installationLevelId,
    installationRoomId,
  });
}

export function setStudyOctopusServedRooms(
  project: CpreyDrawProject,
  octopusId: string,
  servedRoomIds: string[],
): CpreyDrawProject {
  if (!project.study) {
    return project;
  }
  ensureProjectOctopus(project, octopusId);
  const normalizedRoomIds = Array.from(new Set(servedRoomIds)).filter((roomId) => findStudyRoom(project.study, roomId));
  const removedRoomIds = new Set((getStudyOctopus(project.study, octopusId)?.servedRoomIds ?? [])
    .filter((roomId) => !normalizedRoomIds.includes(roomId)));
  const blockingAssignments = getOctopusPortAssignments(project.study, octopusId)
    .filter((assignment) => {
      const device = project.study?.devices.find((candidate) => candidate.id === assignment.studyDeviceId);
      return device?.roomId ? removedRoomIds.has(device.roomId) : false;
    });
  if (blockingAssignments.length > 0) {
    throw new Error('Impossible de retirer cette pièce : des sorties de la pieuvre sont encore affectées à ses équipements.');
  }

  return updateStudyOctopus(project, octopusId, {
    servedRoomIds: normalizedRoomIds,
  });
}

export function assignStudyDeviceToOctopusPort(
  project: CpreyDrawProject,
  octopusId: string,
  portNumber: number,
  studyDeviceId: string,
  source: OctopusPortAssignmentSource = 'manual',
): CpreyDrawProject {
  const validation = validateOctopusPortAssignment(project, octopusId, portNumber, studyDeviceId);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  if (!project.study) {
    return project;
  }

  const existingForDevice = getStudyDevicePortAssignment(project.study, studyDeviceId);
  const nextAssignments = (project.study.portAssignments ?? []).filter((assignment) =>
    assignment.id !== existingForDevice?.id &&
    createPortAssignmentKey(assignment.octopusId, assignment.portNumber) !== createPortAssignmentKey(octopusId, portNumber)
  );

  return {
    ...project,
    study: {
      ...project.study,
      octopuses: ensureStudyOctopusEntry(project.study, octopusId),
      portAssignments: [
        ...nextAssignments,
        {
          id: nextPortAssignmentId(getNextPortAssignmentIndex(nextAssignments)),
          octopusId,
          portNumber,
          studyDeviceId,
          source,
        },
      ].sort(comparePortAssignments),
    },
  };
}

export function unassignOctopusPort(
  project: CpreyDrawProject,
  octopusId: string,
  portNumber: number,
): CpreyDrawProject {
  if (!project.study) {
    return project;
  }
  ensureProjectOctopus(project, octopusId);
  ensureValidPortNumber(portNumber);

  return {
    ...project,
    study: {
      ...project.study,
      portAssignments: (project.study.portAssignments ?? []).filter((assignment) =>
        createPortAssignmentKey(assignment.octopusId, assignment.portNumber) !== createPortAssignmentKey(octopusId, portNumber)
      ),
    },
  };
}

export function moveStudyDeviceOctopusPortAssignment(
  project: CpreyDrawProject,
  studyDeviceId: string,
  toOctopusId: string,
  toPortNumber: number,
): CpreyDrawProject {
  if (!project.study) {
    return project;
  }
  const current = getStudyDevicePortAssignment(project.study, studyDeviceId);
  const withoutCurrent = current
    ? unassignOctopusPort(project, current.octopusId, current.portNumber)
    : project;

  return assignStudyDeviceToOctopusPort(withoutCurrent, toOctopusId, toPortNumber, studyDeviceId, current?.source ?? 'manual');
}

export function validateOctopusPortAssignment(
  project: CpreyDrawProject,
  octopusId: string,
  portNumber: number,
  studyDeviceId: string,
): { ok: true } | { ok: false; reason: string } {
  if (!project.study) {
    return { ok: false, reason: 'Aucune étude importée.' };
  }
  const octopus = project.octopuses.find((candidate) => candidate.id === octopusId);
  if (!octopus) {
    return { ok: false, reason: 'Pieuvre introuvable.' };
  }
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 16) {
    return { ok: false, reason: 'Numéro de port invalide.' };
  }
  if (!octopus.ports.some((port) => port.number === portNumber)) {
    return { ok: false, reason: 'Port introuvable sur cette pieuvre.' };
  }
  const device = project.study.devices.find((candidate) => candidate.id === studyDeviceId);
  if (!device) {
    return { ok: false, reason: 'Équipement étude introuvable.' };
  }
  if (device.type !== 'apparatus') {
    return { ok: false, reason: 'Seuls les appareillages peuvent être affectés aux ports.' };
  }
  if (!device.roomId) {
    return { ok: false, reason: "La pièce de l'équipement doit être définie avant affectation." };
  }

  const existingForPort = getOctopusPortAssignments(project.study, octopusId)
    .find((assignment) => assignment.portNumber === portNumber);
  if (existingForPort && existingForPort.studyDeviceId !== studyDeviceId) {
    return { ok: false, reason: 'Ce port est déjà affecté.' };
  }
  const existingForDevice = getStudyDevicePortAssignment(project.study, studyDeviceId);
  if (existingForDevice && (
    existingForDevice.octopusId !== octopusId ||
    existingForDevice.portNumber !== portNumber
  )) {
    return { ok: false, reason: 'Cet équipement est déjà affecté à une sortie.' };
  }

  const studyOctopus = getStudyOctopus(project.study, octopusId);
  if (!studyOctopus?.servedRoomIds?.includes(device.roomId)) {
    return { ok: false, reason: "La pièce de cet équipement n'est pas desservie par cette pieuvre." };
  }

  return { ok: true };
}

export function shouldDisplayApparatusForActiveLevel(
  project: CpreyDrawProject,
  apparatus: ApparatusInstance,
): boolean {
  return shouldDisplayDrawingObjectForActiveLevel(project, apparatus.id, apparatus.importContext);
}

export function shouldDisplayOctopusForActiveLevel(project: CpreyDrawProject, octopus: Octopus): boolean {
  return shouldDisplayDrawingObjectForActiveLevel(project, octopus.id, octopus.importContext);
}

export function shouldDisplayDuctForActiveLevel(project: CpreyDrawProject, duct: Duct): boolean {
  if (!project.study || !project.activeLevelId) {
    return true;
  }

  const levelIds = [
    getEndpointLevelId(project, duct.source),
    getEndpointLevelId(project, duct.target),
  ].filter((levelId): levelId is string => typeof levelId === 'string');

  return levelIds.every((levelId) => levelId === project.activeLevelId);
}

function shouldDisplayDrawingObjectForActiveLevel(
  project: CpreyDrawProject,
  drawingObjectId: string,
  importContext: CdefImportContext | undefined,
): boolean {
  if (!project.study || !project.activeLevelId) {
    return true;
  }

  const levelId = getStudyLevelIdForDrawingObject(project, drawingObjectId) ??
    getStudyLevelIdFromImportContext(project.study, importContext);

  return levelId ? levelId === project.activeLevelId : true;
}

function getEndpointLevelId(project: CpreyDrawProject, endpoint: DuctEndpoint): string | undefined {
  if (endpoint.type === 'apparatus') {
    const apparatus = project.apparatus.find((item) => item.id === endpoint.id);
    return getStudyLevelIdForDrawingObject(project, endpoint.id) ??
      getStudyLevelIdFromImportContext(project.study, apparatus?.importContext);
  }

  if (endpoint.type === 'octopus-output') {
    const octopus = project.octopuses.find((item) => item.id === endpoint.octopusId);
    return getStudyLevelIdForDrawingObject(project, endpoint.octopusId) ??
      getStudyLevelIdFromImportContext(project.study, octopus?.importContext);
  }

  return undefined;
}

function getStudyLevelIdForDrawingObject(
  project: CpreyDrawProject,
  drawingObjectId: string,
): string | undefined {
  return project.study?.devices.find((device) => device.drawingObjectId === drawingObjectId)?.levelId;
}

function getStudyLevelIdFromImportContext(
  study: ImportedStudy | undefined,
  importContext: CdefImportContext | undefined,
): string | undefined {
  if (!study || !importContext?.levelName) {
    return undefined;
  }

  const location = locationFromImportContext(importContext);
  const key = createLevelKey(location.levelName, location.levelCode);
  return study.levels.find((level) => createLevelKey(level.name, level.code) === key)?.id;
}

function ensureLevel(
  levels: LevelDraft[],
  levelKeys: Map<string, LevelDraft>,
  rawLevelName: string,
  rawLevelCode?: string,
): LevelDraft {
  const parsed = parseLevelLabel(rawLevelName);
  const code = rawLevelCode ?? parsed.levelCode;
  const name = parsed.levelName ?? rawLevelName.trim();
  const key = createLevelKey(name, code);
  const existing = levelKeys.get(key);
  if (existing) {
    return existing;
  }

  const level: LevelDraft = {
    id: nextLevelId(levels.length),
    code,
    name,
    rooms: [],
  };
  levels.push(level);
  levelKeys.set(key, level);
  return level;
}

function ensureRoom(
  level: LevelDraft,
  roomKeys: Map<string, StudyRoom>,
  rawRoomName: string,
  profile?: string,
): StudyRoom {
  const name = rawRoomName.trim();
  const key = `${level.id}:${normalizeKey(name)}`;
  const existing = roomKeys.get(key);
  if (existing) {
    return existing;
  }

  const room: StudyRoom = {
    id: nextRoomId(roomKeys.size),
    levelId: level.id,
    name,
    profile,
  };
  level.rooms.push(room);
  roomKeys.set(key, room);
  return room;
}

function locationFromImportContext(
  importContext: CdefImportContext | undefined,
  comments = '',
): ParsedStudyLocation {
  const parsedComment = parseStudyLocation(comments);
  const parsedLevel = importContext?.levelName ? parseLevelLabel(importContext.levelName) : {};

  return {
    levelCode: parsedLevel.levelCode ?? parsedComment.levelCode,
    levelName: parsedLevel.levelName ?? importContext?.levelName ?? parsedComment.levelName,
    roomName: importContext?.roomName ?? parsedComment.roomName,
    profile: importContext?.roomProfile ?? parsedComment.profile,
  };
}

function parseLevelLabel(value: string): ParsedStudyLocation {
  return parseStudyLocation(`Niveau : ${value}`);
}

function createLevelKey(name: string | undefined, code?: string): string {
  return `${normalizeKey(code ?? '')}:${normalizeKey(name ?? '')}`;
}

function normalizeKey(value: string): string {
  return removeAccents(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function removeAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function nextLevelId(index: number): string {
  return `level_${String(index + 1).padStart(3, '0')}`;
}

function nextRoomId(index: number): string {
  return `room_${String(index + 1).padStart(3, '0')}`;
}

function nextDeviceId(index: number): string {
  return `device_${String(index + 1).padStart(3, '0')}`;
}

function nextPhysicalGroupId(index: number): string {
  return `physical_group_${String(index + 1).padStart(3, '0')}`;
}

function nextPortAssignmentId(index: number): string {
  return `port_assignment_${String(index + 1).padStart(3, '0')}`;
}

function getNextPhysicalGroupIndex(groups: StudyPhysicalGroup[]): number {
  return groups.reduce((maxIndex, group) => {
    const match = group.id.match(/^physical_group_(\d+)$/);
    return match ? Math.max(maxIndex, Number(match[1])) : maxIndex;
  }, 0);
}

function getNextPortAssignmentIndex(assignments: OctopusPortAssignment[]): number {
  return assignments.reduce((maxIndex, assignment) => {
    const match = assignment.id.match(/^port_assignment_(\d+)$/);
    return match ? Math.max(maxIndex, Number(match[1])) : maxIndex;
  }, 0);
}

function createPortAssignmentKey(octopusId: string, portNumber: number): string {
  return `${octopusId}:${portNumber}`;
}

function comparePortAssignments(left: OctopusPortAssignment, right: OctopusPortAssignment): number {
  return left.octopusId.localeCompare(right.octopusId, 'fr') || left.portNumber - right.portNumber;
}

function dedupeStudyOctopuses(octopuses: StudyOctopus[]): StudyOctopus[] {
  const byOctopusId = new Map<string, StudyOctopus>();
  for (const octopus of octopuses) {
    if (byOctopusId.has(octopus.octopusId)) {
      continue;
    }
    byOctopusId.set(octopus.octopusId, {
      octopusId: octopus.octopusId,
      installationLevelId: octopus.installationLevelId,
      installationRoomId: octopus.installationRoomId,
      servedRoomIds: Array.from(new Set(octopus.servedRoomIds ?? [])),
    });
  }

  return Array.from(byOctopusId.values());
}

function dedupePortAssignments(assignments: OctopusPortAssignment[]): OctopusPortAssignment[] | undefined {
  const portKeys = new Set<string>();
  const deviceIds = new Set<string>();
  const deduped = assignments
    .filter((assignment) => {
      const key = createPortAssignmentKey(assignment.octopusId, assignment.portNumber);
      if (portKeys.has(key) || deviceIds.has(assignment.studyDeviceId)) {
        return false;
      }
      portKeys.add(key);
      deviceIds.add(assignment.studyDeviceId);
      return true;
    })
    .sort(comparePortAssignments);

  return deduped.length > 0 ? deduped : undefined;
}

function ensureProjectOctopus(project: CpreyDrawProject, octopusId: string): void {
  if (!project.octopuses.some((octopus) => octopus.id === octopusId)) {
    throw new Error('Pieuvre introuvable.');
  }
}

function ensureValidPortNumber(portNumber: number): void {
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 16) {
    throw new Error('Numéro de port invalide.');
  }
}

function findStudyRoom(study: ImportedStudy | undefined, roomId: string | undefined): StudyRoom | undefined {
  if (!study || !roomId) {
    return undefined;
  }

  return study.levels.flatMap((level) => level.rooms).find((room) => room.id === roomId);
}

function ensureStudyOctopusEntry(study: ImportedStudy, octopusId: string): StudyOctopus[] {
  return dedupeStudyOctopuses([
    ...(study.octopuses ?? []),
    { octopusId, servedRoomIds: [] },
  ]);
}

function updateStudyOctopus(
  project: CpreyDrawProject,
  octopusId: string,
  updates: Partial<Pick<StudyOctopus, 'installationLevelId' | 'installationRoomId' | 'servedRoomIds'>>,
): CpreyDrawProject {
  if (!project.study) {
    return project;
  }

  const existing = getStudyOctopus(project.study, octopusId) ?? { octopusId, servedRoomIds: [] };
  const nextOctopus = {
    ...existing,
    ...updates,
    servedRoomIds: Array.from(new Set(updates.servedRoomIds ?? existing.servedRoomIds ?? [])),
  };

  return {
    ...project,
    study: {
      ...project.study,
      octopuses: [
        ...(project.study.octopuses ?? []).filter((octopus) => octopus.octopusId !== octopusId),
        nextOctopus,
      ],
    },
  };
}

function isApparatusCatalogId(value: unknown): value is ApparatusCatalogId {
  return typeof value === 'string' && APPARATUS_CATALOG.some((catalogItem) => catalogItem.id === value);
}

function inferDeviceSourceType(
  device: Pick<StudyDevice, 'catalogId' | 'modelId' | 'type' | 'metricKey'> | ApparatusInstance,
): string | undefined {
  const metricKey = 'metricKey' in device && typeof device.metricKey === 'string'
    ? device.metricKey
    : 'importContext' in device
      ? device.importContext?.metricKey
      : undefined;
  if (metricKey === 'prises_spec') {
    return 'SP';
  }
  if (device.type === 'apparatus' && isApparatusCatalogId(device.catalogId)) {
    return getApparatusCatalogItem(device.catalogId).type;
  }

  return device.type === 'octopus' ? 'OCTOPUS' : undefined;
}

function getStudyDeviceSourceType(study: ImportedStudy | undefined, device: StudyDevice): string | undefined {
  return device.sourceType ?? inferDeviceSourceType(device) ??
    study?.devices.find((candidate) => candidate.id === device.id)?.sourceType;
}

function validateStudyPhysicalSelection(
  devices: StudyDevice[],
  drawingCatalogId: ApparatusCatalogId,
): string | undefined {
  if (devices.length === 0) {
    return 'Aucun élément étude sélectionné.';
  }
  if (devices.some((device) => device.type !== 'apparatus')) {
    return 'Seuls les appareillages peuvent être regroupés.';
  }
  if (devices.some((device) => device.status === PLACED_STATUS || device.drawingObjectId)) {
    return "Supprimez d'abord l'appareillage placé avant de modifier la représentation.";
  }
  const existingGroupIds = new Set(devices.map((device) => device.physicalGroupId).filter(Boolean) as string[]);
  if (existingGroupIds.size > 0) {
    if (existingGroupIds.size > 1) {
      return 'Une référence est déjà associée à un autre appareillage.';
    }
    const existingGroupId = Array.from(existingGroupIds)[0];
    if (devices.some((device) => device.physicalGroupId !== existingGroupId)) {
      return 'Une référence est déjà associée à un autre appareillage.';
    }
  }

  const [first] = devices;
  if (devices.some((device) => device.levelId !== first.levelId)) {
    return 'Le regroupement doit rester dans le même niveau.';
  }
  if (devices.some((device) => device.roomId !== first.roomId)) {
    return 'Le regroupement doit rester dans la même pièce.';
  }

  const sourceType = first.sourceType ?? inferDeviceSourceType(first);
  if (devices.some((device) => (device.sourceType ?? inferDeviceSourceType(device)) !== sourceType)) {
    return 'Le regroupement doit utiliser le même type électrique.';
  }
  if (getApparatusCatalogItem(drawingCatalogId).type !== sourceType) {
    return "L'appareillage choisi n'est pas compatible avec le type électrique.";
  }
  if (devices.length !== getCatalogGroupCapacity(drawingCatalogId)) {
    return `Cet appareillage doit associer ${getCatalogGroupCapacity(drawingCatalogId)} référence(s).`;
  }

  return undefined;
}

function getStudyPlacementTargetsFromDevices(
  study: ImportedStudy | undefined,
  devices: StudyDevice[],
): StudyPlacementTarget[] {
  if (!study) {
    return [];
  }

  const targets: StudyPlacementTarget[] = [];
  const usedDeviceIds = new Set<string>();
  for (const group of study.physicalGroups ?? []) {
    const groupDevices = group.studyDeviceIds
      .map((deviceId) => devices.find((device) => device.id === deviceId))
      .filter((device): device is StudyDevice => Boolean(device));
    if (groupDevices.length === 0) {
      continue;
    }
    groupDevices.forEach((device) => usedDeviceIds.add(device.id));
    const drawingObjectIds = Array.from(new Set(groupDevices.map((device) => device.drawingObjectId).filter(Boolean)));
    const allPlaced = groupDevices.every((device) => device.status === PLACED_STATUS && device.drawingObjectId);
    targets.push({
      id: group.id,
      kind: 'group',
      studyDeviceIds: groupDevices.map((device) => device.id),
      identifiers: groupDevices.map(getStudyDeviceIdentifier),
      drawingCatalogId: group.drawingCatalogId,
      drawingObjectId: allPlaced && drawingObjectIds.length === 1 ? drawingObjectIds[0] : group.drawingObjectId,
      status: allPlaced ? PLACED_STATUS : UNPLACED_STATUS,
      levelId: groupDevices[0]?.levelId,
      roomId: groupDevices[0]?.roomId,
    });
  }

  for (const device of devices) {
    if (usedDeviceIds.has(device.id)) {
      continue;
    }
    targets.push({
      id: device.id,
      kind: 'device',
      studyDeviceIds: [device.id],
      identifiers: [getStudyDeviceIdentifier(device)],
      drawingCatalogId: getStudyDeviceDrawingCatalogId(device),
      drawingObjectId: device.drawingObjectId,
      status: device.status,
      levelId: device.levelId,
      roomId: device.roomId,
    });
  }

  return targets.sort((left, right) => left.identifiers.join(' ').localeCompare(right.identifiers.join(' '), 'fr'));
}

function getStudyDeviceIdentifier(device: StudyDevice): string {
  return device.identifier ?? device.catalogId ?? device.modelId ?? device.id;
}

function compareStudyDeviceIdentifiers(left: StudyDevice, right: StudyDevice): number {
  return getStudyDeviceIdentifier(left).localeCompare(getStudyDeviceIdentifier(right), 'fr', {
    numeric: true,
    sensitivity: 'base',
  });
}

function getProgress(devices: StudyDevice[]): StudyProgress {
  const placed = devices.filter((device) => device.status === PLACED_STATUS).length;
  const total = devices.length;
  return {
    total,
    placed,
    unplaced: total - placed,
  };
}
