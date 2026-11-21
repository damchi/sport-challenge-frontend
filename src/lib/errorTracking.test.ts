import type { ErrorEvent } from '@sentry/react';
import { ApiError } from '../api/errors';
import {
  DATA_COLLECTION,
  reportError,
  resetErrorTracking,
  scrubBreadcrumb,
  scrubEvent,
  scrubText,
  scrubUrl,
  shouldReport,
  startErrorTracking,
} from './errorTracking';

const DSN = 'https://public-key@o1.ingest.sentry.io/2';

function fakeSentry() {
  const sdk = { init: vi.fn(), captureException: vi.fn() };
  // The tests use only these two functions of the SDK.
  const load = () => Promise.resolve(sdk as unknown as typeof import('./sentrySdk'));
  return { sdk, load };
}

afterEach(() => resetErrorTracking());

describe('scrubText and scrubUrl', () => {
  it('removes e-mails and tokens from a message', () => {
    expect(scrubText('no account for alex@example.com')).toBe('no account for [email]');
    expect(scrubText('sent Bearer abc.def.ghi')).toBe('sent [token]');
    expect(scrubText('jwt eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl here')).toBe('jwt [token] here');
    expect(scrubText('failed at https://app.test/invite#opaque-token now')).toBe(
      'failed at https://app.test/invite now',
    );
    expect(scrubText('no route /callback?code=abc&state=xyz')).toBe('no route /callback');
  });

  it('keeps the address without its query or fragment', () => {
    expect(scrubUrl('https://app.test/invite#invitation-token')).toBe('https://app.test/invite');
    expect(scrubUrl('https://app.test/?code=abc&state=xyz')).toBe('https://app.test/');
    expect(scrubUrl('/challenges/42')).toBe('/challenges/42');
  });
});

describe('scrubEvent', () => {
  it('sends no user, extra, body, cookie, header or query', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'failed for alex@example.com',
      user: { id: 'auth0|1', email: 'alex@example.com', username: 'alex' },
      extra: { nickname: 'alex' },
      request: {
        url: 'https://app.test/invite#invitation-token',
        data: '{"nickname":"alex"}',
        cookies: { session: 'secret' },
        query_string: 'code=abc',
        headers: { 'User-Agent': 'Firefox', Authorization: 'Bearer abc', Referer: 'x?code=1' },
      },
      exception: { values: [{ type: 'Error', value: 'token eyJa.eyJb.c2ln' }] },
      tags: { request_id: 'req-1' },
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toEqual({
      url: 'https://app.test/invite',
      headers: { 'User-Agent': 'Firefox' },
    });
    expect(scrubbed.message).toBe('failed for [email]');
    expect(scrubbed.exception?.values?.[0]?.value).toBe('token [token]');
    expect(scrubbed.tags).toEqual({ request_id: 'req-1' });
  });

  it('removes the query and fragment from the file names of the stack', () => {
    const scrubbed = scrubEvent({
      type: undefined,
      exception: {
        values: [
          {
            value: 'Script error.',
            stacktrace: {
              frames: [
                {
                  filename: 'https://app.test/invite#invitation-token',
                  abs_path: 'https://app.test/?code=abc',
                },
              ],
            },
          },
        ],
      },
    });

    expect(scrubbed.exception?.values?.[0]?.stacktrace?.frames).toEqual([
      { filename: 'https://app.test/invite', abs_path: 'https://app.test/' },
    ]);
  });

  it('keeps only the scrubbed navigations and requests among the breadcrumbs', () => {
    const scrubbed = scrubEvent({
      type: undefined,
      breadcrumbs: [
        { category: 'ui.click', message: 'button[aria-label="Remove Alex"]' },
        { category: 'console', message: 'alex@example.com' },
        { category: 'navigation', data: { from: '/', to: '/invite#invitation-token' } },
      ],
    });

    expect(scrubbed.breadcrumbs).toEqual([
      expect.objectContaining({ category: 'navigation', data: { from: '/', to: '/invite' } }),
    ]);
  });
});

describe('scrubBreadcrumb', () => {
  it('keeps the method and status of a request, never its body sizes or query', () => {
    expect(
      scrubBreadcrumb({
        type: 'http',
        category: 'fetch',
        data: {
          method: 'POST',
          url: 'https://api.test/activities?x=1',
          status_code: 500,
          'url.query': '?x=1',
          request_body_size: 120,
        },
      }),
    ).toEqual({
      type: 'http',
      category: 'fetch',
      level: undefined,
      timestamp: undefined,
      data: { method: 'POST', url: 'https://api.test/activities', status_code: 500 },
    });
  });

  it('drops clicks and console lines', () => {
    expect(scrubBreadcrumb({ category: 'ui.click', message: 'Alex' })).toBeNull();
    expect(scrubBreadcrumb({ category: 'console', message: 'Alex' })).toBeNull();
  });
});

describe('shouldReport', () => {
  it('reports bugs, server failures and unreadable answers', () => {
    expect(shouldReport(new TypeError('x is undefined'))).toBe(true);
    expect(shouldReport(new ApiError('internal_error', 500))).toBe(true);
    expect(shouldReport(new ApiError('unknown', 418))).toBe(true);
  });

  it('leaves out the answers the user is shown', () => {
    expect(shouldReport(new ApiError('week_locked', 409))).toBe(false);
    expect(shouldReport(new ApiError('network_error', 0))).toBe(false);
  });
});

describe('startErrorTracking', () => {
  it('stays off in development or without a DSN', async () => {
    const { sdk, load } = fakeSentry();

    await startErrorTracking({ dsn: DSN, dev: true, load });
    await startErrorTracking({ dsn: undefined, dev: false, load });
    reportError(new Error('boom'));

    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('collects nothing about the person: no user data, IP, cookie, body or query', () => {
    expect(DATA_COLLECTION).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
    });
  });

  it('starts without personal data and with the scrubbing', async () => {
    const { sdk, load } = fakeSentry();

    await startErrorTracking({ dsn: DSN, dev: false, load });

    expect(sdk.init).toHaveBeenCalledWith({
      dsn: DSN,
      dataCollection: DATA_COLLECTION,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  });

  it('sends the errors raised while the SDK loads, with the request id', async () => {
    const { sdk, load } = fakeSentry();
    const error = new ApiError('internal_error', 503, {}, 'req-1');

    const started = startErrorTracking({ dsn: DSN, dev: false, load });
    reportError(error);
    reportError(new ApiError('week_locked', 409));
    await started;

    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect(sdk.captureException).toHaveBeenCalledWith(error, {
      tags: { api_code: 'internal_error', api_status: 503, request_id: 'req-1' },
    });
  });

  it('leaves the app running when the SDK cannot load', async () => {
    reportError(new Error('lost'));
    await expect(
      startErrorTracking({
        dsn: DSN,
        dev: false,
        load: () => Promise.reject(new Error('blocked')),
      }),
    ).resolves.toBeUndefined();
  });

  it('stays off, with nothing kept, when the SDK fails to start', async () => {
    const { sdk, load } = fakeSentry();
    sdk.init.mockImplementation(() => {
      throw new Error('invalid DSN');
    });

    const started = startErrorTracking({ dsn: DSN, dev: false, load });
    reportError(new Error('lost'));
    await expect(started).resolves.toBeUndefined();
    reportError(new Error('after'));

    expect(sdk.captureException).not.toHaveBeenCalled();
  });
});
