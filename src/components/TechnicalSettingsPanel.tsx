import { useEffect, useState } from 'react';
import { normalizeTechnicalSettings } from '../domain/technicalSettings';
import type { CpreyDrawProject, ProjectTechnicalSettings } from '../types/project';

interface TechnicalSettingsPanelProps {
  project: CpreyDrawProject;
  onClose: () => void;
  onSave: (settings: ProjectTechnicalSettings) => void;
}

type TechnicalSettingsDraft = Record<keyof Omit<ProjectTechnicalSettings, 'roomCeilingHeights'>, string> & {
  roomCeilingHeights: Record<string, string>;
};

export function TechnicalSettingsPanel({ project, onClose, onSave }: TechnicalSettingsPanelProps) {
  const [draft, setDraft] = useState<TechnicalSettingsDraft>(() => toDraft(project.technicalSettings));
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(toDraft(project.technicalSettings));
    setError('');
  }, [project.technicalSettings]);

  const updateNumber = (field: keyof Omit<ProjectTechnicalSettings, 'roomCeilingHeights'>, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateRoomHeight = (roomId: string, value: string) => {
    setDraft((current) => ({
      ...current,
      roomCeilingHeights: {
        ...current.roomCeilingHeights,
        [roomId]: value,
      },
    }));
  };

  const handleSave = () => {
    const parsed = parseDraft(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError('');
    onSave(parsed.settings);
  };

  const generalHeight = parseDisplayNumber(draft.defaultCeilingHeight);

  return (
    <div className="pdf-export-backdrop" role="presentation">
      <section className="site-information-panel technical-settings-panel" role="dialog" aria-modal="true" aria-labelledby="technical-settings-title">
        <header className="pdf-export-header">
          <div>
            <h2 id="technical-settings-title">Paramètres techniques</h2>
          </div>
          <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="site-information-content">
          <fieldset>
            <legend>Bâtiment</legend>
            <NumberField
              label="Hauteur de plafond générale"
              value={draft.defaultCeilingHeight}
              onChange={(value) => updateNumber('defaultCeilingHeight', value)}
            />
          </fieldset>

          <fieldset>
            <legend>Tableau électrique</legend>
            <NumberField
              label="Hauteur centre tableau depuis le sol"
              value={draft.panelCenterHeightFromFloor}
              onChange={(value) => updateNumber('panelCenterHeightFromFloor', value)}
            />
          </fieldset>

          <fieldset>
            <legend>Gaines</legend>
            <NumberField
              label="Marge de gaine pour raccordement"
              value={draft.ductConnectionMargin}
              onChange={(value) => updateNumber('ductConnectionMargin', value)}
            />
            <NumberField
              label="Hauteur du vide sanitaire"
              value={draft.crawlSpaceHeight}
              onChange={(value) => updateNumber('crawlSpaceHeight', value)}
            />
          </fieldset>

          <fieldset>
            <legend>Pièces</legend>
            {!project.study && <p className="connection-action-note">Aucune étude importée associée au projet.</p>}
            {project.study?.levels.map((level) => (
              <div className="technical-room-group" key={level.id}>
                <h4>{level.code ? `${level.code} : ${level.name}` : level.name}</h4>
                {level.rooms.length === 0 && <p className="connection-action-note">Aucune pièce sur ce niveau.</p>}
                {level.rooms.map((room) => (
                  <label className="pdf-export-field technical-room-field" key={room.id}>
                    <span>{room.name}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={`Défaut : ${formatMeters(generalHeight)}`}
                      value={draft.roomCeilingHeights[room.id] ?? ''}
                      onChange={(event) => updateRoomHeight(room.id, event.currentTarget.value)}
                    />
                    <span>m</span>
                  </label>
                ))}
              </div>
            ))}
          </fieldset>

          {error && <p className="form-error">{error}</p>}
        </div>

        <footer className="pdf-export-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            Enregistrer
          </button>
        </footer>
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="pdf-export-field technical-number-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <span>m</span>
    </label>
  );
}

function toDraft(settings: ProjectTechnicalSettings): TechnicalSettingsDraft {
  const normalized = normalizeTechnicalSettings(settings);
  return {
    defaultCeilingHeight: formatDraftNumber(normalized.defaultCeilingHeight),
    panelCenterHeightFromFloor: formatDraftNumber(normalized.panelCenterHeightFromFloor),
    ductConnectionMargin: formatDraftNumber(normalized.ductConnectionMargin),
    crawlSpaceHeight: formatDraftNumber(normalized.crawlSpaceHeight),
    roomCeilingHeights: Object.fromEntries(
      Object.entries(normalized.roomCeilingHeights ?? {}).map(([roomId, height]) => [roomId, formatDraftNumber(height)]),
    ),
  };
}

function parseDraft(draft: TechnicalSettingsDraft):
  | { ok: true; settings: ProjectTechnicalSettings }
  | { ok: false; error: string } {
  const defaultCeilingHeight = parseRequiredNumber(draft.defaultCeilingHeight);
  const panelCenterHeightFromFloor = parseRequiredNumber(draft.panelCenterHeightFromFloor);
  const ductConnectionMargin = parseRequiredNumber(draft.ductConnectionMargin);
  const crawlSpaceHeight = parseRequiredNumber(draft.crawlSpaceHeight);
  if (
    defaultCeilingHeight === null ||
    panelCenterHeightFromFloor === null ||
    ductConnectionMargin === null ||
    crawlSpaceHeight === null
  ) {
    return { ok: false, error: 'Les valeurs techniques doivent être des nombres positifs ou nuls.' };
  }

  const roomCeilingHeights: Record<string, number> = {};
  for (const [roomId, value] of Object.entries(draft.roomCeilingHeights)) {
    if (value.trim() === '') {
      continue;
    }
    const height = parseRequiredNumber(value);
    if (height === null) {
      return { ok: false, error: 'Les hauteurs par pièce doivent être des nombres positifs ou nuls.' };
    }
    roomCeilingHeights[roomId] = height;
  }

  return {
    ok: true,
    settings: {
      defaultCeilingHeight,
      panelCenterHeightFromFloor,
      ductConnectionMargin,
      crawlSpaceHeight,
      roomCeilingHeights,
    },
  };
}

function parseRequiredNumber(value: string): number | null {
  const number = parseDisplayNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function parseDisplayNumber(value: string): number | null {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function formatDraftNumber(value: number): string {
  return value.toFixed(2);
}

function formatMeters(value: number | null): string {
  return value === null ? '' : `${value.toFixed(2).replace('.', ',')} m`;
}
