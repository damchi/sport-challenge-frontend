import { ApiError } from './errors';
import { createQueryClient, shouldRetry } from './queryClient';

function setup() {
  const handlers = { onAuthError: vi.fn(), onError: vi.fn() };
  return { client: createQueryClient(handlers), ...handlers };
}

function failingWith(error: unknown) {
  return () => Promise.reject(error);
}

describe('shouldRetry', () => {
  it('retries network and server errors twice at most', () => {
    expect(shouldRetry(0, new ApiError('network_error', 0))).toBe(true);
    expect(shouldRetry(1, new ApiError('internal_error', 503))).toBe(true);
    expect(shouldRetry(2, new ApiError('internal_error', 503))).toBe(false);
  });

  it('never retries a 4xx answer or an unknown error', () => {
    expect(shouldRetry(0, new ApiError('not_found', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('rate_limited', 429))).toBe(false);
    expect(shouldRetry(0, new Error('boom'))).toBe(false);
  });
});

describe('createQueryClient global errors', () => {
  it('leaves the error of a first load to its screen', async () => {
    const { client, onError, onAuthError } = setup();

    await client
      .fetchQuery({ queryKey: ['a'], queryFn: failingWith(new ApiError('not_found', 404)) })
      .catch(() => undefined);

    expect(onError).not.toHaveBeenCalled();
    expect(onAuthError).not.toHaveBeenCalled();
  });

  it('reports a failed refresh of data already on screen', async () => {
    const { client, onError } = setup();
    client.setQueryData(['a'], 'previous');
    const error = new ApiError('internal_error', 500);

    await client
      .fetchQuery({ queryKey: ['a'], queryFn: failingWith(error), retry: false, staleTime: 0 })
      .catch(() => undefined);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('reports a failed action', async () => {
    const { client, onError } = setup();
    const error = new ApiError('week_locked', 409);

    await client
      .getMutationCache()
      .build(client, { mutationFn: failingWith(error) })
      .execute(undefined)
      .catch(() => undefined);

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('turns an authentication error into a lost session, not a message', async () => {
    const { client, onError, onAuthError } = setup();

    await client
      .getMutationCache()
      .build(client, { mutationFn: failingWith(new ApiError('token_expired', 401)) })
      .execute(undefined)
      .catch(() => undefined);
    await client
      .fetchQuery({ queryKey: ['b'], queryFn: failingWith(new ApiError('token_expired', 401)) })
      .catch(() => undefined);

    expect(onAuthError).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });
});
