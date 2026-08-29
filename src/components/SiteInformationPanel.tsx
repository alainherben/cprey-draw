import { useEffect, useState } from 'react';
import { getProjectStatusLabel, PROJECT_STATUS_OPTIONS } from '../domain/site';
import type { CpreyDrawProject, ProjectStatus, SiteInformation } from '../types/project';
import { fromSiteDraft, toSiteDraft, type SiteDraft } from './SiteInformationPanelModel';

interface SiteInformationPanelProps {
  project: CpreyDrawProject;
  onClose: () => void;
  onSave: (site: SiteInformation, status: ProjectStatus) => void;
}

export function SiteInformationPanel({ project, onClose, onSave }: SiteInformationPanelProps) {
  const [site, setSite] = useState<SiteDraft>(() => toSiteDraft(project.site));
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  useEffect(() => {
    setSite(toSiteDraft(project.site));
    setStatus(project.status);
  }, [project.site, project.status]);

  const updateField = (field: keyof SiteDraft, value: string) => {
    setSite((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    onSave(fromSiteDraft(site), status);
  };

  return (
    <div className="pdf-export-backdrop" role="presentation">
      <section className="site-information-panel" role="dialog" aria-modal="true" aria-labelledby="site-information-title">
        <header className="pdf-export-header">
          <div>
            <h2 id="site-information-title">Informations chantier</h2>
            <p>Fiche projet préparée pour le dossier chantier et le futur usage Web.</p>
          </div>
          <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="site-information-content">
          <fieldset>
            <legend>Chantier</legend>
            <TextField label="Nom" value={site.name} onChange={(value) => updateField('name', value)} />
            <TextField label="Référence" value={site.reference} onChange={(value) => updateField('reference', value)} />
            <TextField label="Référence devis" value={site.quoteReference} onChange={(value) => updateField('quoteReference', value)} />
            <TextField label="Version" value={site.projectVersion} onChange={(value) => updateField('projectVersion', value)} />
            <label className="pdf-export-field">
              <span>Statut</span>
              <select value={status} onChange={(event) => setStatus(event.currentTarget.value as ProjectStatus)}>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset>
            <legend>Client</legend>
            <TextField label="Nom" value={site.clientName} onChange={(value) => updateField('clientName', value)} />
            <TextField label="Téléphone" value={site.phone} onChange={(value) => updateField('phone', value)} />
            <TextField label="Email" value={site.email} onChange={(value) => updateField('email', value)} />
          </fieldset>

          <fieldset>
            <legend>Adresse</legend>
            <TextField label="Adresse" value={site.address} onChange={(value) => updateField('address', value)} />
            <TextField label="Code postal" value={site.postalCode} onChange={(value) => updateField('postalCode', value)} />
            <TextField label="Ville" value={site.city} onChange={(value) => updateField('city', value)} />
          </fieldset>

          <fieldset>
            <legend>Intervenants</legend>
            <TextField label="Constructeur" value={site.builder} onChange={(value) => updateField('builder', value)} />
            <TextField label="Électricien" value={site.electrician} onChange={(value) => updateField('electrician', value)} />
            <TextField label="Magasin / Distributeur" value={site.distributor} onChange={(value) => updateField('distributor', value)} />
          </fieldset>

          <fieldset>
            <legend>Origine</legend>
            <div className="site-readonly-grid">
              <span>Origine du projet</span>
              <strong>{project.origin.type === 'configurator' ? 'Configurateur' : 'Manuel'}</strong>
              {project.origin.type === 'configurator' && (
                <>
                  <span>Référence configurateur</span>
                  <strong>{project.origin.quoteId ?? site.quoteReference ?? 'Non renseignée'}</strong>
                  <span>Niveau</span>
                  <strong>{project.origin.configuratorSummary?.level ?? 'Non renseigné'}</strong>
                </>
              )}
              <span>Créé le</span>
              <strong>{formatIsoDate(project.audit.createdAt)}</strong>
              <span>Dernière modification</span>
              <strong>{formatIsoDate(project.audit.updatedAt)}</strong>
              <span>Statut actuel</span>
              <strong>{getProjectStatusLabel(project.status)}</strong>
            </div>
          </fieldset>

          <fieldset>
            <legend>Commentaires</legend>
            <label className="site-textarea-field">
              <span>Commentaires</span>
              <textarea value={site.comments ?? ''} onChange={(event) => updateField('comments', event.currentTarget.value)} />
            </label>
          </fieldset>
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="pdf-export-field">
      <span>{label}</span>
      <input type="text" value={value ?? ''} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  );
}

function formatIsoDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR');
}
