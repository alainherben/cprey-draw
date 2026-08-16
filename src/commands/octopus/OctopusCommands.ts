import type { CpreyDrawProject, Octopus, OctopusOutputOverride, Point } from '../../types/project';
import type { ApplyProject } from '../CommandManager';
import { ProjectSnapshotCommand } from '../ProjectSnapshotCommand';
import { isSameOctopusOutput } from '../../domain/ducts';
import { removeOctopusOutputOverride, upsertOctopusOutputOverride } from '../../domain/octopusOutputs';

export function createAddOctopusCommand(
  before: CpreyDrawProject,
  octopus: Octopus,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  return new ProjectSnapshotCommand(
    'Ajouter une pieuvre',
    before,
    { ...before, octopuses: [...before.octopuses, octopus] },
    applyProject,
  );
}

export function createMoveOctopusCommand(
  before: CpreyDrawProject,
  octopusId: string,
  from: Point,
  to: Point,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const normalizedBefore: CpreyDrawProject = {
    ...before,
    octopuses: before.octopuses.map((octopus) =>
      octopus.id === octopusId ? { ...octopus, x: from.x, y: from.y } : octopus,
    ),
  };
  const after: CpreyDrawProject = {
    ...before,
    octopuses: before.octopuses.map((octopus) =>
      octopus.id === octopusId ? { ...octopus, x: to.x, y: to.y } : octopus,
    ),
  };

  return new ProjectSnapshotCommand(
    'Déplacer une pieuvre',
    normalizedBefore,
    after,
    applyProject,
  );
}

export function createUpdateOctopusCommand(
  before: CpreyDrawProject,
  octopusId: string,
  updates: Partial<Pick<Octopus, 'name' | 'x' | 'y' | 'rotation' | 'comments' | 'visible' | 'locked' | 'displayScale' | 'outputOverrides'>>,
  applyProject: ApplyProject,
  label = 'Modifier une pieuvre',
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    octopuses: before.octopuses.map((octopus) =>
      octopus.id === octopusId ? { ...octopus, ...updates } : octopus,
    ),
  };

  return new ProjectSnapshotCommand(label, before, after, applyProject);
}

export function createUpdateOctopusOutputOverrideCommand(
  before: CpreyDrawProject,
  octopusId: string,
  override: OctopusOutputOverride,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    octopuses: before.octopuses.map((octopus) =>
      octopus.id === octopusId ? upsertOctopusOutputOverride(octopus, override) : octopus,
    ),
  };

  return new ProjectSnapshotCommand('Configurer une sortie libre', before, after, applyProject);
}

export function createResetOctopusOutputOverrideCommand(
  before: CpreyDrawProject,
  octopusId: string,
  outputNumber: number,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    octopuses: before.octopuses.map((octopus) =>
      octopus.id === octopusId ? removeOctopusOutputOverride(octopus, outputNumber) : octopus,
    ),
  };

  return new ProjectSnapshotCommand('Réinitialiser une sortie libre', before, after, applyProject);
}

export function createDeleteOctopusCommand(
  before: CpreyDrawProject,
  octopusId: string,
  applyProject: ApplyProject,
): ProjectSnapshotCommand {
  const after: CpreyDrawProject = {
    ...before,
    octopuses: before.octopuses.filter((octopus) => octopus.id !== octopusId),
    ducts: before.ducts.filter(
      (duct) =>
        !isSameOctopusOutput(duct.source, octopusId) &&
        !isSameOctopusOutput(duct.circuitOrigin, octopusId),
    ),
  };

  return new ProjectSnapshotCommand('Supprimer une pieuvre', before, after, applyProject);
}
