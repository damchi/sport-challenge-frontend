import type { components } from './generated/schema';

/** Codes of the API, plus the client's own: no response, or no readable error. */
export type ApiErrorCode = components['schemas']['ErrorCode'] | 'network_error' | 'unknown_error';

/**
 * Every failed request ends as an ApiError. The interface translates `code`
 * (errors.<code>) and never shows the server's message.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly params: Record<string, string>;
  readonly requestId: string | undefined;

  constructor(
    code: string,
    status: number,
    params: Record<string, string> = {},
    requestId?: string,
  ) {
    super(`API error ${code} (HTTP ${status})`);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.params = params;
    this.requestId = requestId;
  }
}

// Code used when the response has no readable error body.
function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal_error';
  return 'unknown_error';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// i18next reads these keys of the values as options (language, namespace...):
// a server parameter never takes their place.
const RESERVED_PARAMS = new Set([
  'lng',
  'lngs',
  'ns',
  'defaultValue',
  'context',
  'count',
  'keyPrefix',
  'returnObjects',
  'returnDetails',
  'replace',
  'interpolation',
  'postProcess',
]);

function stringParams(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === 'string' && !RESERVED_PARAMS.has(entry[0]),
    ),
  );
}

async function readErrorBody(response: Response): Promise<Record<string, unknown> | undefined> {
  if (!response.headers.get('content-type')?.includes('json')) return undefined;
  try {
    const body: unknown = await response.json();
    return isRecord(body) && isRecord(body.error) ? body.error : undefined;
  } catch {
    return undefined;
  }
}

/** Normalizes a failed response `{ "error": { code, message, params, request_id } }`. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body = await readErrorBody(response);
  // A code is a translation key segment (errors.<code>): snake_case only.
  const code =
    typeof body?.code === 'string' && /^[a-z][a-z0-9_]*$/.test(body.code)
      ? body.code
      : codeForStatus(response.status);
  const params = stringParams(body?.params);
  const requestId = typeof body?.request_id === 'string' ? body.request_id : undefined;

  const retryAfter = response.headers.get('retry-after');
  if (response.status === 429 && retryAfter && /^[1-9]\d*$/.test(retryAfter)) {
    params.retry_after = retryAfter;
  }
  return new ApiError(code, response.status, params, requestId);
}

/** No response at all: offline, DNS, CORS, server down. */
export function networkError(cause: unknown): ApiError {
  const error = new ApiError('network_error', 0);
  error.cause = cause;
  return error;
}

/**
 * Translation key and values of an error, for i18next. `hasKey` tells
 * whether a key is translated (i18next.exists); a code without text falls
 * back on errors.unknown_error rather than showing the raw key.
 */
export function errorMessage(
  error: ApiError,
  hasKey: (key: string) => boolean,
): { key: string; values: Record<string, string> } {
  if (error.code === 'rate_limited' && error.params.retry_after) {
    return { key: 'errors.rate_limited_delay', values: error.params };
  }
  const key = `errors.${error.code}`;
  return hasKey(key) ? { key, values: error.params } : { key: 'errors.unknown_error', values: {} };
}
