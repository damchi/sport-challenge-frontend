import { act, renderHook } from '@testing-library/react';
import { ApiError } from '../../api/errors';
import { createFakeAuth } from '../../test/fakeAuth';
import type { Auth } from './auth';
import {
  sessionEndAction,
  useHandleLostSession,
  type AuthErrorEvent,
} from './useHandleLostSession';

const tokenExpired = new ApiError('token_expired', 401);

function setup(initialAuth: Auth, { reauthAllowed = true } = {}) {
  const options = {
    clearCache: vi.fn(),
    currentPath: () => '/challenges/42',
    reauth: { allowed: vi.fn(() => reauthAllowed), record: vi.fn(), forget: vi.fn() },
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
    expect(onSessionEnd).toHaveBeenCalledWith({
      reason: 'unavailable',
      returnTo: '/challenges/42',
    });
  });

  it('signs out locally and reports a deleted account', () => {
    const auth = signedIn();
    const { clearCache, onSessionEnd, authError } = setup(auth);

    authError(new ApiError('account_deleted', 401));

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(onSessionEnd).toHaveBeenCalledWith({
      reason: 'account_deleted',
      returnTo: '/challenges/42',
    });
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

  it('tries again on the next error after a failed attempt, which does not count', async () => {
    const signIn = vi.fn<Auth['signIn']>().mockRejectedValueOnce(new Error('offline'));
    signIn.mockResolvedValue(undefined);
    const { reauth, authError } = setup(createFakeAuth({ isAuthenticated: true, signIn }));

    authError();
    await act(() => Promise.resolve());
    expect(reauth.forget).toHaveBeenCalledTimes(1);
    authError();

    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('lets the next error try again when the local sign-out failed', async () => {
    const signOut = vi.fn<Auth['signOut']>().mockRejectedValueOnce(new Error('failed'));
    signOut.mockResolvedValue(undefined);
    const { onSessionEnd, authError } = setup(createFakeAuth({ isAuthenticated: true, signOut }), {
      reauthAllowed: false,
    });

    authError();
    await act(() => Promise.resolve());
    authError();

    expect(onSessionEnd).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenCalledTimes(2);
  });
});

describe('sessionEndAction', () => {
  const reauth = () => ({ allowed: vi.fn(() => true), record: vi.fn(), forget: vi.fn() });

  it('ends the Auth0 session of a deleted account', async () => {
    const auth = createFakeAuth();

    await sessionEndAction(
      { reason: 'account_deleted', returnTo: '/challenges/42' },
      auth,
      reauth(),
    );

    expect(auth.signOut).toHaveBeenCalledWith();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('retries the sign-in back to the page in use, with the loop guard reset', async () => {
    const auth = createFakeAuth();
    const guard = reauth();

    await sessionEndAction({ reason: 'unavailable', returnTo: '/challenges/42' }, auth, guard);

    expect(guard.forget).toHaveBeenCalledTimes(1);
    expect(auth.signIn).toHaveBeenCalledWith('/challenges/42');
  });
});
