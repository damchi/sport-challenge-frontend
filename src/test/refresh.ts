import type { QueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { HttpResponse } from 'msw';

/** A failed answer of the API: a server error, or too many requests. */
export function failure(status: 500 | 429) {
  const code = status === 429 ? 'rate_limited' : 'internal_error';
  return HttpResponse.json({ error: { code, message: 'Failed' } }, { status });
}

/**
 * Reloads every query on screen, as coming back to the app does once they
 * are stale, and waits for their answers to reach the screen: the query
 * client tells the components in a batch, on the next turn of the timers.
 */
export async function refreshAll(queryClient: QueryClient): Promise<void> {
  await act(async () => {
    await queryClient.refetchQueries({ type: 'active' });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
