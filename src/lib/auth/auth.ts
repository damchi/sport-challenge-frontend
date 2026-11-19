import { createContext, useContext } from 'react';

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
  /** Redirects to the sign-in page, then back to `returnTo` (a path of the app). */
  signIn: (returnTo?: string) => Promise<void>;
  /** Revokes the session and leaves the app signed out. */
  signOut: () => Promise<void>;
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
 * Path to go back to after sign-in. Only a path of this app: an absolute or
 * protocol-relative address (`//evil.example`) would be an open redirect.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\')) return '/';
  return value;
}
