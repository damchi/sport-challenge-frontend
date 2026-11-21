import { http, HttpResponse } from 'msw';

// A stand-in for the Auth0 tenant, answered inside the test run: the real
// SDK signs in against it, so no app code changes for the tests and nothing
// of it can run in production. It covers what the journeys use: the sign-in
// page, the code exchange, the revocation and the logout. No silent sign-in
// after a reload: the page's clock is fixed in the past, so the SDK's
// session cookie is born expired and a reload asks to sign in again. The
// tokens are unsigned: the SDK checks the claims of the ID token, not its
// signature (the API checks it, and the API is mocked here).

export const AUTH0_DOMAIN = 'auth.e2e.test';
export const AUTH0_CLIENT_ID = 'e2e-client-id';
export const API_AUDIENCE = 'https://api.e2e.test';
/** The name of the only link of the fake sign-in page. */
export const FAKE_SIGN_IN = 'Sign in (fake Auth0)';

const ISSUER = `https://${AUTH0_DOMAIN}/`;
const USER_ID = 'auth0|e2e-user';

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function idToken(now: Date, nonce: string | undefined): string {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64Url({ alg: 'RS256', typ: 'JWT' });
  const claims = base64Url({
    iss: ISSUER,
    aud: AUTH0_CLIENT_ID,
    sub: USER_ID,
    iat,
    exp: iat + 3600,
    ...(nonce && { nonce }),
  });
  return `${header}.${claims}.unsigned`;
}

/** Text written as HTML: only the test's own values, escaped all the same. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Whether the address is a page of the app under test (no open redirect, even here). */
function isAppUrl(value: string | null, appOrigin: string): value is string {
  if (!value) return false;
  try {
    return new URL(value).origin === appOrigin;
  } catch {
    return false;
  }
}

/**
 * Handlers of the fake tenant. `now` must be the time the page's clock
 * shows: the SDK checks the token dates against it.
 */
export function fakeAuth0(appOrigin: string, now: Date) {
  let issued = 0;
  // Nonce of each code not yet exchanged: the SDK checks it in the ID token.
  const codes = new Map<string, string | undefined>();

  function newCode(nonce: string | null): string {
    issued += 1;
    const code = `code-${issued}`;
    codes.set(code, nonce ?? undefined);
    return code;
  }

  function tokens(nonce: string | undefined) {
    issued += 1;
    return HttpResponse.json({
      access_token: `access-token-${issued}`,
      id_token: idToken(now, nonce),
      refresh_token: `refresh-token-${issued}`,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid profile email offline_access',
    });
  }

  return [
    http.get(`https://${AUTH0_DOMAIN}/authorize`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      const redirectUri = query.get('redirect_uri');
      const state = query.get('state') ?? '';
      if (query.get('client_id') !== AUTH0_CLIENT_ID || !isAppUrl(redirectUri, appOrigin)) {
        return new HttpResponse('Invalid client or redirect_uri', { status: 400 });
      }

      // The sign-in page: one link standing for the user's credentials.
      const back = new URL(redirectUri);
      back.searchParams.set('code', newCode(query.get('nonce')));
      back.searchParams.set('state', state);
      return HttpResponse.html(
        `<!doctype html><title>Fake Auth0</title><a href="${escapeHtml(back.href)}">${FAKE_SIGN_IN}</a>`,
      );
    }),

    http.post(`https://${AUTH0_DOMAIN}/oauth/token`, async ({ request }) => {
      const text = await request.text();
      const body = request.headers.get('content-type')?.includes('json')
        ? new URLSearchParams(Object.entries(JSON.parse(text) as Record<string, string>))
        : new URLSearchParams(text);
      const code = body.get('code') ?? '';
      if (!codes.has(code)) return HttpResponse.json({ error: 'invalid_grant' }, { status: 403 });
      const nonce = codes.get(code);
      codes.delete(code);
      return tokens(nonce);
    }),

    http.post(
      `https://${AUTH0_DOMAIN}/oauth/revoke`,
      () => new HttpResponse(null, { status: 200 }),
    ),

    http.get(`https://${AUTH0_DOMAIN}/v2/logout`, ({ request }) => {
      const returnTo = new URL(request.url).searchParams.get('returnTo');
      if (!isAppUrl(returnTo, appOrigin)) {
        return new HttpResponse('Invalid returnTo', { status: 400 });
      }
      return new HttpResponse(null, { status: 302, headers: { Location: returnTo } });
    }),
  ];
}
