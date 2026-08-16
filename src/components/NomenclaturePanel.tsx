import type { ReactNode } from 'react';
import type { ProjectNomenclature } from '../domain/bom';

interface NomenclaturePanelProps {
  nomenclature: ProjectNomenclature;
  onClose: () => void;
}

export function NomenclaturePanel({ nomenclature, onClose }: NomenclaturePanelProps) {
  return (
    <div className="nomenclature-backdrop" role="dialog" aria-modal="true" aria-label="Nomenclature du chantier">
      <aside className="nomenclature-panel">
        <header className="nomenclature-header">
          <div>
            <h2>Nomenclature</h2>
            <p>Données recalculées depuis le projet courant</p>
          </div>
          <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer la nomenclature">
            ×
          </button>
        </header>

        <div className="nomenclature-content">
          <NomenclatureSection title="Résumé">
            <div className="nomenclature-grid">
              <NomenclatureStat label="Pieuvres" value={nomenclature.summary.octopusCount} />
              <NomenclatureStat label="Appareillages" value={nomenclature.summary.apparatusCount} />
              <NomenclatureStat label="Gaines" value={nomenclature.summary.ductCount} />
              <NomenclatureStat label="Longueur posée" value={formatLength(nomenclature.summary.totalUsedDuctLengthMeters)} />
            </div>
          </NomenclatureSection>

          <NomenclatureSection title="Pieuvres">
            <SimpleTable
              headers={['Modèle', 'Quantité']}
              rows={nomenclature.octopuses.byModel.map((item) => [item.label, item.count.toString()])}
              empty="Aucune pieuvre"
            />
            <div className="nomenclature-cards">
              {nomenclature.octopuses.details.map((octopus) => (
                <article key={octopus.id} className="nomenclature-card">
                  <h3>{octopus.name}</h3>
                  <p>{octopus.modelName}</p>
                  <dl>
                    <dt>Sorties standard utilisées</dt>
                    <dd>{octopus.standardUsed}</dd>
                    <dt>Sorties personnalisées</dt>
                    <dd>{octopus.customOutputs.length}</dd>
                    <dt>Sorties libres restantes</dt>
                    <dd>{octopus.freeRemaining}</dd>
                  </dl>
                  {octopus.customOutputs.length > 0 && (
                    <SimpleTable
                      headers={['Sortie', 'Code', 'Destination', 'Gaine']}
                      rows={octopus.customOutputs.map((output) => [
                        output.outputNumber.toString(),
                        output.code,
                        output.destination,
                        `Ø${output.diameterMm} / ${formatLength(output.availableLengthMeters)}`,
                      ])}
                    />
                  )}
                </article>
              ))}
            </div>
          </NomenclatureSection>

          <NomenclatureSection title="Appareillages">
            <h3>Par référence</h3>
            <SimpleTable
              headers={['Référence', 'Quantité']}
              rows={nomenclature.apparatus.byCatalog.map((item) => [item.label, item.count.toString()])}
              empty="Aucun appareillage"
            />
            <h3>Par TYPE</h3>
            <SimpleTable
              headers={['TYPE', 'Quantité']}
              rows={nomenclature.apparatus.byType.map((item) => [item.label, item.count.toString()])}
              empty="Aucun appareillage"
            />
          </NomenclatureSection>

          <NomenclatureSection title="Gaines">
            <SimpleTable
              headers={['Diamètre', 'Disponible', 'Utilisée', 'Restante']}
              rows={nomenclature.ducts.byDiameter.map((item) => [
                `Ø${item.diameterMm}`,
                formatLength(item.availableLengthMeters),
                formatLength(item.usedLengthMeters),
                formatLength(item.remainingLengthMeters),
              ])}
              empty="Aucune gaine avec diamètre connu"
            />
            {nomenclature.ducts.directUnspecified.length > 0 && (
              <>
                <h3>Liaisons directes sans spécification</h3>
                <SimpleTable
                  headers={['Appareillage', 'Longueur']}
                  rows={nomenclature.ducts.directUnspecified.map((item) => [
                    item.apparatusLabel,
                    item.usedLengthMeters === null ? 'Non calculable' : formatLength(item.usedLengthMeters),
                  ])}
                />
              </>
            )}
          </NomenclatureSection>

          <NomenclatureSection title="Conducteurs">
            <SimpleTable
              headers={['Couleur', 'Section', 'Longueur']}
              rows={nomenclature.conductors.map((item) => [
                item.color,
                `${formatSection(item.sectionMm2)} mm²`,
                formatLength(item.lengthMeters),
              ])}
              empty="Aucun conducteur spécifié"
            />
          </NomenclatureSection>

          <NomenclatureSection title="Adaptateurs / bouchons">
            <SimpleTable
              headers={['Adaptateur', 'Diamètre', 'Quantité']}
              rows={nomenclature.adapters.map((item) => [
                adapterLabel(item.adapterColor),
                `Ø${item.diameterMm}`,
                item.count.toString(),
              ])}
              empty="Aucun adaptateur installé"
            />
            <SimpleTable
              headers={['Bouchon', 'Quantité']}
              rows={nomenclature.caps.map((item) => [capLabel(item.capColor), item.count.toString()])}
              empty="Aucun bouchon libre"
            />
          </NomenclatureSection>

          <NomenclatureSection title="Réserves">
            <SimpleTable
              headers={['Pieuvre', 'Sorties libres']}
              rows={nomenclature.reserves.map((item) => [item.octopusName, item.freeOutputs.toString()])}
              empty="Aucune réserve"
            />
          </NomenclatureSection>

          <NomenclatureSection title="Dépassements">
            <SimpleTable
              headers={['Gaine', 'Disponible', 'Utilisée', 'Dépassement']}
              rows={nomenclature.ducts.overruns.map((item) => [
                item.label,
                formatLength(item.availableLengthMeters),
                formatLength(item.usedLengthMeters),
                formatLength(item.overrunMeters),
              ])}
              empty="Aucun dépassement"
              rowClassName="danger-row"
            />
          </NomenclatureSection>

          <NomenclatureSection title="Non raccordés">
            <h3>Appareillages</h3>
            <SimpleTable
              headers={['Repère', 'Référence']}
              rows={nomenclature.apparatus.unconnected.map((item) => [item.identifier, item.catalogName])}
              empty="Tous les appareillages sont raccordés"
            />
            <h3>Sorties standard non raccordées</h3>
            <SimpleTable
              headers={['Pieuvre', 'Sortie', 'Code', 'Destination']}
              rows={nomenclature.unconnectedStandardOutputs.map((item) => [
                item.octopusName,
                item.outputNumber.toString(),
                item.code,
                item.destination,
              ])}
              empty="Aucune sortie standard non raccordée"
            />
          </NomenclatureSection>
        </div>
      </aside>
    </div>
  );
}

function NomenclatureSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="nomenclature-section" open>
      <summary>{title}</summary>
      <div className="nomenclature-section-body">{children}</div>
    </details>
  );
}

function NomenclatureStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="nomenclature-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
  rowClassName,
}: {
  headers: string[];
  rows: string[][];
  empty?: string;
  rowClassName?: string;
}) {
  if (rows.length === 0) {
    return <p className="nomenclature-empty">{empty ?? 'Aucune donnée'}</p>;
  }

  return (
    <div className="nomenclature-table-wrap">
      <table className="nomenclature-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.join('|')}-${rowIndex}`} className={rowClassName}>
              {row.map((cell, cellIndex) => (
                <td key={`${cell}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatLength(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} m`;
}

function formatSection(value: number): string {
  return value.toString().replace('.', ',');
}

function adapterLabel(value: string): string {
  if (value === 'yellow') {
    return 'Jaune';
  }
  if (value === 'blue') {
    return 'Bleu';
  }
  return value;
}

function capLabel(value: string): string {
  return value === 'white' ? 'Blanc' : value;
}
