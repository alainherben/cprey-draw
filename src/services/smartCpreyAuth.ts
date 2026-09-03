export const SMART_CPREY_DRAW_APPLICATION_ID = 'cprey_draw';

export interface SmartCpreyUser {
  siteId: number;
  codeSite: string;
  name: string;
  email: string;
  application: typeof SMART_CPREY_DRAW_APPLICATION_ID;
}

export interface SmartCpreySession {
  ok: true;
  authenticated: true;
  authorized: true;
  application: typeof SMART_CPREY_DRAW_APPLICATION_ID;
  user: SmartCpreyUser;
}

export type SmartCpreySessionState =
  | { status: 'loading' }
  | { status: 'development'; session: SmartCpreySession }
  | { status: 'authenticated'; session: SmartCpreySession }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string };

export interface SmartCpreyAuthEnv {
  DEV?: boolean;
  PROD?: boolean;
  BASE_URL?: string;
  VITE_SMARTCPREY_AUTH_MOCK?: string;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function getSmartCpreySessionEndpoint(baseUrl: string | undefined): string {
  const base = baseUrl && baseUrl.trim() ? baseUrl.trim() : '/';
  return `${base.endsWith('/') ? base : `${base}/`}api/session.php`;
}

export function getSmartCpreyLogoutEndpoint(baseUrl: string | undefined): string {
  const base = baseUrl && baseUrl.trim() ? baseUrl.trim() : '/';
  return `${base.endsWith('/') ? base : `${base}/`}api/logout.php`;
}

export function shouldUseSmartCpreyDevAuthMock(env: SmartCpreyAuthEnv): boolean {
  return Boolean(env.DEV && !env.PROD && env.VITE_SMARTCPREY_AUTH_MOCK !== 'false');
}

export function createSmartCpreyDevSession(): SmartCpreySession {
  return {
    ok: true,
    authenticated: true,
    authorized: true,
    application: SMART_CPREY_DRAW_APPLICATION_ID,
    user: {
      siteId: 0,
      codeSite: 'DEV',
      name: 'Développement local',
      email: 'dev@smartcprey.local',
      application: SMART_CPREY_DRAW_APPLICATION_ID,
    },
  };
}

export async function fetchSmartCpreySession(
  fetchImpl: FetchLike,
  endpoint: string,
): Promise<SmartCpreySessionState> {
  try {
    const response = await fetchImpl(endpoint, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (response.status === 401) {
      return { status: 'unauthenticated' };
    }

    if (response.status === 403) {
      return { status: 'forbidden' };
    }

    if (!response.ok) {
      return { status: 'error', message: 'Session SmartCPREY indisponible.' };
    }

    const payload = await response.json();

    if (!isSmartCpreySession(payload)) {
      return { status: 'error', message: 'Réponse session SmartCPREY invalide.' };
    }

    return { status: 'authenticated', session: payload };
  } catch {
    return { status: 'error', message: 'Session SmartCPREY indisponible.' };
  }
}

export async function logoutSmartCpreySession(
  fetchImpl: FetchLike,
  endpoint: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (response.status === 401) {
      return { ok: true };
    }

    if (!response.ok) {
      return { ok: false, message: 'Déconnexion SmartCPREY indisponible.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: 'Déconnexion SmartCPREY indisponible.' };
  }
}

export async function loadSmartCpreySession(
  env: SmartCpreyAuthEnv,
  fetchImpl: FetchLike = fetch,
): Promise<SmartCpreySessionState> {
  if (shouldUseSmartCpreyDevAuthMock(env)) {
    return { status: 'development', session: createSmartCpreyDevSession() };
  }

  return fetchSmartCpreySession(fetchImpl, getSmartCpreySessionEndpoint(env.BASE_URL));
}

function isSmartCpreySession(value: unknown): value is SmartCpreySession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<SmartCpreySession>;
  const user = session.user as Partial<SmartCpreyUser> | undefined;

  return session.ok === true &&
    session.authenticated === true &&
    session.authorized === true &&
    session.application === SMART_CPREY_DRAW_APPLICATION_ID &&
    Boolean(user) &&
    typeof user?.siteId === 'number' &&
    typeof user?.codeSite === 'string' &&
    typeof user?.name === 'string' &&
    typeof user?.email === 'string' &&
    user?.application === SMART_CPREY_DRAW_APPLICATION_ID;
}
