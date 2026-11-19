import { act, renderHook } from '@testing-library/react';
import { ApiError } from '../../api/errors';
import { createFakeAuth } from '../../test/fakeAuth';
import type { Auth } from './auth';
import { useHandleLostSession, type AuthErrorEvent } from './useHandleLostSession';

const tokenExpired = new ApiError('token_expired', 401);

function setup(initialAuth: Auth, { reauthAllowed = true } = {}) {
  const options = {
    clearCache: vi.fn(),
    currentPath: () => '/challenges/42',
    reauth: { allowed: vi.fn(() => reauthAllowed), record: vi.fn() },
    onSessionEnd: vi.fn(),
  };
  let auth = initialAuth;
  let event: AuthErrorEvent | undefined;
  const { rerender } = renderHook(() => useHandleLostSession(auth, event, options));
  const authError = (error: unknown = tokenExpired) => {
    event = { id: (event?.id ?? 0) + 1, error };
    rerender();
  };
  const update = (next: Auth) => {
    auth = next;
    rerender();
  };
  return { ...options, authError, update, rerender };
}

const signedIn = () => createFakeAuth({ isAuthenticated: true, user: { id: 'auth0|1' } });

describe('useHandleLostSession', () => {
  it('clears the data and signs in again, back to the page in use', () => {
    const auth = signedIn();
    const { clearCache, authError, rerender } = setup(auth);

    authError();
    rerender();

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    expect(auth.signIn).toHaveBeenCalledWith('/challenges/42');
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('records the automatic re-sign-in before leaving', () => {
    const { reauth, authError } = setup(signedIn());

    authError();

    expect(reauth.record).toHaveBeenCalledTimes(1);
  });

  it('stops instead of looping when the new session is refused too', () => {
    const auth = signedIn();
    const { onSessionEnd, authError } = setup(auth, { reauthAllowed: false });

    authError();

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(auth.signOut).toHaveBeenCalledWith({ local: true });
    expect(onSessionEnd).toHaveBeenCalledWith('unavailable');
  });

  it('signs out locally and reports a deleted account', () => {
    const auth = signedIn();
    const { clearCache, onSessionEnd, authError } = setup(auth);

    authError(new ApiError('account_deleted', 401));

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).toHaveBeenCalledWith('account_deleted');
    expect(auth.signOut).toHaveBeenCalledWith({ local: true });
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', () => {
    const auth = createFakeAuth();
    const { clearCache, authError } = setup(auth);

    authError();

    expect(clearCache).not.toHaveBeenCalled();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('handles an error received while the session loads once it is known', () => {
    const { clearCache, authError, update } = setup(createFakeAuth({ isLoading: true }));

    authError();
    expect(clearCache).not.toHaveBeenCalled();

    const auth = signedIn();
    update(auth);

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it('tries again on the next error after a failed attempt', async () => {
    const signIn = vi.fn<Auth['signIn']>().mockRejectedValueOnce(new Error('offline'));
    signIn.mockResolvedValue(undefined);
    const { authError } = setup(createFakeAuth({ isAuthenticated: true, signIn }));

    authError();
    await act(() => Promise.resolve());
    authError();

    expect(signIn).toHaveBeenCalledTimes(2);
  });
});
