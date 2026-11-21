import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

/** How long a result stays fresh before a refetch (V1: refresh, no live update). */
export const staleTimes = {
  default: 60_000,
  // The ranking moves with every activity; applied by the leaderboard hook.
  leaderboard: 10_000,
} as const;

const MAX_RETRIES = 2;

/** A lost session: the client already tried to renew it before failing. */
function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// Only failures that may pass on a new attempt: no response, or a server error.
// A 4xx answer would only repeat itself.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

export interface QueryClientHandlers {
  /** Authentication lost (401 after a renewal attempt): the session is handled by the app. */
  onAuthError: (error: unknown) => void;
  /** Error no screen shows by itself: a failed action, or a failed background refresh. */
  onError: (error: unknown) => void;
  /** Every failure, shown or not: for the error tracking, which keeps the unexpected ones. */
  onFailure: (error: unknown) => void;
}

/**
 * Query client of the app. A query error is shown by its screen (error state
 * with retry); only errors no screen shows reach `onError`.
 */
export function createQueryClient({
  onAuthError,
  onError,
  onFailure,
}: QueryClientHandlers): QueryClient {
  function report(error: unknown, shownByScreen: boolean): void {
    onFailure(error);
    if (isAuthError(error)) onAuthError(error);
    else if (!shownByScreen) onError(error);
  }

  return new QueryClient({
    queryCache: new QueryCache({
      // A screen shows the error of its first load; a failed refresh keeps the
      // previous data on screen, so the error is reported globally.
      onError: (error, query) => report(error, query.state.data === undefined),
    }),
    mutationCache: new MutationCache({
      // A mutation whose form shows its own errors (meta.handlesError) skips the banner.
      onError: (error, _variables, _context, mutation) =>
        report(error, mutation.meta?.handlesError === true),
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: staleTimes.default },
      mutations: { retry: false },
    },
  });
}
