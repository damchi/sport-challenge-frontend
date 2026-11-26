import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { createApiClient, type Session } from './client';
import { server } from '../mocks/server';
import { ApiError, errorMessage } from './errors';

const BASE_URL = 'https://api.test';
const SPORTS = `${BASE_URL}/api/v1/sports`;

const hasKey = (key: string) => i18n.exists(key);

function fakeSession(tokens: (string | undefined)[], renewed = true) {
  let current = tokens.shift();
  const session = {
    getAccessToken: vi.fn(() => Promise.resolve(current)),
    renew: vi.fn(() => {
      // A failed renewal keeps the current token.
      if (renewed) current = tokens.shift();
      return Promise.resolve(renewed);
    }),
  } satisfies Session;
  return session;
}

function errorBody(code: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message: 'English fallback', ...extra } };
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiError)) throw new Error(`Expected an ApiError, got ${String(error)}`);
  return error;
}

describe('createApiClient', () => {
  it('sends the access token and returns the data', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(SPORTS, ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json({ items: [] });
      }),
    );
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token-1']) });

    const { data } = await client.GET('/api/v1/sports');

    expect(data).toEqual({ items: [] });
    expect(seen).toEqual(['Bearer token-1']);
  });

  it('sends no Authorization header when signed out', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(SPORTS, ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json({ items: [] });
      }),
    );
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession([undefined]) });

    await client.GET('/api/v1/sports');

    expect(seen).toEqual([null]);
  });

  it('fails as network_error without sending when the token cannot be read', async () => {
    const sent = vi.fn(() => HttpResponse.json({ sports: [] }));
    server.use(http.get(SPORTS, sent));
    const session = fakeSession(['token']);
    session.getAccessToken.mockRejectedValueOnce(new Error('timeout'));
    const client = createApiClient({ baseUrl: BASE_URL, session });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'network_error', status: 0 });
    expect(sent).not.toHaveBeenCalled();
  });

  it('normalizes a 4xx error body', async () => {
    server.use(
      http.get(SPORTS, () =>
        HttpResponse.json(
          errorBody('validation_failed', {
            params: { field: 'name', max: 40, lng: 'en' },
            request_id: 'req-1',
          }),
          { status: 422 },
        ),
      ),
    );
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'validation_failed', status: 422, requestId: 'req-1' });
    // Only string values, never an i18next option such as lng.
    expect(error.params).toEqual({ field: 'name' });
  });

  it('falls back on the status when the code is not a plain key', async () => {
    server.use(http.get(SPORTS, () => HttpResponse.json(errorBody('home.title'), { status: 404 })));
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error.code).toBe('not_found');
  });

  it('normalizes a 5xx error and a response without body', async () => {
    server.use(http.get(SPORTS, () => new HttpResponse(null, { status: 503 })));
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'internal_error', status: 503, params: {} });
    expect(error.requestId).toBeUndefined();
  });

  it('turns a network failure into network_error', async () => {
    server.use(http.get(SPORTS, () => HttpResponse.error()));
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'network_error', status: 0 });
  });

  it('keeps the retry delay of a 429 for errors.rate_limited', async () => {
    server.use(
      http.get(SPORTS, () =>
        HttpResponse.json(errorBody('rate_limited'), {
          status: 429,
          headers: { 'Retry-After': '30' },
        }),
      ),
    );
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error.params).toEqual({ retry_after: '30' });
    expect(errorMessage(error, hasKey)).toEqual({
      key: 'errors.rate_limited_delay',
      values: { retry_after: '30' },
    });
  });

  it('uses errors.rate_limited when no delay is given', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('rate_limited'), { status: 429 })),
    );
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(errorMessage(error, hasKey).key).toBe('errors.rate_limited');
  });

  it('renews the session once on 401 and replays the request', async () => {
    server.use(
      http.get(SPORTS, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ items: [] })
          : HttpResponse.json(errorBody('token_expired'), { status: 401 }),
      ),
    );
    const session = fakeSession(['stale', 'fresh']);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    const { data } = await client.GET('/api/v1/sports');

    expect(data).toEqual({ items: [] });
    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('shares one renewal between concurrent 401 responses', async () => {
    server.use(
      http.get(SPORTS, ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ items: [] })
          : HttpResponse.json(errorBody('token_expired'), { status: 401 }),
      ),
    );
    const session = fakeSession(['stale', 'fresh']);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    await Promise.all([client.GET('/api/v1/sports'), client.GET('/api/v1/sports')]);

    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('fails with the 401 when the renewal fails', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('token_expired'), { status: 401 })),
    );
    const session = fakeSession(['stale'], false);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'token_expired', status: 401 });
  });

  it('renews once when concurrent 401 cannot be renewed', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('token_expired'), { status: 401 })),
    );
    const session = fakeSession(['stale'], false);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    await Promise.allSettled([client.GET('/api/v1/sports'), client.GET('/api/v1/sports')]);
    await failure(client.GET('/api/v1/sports'));

    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('turns a network failure of the replay into network_error', async () => {
    let calls = 0;
    server.use(
      http.get(SPORTS, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(errorBody('token_expired'), { status: 401 })
          : HttpResponse.error();
      }),
    );
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['stale', 'fresh']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'network_error', status: 0 });
  });

  it('does not renew on a 401 sent without a session', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('unauthenticated'), { status: 401 })),
    );
    const session = fakeSession([undefined]);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error).toMatchObject({ code: 'unauthenticated', status: 401 });
    expect(session.renew).not.toHaveBeenCalled();
  });

  it('renews once when concurrent replays are still refused', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('account_deleted'), { status: 401 })),
    );
    const session = fakeSession(['stale', 'fresh']);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    await Promise.allSettled([client.GET('/api/v1/sports'), client.GET('/api/v1/sports')]);

    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('replays without the previous token when the renewal leaves none', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(SPORTS, ({ request }) => {
        seen.push(request.headers.get('authorization'));
        return HttpResponse.json(errorBody('unauthenticated'), { status: 401 });
      }),
    );
    const client = createApiClient({
      baseUrl: BASE_URL,
      session: fakeSession(['stale', undefined]),
    });

    await failure(client.GET('/api/v1/sports'));

    expect(seen).toEqual(['Bearer stale', null]);
  });

  it('fails with the 401 when the replay is still refused', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('account_deleted'), { status: 401 })),
    );
    const session = fakeSession(['stale', 'fresh']);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(error.code).toBe('account_deleted');
    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('does not renew again a token still refused after its replay', async () => {
    server.use(
      http.get(SPORTS, () => HttpResponse.json(errorBody('account_deleted'), { status: 401 })),
    );
    const session = fakeSession(['stale', 'fresh']);
    const client = createApiClient({ baseUrl: BASE_URL, session });

    await failure(client.GET('/api/v1/sports'));
    await failure(client.GET('/api/v1/sports'));

    expect(session.renew).toHaveBeenCalledTimes(1);
  });

  it('keeps the access token out of the error', async () => {
    server.use(http.get(SPORTS, () => HttpResponse.json(errorBody('forbidden'), { status: 403 })));
    const client = createApiClient({ baseUrl: BASE_URL, session: fakeSession(['secret-token']) });

    const error = await failure(client.GET('/api/v1/sports'));

    expect(JSON.stringify({ ...error, message: error.message })).not.toContain('secret-token');
  });
});
