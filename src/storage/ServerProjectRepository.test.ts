import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultProject } from './ProjectStorage';
import { ServerProjectRepository } from './ServerProjectRepository';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function sessionResponse(): Response {
  return jsonResponse({
    ok: true,
    authenticated: true,
    authorized: true,
    application: 'cprey_draw',
    user: {
      siteId: 8,
      codeSite: '00015',
      name: 'AH Hauterives',
      email: 'test@example.com',
      application: 'cprey_draw',
    },
    csrfToken: 'csrf-test-token',
  });
}

test('lists server projects', async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse({
      ok: true,
      projects: [
        {
          id: 'project-1',
          name: 'Maison Dupont',
          updatedAt: '2026-09-01T12:00:00.000Z',
        },
      ],
    });

  const repository = new ServerProjectRepository({ fetchImpl });
  const projects = await repository.list();

  assert.deepEqual(projects, [
    {
      id: 'project-1',
      name: 'Maison Dupont',
      updatedAt: '2026-09-01T12:00:00.000Z',
    },
  ]);
});

test('loads and normalizes a server project', async () => {
  const project = createDefaultProject();
  project.project.name = 'Projet serveur';

  const fetchImpl: typeof fetch = async () =>
    jsonResponse({
      ok: true,
      project: JSON.stringify(project),
    });

  const repository = new ServerProjectRepository({ fetchImpl });
  const loaded = await repository.load(project.project.id);

  assert.equal(loaded.project.id, project.project.id);
  assert.equal(loaded.project.name, 'Projet serveur');
});

test('saves a serialized project to the server with CSRF token', async () => {
  const project = createDefaultProject();

  const requests: Array<{
    url: string;
    method: string;
    headers: Headers;
    body?: string;
  }> = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    requests.push({
      url,
      method,
      headers: new Headers(init?.headers),
      body: init?.body ? String(init.body) : undefined,
    });

    if (url === '/CPREY-DRAW/api/session.php') {
      return sessionResponse();
    }

    return jsonResponse({
      ok: true,
    });
  };

  const repository = new ServerProjectRepository({ fetchImpl });
  await repository.save(project);

  assert.equal(requests.length, 2);

  assert.equal(
    requests[0].url,
    '/CPREY-DRAW/api/session.php',
  );
  assert.equal(requests[0].method, 'GET');

  assert.equal(
    requests[1].url,
    '/CPREY-DRAW/api/projects.php',
  );
  assert.equal(requests[1].method, 'POST');
  assert.equal(
    requests[1].headers.get('X-CSRF-Token'),
    'csrf-test-token',
  );

  assert.ok(requests[1].body);

  const outerPayload = JSON.parse(requests[1].body as string);

  assert.equal(typeof outerPayload.project, 'string');

  const serializedProject = JSON.parse(outerPayload.project);

  assert.equal(serializedProject.project.id, project.project.id);
});

test('deletes a project by id with CSRF token', async () => {
  const requests: Array<{
    url: string;
    method: string;
    headers: Headers;
  }> = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    requests.push({
      url,
      method,
      headers: new Headers(init?.headers),
    });

    if (url === '/CPREY-DRAW/api/session.php') {
      return sessionResponse();
    }

    return jsonResponse({
      ok: true,
    });
  };

  const repository = new ServerProjectRepository({ fetchImpl });
  await repository.delete('project-123');

  assert.equal(requests.length, 2);

  assert.equal(
    requests[0].url,
    '/CPREY-DRAW/api/session.php',
  );
  assert.equal(requests[0].method, 'GET');

  assert.equal(
    requests[1].url,
    '/CPREY-DRAW/api/projects.php?id=project-123',
  );
  assert.equal(requests[1].method, 'DELETE');
  assert.equal(
    requests[1].headers.get('X-CSRF-Token'),
    'csrf-test-token',
  );
});

test('reuses cached CSRF token for later mutations', async () => {
  const project = createDefaultProject();
  let sessionCalls = 0;

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);

    if (url === '/CPREY-DRAW/api/session.php') {
      sessionCalls += 1;
      return sessionResponse();
    }

    return jsonResponse({
      ok: true,
    });
  };

  const repository = new ServerProjectRepository({ fetchImpl });

  await repository.save(project);
  await repository.delete(project.project.id);

  assert.equal(sessionCalls, 1);
});

test('rejects invalid CSRF session responses', async () => {
  const project = createDefaultProject();

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);

    if (url === '/CPREY-DRAW/api/session.php') {
      return jsonResponse({
        ok: true,
        authenticated: true,
        authorized: true,
        csrfToken: '',
      });
    }

    return jsonResponse({
      ok: true,
    });
  };

  const repository = new ServerProjectRepository({ fetchImpl });

  await assert.rejects(
    () => repository.save(project),
    /Token CSRF CPREY DRAW invalide/,
  );
});

test('rejects invalid list responses', async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse({
      ok: true,
      projects: 'invalid',
    });

  const repository = new ServerProjectRepository({ fetchImpl });

  await assert.rejects(
    () => repository.list(),
    /Réponse serveur invalide/,
  );
});

test('rejects HTTP errors', async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse(
      {
        ok: false,
      },
      403,
    );

  const repository = new ServerProjectRepository({ fetchImpl });

  await assert.rejects(
    () => repository.list(),
    /Impossible de charger la liste des projets serveur/,
  );
});
