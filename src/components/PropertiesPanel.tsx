import { useEffect, useState } from 'react';
import {
  ADAPTER_COLOR_LABELS,
  CAP_COLOR_LABELS,
  getOctopusCatalogModel,
  WIRE_COLOR_LABELS,
} from '../catalog/octopuses';
import { getApparatusCatalogItem } from '../catalog/apparatus';
import {
  calculateDuctLengthStatus,
  calculateDuctUsedLengthMeters,
  getCircuitExpectedApparatusType,
  getApparatusCircuitContext,
  getDuctPathPoints,
  getDuctSourceOctopusOutput,
  getExpectedApparatusType,
  isPowerSupplyOutputDestination,
  LINK_COLOR_CSS,
} from '../domain/ducts';
import { OCTOPUS_MODELS } from '../domain/octopus';
import {
  CONFIGURABLE_OUTPUT_TYPES,
  createOctopusOutputOverride,
  DEFAULT_DESTINATION_BY_TYPE,
  generateNextOutputCode,
  getEffectiveOctopusOutputs,
  getOctopusOutputCounts,
  validateOctopusOutputOverride,
  type EffectiveOctopusOutput,
} from '../domain/octopusOutputs';
import type {
  ApparatusInstance,
  ConnectionTargetType,
  Duct,
  DuctConductor,
  DuctEndpoint,
  DuctSpecification,
  ElectricalPanel,
  Octopus,
  OctopusOutputOverride,
} from '../types/project';

type SelectedBusinessObject = ElectricalPanel | Octopus | ApparatusInstance;

type ElectricalPanelUpdates = Partial<
  Pick<
    ElectricalPanel,
    'name' | 'x' | 'y' | 'rotation' | 'rows' | 'reserveModules' | 'comments' | 'visible' | 'locked'
  >
>;

type OctopusUpdates = Partial<
  Pick<Octopus, 'name' | 'x' | 'y' | 'rotation' | 'comments' | 'visible' | 'locked' | 'displayScale' | 'outputOverrides'>
>;

type ApparatusUpdates = Partial<
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
>;

interface PropertiesPanelProps {
  selectedObject: SelectedBusinessObject | null;
  selectedDuct: Duct | null;
  selectedDuctControlId: string | null;
  octopuses: Octopus[];
  apparatus: ApparatusInstance[];
  electricalPanel: ElectricalPanel | undefined;
  ducts: Duct[];
  metersPerPixel: number | null;
  pendingConnectionOutput:
    | { kind: 'octopus-output'; octopusId: string; outputNumber: number; targetType: ConnectionTargetType }
    | { kind: 'apparatus-chain'; apparatusId: string }
    | null;
  onClose: () => void;
  onUpdateElectricalPanel: (updates: ElectricalPanelUpdates, label?: string) => void;
  onDeleteElectricalPanel: () => void;
  onUpdateOctopus: (octopusId: string, updates: OctopusUpdates, label?: string) => void;
  onUpdateOctopusOutputOverride: (octopusId: string, override: OctopusOutputOverride) => void;
  onResetOctopusOutputOverride: (octopusId: string, outputNumber: number) => void;
  onDeleteOctopus: (octopusId: string) => void;
  onUpdateApparatus: (apparatusId: string, updates: ApparatusUpdates, label?: string) => void;
  onDeleteApparatus: (apparatusId: string) => void;
  onStartConnection: (octopusId: string, outputNumber: number, targetType: ConnectionTargetType) => void;
  onStartApparatusConnection: (apparatusId: string) => void;
  onCreateDirectPanelConnection: (apparatusId: string) => void;
  onAddDuctWaypoint: (ductId: string) => void;
  onResetDuctControl: (ductId: string, controlId: string) => void;
  onUpdateDuctSpecification: (ductId: string, specification: DuctSpecification) => void;
  onDeleteDuct: (ductId: string) => void;
}

function formatDistance(valuePixels: number, metersPerPixel: number | null): string {
  if (metersPerPixel === null) {
    return `${valuePixels.toFixed(0)} px`;
  }

  return `${(valuePixels * metersPerPixel).toFixed(2)} m`;
}

function metersToPixels(valueMeters: number, metersPerPixel: number | null): number | null {
  return metersPerPixel === null ? null : valueMeters / metersPerPixel;
}

function outputSideLabel(outputNumber: number): string {
  if (outputNumber <= 4) {
    return 'Haut';
  }
  if (outputNumber <= 8) {
    return 'Droite';
  }
  if (outputNumber <= 12) {
    return 'Bas';
  }
  return 'Gauche';
}

