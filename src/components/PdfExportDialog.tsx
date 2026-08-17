import { useEffect, useState } from 'react';
import { DEFAULT_PDF_EXPORT_OPTIONS, type PdfExportOptions } from '../export/pdf/PdfTypes';

interface PdfExportDialogProps {
  isOpen: boolean;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
  onExport: (options: PdfExportOptions) => void;
}

export function PdfExportDialog({
  isOpen,
  isGenerating,
  error,
  onClose,
  onExport,
}: PdfExportDialogProps) {
  const [options, setOptions] = useState<PdfExportOptions>(DEFAULT_PDF_EXPORT_OPTIONS);

  useEffect(() => {
    if (isOpen) {
      setOptions(DEFAULT_PDF_EXPORT_OPTIONS);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pdf-export-backdrop" role="presentation">
      <section className="pdf-export-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-export-title">
        <header className="pdf-export-header">
          <div>
            <h2 id="pdf-export-title">Exporter le dossier chantier</h2>
            <p>PDF couleur, structuré depuis les données du projet.</p>
          </div>
          <button type="button" className="panel-close-button" onClick={onClose} disabled={isGenerating} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="pdf-export-content">
          <fieldset>
            <legend>Contenu</legend>
            <Checkbox label="Page de couverture" checked={options.includeCover} onChange={(value) => setOptions({ ...options, includeCover: value })} />
            <Checkbox label="Plan général" checked={options.includeGeneralPlan} onChange={(value) => setOptions({ ...options, includeGeneralPlan: value })} />
            <Checkbox label="Plans par pieuvre" checked={options.includeOctopusPlans} onChange={(value) => setOptions({ ...options, includeOctopusPlans: value })} />
            <Checkbox label="Nomenclature" checked={options.includeNomenclature} onChange={(value) => setOptions({ ...options, includeNomenclature: value })} />
            <Checkbox label="Contrôles" checked={options.includeValidation} onChange={(value) => setOptions({ ...options, includeValidation: value })} />
            <Checkbox label="Réserves" checked={options.includeReserves} onChange={(value) => setOptions({ ...options, includeReserves: value })} />
            <Checkbox label="Appareillages" checked={options.includeApparatus} onChange={(value) => setOptions({ ...options, includeApparatus: value })} />
          </fieldset>

          <fieldset>
            <legend>Format</legend>
            <label className="pdf-export-field">
              <span>Papier</span>
              <select
                value={options.paperFormat}
                onChange={(event) => setOptions({ ...options, paperFormat: event.currentTarget.value as PdfExportOptions['paperFormat'] })}
              >
                <option value="a3">A3</option>
                <option value="a4">A4</option>
              </select>
            </label>
            <label className="pdf-export-field">
              <span>Orientation</span>
              <select
                value={options.orientation}
                onChange={(event) => setOptions({ ...options, orientation: event.currentTarget.value as PdfExportOptions['orientation'] })}
              >
                <option value="landscape">Paysage</option>
                <option value="portrait">Portrait</option>
              </select>
            </label>
            <Checkbox
              label="Exporter uniquement les calques actuellement visibles"
              checked={options.visibleLayersOnly}
              onChange={(value) => setOptions({ ...options, visibleLayersOnly: value })}
            />
          </fieldset>

          <fieldset>
            <legend>Affichage des plans</legend>
            <Checkbox
              label="Longueurs sur le plan général"
              checked={options.showDuctLengthsGeneralPlan}
              onChange={(value) => setOptions({ ...options, showDuctLengthsGeneralPlan: value })}
            />
            <Checkbox
              label="Longueurs sur les plans par pieuvre"
              checked={options.showDuctLengthsOctopusPlans}
              onChange={(value) => setOptions({ ...options, showDuctLengthsOctopusPlans: value })}
            />
          </fieldset>
        </div>

        {error && <p className="pdf-export-error">{error}</p>}

        <footer className="pdf-export-actions">
          {isGenerating && (
            <span className="pdf-export-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              Génération du PDF...
            </span>
          )}
          <button type="button" className="secondary-button" onClick={onClose} disabled={isGenerating}>
            Annuler
          </button>
          <button type="button" className="primary-button" onClick={() => onExport(options)} disabled={isGenerating}>
            Exporter
          </button>
        </footer>
      </section>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="pdf-export-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
