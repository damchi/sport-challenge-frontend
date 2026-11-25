import { useEffect, useRef } from 'react';
import { ApiError } from '../../api/errors';
import type { Auth } from './auth';

/** Latest authentication error of the query client, numbered so each one is handled once. */
export interface AuthErrorEvent {
  id: number;
  error: unknown;
}

/**
 * Why the session ended, when the app shows it instead of signing in again:
 * the account is gone (`account_deleted`), the user just deleted it
 * (`account_deleted_by_user`), an admin blocked it (`account_blocked`), or
 * the session could not be restored.
 */
export interface SessionEnd {
  reason: 'account_deleted' | 'account_deleted_by_user' | 'account_blocked' | 'unavailable';
  /** Page in use when it ended: a retry comes back to it. */
  returnTo: string;
}

/**
 * The session end to show: the first one stays, so a 401 right after a
 * deletion does not replace the user's own confirmation.
 */
export function firstSessionEnd(current: SessionEnd | undefined, next: SessionEnd): SessionEnd {
  return current ?? next;
}

/** Remembers automatic re-sign-ins across page loads, to stop a loop. */
export interface ReauthGuard {
  /** False right after an automatic re-sign-in: a new 401 would loop. */
  allowed: () => boolean;
  record: () => void;
  /** The re-sign-in did not start: it does not count. */
  forget: () => void;
}

interface LostSessionOptions {
  clearCache: () => void;
  /** Path to come back to after signing in again (the page in use). */
  currentPath: () => string;
  reauth: ReauthGuard;
  /** The session ended for good: the app shows why instead of the pages. */
  onSessionEnd: (end: SessionEnd) => void;
}

/**
 * Handles a lost session (authentication error after a renewal attempt).
 * While signed in, the user's data is cleared, then:
 * - a deleted account (`account_deleted`) or a blocked one (`account_blocked`)
 *   signs out locally, the app shows it;
 * - otherwise the app signs in again and comes back to the page in use,
 *   silently when the Auth0 session is still valid; if the API refuses the
 *   new session too (a 401 right after an automatic re-sign-in), it signs
 *   out locally and reports the session as unavailable rather than loop.
 * Signed out, there is no session to restore: nothing is done. While the
 * session loads, the error waits. A failed attempt lets the next error retry.
 */
export function useHandleLostSession(
  auth: Auth,
  authError: AuthErrorEvent | undefined,
  { clearCache, currentPath, reauth, onSessionEnd }: LostSessionOptions,
): void {
  const handled = useRef(0);
  const acting = useRef(false);

  useEffect(() => {
    if (!authError || authError.id === handled.current || auth.isLoading) return;
    handled.current = authError.id;
    if (!auth.isAuthenticated || acting.current) return;

    clearCache();
    acting.current = true;
    // The next authentication error may try again.
    const allowNextAttempt = () => {
      acting.current = false;
    };
    const code = authError.error instanceof ApiError ? authError.error.code : undefined;
    // Signing in again would not help: the account is gone or blocked.
    const ended = code === 'account_deleted' || code === 'account_blocked' ? code : undefined;
    if (ended || !reauth.allowed()) {
      onSessionEnd({ reason: ended ?? 'unavailable', returnTo: currentPath() });
      auth.signOut({ local: true }).catch(allowNextAttempt);
    } else {
      reauth.record();
      auth.signIn(currentPath()).catch(() => {
        reauth.forget();
        allowNextAttempt();
      });
    }
  }, [authError, auth, clearCache, currentPath, reauth, onSessionEnd]);
}

/**
 * Action of the session-end screen: a deleted or blocked account ends the
 * Auth0 session too; an unavailable session forgets the loop guard and signs in again,
 * back to the page in use.
 */
export function sessionEndAction(end: SessionEnd, auth: Auth, reauth: ReauthGuard): Promise<void> {
  if (end.reason !== 'unavailable') return auth.signOut();
  reauth.forget();
  return auth.signIn(end.returnTo);
}
