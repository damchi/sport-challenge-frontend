import { useEffect, useRef } from 'react';
import type { Auth } from './auth';

/**
 * Handles lost sessions (authentication errors after a renewal attempt),
 * counted by `authErrors`: each new one clears the user's data, and signs out
 * once if signed in (a signed-out request that gets a 401 has no session to
 * end). A failed sign-out lets the next error try again.
 */
export function useSignOutOnAuthError(
  auth: Auth,
  authErrors: number,
  clearCache: () => void,
): void {
  const handledAuthErrors = useRef(0);
  const signingOut = useRef(false);

  useEffect(() => {
    if (authErrors === handledAuthErrors.current) return;
    handledAuthErrors.current = authErrors;
    clearCache();
    if (auth.isAuthenticated && !signingOut.current) {
      signingOut.current = true;
      auth.signOut().catch(() => {
        signingOut.current = false;
      });
    }
  }, [authErrors, auth, clearCache]);
}
