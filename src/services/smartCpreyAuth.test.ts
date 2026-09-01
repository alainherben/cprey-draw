import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSmartCpreyDevSession,
  fetchSmartCpreySession,
  getSmartCpreySessionEndpoint,
  shouldUseSmartCpreyDevAuthMock,
  SMART_CPREY_DRAW_APPLICATION_ID,
} from './smartCpreyAuth';

test('uses the stable SmartCPREY application identifier', () => {
  assert.equal(SMART_CPREY_DRAW_APPLICATION_ID, 'cprey_draw');
});

test('builds the session endpoint below the Vite base path', () => {
  assert.equal(
    getSmartCpreySessionEndpoint('/CPREY-DRAW/'),
    '/CPREY-DRAW/api/session.php',
  );

  assert.equal(
    getSmartCpreySessionEndpoint('/CPREY-DRAW'),
    '/CPREY-DRAW/api/session.php',
  );
});

test('development auth mock is never enabled in production', () => {
  assert.equal(
    shouldUseSmartCpreyDevAuthMock({ DEV: true, PROD: false }),
    true,
  );

  assert.equal(
    shouldUseSmartCpreyDevAuthMock({
      DEV: true,
      PROD: false,
      VITE_SMARTCPREY_AUTH_MOCK: 'false',
    }),
    false,
  );

  assert.equal(
    shouldUseSmartCpreyDevAuthMock({ DEV: false, PROD: true }),
    false,
  );

  assert.equal(
    shouldUseSmartCpreyDevAuthMock({ DEV: true, PROD: true }),
    false,
  );
});

test('development auth mock exposes a local authorized session', () => {
  const session = createSmartCpreyDevSession();

  assert.equal(session.ok, true);
  assert.equal(session.authenticated, true);
  assert.equal(session.authorized, true);
  assert.equal(session.application, 'cprey_draw');
  assert.equal(session.user.codeSite, 'DEV');
  assert.equal(session.user.email, 'dev@smartcprey.local');
});

test('session API maps unauthenticated and forbidden responses', async () => {
  const unauthenticated = await fetchSmartCpreySession(
    async () => new Response('', { status: 401 }),
    '/api/session.php',
  );

  const forbidden = await fetchSmartCpreySession(
    async () => new Response('', { status: 403 }),
    '/api/session.php',
  );

  assert.equal(unauthenticated.status, 'unauthenticated');
  assert.equal(forbidden.status, 'forbidden');
});

test('session API accepts the real SmartCPREY authorized payload', async () => {
  const state = await fetchSmartCpreySession(
    async () => Response.json({
      ok: true,
      authenticated: true,
      authorized: true,
      application: 'cprey_draw',
      user: {
        siteId: 8,
        codeSite: '00015',
        name: 'AH Hauterives',
        email: 'client@example.com',
        application: 'cprey_draw',
      },
    }),
    '/api/session.php',
  );

  assert.equal(state.status, 'authenticated');

  assert.equal(
    state.status === 'authenticated'
      ? state.session.user.codeSite
      : '',
    '00015',
  );
});

test('session API rejects malformed authorized payloads', async () => {
  const state = await fetchSmartCpreySession(
    async () => Response.json({
      ok: true,
      authenticated: true,
      authorized: false,
      application: 'cprey_draw',
      user: {
        siteId: 8,
        codeSite: '00015',
        name: 'AH Hauterives',
        email: 'client@example.com',
        application: 'cprey_draw',
      },
    }),
    '/api/session.php',
  );

  assert.equal(state.status, 'error');
});
