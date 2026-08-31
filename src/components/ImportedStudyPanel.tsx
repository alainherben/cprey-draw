import { useEffect, useMemo, useState } from 'react';
import { getApparatusCatalogItem } from '../catalog/apparatus';
import {
  getCatalogGroupCapacity,
  getCompatibleCatalogItems,
  getCompatibleStudyDeviceCandidates,
  getStudyDevicePortAssignment,
  getStudyDeviceDrawingCatalogId,
  getStudyPlacementTargetsForRoom,
  getStudyProgress,
  getStudyProgressForRoom,
  getUnassignedStudyPlacementTargets,
  type StudyPlacementTarget,
} from '../domain/importedStudy';
import type { ApparatusCatalogId, ImportedStudy, Octopus, StudyDevice, StudyLevel, StudyRoom } from '../types/project';

interface ImportedStudyPanelProps {
  study: ImportedStudy | undefined;
  octopuses: Octopus[];
  activeLevelId?: string;
  pendingPlacementDeviceId?: string;
  onClose: () => void;
  onChangeActiveLevel: (levelId: string) => void;
  onAddLevel: (name: string) => void;
  onRenameLevel: (levelId: string, name: string) => void;
  onRemoveLevel: (levelId: string) => void;
  onAddRoom: (levelId: string, name: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onRemoveRoom: (roomId: string) => void;
  onSelectTarget: (target: StudyPlacementTarget) => void;
  onConfigureRepresentation: (studyDeviceIds: string[], drawingCatalogId: ApparatusCatalogId) => void;
  onDissociateGroup: (physicalGroupId: string) => void;
}

export function ImportedStudyPanel({
  study,
  octopuses,
  activeLevelId,
  pendingPlacementDeviceId,
  onClose,
  onChangeActiveLevel,
  onAddLevel,
  onRenameLevel,
  onRemoveLevel,
  onAddRoom,
  onRenameRoom,
  onRemoveRoom,
  onSelectTarget,
  onConfigureRepresentation,
  onDissociateGroup,
}: ImportedStudyPanelProps) {
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const effectiveStudy = study ?? { levels: [], devices: [] };
  const totalProgress = getStudyProgress(effectiveStudy);
  const sortedLevels = [
    ...effectiveStudy.levels.filter((level) => level.id === activeLevelId),
    ...effectiveStudy.levels.filter((level) => level.id !== activeLevelId),
  ];

  return (
    <aside className="study-panel" aria-label="Niveaux et pièces">
      <header className="study-panel-header">
        <div>
          <h2>Niveaux et pièces</h2>
          <p>{totalProgress.placed}/{totalProgress.total} placés</p>
        </div>
        <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </header>

      <div className="study-panel-content">
        {effectiveStudy.levels.length > 0 ? (
          <label className="study-active-level">
            <span>Niveau actif</span>
            <select
              value={activeLevelId ?? ''}
              onChange={(event) => onChangeActiveLevel(event.currentTarget.value)}
            >
              {effectiveStudy.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {formatLevelLabel(level)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="study-empty-message">Aucun niveau défini.</p>
        )}

        {sortedLevels.map((level) => {
          const levelDevices = effectiveStudy.devices.filter((device) => device.levelId === level.id);
          const levelPlaced = levelDevices.filter((device) => device.status === 'placed').length;
          const isActive = level.id === activeLevelId;

          return (
            <section key={level.id} className={`study-level ${isActive ? 'active' : ''}`}>
              <header>
                <h3>{formatLevelLabel(level)}</h3>
                <span>{levelPlaced}/{levelDevices.length}</span>
              </header>
              <div className="study-location-actions">
                <button type="button" onClick={() => renameLevel(level, onRenameLevel)}>Renommer</button>
                <button type="button" onClick={() => onRemoveLevel(level.id)}>Supprimer</button>
              </div>

              <div className="study-rooms">
                {level.rooms.map((room) => {
                  const roomProgress = getStudyProgressForRoom(effectiveStudy, room.id);
                  return (
                    <details key={room.id} open={isActive}>
                      <summary>
                        <span>
                          {room.name}
                          {room.profile && <small>{room.profile}</small>}
                        </span>
                        <strong>{roomProgress.placed}/{roomProgress.total}</strong>
                      </summary>
                      <div className="study-location-actions room-actions">
                        <button type="button" onClick={() => renameRoom(room, onRenameRoom)}>Renommer</button>
                        <button type="button" onClick={() => onRemoveRoom(room.id)}>Supprimer</button>
                      </div>
                      <div className="study-device-list">
                        {getStudyPlacementTargetsForRoom(effectiveStudy, room.id).map((target) => (
                          <StudyTargetButton
                            key={target.id}
                            study={effectiveStudy}
                            target={target}
                            octopuses={octopuses}
                            active={target.id === pendingPlacementDeviceId}
                            onSelect={onSelectTarget}
                            onChoose={(deviceId) => setEditingDeviceId(deviceId)}
                            onDissociate={onDissociateGroup}
                          />
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
              <button type="button" className="study-add-button" onClick={() => addRoom(level.id, onAddRoom)}>
                + Ajouter une pièce
              </button>
            </section>
          );
        })}

        {effectiveStudy.devices.some((device) => !device.levelId) && (
          <section className="study-level">
            <header>
              <h3>Non affecté</h3>
              <span>{effectiveStudy.devices.filter((device) => !device.levelId && device.status === 'placed').length}/{effectiveStudy.devices.filter((device) => !device.levelId).length}</span>
            </header>
            <div className="study-device-list">
              {getUnassignedStudyPlacementTargets(effectiveStudy).map((target) => (
                <StudyTargetButton
                  key={target.id}
                  study={effectiveStudy}
                  target={target}
                  octopuses={octopuses}
                  active={target.id === pendingPlacementDeviceId}
                  onSelect={onSelectTarget}
                  onChoose={(deviceId) => setEditingDeviceId(deviceId)}
                  onDissociate={onDissociateGroup}
                />
              ))}
            </div>
          </section>
        )}

        <button type="button" className="study-add-button primary" onClick={() => addLevel(onAddLevel)}>
          + Ajouter un niveau
        </button>
      </div>

      {editingDeviceId && (
        <StudyRepresentationDialog
          study={effectiveStudy}
          deviceId={editingDeviceId}
          onCancel={() => setEditingDeviceId(null)}
          onApply={(studyDeviceIds, drawingCatalogId) => {
            onConfigureRepresentation(studyDeviceIds, drawingCatalogId);
            setEditingDeviceId(null);
          }}
        />
      )}
    </aside>
  );
}

function formatLevelLabel(level: StudyLevel): string {
  return level.code ? `${level.code} : ${level.name}` : level.name;
}

function addLevel(onAddLevel: (name: string) => void): void {
  const name = window.prompt('Nom du niveau');
  if (name !== null) {
    onAddLevel(name);
  }
}

function renameLevel(level: StudyLevel, onRenameLevel: (levelId: string, name: string) => void): void {
  const name = window.prompt('Nouveau nom du niveau', level.name);
  if (name !== null) {
    onRenameLevel(level.id, name);
  }
}

function addRoom(levelId: string, onAddRoom: (levelId: string, name: string) => void): void {
  const name = window.prompt('Nom de la pièce');
  if (name !== null) {
    onAddRoom(levelId, name);
  }
}

function renameRoom(room: StudyRoom, onRenameRoom: (roomId: string, name: string) => void): void {
  const name = window.prompt('Nouveau nom de la pièce', room.name);
  if (name !== null) {
    onRenameRoom(room.id, name);
  }
}

function StudyTargetButton({
  study,
  target,
  octopuses,
  active,
  onSelect,
  onChoose,
  onDissociate,
}: {
  study: ImportedStudy;
  target: StudyPlacementTarget;
  octopuses: Octopus[];
  active: boolean;
  onSelect: (target: StudyPlacementTarget) => void;
  onChoose: (deviceId: string) => void;
  onDissociate: (physicalGroupId: string) => void;
}) {
  const drawingCatalogId = target.drawingCatalogId;
  const catalogLabel = drawingCatalogId ? getApparatusCatalogItem(drawingCatalogId).name : undefined;
  const isPlaced = target.status === 'placed';
  const primaryDevice = study.devices.find((device) => device.id === target.studyDeviceIds[0]);

  return (
    <div className={`study-device-row ${active ? 'active' : ''}`}>
      <button
        type="button"
        className={`study-device ${target.status}`}
        onClick={() => onSelect(target)}
      >
        <span>
          <strong>{target.identifiers.join(' + ')}</strong>
          {catalogLabel && <em>{catalogLabel}</em>}
        </span>
        <small>{isPlaced ? 'placé' : 'à placer'}</small>
      </button>
      <StudyTargetAssignments study={study} target={target} octopuses={octopuses} />
      {!isPlaced && primaryDevice?.type === 'apparatus' && (
        <button type="button" className="study-device-action" onClick={() => onChoose(primaryDevice.id)}>
          Choisir…
        </button>
      )}
      {!isPlaced && target.kind === 'group' && (
        <button type="button" className="study-device-action" onClick={() => onDissociate(target.id)}>
          Dissocier
        </button>
      )}
    </div>
  );
}

function StudyTargetAssignments({
  study,
  target,
  octopuses,
}: {
  study: ImportedStudy;
  target: StudyPlacementTarget;
  octopuses: Octopus[];
}) {
  const entries = target.studyDeviceIds.map((studyDeviceId) => {
    const device = study.devices.find((candidate) => candidate.id === studyDeviceId);
    const assignment = getStudyDevicePortAssignment(study, studyDeviceId);
    if (!device || !assignment) {
      return { device, label: 'Non affecté' };
    }

    const octopus = octopuses.find((candidate) => candidate.id === assignment.octopusId);
    return {
      device,
      label: `${octopus?.name ?? 'Pieuvre introuvable'} / Port ${assignment.portNumber}`,
    };
  });

  if (entries.length === 0) {
    return null;
  }

  if (entries.length === 1) {
    return <small className="study-assignment-line">→ {entries[0].label}</small>;
  }

  return (
    <div className="study-assignment-list">
      {entries.map(({ device, label }) => (
        <small key={device?.id ?? label}>
          {device?.identifier ?? device?.id ?? 'Référence'} → {label}
        </small>
      ))}
    </div>
  );
}

function StudyRepresentationDialog({
  study,
  deviceId,
  onCancel,
  onApply,
}: {
  study: ImportedStudy;
  deviceId: string;
  onCancel: () => void;
  onApply: (studyDeviceIds: string[], drawingCatalogId: ApparatusCatalogId) => void;
}) {
  const device = study.devices.find((candidate) => candidate.id === deviceId);
  const compatibleItems = useMemo(
    () => device ? getCompatibleCatalogItems(study, device) : [],
    [device, study],
  );
  const initialCatalogId = device ? getStudyDeviceDrawingCatalogId(device) ?? compatibleItems[0]?.id : undefined;
  const [drawingCatalogId, setDrawingCatalogId] = useState<ApparatusCatalogId | undefined>(initialCatalogId);
  const candidates = useMemo(
    () => device ? getCompatibleStudyDeviceCandidates(study, device) : [],
    [device, study],
  );
  const capacity = drawingCatalogId ? getCatalogGroupCapacity(drawingCatalogId) : 1;
  const secondaryCandidates = useMemo(
    () => device ? candidates.filter((candidate) => candidate.id !== device.id) : [],
    [candidates, device],
  );
  const [selectedSecondaryId, setSelectedSecondaryId] = useState<string>('');

  useEffect(() => {
    setDrawingCatalogId(initialCatalogId);
    setSelectedSecondaryId('');
  }, [device?.id, initialCatalogId]);

  useEffect(() => {
    if (!device || !drawingCatalogId) {
      return;
    }
    setSelectedSecondaryId((current) =>
      current && secondaryCandidates.some((candidate) => candidate.id === current) ? current : '',
    );
  }, [capacity, device, drawingCatalogId, secondaryCandidates]);

  if (!device || !drawingCatalogId) {
    return null;
  }

  const catalogLabel = getApparatusCatalogItem(drawingCatalogId).name;
  const selectedIds = capacity === 1
    ? [device.id]
    : selectedSecondaryId
      ? [device.id, selectedSecondaryId]
      : [device.id];
  const canApply = capacity === 1 || selectedIds.length === capacity;
  const noSecondaryCandidate = capacity > 1 && secondaryCandidates.length === 0;

  return (
    <div className="study-dialog-backdrop" role="presentation">
      <section className="study-dialog" role="dialog" aria-modal="true" aria-labelledby="study-dialog-title">
        <header>
          <h3 id="study-dialog-title">
            {capacity > 1 ? `Créer ${articleForCatalogName(catalogLabel)} ${catalogLabel}` : 'Choisir l’appareillage'}
          </h3>
          <button type="button" className="panel-close-button" onClick={onCancel} aria-label="Fermer">
            ×
          </button>
        </header>

        <label className="property-field">
          <span>Référence CDEF</span>
          <strong>{device.identifier ?? device.id}</strong>
        </label>

        <label className="property-field">
          <span>Appareillage</span>
          <select
            value={drawingCatalogId}
            onChange={(event) => setDrawingCatalogId(event.currentTarget.value as ApparatusCatalogId)}
          >
            {compatibleItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {capacity > 1 && (
          <section className="study-dialog-section">
            <h4>Référence principale</h4>
            <div className="study-primary-reference">
              <strong>{device.identifier ?? device.id}</strong>
            </div>
            <h4>Associer avec</h4>
            <div className="study-candidates">
              {secondaryCandidates.map((candidate) => (
                <label key={candidate.id}>
                  <input
                    type="radio"
                    name={`study-group-${device.id}`}
                    checked={selectedSecondaryId === candidate.id}
                    onChange={() => setSelectedSecondaryId(candidate.id)}
                  />
                  <span>{candidate.identifier ?? candidate.id}</span>
                </label>
              ))}
            </div>
            {noSecondaryCandidate && (
              <p className="study-dialog-message">
                Aucune autre {getStudyDeviceFamilyLabel(device)} disponible dans cette pièce pour créer {articleForCatalogName(catalogLabel)} {catalogLabel}.
              </p>
            )}
          </section>
        )}

        <footer>
          <button type="button" className="secondary-action" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="primary-action"
            disabled={!canApply}
            onClick={() => onApply(selectedIds, drawingCatalogId)}
          >
            {capacity > 1 ? 'Créer' : 'Valider'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function articleForCatalogName(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(name) ? 'un' : 'une';
}

function getStudyDeviceFamilyLabel(device: StudyDevice): string {
  const sourceType = device.sourceType ?? '';
  if (sourceType === 'PR') {
    return 'prise';
  }
  if (sourceType === 'IN') {
    return 'commande';
  }
  if (sourceType === 'LA') {
    return 'lampe';
  }

  return 'référence';
}
