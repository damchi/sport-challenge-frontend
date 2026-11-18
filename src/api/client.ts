import createClient, { type Middleware } from 'openapi-fetch';
import { ApiError, networkError, toApiError } from './errors';
import type { paths } from './generated/schema';

/**
 * What the client needs from the authentication layer, which provides it
 * (Auth0 on the web): the client stays independent of the SDK.
 */
export interface Session {
  /** Current access token, or undefined when signed out. */
  getAccessToken: () => Promise<string | undefined>;
  /** Tries to get a new access token; resolves to false when it cannot. */
  renew: () => Promise<boolean>;
  /** Session lost after a renewal attempt: sign out and clear the cache. */
  expire: () => void;
}

export interface ApiClientOptions {
  baseUrl: string;
  session: Session;
  fetch?: typeof globalThis.fetch;
}

function withToken(request: Request, token: string | undefined): Request {
  const next = new Request(request);
  if (token) next.headers.set('Authorization', `Bearer ${token}`);
  return next;
}

/**
 * Typed client of the API. A request either resolves with its data or throws
 * an ApiError. A 401 triggers one session renewal (shared by concurrent
 * requests) and one replay; a second failure expires the session.
 */
export function createApiClient({ baseUrl, session, fetch }: ApiClientOptions) {
  // Copies of the sent requests and their token, to replay them after a renewal.
  const sent = new Map<string, { request: Request; token: string | undefined }>();
  let renewal: Promise<boolean> | undefined;
  // Tokens of a session already lost: no new renewal, no second expire().
  const expiredTokens = new Set<string>();

  function renewOnce(): Promise<boolean> {
    renewal ??= session
      .renew()
      .catch(() => false)
      .finally(() => {
        renewal = undefined;
      });
    return renewal;
  }

  function expireSession(...tokens: (string | undefined)[]): void {
    const lost = tokens.filter((token): token is string => token !== undefined);
    if (lost.every((token) => expiredTokens.has(token))) return;
    lost.forEach((token) => expiredTokens.add(token));
    session.expire();
  }

  async function replay(
    request: Request,
    fetchRequest: typeof globalThis.fetch,
  ): Promise<{ response: Response; token: string | undefined }> {
    const token = await session.getAccessToken();
    try {
      return { response: await fetchRequest(withToken(request, token)), token };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw networkError(error);
    }
  }

  const middleware: Middleware = {
    async onRequest({ request, id }) {
      const token = await session.getAccessToken();
      const authorized = withToken(request, token);
      sent.set(id, { request: authorized.clone(), token });
      return authorized;
    },

    async onResponse({ response, id, options }) {
      const original = sent.get(id);
      sent.delete(id);

      let final = response;
      // Only a request sent with a session that is not already lost renews it;
      // a signed-out request just fails.
      const sentToken = original?.token;
      if (final.status === 401 && original && sentToken && !expiredTokens.has(sentToken)) {
        // A request sent before a renewal that already ended only needs a replay.
        const current = await session.getAccessToken();
        if (current !== sentToken || (await renewOnce())) {
          const replayed = await replay(original.request, options.fetch);
          final = replayed.response;
          if (final.status === 401) expireSession(sentToken, replayed.token);
        } else {
          expireSession(sentToken);
        }
      }

      if (!final.ok) throw await toApiError(final);
      return final === response ? undefined : final;
    },

    onError({ error, id }) {
      sent.delete(id);
      if (error instanceof ApiError) return error;
      // A cancelled request (TanStack Query) stays an AbortError.
      if (error instanceof Error && error.name === 'AbortError') return error;
      return networkError(error);
    },
  };

  const client = createClient<paths>({ baseUrl, fetch });
  client.use(middleware);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
