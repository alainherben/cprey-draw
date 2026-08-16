import type { ProjectIssue, ProjectValidationResult, ValidationSeverity } from '../domain/projectValidation';

interface ValidationPanelProps {
  result: ProjectValidationResult;
  onClose: () => void;
  onLocateIssue: (issue: ProjectIssue) => void;
}

export function ValidationPanel({ result, onClose, onLocateIssue }: ValidationPanelProps) {
  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.filter((issue) => issue.severity === 'warning');
  const infos = result.issues.filter((issue) => issue.severity === 'info');

  return (
    <div className="validation-backdrop" role="dialog" aria-modal="true" aria-label="Contrôles du projet">
      <aside className="validation-panel">
        <header className="validation-header">
          <div>
            <h2>Contrôles du projet</h2>
            <p>{result.isValid ? 'Projet cohérent' : 'Des erreurs doivent être corrigées'}</p>
          </div>
          <button type="button" className="panel-close-button" onClick={onClose} aria-label="Fermer les contrôles">
            ×
          </button>
        </header>

        <div className="validation-summary">
          <ValidationCounter severity="error" label="Erreurs" count={result.errorCount} />
          <ValidationCounter severity="warning" label="Avertissements" count={result.warningCount} />
          <ValidationCounter severity="info" label="Informations" count={result.infoCount} />
        </div>

        <div className="validation-content">
          <IssueSection title="Erreurs" issues={errors} empty="Aucune erreur" onLocateIssue={onLocateIssue} />
          <IssueSection title="Avertissements" issues={warnings} empty="Aucun avertissement" onLocateIssue={onLocateIssue} />
          <IssueSection title="Informations" issues={infos} empty="Aucune information" onLocateIssue={onLocateIssue} />
        </div>
      </aside>
    </div>
  );
}

function ValidationCounter({
  severity,
  label,
  count,
}: {
  severity: ValidationSeverity;
  label: string;
  count: number;
}) {
  return (
    <div className={`validation-counter ${severity}`}>
      <span>{label}</span>
      <strong>{count}</strong>
    </div>
  );
}

function IssueSection({
  title,
  issues,
  empty,
  onLocateIssue,
}: {
  title: string;
  issues: ProjectIssue[];
  empty: string;
  onLocateIssue: (issue: ProjectIssue) => void;
}) {
  return (
    <details className="validation-section" open={issues.length > 0}>
      <summary>{title}</summary>
      <div className="validation-section-body">
        {issues.length === 0 && <p className="validation-empty">{empty}</p>}
        {issues.map((issue) => (
          <article key={issue.id} className={`validation-issue ${issue.severity}`}>
            <div>
              <span className={`validation-badge ${issue.severity}`}>{severityLabel(issue.severity)}</span>
              <h3>{issue.title}</h3>
              <p>{issue.message}</p>
              <small>{issue.code}</small>
            </div>
            <button type="button" className="secondary-button" onClick={() => onLocateIssue(issue)}>
              Localiser
            </button>
          </article>
        ))}
      </div>
    </details>
  );
}

function severityLabel(severity: ValidationSeverity): string {
  if (severity === 'error') {
    return 'Erreur';
  }
  if (severity === 'warning') {
    return 'Avertissement';
  }
  return 'Info';
}
