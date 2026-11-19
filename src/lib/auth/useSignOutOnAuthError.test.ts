import { act, renderHook } from '@testing-library/react';
import { createFakeAuth } from '../../test/fakeAuth';
import type { Auth } from './auth';
import { useSignOutOnAuthError } from './useSignOutOnAuthError';

function setup(auth: Auth) {
  const clearCache = vi.fn();
  let authErrors = 0;
  const { rerender } = renderHook(() => useSignOutOnAuthError(auth, authErrors, clearCache));
  const authError = () => {
    authErrors += 1;
    rerender();
  };
  return { clearCache, authError, rerender };
}

describe('useSignOutOnAuthError', () => {
  it('clears the cache on each error and signs out once', () => {
    const auth = createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });
    const { clearCache, authError, rerender } = setup(auth);

    authError();
    authError();
    rerender();

    expect(clearCache).toHaveBeenCalledTimes(2);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('does nothing when signed out (no session, and no refetch loop)', () => {
    const auth = createFakeAuth();
    const { clearCache, authError } = setup(auth);

    authError();

    expect(clearCache).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('tries to sign out again after a failed sign-out', async () => {
    const signOut = vi.fn<() => Promise<void>>().mockRejectedValueOnce(new Error('offline'));
    signOut.mockResolvedValue(undefined);
    const auth = createFakeAuth({ isAuthenticated: true, signOut });
    const { authError } = setup(auth);

    authError();
    await act(() => Promise.resolve());
    authError();

    expect(signOut).toHaveBeenCalledTimes(2);
  });
});
