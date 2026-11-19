import { useEffect, useRef } from 'react';
import type { Auth } from './auth';

/**
 * Handles lost sessions (authentication errors after a renewal attempt),
 * counted by `authErrors`: while signed in, each new one clears the user's
 * data and signs out once. Signed out, there is no session to end nor
 * personal data cached, and clearing would refetch mounted screens into a
 * 401 loop: nothing is done. A failed sign-out lets the next error try again.
 */
export function useSignOutOnAuthError(
  auth: Auth,
  authErrors: number,
  clearCache: () => void,
): void {
  const handledAuthErrors = useRef(0);
  const signingOut = useRef(false);

  useEffect(() => {
    // While the session loads, keep the error for when it is known.
    if (authErrors === handledAuthErrors.current || auth.isLoading) return;
    handledAuthErrors.current = authErrors;
    if (!auth.isAuthenticated) return;
    clearCache();
    if (!signingOut.current) {
      signingOut.current = true;
      auth.signOut().catch(() => {
        signingOut.current = false;
      });
    }
  }, [authErrors, auth, clearCache]);
}
