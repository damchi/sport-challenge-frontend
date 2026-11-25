// Error tracking (Sentry), without consent: the app is for a circle of friends
// (README §6). What protects the data is the scrubbing below: no name, nickname,
// e-mail, token or request body leaves the browser; the request id stays.
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { ApiError } from '../api/errors';

type Sentry = typeof import('./sentrySdk');

const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
// A JSON Web Token (header.payload.signature), or what follows "Bearer".
const TOKEN = /\beyJ[\w-]+\.[\w-]+\.[\w-]*|\bBearer\s+\S+/gi;
// The query or fragment of an address or a path quoted in a text.
const URL_REST = /(https?:\/\/[^\s?#]*|\/[\w\-./]*)[?#]\S*/g;

/** Removes e-mails, tokens and address queries or fragments from a free text (an error message). */
export function scrubText(text: string): string {
  return text.replace(EMAIL, '[email]').replace(TOKEN, '[token]').replace(URL_REST, '$1');
}

/**
 * Keeps an address without its query (Auth0 code and state) and fragment
 * (invitation token): origin and path only.
 */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/, 1)[0] ?? '';
}

/** The event as it may leave the browser. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { request, message, exception, breadcrumbs } = event;
  const userAgent = request?.headers?.['User-Agent'];
  return {
    ...event,
    // Who the user is, and the free data attached to the event.
    user: undefined,
    extra: undefined,
    message: message === undefined ? undefined : scrubText(message),
    logentry: undefined,
    exception: exception && {
      values: exception.values?.map((value) => ({
        ...value,
        value: value.value === undefined ? undefined : scrubText(value.value),
        // An error without a source file gets the page address as file name.
        stacktrace: value.stacktrace && {
          ...value.stacktrace,
          frames: value.stacktrace.frames?.map((frame) => ({
            ...frame,
            filename: frame.filename === undefined ? undefined : scrubUrl(frame.filename),
            abs_path: frame.abs_path === undefined ? undefined : scrubUrl(frame.abs_path),
          })),
        },
      })),
    },
    // Only the address, without query or fragment, and the browser.
    request: request && {
      url: request.url === undefined ? undefined : scrubUrl(request.url),
      headers: userAgent === undefined ? undefined : { 'User-Agent': userAgent },
    },
    breadcrumbs: breadcrumbs?.flatMap((crumb) => scrubBreadcrumb(crumb) ?? []),
  };
}

const URL_FIELDS = ['url', 'from', 'to'];

/**
 * Keeps the navigations and the requests, with scrubbed addresses. Clicks and
 * console lines may carry a name or a nickname: they are dropped.
 */
export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (!['navigation', 'fetch', 'xhr'].includes(crumb.category ?? '')) return null;
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(crumb.data ?? {})) {
    if (URL_FIELDS.includes(key) && typeof value === 'string') data[key] = scrubUrl(value);
    else if (key === 'method' || key === 'status_code') data[key] = value;
  }
  return {
    type: crumb.type,
    category: crumb.category,
    level: crumb.level,
    timestamp: crumb.timestamp,
    data,
  };
}

/**
 * Errors worth a report: a bug of the app, a server failure or an unreadable
 * answer. The expected answers (4xx, no network, a 503 `busy` where nothing was
 * written and a retry is enough) are shown to the user, not reported.
 */
export function shouldReport(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.status === 503 && error.code === 'busy') return false;
  return error.status >= 500 || error.code === 'unknown';
}

/** What the SDK may collect by itself: the browser name, nothing about the person. */
export const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
} satisfies NonNullable<Parameters<Sentry['init']>[0]>['dataCollection'];

let sentry: Sentry | undefined;
// Errors raised while the SDK loads, sent once it is there.
let pending: unknown[] = [];
let started = false;

function capture(client: Sentry, error: unknown): void {
  if (error instanceof ApiError) {
    client.captureException(error, {
      tags: { api_code: error.code, api_status: error.status, request_id: error.requestId },
    });
  } else {
    client.captureException(error);
  }
}

/**
 * Reports an error to Sentry; does nothing when tracking is off or the error
 * is expected. Never throws: it runs inside the app's own error handling.
 */
export function reportError(error: unknown): void {
  if (!started || !shouldReport(error)) return;
  if (!sentry) {
    pending.push(error);
    return;
  }
  try {
    capture(sentry, error);
  } catch {
    // A failing SDK loses this report, nothing more.
  }
}

export interface ErrorTrackingOptions {
  dsn: string | undefined;
  /** Development build: no tracking. */
  dev: boolean;
  /** Loads the SDK; injected by the tests. */
  load?: () => Promise<Sentry>;
}

/**
 * Starts the error tracking, outside development and with a DSN only. The SDK
 * is loaded apart, so the main bundle does not carry it.
 */
export async function startErrorTracking({
  dsn,
  dev,
  load = () => import('./sentrySdk'),
}: ErrorTrackingOptions): Promise<void> {
  if (dev || !dsn || started) return;
  started = true;
  let client: Sentry;
  try {
    client = await load();
    client.init({
      dsn,
      // Sentry 11 replaced sendDefaultPii with dataCollection. userInfo: false
      // also stops the IP address the SDK asks Sentry to infer ({{auto}}).
      dataCollection: DATA_COLLECTION,
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  } catch {
    // Tracking is not worth breaking the app (SDK blocked by the browser,
    // offline, or refusing its options): it stays off, nothing is kept.
    started = false;
    pending = [];
    return;
  }
  sentry = client;
  for (const error of pending) capture(client, error);
  pending = [];
}

/** Forgets the started SDK; for the tests only. */
export function resetErrorTracking(): void {
  sentry = undefined;
  pending = [];
  started = false;
}
