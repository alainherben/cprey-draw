import type { CpreyDrawProject } from '../types/project';
import { deserializeProject, serializeProject } from './ProjectStorage';

export interface ServerProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ServerProjectRepositoryOptions {
  endpoint?: string;
  sessionEndpoint?: string;
  fetchImpl?: typeof fetch;
}

export class ServerProjectRepository {
  private readonly endpoint: string;
  private readonly sessionEndpoint: string;
  private readonly fetchImpl: typeof fetch;
  private csrfToken: string | null = null;

  constructor(options: ServerProjectRepositoryOptions = {}) {
    this.endpoint = options.endpoint ?? '/CPREY-DRAW/api/projects.php';
    this.sessionEndpoint =
      options.sessionEndpoint ?? '/CPREY-DRAW/api/session.php';
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    const response = await this.fetchImpl(this.sessionEndpoint, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Impossible de récupérer la session CPREY DRAW.');
    }

    const payload = await response.json();

    if (
      !payload ||
      payload.ok !== true ||
      payload.authenticated !== true ||
      payload.authorized !== true ||
      typeof payload.csrfToken !== 'string' ||
      payload.csrfToken.length === 0
    ) {
      throw new Error('Token CSRF CPREY DRAW invalide.');
    }

    const csrfToken = payload.csrfToken;
    this.csrfToken = csrfToken;

    return csrfToken;
  }

  async list(): Promise<ServerProjectSummary[]> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Impossible de charger la liste des projets serveur.');
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true || !Array.isArray(payload.projects)) {
      throw new Error('Réponse serveur invalide.');
    }

    return payload.projects;
  }

  async load(projectId: string): Promise<CpreyDrawProject> {
    const url = `${this.endpoint}?id=${encodeURIComponent(projectId)}`;

    const response = await this.fetchImpl(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Impossible de charger le projet serveur.');
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true || typeof payload.project !== 'string') {
      throw new Error('Réponse projet serveur invalide.');
    }

    return deserializeProject(payload.project);
  }

  async save(project: CpreyDrawProject): Promise<void> {
    const csrfToken = await this.getCsrfToken();

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        project: serializeProject(project),
      }),
    });

    if (!response.ok) {
      throw new Error('Impossible d’enregistrer le projet sur le serveur.');
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true) {
      throw new Error('Réponse d’enregistrement serveur invalide.');
    }
  }

  async delete(projectId: string): Promise<void> {
    const csrfToken = await this.getCsrfToken();
    const url = `${this.endpoint}?id=${encodeURIComponent(projectId)}`;

    const response = await this.fetchImpl(url, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
    });

    if (!response.ok) {
      throw new Error('Impossible de supprimer le projet serveur.');
    }

    const payload = await response.json();

    if (!payload || payload.ok !== true) {
      throw new Error('Réponse de suppression serveur invalide.');
    }
  }
}
