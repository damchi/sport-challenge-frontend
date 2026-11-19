import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import i18n from 'i18next';
import { useMemo, type ReactNode } from 'react';
import type { Config } from '../config';
import { AuthContext, safeReturnTo, type Auth } from './auth';

// Errors meaning there is no session to get a token from: the user is signed
// out. Any other failure (network, timeout) is thrown, not taken for a sign-out.
const SIGNED_OUT_ERRORS = new Set([
  'login_required',
  'consent_required',
  'missing_refresh_token',
  'invalid_grant',
]);

function isSignedOutError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof error.error === 'string' &&
    SIGNED_OUT_ERRORS.has(error.error)
  );
}

interface Auth0AuthProviderProps {
  config: Config['auth0'];
  /** Called after sign-in with the path to show (already checked). */
  onRedirect: (returnTo: string) => void;
  children: ReactNode;
}

function Auth0Bridge({ children }: { children: ReactNode }) {
  const {
    isLoading,
    isAuthenticated,
    user,
    error,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    revokeRefreshToken,
  } = useAuth0();

  const auth = useMemo<Auth>(
    () => ({
      isLoading,
      isAuthenticated,
      user: user?.sub ? { id: user.sub } : undefined,
      hasError: error !== undefined,
      signIn: (returnTo) =>
        loginWithRedirect({
          appState: { returnTo: safeReturnTo(returnTo) },
          // The sign-in page speaks the app's language.
          authorizationParams: { ui_locales: i18n.language },
        }),
      signOut: async () => {
        // The logout redirect does not revoke the refresh token: revoke it first.
        await revokeRefreshToken().catch(() => undefined);
        await logout({ logoutParams: { returnTo: window.location.origin } });
      },
      getAccessToken: async ({ forceRefresh = false } = {}) => {
        if (!isAuthenticated) return undefined;
        try {
          return await getAccessTokenSilently({ cacheMode: forceRefresh ? 'off' : 'on' });
        } catch (error) {
          // Session lost (refresh token expired or revoked): signed out.
          if (isSignedOutError(error)) return undefined;
          throw error;
        }
      },
    }),
    [
      isLoading,
      isAuthenticated,
      user,
      error,
      loginWithRedirect,
      logout,
      getAccessTokenSilently,
      revokeRefreshToken,
    ],
  );

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/**
 * Auth0 (Authorization Code with PKCE). The access token is issued for the API
 * (audience), kept in memory with a rotating refresh token, never in storage.
 * After a reload, the session comes back through Auth0's silent sign-in when
 * the browser allows it; otherwise the user signs in again.
 */
export function Auth0AuthProvider({ config, onRedirect, children }: Auth0AuthProviderProps) {
  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        audience: config.audience,
        redirect_uri: `${window.location.origin}/callback`,
      }}
      cacheLocation="memory"
      useRefreshTokens
      useRefreshTokensFallback
      // Only /callback carries Auth0's code and state: another page may use a
      // `code` parameter of its own (an invitation...).
      skipRedirectCallback={window.location.pathname !== '/callback'}
      onRedirectCallback={(appState) => onRedirect(safeReturnTo(appState?.returnTo))}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}
