import { createContext, useContext } from 'react';
import { HOME_PATH } from '../paths';

/** Signed-in user, as far as authentication knows: the profile comes from the API. */
export interface AuthUser {
  /** Stable Auth0 identifier (`sub`), the only one the API trusts. */
  id: string;
}

/**
 * Authentication of the app, independent of the SDK (Auth0 on the web, a test
 * double in tests). Tokens stay in memory: never in the URL, storage or logs.
 */
export interface Auth {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | undefined;
  /** The last sign-in attempt failed (cancelled, expired code...). */
  hasError: boolean;
  /**
   * Someone signed in on this device and has not signed out since, even if
   * the session did not survive a reload: the landing page offers « Mon
   * compte » rather than « Se connecter ». Read when the session changes.
   */
  isReturning: boolean;
  /**
   * Redirects to the sign-in page, then back to `returnTo` (a path of the
   * app). `chooseAccount` shows the sign-in form even when Auth0 still has a
   * session, so another account can be used (after a refused or failed
   * sign-in, the same account would come back otherwise).
   */
  signIn: (returnTo?: string, options?: { chooseAccount?: boolean }) => Promise<void>;
  /**
   * Revokes the session and leaves the app signed out. `local` stays in the
   * app (no redirect to the sign-out page), to show a message afterwards.
   */
  signOut: (options?: { local?: boolean }) => Promise<void>;
  /** Access token for the API, or undefined when signed out; `forceRefresh` renews it. */
  getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | undefined>;
}

export const AuthContext = createContext<Auth | undefined>(undefined);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside an authentication provider');
  return auth;
}

/**
 * Path to go back to after sign-in. Only a path of this app (`origin`): an
 * absolute or protocol-relative address would be an open redirect. The value
 * is resolved like the browser would (it drops tabs and newlines, reads `\\`
 * as `/`), and kept only if it stays on the app's origin and its path does
 * not start with `//`: dot segments can resolve to one (`/.//evil.example`),
 * which a later navigation would read as another host.
 */
export function safeReturnTo(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return HOME_PATH;
  // new URL rather than URL.parse: the supported browsers (README §3,
  // Safari 15.4) lack the latter.
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== origin || url.pathname.startsWith('//')) return HOME_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}