function formatLengthMeters(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} m`;
}

function outputStateLabel(output: EffectiveOctopusOutput): string {
  if (output.state === 'custom') {
    return 'Personnalisée';
  }

  return output.state === 'standard' ? 'Standard' : 'Libre';
}

function adapterColorForDiameter(diameterMm: 16 | 20 | 25): 'yellow' | 'blue' {
  return diameterMm === 16 ? 'yellow' : 'blue';
}

function normalizeOverrideDraft(override: OctopusOutputOverride): OctopusOutputOverride {
  const diameterMm = [16, 20, 25].includes(override.duct.diameterMm) ? override.duct.diameterMm : 20;

  return {
    ...override,
    code: override.code.trim().toUpperCase(),
    destination: override.destination.trim(),
    duct: {
      ...override.duct,
      diameterMm,
      adapterColor: adapterColorForDiameter(diameterMm),
      capped: false,
      capColor: undefined,
      availableLengthMeters: Math.max(Number(override.duct.availableLengthMeters) || 0, 0),
    },
    conductors: override.conductors
      .filter((conductor) => conductor.function.trim() !== '')
      .map((conductor, index) => ({
        ...conductor,
        order: index + 1,
        quantity: Math.max(Math.round(Number(conductor.quantity)) || 1, 1),
      })),
  };
}

function endpointLabel(
  endpoint: DuctEndpoint,
  octopuses: Octopus[],
  apparatus: ApparatusInstance[],
  electricalPanel: ElectricalPanel | undefined,
): string {
  if (endpoint.type === 'octopus-output') {
    const octopus = octopuses.find((candidate) => candidate.id === endpoint.octopusId);
    return `${octopus?.name ?? 'Pieuvre introuvable'} / sortie ${endpoint.outputNumber}`;
  }

  if (endpoint.type === 'apparatus') {
    const targetApparatus = apparatus.find((candidate) => candidate.id === endpoint.id);
    const catalogItem = targetApparatus ? getApparatusCatalogItem(targetApparatus.catalogId) : null;
    return targetApparatus ? `${targetApparatus.identifier} — ${catalogItem?.name ?? targetApparatus.name}` : 'Appareillage introuvable';
  }

  return electricalPanel?.id === endpoint.id ? electricalPanel.name : 'Tableau introuvable';
}

function OutputDetail({ output }: { output: EffectiveOctopusOutput }) {
  const isFree = output.state === 'free';
  const expectedType = getExpectedApparatusType(output.code);

  return (
    <div className="output-detail">
      <h4>
        Sortie {output.outputNumber} — {output.code}
      </h4>
      <dl>
        <div>
          <dt>État</dt>
          <dd>{outputStateLabel(output)}</dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>{output.destination}</dd>
        </div>
        {!isFree && !isPowerSupplyOutputDestination(output.destination) && (
          <div>
            <dt>Type attendu</dt>
            <dd>{expectedType ?? 'Non raccordable à un appareillage'}</dd>
          </div>
        )}
        <div>
          <dt>Gaine</dt>
          <dd>{isFree ? 'Non installée' : `Ø ${output.duct.diameterMm} mm`}</dd>
        </div>
        <div>
          <dt>Adaptateur</dt>
          <dd>{ADAPTER_COLOR_LABELS[output.duct.adapterColor]}</dd>
        </div>
        {output.duct.capped && output.duct.capColor && (
          <div>
            <dt>Bouchon</dt>
            <dd>{CAP_COLOR_LABELS[output.duct.capColor]}</dd>
          </div>
        )}
        {!isFree && (
          <>
            <div>
              <dt>Longueur disponible</dt>
              <dd>{formatLengthMeters(output.duct.lengthMeters)}</dd>
            </div>
            <div>
              <dt>Couleur liaison</dt>
              <dd>{output.linkColor}</dd>
            </div>
          </>
        )}
      </dl>

      {output.conductors.length > 0 && (
        <div className="conductors-section">
          <h5>Conducteurs</h5>
          <div className="conductors-list">
            {output.conductors.map((conductor) => (
              <div key={conductor.order}>
                <strong>{conductor.order}</strong>
                <span>{conductor.function}</span>
                <span>{WIRE_COLOR_LABELS[conductor.color as keyof typeof WIRE_COLOR_LABELS] ?? conductor.color}</span>
                <span>{conductor.sectionMm2.toString().replace('.', ',')} mm²</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PropertiesPanel({
  selectedObject,
  selectedDuct,
  selectedDuctControlId,
  octopuses,
  apparatus,
  electricalPanel,
  ducts,
  metersPerPixel,
  pendingConnectionOutput,
  onClose,
  onUpdateElectricalPanel,
  onDeleteElectricalPanel,
  onUpdateOctopus,
  onUpdateOctopusOutputOverride,
  onResetOctopusOutputOverride,
  onDeleteOctopus,
  onUpdateApparatus,
  onDeleteApparatus,
  onStartConnection,
  onStartApparatusConnection,
  onCreateDirectPanelConnection,
  onAddDuctWaypoint,
  onResetDuctControl,
  onUpdateDuctSpecification,
  onDeleteDuct,
}: PropertiesPanelProps) {
  const [draftName, setDraftName] = useState('');
  const [draftComments, setDraftComments] = useState('');
  const [draftIdentifier, setDraftIdentifier] = useState('');
  const [draftRows, setDraftRows] = useState('3');
  const [draftReserveModules, setDraftReserveModules] = useState('0');
  const [draftDisplayScalePercent, setDraftDisplayScalePercent] = useState('100');
  const [selectedOutputNumber, setSelectedOutputNumber] = useState(1);
  const [overrideDraft, setOverrideDraft] = useState<OctopusOutputOverride | null>(null);
  const [overrideError, setOverrideError] = useState('');
  const [ductDiameterDraft, setDuctDiameterDraft] = useState('20');
  const [ductAvailableLengthDraft, setDuctAvailableLengthDraft] = useState('0');
  const [ductLinkColorDraft, setDuctLinkColorDraft] = useState('Noir');
  const [ductContentDescriptionDraft, setDuctContentDescriptionDraft] = useState('');
  const [ductConductorDrafts, setDuctConductorDrafts] = useState<DuctConductor[]>([]);
  const [ductSpecificationError, setDuctSpecificationError] = useState('');

  useEffect(() => {
    setDraftName(selectedObject?.name ?? '');
    setDraftIdentifier(selectedObject?.type === 'apparatus' ? selectedObject.identifier : '');
    setDraftComments(selectedObject?.comments ?? '');
    setDraftRows(selectedObject?.type === 'electrical-panel' ? String(selectedObject.rows) : '3');
    setDraftReserveModules(
      selectedObject?.type === 'electrical-panel' ? String(selectedObject.reserveModules) : '0',
    );
    setDraftDisplayScalePercent(
      selectedObject?.type === 'octopus' || selectedObject?.type === 'apparatus'
        ? String(Math.round((selectedObject.displayScale ?? 1) * 100))
        : '100',
    );
  }, [
    selectedObject?.comments,
    selectedObject?.id,
    selectedObject?.name,
    selectedObject?.type === 'apparatus' ? selectedObject.identifier : undefined,
    selectedObject?.type,
    selectedObject?.type === 'octopus' || selectedObject?.type === 'apparatus'
      ? selectedObject.displayScale
      : undefined,
    selectedObject?.type === 'electrical-panel' ? selectedObject.reserveModules : undefined,
    selectedObject?.type === 'electrical-panel' ? selectedObject.rows : undefined,
  ]);

  useEffect(() => {
    setSelectedOutputNumber(1);
    setOverrideDraft(null);
    setOverrideError('');
  }, [selectedObject?.id]);

  useEffect(() => {
    setDuctDiameterDraft(String(selectedDuct?.specification.diameterMm ?? 20));
    setDuctAvailableLengthDraft(String(selectedDuct?.specification.availableLengthMeters ?? 0));
    setDuctLinkColorDraft(selectedDuct?.specification.linkColor ?? 'Noir');
    setDuctContentDescriptionDraft(selectedDuct?.specification.contentDescription ?? '');
    setDuctConductorDrafts(selectedDuct?.specification.conductors.map((conductor) => ({ ...conductor })) ?? []);
    setDuctSpecificationError('');
  }, [
    selectedDuct?.id,
    selectedDuct?.specification.availableLengthMeters,
    selectedDuct?.specification.contentDescription,
    selectedDuct?.specification.diameterMm,
    selectedDuct?.specification.linkColor,
    selectedDuct?.specification.conductors,
  ]);

  if (!selectedObject && !selectedDuct) {
    return null;
  }

  if (selectedDuct) {
    const isDirectPanelDuct = selectedDuct.source.type === 'electrical-panel' && selectedDuct.target.type === 'apparatus';
    const sourceOctopusOutput = getDuctSourceOctopusOutput(selectedDuct);
    const circuitOriginLabel =
      selectedDuct.circuitOrigin.type === 'octopus-output'
        ? endpointLabel(selectedDuct.circuitOrigin, octopuses, apparatus, electricalPanel)
        : endpointLabel({ type: 'electrical-panel', id: selectedDuct.circuitOrigin.id }, octopuses, apparatus, electricalPanel);
    const ductPathPoints = getDuctPathPoints(selectedDuct, octopuses, apparatus, electricalPanel, metersPerPixel);
    const usedLengthMeters = calculateDuctUsedLengthMeters(ductPathPoints, metersPerPixel, selectedDuct.controls);
    const lengthStatus = calculateDuctLengthStatus(
      selectedDuct.specification.availableLengthMeters,
      usedLengthMeters,
    );
    const saveDirectDuctSpecification = () => {
      const diameterMm = Number(ductDiameterDraft);
      const availableLengthMeters = Number(ductAvailableLengthDraft);
      if (![16, 20, 25].includes(diameterMm)) {
        setDuctSpecificationError('Diamètre invalide.');
        return;
      }
      if (!Number.isFinite(availableLengthMeters) || availableLengthMeters < 0) {
        setDuctSpecificationError('Longueur disponible positive ou nulle obligatoire.');
        return;
      }
      if (!ductLinkColorDraft.trim()) {
        setDuctSpecificationError('Couleur de liaison obligatoire.');
        return;
      }

      const conductors = ductConductorDrafts.map((conductor, index) => ({
        ...conductor,
        order: index + 1,
      }));
      for (const conductor of conductors) {
        if (!Number.isInteger(conductor.quantity) || conductor.quantity <= 0) {
          setDuctSpecificationError('Quantité conducteur invalide.');
          return;
        }
        if (!conductor.color.trim()) {
          setDuctSpecificationError('Couleur conducteur obligatoire.');
          return;
        }
        if (!conductor.function.trim()) {
          setDuctSpecificationError('Fonction conducteur obligatoire.');
          return;
        }
        if (![1.5, 2.5, 6].includes(conductor.sectionMm2)) {
          setDuctSpecificationError('Section conducteur invalide.');
          return;
        }
      }

      setDuctSpecificationError('');
      onUpdateDuctSpecification(selectedDuct.id, {
        ...selectedDuct.specification,
        diameterMm: diameterMm as 16 | 20 | 25,
        availableLengthMeters,
        linkColor: ductLinkColorDraft.trim(),
        contentDescription: ductContentDescriptionDraft.trim() || undefined,
        conductors,
      });
    };

    return (
      <aside className="properties-panel" aria-label="Propriétés de la gaine sélectionnée">
        <div className="properties-header">
          <h2>Gaine</h2>
          <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer le panneau">
            ×
          </button>
        </div>

        <div className="readonly-properties single">
          <div>
            <span>Origine du circuit</span>
            <strong>{circuitOriginLabel}</strong>
          </div>
          <div>
            <span>De</span>
            <strong>{endpointLabel(selectedDuct.source, octopuses, apparatus, electricalPanel)}</strong>
          </div>
          <div>
            <span>Vers</span>
            <strong>{endpointLabel(selectedDuct.target, octopuses, apparatus, electricalPanel)}</strong>
          </div>
          {sourceOctopusOutput && (
            <div>
              <span>Sortie</span>
              <strong>{sourceOctopusOutput.outputNumber}</strong>
            </div>
          )}
          <div>
            <span>Code sortie</span>
            <strong>{selectedDuct.specification.outputCode}</strong>
          </div>
          <div>
            <span>Destination</span>
            <strong>{selectedDuct.specification.destination}</strong>
          </div>
          <div>
            <span>Diamètre</span>
            <strong>{selectedDuct.specification.diameterMm ? `${selectedDuct.specification.diameterMm} mm` : 'Non renseigné'}</strong>
          </div>
          {selectedDuct.specification.adapterColor && (
            <div>
              <span>Adaptateur</span>
              <strong>{ADAPTER_COLOR_LABELS[selectedDuct.specification.adapterColor as keyof typeof ADAPTER_COLOR_LABELS] ?? selectedDuct.specification.adapterColor}</strong>
            </div>
          )}
          <div>
            <span>Longueur disponible</span>
            <strong>
              {selectedDuct.specification.availableLengthMeters > 0
                ? formatLengthMeters(selectedDuct.specification.availableLengthMeters)
                : 'Non renseignée'}
            </strong>
          </div>
          <div>
            <span>Longueur utilisée</span>
            <strong>{usedLengthMeters === null ? 'Échelle requise' : formatLengthMeters(usedLengthMeters)}</strong>
          </div>
          {selectedDuct.specification.availableLengthMeters > 0 && (
            <div>
              <span>{lengthStatus.hasOverrun ? 'DÉPASSEMENT' : 'Longueur restante'}</span>
              <strong className={lengthStatus.hasOverrun ? 'length-overrun' : undefined}>
                {lengthStatus.remainingLengthMeters === null
                  ? 'Échelle requise'
                  : formatLengthMeters(lengthStatus.hasOverrun ? lengthStatus.overrunMeters : lengthStatus.remainingLengthMeters)}
              </strong>
            </div>
          )}
          <div>
            <span>Couleur liaison</span>
            <strong>{selectedDuct.specification.linkColor}</strong>
          </div>
          {selectedDuct.specification.contentDescription && (
            <div>
              <span>Contenu</span>
              <strong>{selectedDuct.specification.contentDescription}</strong>
            </div>
          )}
          <div>
            <span>Courbes</span>
            <strong>{selectedDuct.waypoints.length + 1}</strong>
          </div>
          <div>
            <span>Points intermédiaires</span>
            <strong>{selectedDuct.waypoints.length}</strong>
          </div>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={selectedDuct.locked}
          onClick={() => onAddDuctWaypoint(selectedDuct.id)}
        >
          Ajouter un point
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={selectedDuct.locked || selectedDuctControlId === null}
          onClick={() => {
            if (selectedDuctControlId) {
              onResetDuctControl(selectedDuct.id, selectedDuctControlId);
            }
          }}
        >
          Réinitialiser la courbe
        </button>

        {isDirectPanelDuct && (
          <div className="duct-specification-editor">
            <h5>Spécification de la gaine</h5>
            <label className="property-field">
              <span>Diamètre de gaine</span>
              <select
                value={ductDiameterDraft}
                disabled={selectedDuct.locked}
                onChange={(event) => setDuctDiameterDraft(event.currentTarget.value)}
              >
                <option value="16">16 mm</option>
                <option value="20">20 mm</option>
                <option value="25">25 mm</option>
              </select>
            </label>
            <label className="property-field">
              <span>Longueur disponible (m)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={ductAvailableLengthDraft}
                disabled={selectedDuct.locked}
                onChange={(event) => setDuctAvailableLengthDraft(event.currentTarget.value)}
              />
            </label>
            <label className="property-field">
              <span>Couleur liaison</span>
              <select
                value={ductLinkColorDraft}
                disabled={selectedDuct.locked}
                onChange={(event) => setDuctLinkColorDraft(event.currentTarget.value)}
              >
                {Object.keys(LINK_COLOR_CSS).map((color) => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </label>
            <label className="property-field">
              <span>Description du contenu</span>
              <input
                value={ductContentDescriptionDraft}
                disabled={selectedDuct.locked}
                placeholder="Ex. Câble RJ45"
                onChange={(event) => setDuctContentDescriptionDraft(event.currentTarget.value)}
              />
            </label>

            <div className="conductors-editor">
              <div className="section-heading-row">
                <h5>Conducteurs / contenu électrique</h5>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={selectedDuct.locked}
                  onClick={() => {
                    setDuctConductorDrafts((current) => [
                      ...current,
                      {
                        order: current.length + 1,
                        quantity: 1,
                        function: '',
                        color: '',
                        sectionMm2: 1.5,
                      },
                    ]);
                  }}
                >
                  Ajouter
                </button>
              </div>
              {ductConductorDrafts.length === 0 && (
                <p className="connection-action-note">Aucun conducteur électrique renseigné.</p>
              )}
              {ductConductorDrafts.map((conductor, index) => (
                <div className="duct-conductor-editor-row" key={`${conductor.order}-${index}`}>
                  <input
                    type="number"
                    min="1"
                    value={conductor.quantity}
                    disabled={selectedDuct.locked}
                    title="Quantité"
                    onChange={(event) => {
                      const quantity = Math.max(1, Math.round(Number(event.currentTarget.value) || 1));
                      setDuctConductorDrafts((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity } : item),
                      );
                    }}
                  />
                  <input
                    value={conductor.function}
                    disabled={selectedDuct.locked}
                    placeholder="Fonction"
                    onChange={(event) => {
                      const nextFunction = event.currentTarget.value;
                      setDuctConductorDrafts((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, function: nextFunction } : item),
                      );
                    }}
                  />
                  <input
                    value={conductor.color}
                    disabled={selectedDuct.locked}
                    placeholder="Couleur"
                    onChange={(event) => {
                      const color = event.currentTarget.value;
                      setDuctConductorDrafts((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, color } : item),
                      );
                    }}
                  />
                  <select
                    value={String(conductor.sectionMm2)}
                    disabled={selectedDuct.locked}
                    onChange={(event) => {
                      const sectionMm2 = Number(event.currentTarget.value) as 1.5 | 2.5 | 6;
                      setDuctConductorDrafts((current) =>
                        current.map((item, itemIndex) => itemIndex === index ? { ...item, sectionMm2 } : item),
                      );
                    }}
                  >
                    <option value="1.5">1,5</option>
                    <option value="2.5">2,5</option>
                    <option value="6">6</option>
                  </select>
                  <button
                    type="button"
                    className="small-icon-button"
                    disabled={selectedDuct.locked}
                    onClick={() => setDuctConductorDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label="Supprimer ce conducteur"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {ductSpecificationError && <p className="form-error">{ductSpecificationError}</p>}
            <button
              type="button"
              className="secondary-button"
              disabled={selectedDuct.locked}
              onClick={saveDirectDuctSpecification}
            >
              Enregistrer la spécification
            </button>
          </div>
        )}

        {selectedDuct.specification.conductors.length > 0 && (
          <div className="conductors-section">
            <h5>Conducteurs</h5>
            <div className="conductors-list">
              {selectedDuct.specification.conductors.map((conductor) => (
                <div key={conductor.order}>
                  <strong>{conductor.order}</strong>
                  <span>{conductor.function}</span>
                  <span>{WIRE_COLOR_LABELS[conductor.color as keyof typeof WIRE_COLOR_LABELS] ?? conductor.color}</span>
                  <span>{conductor.sectionMm2.toString().replace('.', ',')} mm²</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="checkbox-field">
          <input type="checkbox" checked={selectedDuct.visible} readOnly />
          <span>Visible</span>
        </label>

        <button
          type="button"
          className="danger-button"
          disabled={selectedDuct.locked}
          onClick={() => onDeleteDuct(selectedDuct.id)}
        >
          Supprimer la gaine
        </button>
      </aside>
    );
  }

  if (!selectedObject) {
    return null;
  }

  const locked = selectedObject.locked;
  const xMeters = metersPerPixel === null ? '' : (selectedObject.x * metersPerPixel).toFixed(2);
  const yMeters = metersPerPixel === null ? '' : (selectedObject.y * metersPerPixel).toFixed(2);

  const updateSelectedObject = (
    updates: ElectricalPanelUpdates | OctopusUpdates | ApparatusUpdates,
    label?: string,
  ) => {
    if (selectedObject.type === 'electrical-panel') {
      onUpdateElectricalPanel(updates as ElectricalPanelUpdates, label);
      return;
    }

    if (selectedObject.type === 'octopus') {
      onUpdateOctopus(selectedObject.id, updates as OctopusUpdates, label);
      return;
    }

    onUpdateApparatus(selectedObject.id, updates as ApparatusUpdates, label);
  };

  const commitName = () => {
    const fallback =
      selectedObject.type === 'electrical-panel'
        ? 'Tableau principal'
        : selectedObject.type === 'octopus'
          ? 'Pieuvre'
          : getApparatusCatalogItem(selectedObject.catalogId).name;
    const name = draftName.trim() || fallback;
    setDraftName(name);
    if (name !== selectedObject.name) {
      updateSelectedObject({ name }, 'Renommer l’objet');
    }
  };

  const commitIdentifier = () => {
    if (selectedObject.type !== 'apparatus') {
      return;
    }

    const identifier = draftIdentifier.trim().toUpperCase() || selectedObject.identifier;
    setDraftIdentifier(identifier);
    if (identifier !== selectedObject.identifier) {
      onUpdateApparatus(selectedObject.id, { identifier }, 'Modifier le repère');
    }
  };

  const commitRows = () => {
    if (selectedObject.type !== 'electrical-panel') {
      return;
    }

    const rows = Math.round(Number(draftRows));
    if (!Number.isFinite(rows)) {
      setDraftRows(String(selectedObject.rows));
      return;
    }

    const nextRows = Math.min(Math.max(rows, 1), 10);
    setDraftRows(String(nextRows));
    if (nextRows !== selectedObject.rows) {
      onUpdateElectricalPanel({ rows: nextRows }, 'Modifier les rangées du tableau');
    }
  };

  const commitReserveModules = () => {
    if (selectedObject.type !== 'electrical-panel') {
      return;
    }

    const reserveModules = Math.round(Number(draftReserveModules));
    if (!Number.isFinite(reserveModules)) {
      setDraftReserveModules(String(selectedObject.reserveModules));
      return;
    }

    const nextReserveModules = Math.max(reserveModules, 0);
    setDraftReserveModules(String(nextReserveModules));
    if (nextReserveModules !== selectedObject.reserveModules) {
      onUpdateElectricalPanel(
        { reserveModules: nextReserveModules },
        'Modifier la réserve du tableau',
      );
    }
  };

  const commitDisplayScale = () => {
    if (selectedObject.type !== 'octopus' && selectedObject.type !== 'apparatus') {
      return;
    }

    const percent = Math.round(Number(draftDisplayScalePercent));
    if (!Number.isFinite(percent)) {
      setDraftDisplayScalePercent(String(Math.round(selectedObject.displayScale * 100)));
      return;
    }

    const maxPercent = selectedObject.type === 'apparatus' ? 800 : 300;
    const nextPercent = Math.min(Math.max(percent, 50), maxPercent);
    const nextDisplayScale = nextPercent / 100;
    setDraftDisplayScalePercent(String(nextPercent));
    if (nextDisplayScale !== selectedObject.displayScale) {
      updateSelectedObject({ displayScale: nextDisplayScale }, "Modifier la taille d'affichage");
    }
  };

  const octopusCatalogModel =
    selectedObject.type === 'octopus' ? getOctopusCatalogModel(selectedObject.modelId) : null;
  const effectiveOutputs = selectedObject.type === 'octopus'
    ? getEffectiveOctopusOutputs(selectedObject)
    : [];
  const octopusOutputCounts = selectedObject.type === 'octopus'
    ? getOctopusOutputCounts(selectedObject)
    : null;
  const apparatusCatalogItem =
    selectedObject.type === 'apparatus' ? getApparatusCatalogItem(selectedObject.catalogId) : null;
  const selectedOutput =
    effectiveOutputs.find((output) => output.outputNumber === selectedOutputNumber) ??
    effectiveOutputs[0] ??
    null;
  const incomingApparatusDuct =
    selectedObject.type === 'apparatus'
      ? ducts.find((duct) => duct.target.type === 'apparatus' && duct.target.id === selectedObject.id)
      : undefined;
  const apparatusCircuitContext =
    selectedObject.type === 'apparatus'
      ? getApparatusCircuitContext(
          {
            schemaVersion: 1,
            project: { id: '', name: '', updatedAt: '' },
            drawing: {
              viewport: { x: 0, y: 0, scale: 1 },
              metersPerPixel,
              scaleReference: null,
              scaleMarkerVisible: true,
              zoomWheelEnabled: true,
              movementLocked: false,
              apparatusGlobalScale: 1,
            },
            plans: [],
            electricalPanel,
            octopuses,
            apparatus,
            ducts,
            layers: [],
          },
          selectedObject.id,
        )
      : null;
  const hasOutgoingApparatusDuct =
    selectedObject.type === 'apparatus'
      ? ducts.some((duct) => duct.source.type === 'apparatus' && duct.source.id === selectedObject.id)
      : false;

  return (
    <aside
      className={`properties-panel ${selectedObject.type === 'octopus' ? 'octopus-properties-panel' : ''}`}
      aria-label="Propriétés de l'objet sélectionné"
    >
      <div className="properties-header">
        <h2>
          {selectedObject.type === 'electrical-panel'
            ? 'Tableau électrique'
            : selectedObject.type === 'octopus'
              ? 'Pieuvre'
              : 'Appareillage'}
        </h2>
        <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer le panneau">
          ×
        </button>
      </div>

      <label className="property-field">
        <span>Nom</span>
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.currentTarget.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
      </label>

      {selectedObject.type === 'octopus' && (
        <div className="readonly-properties single">
          <div>
            <span>Modèle</span>
            <strong>{OCTOPUS_MODELS[selectedObject.modelId].label}</strong>
          </div>
          <div>
            <span>Catalogue</span>
            <strong>
              v{selectedObject.catalogVersion} r{selectedObject.catalogRevision}
            </strong>
          </div>
        </div>
      )}

      {selectedObject.type === 'apparatus' && apparatusCatalogItem && (
        <div className="readonly-properties single">
          <div>
            <span>Catalogue</span>
            <strong>{apparatusCatalogItem.id}</strong>
          </div>
          {apparatusCircuitContext && (
            <>
              <div>
                <span>Pieuvre</span>
                <strong>{apparatusCircuitContext.octopusName}</strong>
              </div>
              <div>
                <span>Circuit</span>
                <strong>{apparatusCircuitContext.label}</strong>
              </div>
            </>
          )}
          <div>
            <span>Type catalogue</span>
            <strong>{apparatusCatalogItem.name}</strong>
          </div>
          <div>
            <span>Révision</span>
            <strong>
              v{selectedObject.catalogVersion} r{selectedObject.catalogRevision}
            </strong>
          </div>
          <div>
            <span>Catégorie</span>
            <strong>{apparatusCatalogItem.category}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>{apparatusCatalogItem.type}</strong>
          </div>
          <div>
            <span>Hauteur</span>
            <strong>{Math.round(apparatusCatalogItem.defaultHeightMeters * 100)} cm</strong>
          </div>
          <div>
            <span>Référence hauteur</span>
            <strong>{apparatusCatalogItem.heightReference}</strong>
          </div>
          <div>
            <span>Alimentation directe</span>
            <strong>{apparatusCatalogItem.directSupply ? 'Oui' : 'Non'}</strong>
          </div>
        </div>
      )}

      {selectedObject.type === 'apparatus' && (
        <label className="property-field">
          <span>Repère</span>
          <input
            value={draftIdentifier}
            onChange={(event) => setDraftIdentifier(event.currentTarget.value)}
            onBlur={commitIdentifier}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
          />
        </label>
      )}

      <div className="property-grid">
        <label className="property-field">
          <span>Position X</span>
          <input
            type="number"
            step="0.01"
            value={xMeters}
            disabled={metersPerPixel === null || locked}
            onChange={(event) => {
              const pixels = metersToPixels(Number(event.currentTarget.value), metersPerPixel);
              if (pixels !== null && Number.isFinite(pixels)) {
                updateSelectedObject({ x: pixels }, 'Modifier la position');
              }
            }}
          />
        </label>

        <label className="property-field">
          <span>Position Y</span>
          <input
            type="number"
            step="0.01"
            value={yMeters}
            disabled={metersPerPixel === null || locked}
            onChange={(event) => {
              const pixels = metersToPixels(Number(event.currentTarget.value), metersPerPixel);
              if (pixels !== null && Number.isFinite(pixels)) {
                updateSelectedObject({ y: pixels }, 'Modifier la position');
              }
            }}
          />
        </label>
      </div>

      <label className="property-field">
        <span>Rotation</span>
        <input
          type="number"
          step="1"
          value={selectedObject.rotation}
          disabled={locked}
          onChange={(event) => {
            const rotation = Number(event.currentTarget.value);
            if (Number.isFinite(rotation)) {
              updateSelectedObject({ rotation }, 'Modifier la rotation');
            }
          }}
        />
      </label>

      <div className="readonly-properties">
        {selectedObject.type !== 'apparatus' && (
          <>
            <div>
              <span>Largeur</span>
              <strong>{selectedObject.type === 'electrical-panel' ? '25 cm' : '20 cm'}</strong>
            </div>
            <div>
              <span>{selectedObject.type === 'electrical-panel' ? 'Profondeur' : 'Hauteur'}</span>
              <strong>{selectedObject.type === 'electrical-panel' ? '10 cm' : '20 cm'}</strong>
            </div>
          </>
        )}
        <div>
          <span>X document</span>
          <strong>{formatDistance(selectedObject.x, metersPerPixel)}</strong>
        </div>
        <div>
          <span>Y document</span>
          <strong>{formatDistance(selectedObject.y, metersPerPixel)}</strong>
        </div>
      </div>

      {selectedObject.type === 'electrical-panel' && (
        <div className="property-grid">
          <label className="property-field">
            <span>Rangées</span>
            <input
              type="number"
              min="1"
              max="10"
              step="1"
              inputMode="numeric"
              value={draftRows}
              onChange={(event) => setDraftRows(event.currentTarget.value)}
              onBlur={commitRows}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>

          <label className="property-field">
            <span>Réserve</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={draftReserveModules}
              onChange={(event) => setDraftReserveModules(event.currentTarget.value)}
              onBlur={commitReserveModules}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        </div>
      )}

      {(selectedObject.type === 'octopus' || selectedObject.type === 'apparatus') && (
        <label className="property-field">
          <span>Taille d’affichage</span>
          <div className="range-input-row">
            <input
              type="range"
              min="50"
              max={selectedObject.type === 'apparatus' ? '800' : '300'}
              step="5"
              value={draftDisplayScalePercent}
              disabled={locked}
              onChange={(event) => setDraftDisplayScalePercent(event.currentTarget.value)}
              onBlur={commitDisplayScale}
            />
            <input
              type="number"
              min="50"
              max={selectedObject.type === 'apparatus' ? '800' : '300'}
              step="5"
              inputMode="numeric"
              value={draftDisplayScalePercent}
              disabled={locked}
              onChange={(event) => setDraftDisplayScalePercent(event.currentTarget.value)}
              onBlur={commitDisplayScale}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
            />
            <span>%</span>
          </div>
        </label>
      )}

      {selectedObject.type === 'apparatus' && (
        <>
          <section className="property-section">
            <h3>Repère</h3>
            <div className="radio-group">
              {[
                ['right', 'Droite'],
                ['left', 'Gauche'],
                ['top', 'Haut'],
                ['bottom', 'Bas'],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="apparatus-label-position"
                    value={value}
                    checked={selectedObject.labelPosition === value}
                    onChange={() =>
                      updateSelectedObject(
                        { labelPosition: value as ApparatusInstance['labelPosition'] },
                        'Modifier la position du repère',
                      )
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <label className="property-field">
            <span>Taille police repère</span>
            <input
              type="number"
              min="8"
              max="24"
              step="1"
              inputMode="numeric"
              value={selectedObject.labelFontSize}
              onChange={(event) => {
                const labelFontSize = Math.round(Number(event.currentTarget.value));
                if (Number.isFinite(labelFontSize)) {
                  updateSelectedObject(
                    { labelFontSize: Math.min(Math.max(labelFontSize, 8), 24) },
                    'Modifier la taille du repère',
                  );
                }
              }}
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={selectedObject.connected}
              onChange={() =>
                updateSelectedObject(
                  { connected: !selectedObject.connected },
                  selectedObject.connected ? 'Déconnecter l’appareillage' : 'Connecter l’appareillage',
                )
              }
            />
            <span>Connecté</span>
          </label>

          {incomingApparatusDuct && (
            <section className="property-section">
              <h3>Circuit</h3>
              <div className="readonly-properties single">
                <div>
                  <span>Origine</span>
                  <strong>{incomingApparatusDuct.specification.outputCode}</strong>
                </div>
                <div>
                  <span>Type circuit</span>
                  <strong>{getCircuitExpectedApparatusType(incomingApparatusDuct) ?? '—'}</strong>
                </div>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={selectedObject.locked || hasOutgoingApparatusDuct}
                onClick={() => onStartApparatusConnection(selectedObject.id)}
              >
                {hasOutgoingApparatusDuct ? 'Circuit déjà prolongé' : 'Prolonger le circuit'}
              </button>
            </section>
          )}

          {apparatusCatalogItem?.directSupply && !incomingApparatusDuct && (
            <button
              type="button"
              className="secondary-button"
              disabled={selectedObject.locked}
              onClick={() => onCreateDirectPanelConnection(selectedObject.id)}
            >
              Raccorder au tableau
            </button>
          )}
        </>
      )}

      <label className="property-field">
        <span>Commentaires</span>
        <textarea
          value={draftComments}
          rows={4}
          onChange={(event) => setDraftComments(event.currentTarget.value)}
          onBlur={() => {
            if (draftComments !== selectedObject.comments) {
              updateSelectedObject({ comments: draftComments }, 'Modifier les commentaires');
            }
          }}
        />
      </label>

      {selectedObject.type === 'octopus' && octopusCatalogModel && selectedOutput && (
        <section className="ports-section">
          <h3>Sorties</h3>
          {octopusOutputCounts && (
            <div className="readonly-properties single compact">
              <div>
                <span>Sorties standard</span>
                <strong>{octopusOutputCounts.standard}</strong>
              </div>
              <div>
                <span>Sorties personnalisées</span>
                <strong>{octopusOutputCounts.custom}</strong>
              </div>
              <div>
                <span>Sorties libres</span>
                <strong>{octopusOutputCounts.free}</strong>
              </div>
            </div>
          )}
          <div className="outputs-list">
            {effectiveOutputs.map((output) => (
              <button
                key={output.outputNumber}
                type="button"
                className={`output-row ${output.outputNumber === selectedOutput.outputNumber ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedOutputNumber(output.outputNumber);
                  setOverrideDraft(null);
                  setOverrideError('');
                }}
              >
                <strong>{output.outputNumber}</strong>
                <span>{output.code}</span>
                <span>{output.destination}</span>
                <small>
                  {output.state !== 'free' && !isPowerSupplyOutputDestination(output.destination)
                    ? `Type ${getExpectedApparatusType(output.code) ?? '—'}`
                    : ''}
                </small>
                <em className={`state-pill ${output.state}`}>{outputStateLabel(output)}</em>
              </button>
            ))}
          </div>
          <OutputDetail output={selectedOutput} />
          <OctopusOutputOverrideEditor
            octopus={selectedObject}
            output={selectedOutput}
            ducts={ducts}
            draft={overrideDraft}
            error={overrideError}
            onDraftChange={(draft) => {
              setOverrideDraft(draft);
              setOverrideError('');
            }}
            onStartConfiguration={() => {
              setOverrideDraft(
                selectedOutput.override ??
                  createOctopusOutputOverride(selectedObject, selectedOutput.outputNumber, 'LA'),
              );
              setOverrideError('');
            }}
            onSave={(draft) => {
              const normalizedDraft = normalizeOverrideDraft(draft);
              const errors = validateOctopusOutputOverride(selectedObject, normalizedDraft);
              if (errors.length > 0) {
                setOverrideError(errors[0]);
                return;
              }
              onUpdateOctopusOutputOverride(selectedObject.id, normalizedDraft);
              setOverrideDraft(null);
              setOverrideError('');
            }}
            onReset={() => {
              onResetOctopusOutputOverride(selectedObject.id, selectedOutput.outputNumber);
              setOverrideDraft(null);
              setOverrideError('');
            }}
          />
          <ConnectionOutputAction
            output={selectedOutput}
            octopusId={selectedObject.id}
            ducts={ducts}
            pendingConnectionOutput={pendingConnectionOutput}
            onStartConnection={onStartConnection}
          />

          <h3>Ports</h3>
          <div className="ports-list">
            {selectedObject.ports.map((port) => (
              <div key={port.number}>
                <strong>{port.number}</strong>
                <span>{outputSideLabel(port.number)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={selectedObject.visible}
          onChange={() =>
            updateSelectedObject(
              { visible: !selectedObject.visible },
              selectedObject.visible ? 'Masquer l’objet' : 'Afficher l’objet',
            )
          }
        />
        <span>Visible</span>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={selectedObject.locked}
          onChange={() =>
            updateSelectedObject(
              { locked: !selectedObject.locked },
              selectedObject.locked ? 'Déverrouiller l’objet' : 'Verrouiller l’objet',
            )
          }
        />
        <span>Verrouillé</span>
      </label>

      <button
        type="button"
        className="danger-button"
        onClick={() => {
          if (selectedObject.type === 'electrical-panel') {
            onDeleteElectricalPanel();
          } else if (selectedObject.type === 'octopus') {
            onDeleteOctopus(selectedObject.id);
          } else {
            onDeleteApparatus(selectedObject.id);
          }
        }}
      >
        {selectedObject.type === 'electrical-panel'
          ? 'Supprimer le tableau'
          : selectedObject.type === 'octopus'
            ? 'Supprimer la pieuvre'
            : "Supprimer l'appareillage"}
      </button>
    </aside>
  );
}

function ConnectionOutputAction({
  output,
  octopusId,
  ducts,
  pendingConnectionOutput,
  onStartConnection,
}: {
  output: EffectiveOctopusOutput;
  octopusId: string;
  ducts: Duct[];
  pendingConnectionOutput:
    | { kind: 'octopus-output'; octopusId: string; outputNumber: number; targetType: ConnectionTargetType }
    | { kind: 'apparatus-chain'; apparatusId: string }
    | null;
  onStartConnection: (octopusId: string, outputNumber: number, targetType: ConnectionTargetType) => void;
}) {
  const existingDuct = ducts.find(
    (duct) =>
      duct.source.type === 'octopus-output' &&
      duct.source.octopusId === octopusId &&
      duct.source.outputNumber === output.outputNumber,
  );
  const isPending =
    pendingConnectionOutput?.kind === 'octopus-output' &&
    pendingConnectionOutput.octopusId === octopusId &&
    pendingConnectionOutput.outputNumber === output.outputNumber;

  if (output.state === 'free') {
    return (
      <div className="connection-action-note">
        Sortie libre — configurez cette sortie pour la raccorder.
      </div>
    );
  }

  if (existingDuct) {
    return <div className="connection-action-note">Sortie déjà raccordée.</div>;
  }

  const targetType: ConnectionTargetType = isPowerSupplyOutputDestination(output.destination)
    ? 'electrical-panel'
    : 'apparatus';

  return (
    <button
      type="button"
      className="secondary-button"
      onClick={() => onStartConnection(octopusId, output.outputNumber, targetType)}
    >
      {isPending
        ? targetType === 'electrical-panel'
          ? 'Sélectionnez le tableau…'
          : 'Sélectionnez un appareillage…'
        : 'Connecter'}
    </button>
  );
}

function OctopusOutputOverrideEditor({
  octopus,
  output,
  ducts,
  draft,
  error,
  onDraftChange,
  onStartConfiguration,
  onSave,
  onReset,
}: {
  octopus: Octopus;
  output: EffectiveOctopusOutput;
  ducts: Duct[];
  draft: OctopusOutputOverride | null;
  error: string;
  onDraftChange: (draft: OctopusOutputOverride) => void;
  onStartConfiguration: () => void;
  onSave: (draft: OctopusOutputOverride) => void;
  onReset: () => void;
}) {
  const isCatalogFree = output.catalogOutput.state === 'free';
  const existingDuct = ducts.find(
    (duct) =>
      duct.source.type === 'octopus-output' &&
      duct.source.octopusId === octopus.id &&
      duct.source.outputNumber === output.outputNumber,
  );

  if (!isCatalogFree) {
    return null;
  }

  if (existingDuct) {
    return (
      <div className="connection-action-note">
        Supprimer la liaison avant de modifier cette sortie.
      </div>
    );
  }

  if (!draft && output.state !== 'custom') {
    return (
      <button type="button" className="secondary-button" onClick={onStartConfiguration}>
        Configurer cette sortie
      </button>
    );
  }

  const currentDraft = draft ?? output.override;
  if (!currentDraft) {
    return null;
  }

  const updateDraft = (updates: Partial<OctopusOutputOverride>) => {
    onDraftChange({ ...currentDraft, ...updates });
  };
  const updateDuct = (updates: Partial<OctopusOutputOverride['duct']>) => {
    onDraftChange({ ...currentDraft, duct: { ...currentDraft.duct, ...updates } });
  };

  return (
    <section className="property-section output-override-editor">
      <h3>Personnalisation</h3>
      {error && <div className="form-error">{error}</div>}

      <label className="property-field">
        <span>Type</span>
        <select
          value={currentDraft.type}
          onChange={(event) => {
            const type = event.currentTarget.value as OctopusOutputOverride['type'];
            updateDraft({
              type,
              code: generateNextOutputCode(octopus, type),
              destination: DEFAULT_DESTINATION_BY_TYPE[type],
            });
          }}
        >
          {CONFIGURABLE_OUTPUT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="property-field">
        <span>Code</span>
        <input
          value={currentDraft.code}
          onChange={(event) => updateDraft({ code: event.currentTarget.value.toUpperCase() })}
        />
      </label>

      <label className="property-field">
        <span>Destination</span>
        <input
          value={currentDraft.destination}
          onChange={(event) => updateDraft({ destination: event.currentTarget.value })}
        />
      </label>

      <div className="property-grid">
        <label className="property-field">
          <span>Diamètre</span>
          <select
            value={currentDraft.duct.diameterMm}
            onChange={(event) => {
              const diameterMm = Number(event.currentTarget.value) as 16 | 20;
              updateDuct({
                diameterMm,
                adapterColor: adapterColorForDiameter(diameterMm),
                capped: false,
                capColor: undefined,
              });
            }}
          >
            <option value={16}>16 mm</option>
            <option value={20}>20 mm</option>
          </select>
        </label>

        <label className="property-field">
          <span>Longueur disponible</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={currentDraft.duct.availableLengthMeters}
            onChange={(event) =>
              updateDuct({ availableLengthMeters: Math.max(Number(event.currentTarget.value), 0) })
            }
          />
        </label>
      </div>

      <div className="readonly-properties single compact">
        <div>
          <span>Adaptateur</span>
          <strong>{ADAPTER_COLOR_LABELS[currentDraft.duct.adapterColor]}</strong>
        </div>
        <div>
          <span>Ø25</span>
          <strong>Adaptateur à définir</strong>
        </div>
        <div>
          <span>Bouchon</span>
          <strong>Aucun</strong>
        </div>
      </div>

      <label className="property-field">
        <span>Couleur liaison</span>
        <select
          value={currentDraft.linkColor}
          onChange={(event) => updateDraft({ linkColor: event.currentTarget.value })}
        >
          {Object.keys(LINK_COLOR_CSS).map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </label>

      <div className="conductors-section">
        <h5>Conducteurs</h5>
        <div className="conductors-editor">
          {currentDraft.conductors.map((conductor, index) => (
            <div key={conductor.order} className="conductor-editor-row">
              <input
                type="number"
                min="1"
                value={conductor.quantity}
                aria-label="Quantité conducteur"
                onChange={(event) => {
                  const conductors = currentDraft.conductors.map((candidate, candidateIndex) =>
                    candidateIndex === index
                      ? { ...candidate, quantity: Math.max(Math.round(Number(event.currentTarget.value)), 1) }
                      : candidate,
                  );
                  updateDraft({ conductors });
                }}
              />
              <input
                value={conductor.function}
                aria-label="Fonction conducteur"
                onChange={(event) => {
                  const conductors = currentDraft.conductors.map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, function: event.currentTarget.value } : candidate,
                  );
                  updateDraft({ conductors });
                }}
              />
              <input
                value={conductor.color}
                aria-label="Couleur conducteur"
                onChange={(event) => {
                  const conductors = currentDraft.conductors.map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, color: event.currentTarget.value } : candidate,
                  );
                  updateDraft({ conductors });
                }}
              />
              <select
                value={conductor.sectionMm2}
                aria-label="Section conducteur"
                onChange={(event) => {
                  const sectionMm2 = Number(event.currentTarget.value) as 1.5 | 2.5 | 6;
                  const conductors = currentDraft.conductors.map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, sectionMm2 } : candidate,
                  );
                  updateDraft({ conductors });
                }}
              >
                <option value={1.5}>1,5</option>
                <option value={2.5}>2,5</option>
                <option value={6}>6</option>
              </select>
              <button
                type="button"
                className="small-icon-button"
                aria-label="Supprimer le conducteur"
                onClick={() =>
                  updateDraft({
                    conductors: currentDraft.conductors.filter((_, candidateIndex) => candidateIndex !== index),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            updateDraft({
              conductors: [
                ...currentDraft.conductors,
                {
                  order: currentDraft.conductors.length + 1,
                  quantity: 1,
                  function: 'Conducteur',
                  color: 'Rouge',
                  sectionMm2: 1.5,
                },
              ],
            })
          }
        >
          Ajouter un conducteur
        </button>
      </div>

      <button type="button" className="secondary-button" onClick={() => onSave(currentDraft)}>
        Enregistrer la configuration
      </button>
      {output.state === 'custom' && (
        <button type="button" className="danger-button" onClick={onReset}>
          Réinitialiser en sortie libre
        </button>
      )}
    </section>
  );
}
