import type { Auth0ProviderOptions } from '@auth0/auth0-react';
import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import { Auth0AuthProvider } from './Auth0AuthProvider';

const sdk = vi.hoisted(() => ({
  providerProps: undefined as unknown,
  state: {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'auth0|123', email: 'private@example.com' } as { sub?: string } | undefined,
    error: undefined as Error | undefined,
  },
  loginWithRedirect: vi.fn(() => Promise.resolve()),
  logout: vi.fn(() => Promise.resolve()),
  getAccessTokenSilently: vi.fn(() => Promise.resolve('access-token')),
  revokeRefreshToken: vi.fn(() => Promise.resolve()),
}));

vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: (props: { children: ReactNode }) => {
    sdk.providerProps = props;
    return props.children;
  },
  useAuth0: () => ({
    ...sdk.state,
    loginWithRedirect: sdk.loginWithRedirect,
    logout: sdk.logout,
    getAccessTokenSilently: sdk.getAccessTokenSilently,
    revokeRefreshToken: sdk.revokeRefreshToken,
  }),
}));

const config = { domain: 'auth.test', clientId: 'client-id', audience: 'https://api.test' };

function renderAuthHook(onRedirect = vi.fn()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Auth0AuthProvider config={config} onRedirect={onRedirect}>
      {children}
    </Auth0AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

function renderAuth(onRedirect = vi.fn()) {
  return renderAuthHook(onRedirect).result;
}

function providerProps(): Auth0ProviderOptions {
  return sdk.providerProps as Auth0ProviderOptions;
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.state = {
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'auth0|123' },
    error: undefined,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Auth0AuthProvider', () => {
  it('asks for an API access token, kept in memory with refresh tokens', () => {
    render(
      <Auth0AuthProvider config={config} onRedirect={vi.fn()}>
        {null}
      </Auth0AuthProvider>,
    );

    expect(providerProps()).toMatchObject({
      domain: 'auth.test',
      clientId: 'client-id',
      authorizationParams: {
        audience: 'https://api.test',
        redirect_uri: `${window.location.origin}/callback`,
      },
      cacheLocation: 'memory',
      useRefreshTokens: true,
      // jsdom starts on /, not /callback.
      skipRedirectCallback: true,
    });
  });

  it('handles the sign-in code only on /callback', () => {
    window.history.pushState({}, '', '/callback?code=abc&state=xyz');
    render(
      <Auth0AuthProvider config={config} onRedirect={vi.fn()}>
        {null}
      </Auth0AuthProvider>,
    );
    window.history.pushState({}, '', '/');

    expect(providerProps().skipRedirectCallback).toBe(false);
  });

  it('exposes only the user identifier', () => {
    expect(renderAuth().current.user).toEqual({ id: 'auth0|123' });
  });

  it('signs in with the return path and the app language', async () => {
    await renderAuth().current.signIn('/challenges/42');

    expect(sdk.loginWithRedirect).toHaveBeenCalledWith({
      appState: { returnTo: '/challenges/42' },
      authorizationParams: { ui_locales: 'fr' },
    });
  });

  it('can show the sign-in form to choose another account', async () => {
    await renderAuth().current.signIn('/', { chooseAccount: true });

    expect(sdk.loginWithRedirect).toHaveBeenCalledWith({
      appState: { returnTo: '/' },
      authorizationParams: { ui_locales: 'fr', prompt: 'login' },
    });
  });

  it('opens only a path of the app after sign-in', () => {
    const onRedirect = vi.fn();
    renderAuth(onRedirect);

    providerProps().onRedirectCallback?.({ returnTo: 'https://evil.example' });
    providerProps().onRedirectCallback?.({ returnTo: '/challenges/42' });

    expect(onRedirect.mock.calls).toEqual([['/challenges'], ['/challenges/42']]);
  });

  it('revokes the refresh token before signing out', async () => {
    await renderAuth().current.signOut();

    expect(sdk.revokeRefreshToken).toHaveBeenCalledBefore(sdk.logout);
    expect(sdk.logout).toHaveBeenCalledWith({ logoutParams: { returnTo: window.location.origin } });
  });

  it('can sign out locally, without leaving the app', async () => {
    await renderAuth().current.signOut({ local: true });

    expect(sdk.revokeRefreshToken).toHaveBeenCalledBefore(sdk.logout);
    expect(sdk.logout).toHaveBeenCalledWith({ openUrl: false });
  });

  it('gives the cached access token, or renews it on demand', async () => {
    const auth = renderAuth();

    expect(await auth.current.getAccessToken()).toBe('access-token');
    await auth.current.getAccessToken({ forceRefresh: true });

    expect(sdk.getAccessTokenSilently.mock.calls).toEqual([
      [{ cacheMode: 'on' }],
      [{ cacheMode: 'off' }],
    ]);
  });

  it('waits for the session to load before giving a token', async () => {
    sdk.state = { ...sdk.state, isLoading: true, isAuthenticated: false, user: undefined };
    const { result, rerender } = renderAuthHook();

    const token = result.current.getAccessToken();
    sdk.state = {
      ...sdk.state,
      isLoading: false,
      isAuthenticated: true,
      user: { sub: 'auth0|123' },
    };
    rerender();

    expect(await token).toBe('access-token');
  });

  it('stops waiting for a session that never loads', async () => {
    vi.useFakeTimers();
    sdk.state = { ...sdk.state, isLoading: true, isAuthenticated: false, user: undefined };
    const token = renderAuth().current.getAccessToken();
    const failed = expect(token).rejects.toThrow('did not load in time');

    await vi.advanceTimersByTimeAsync(15_000);

    await failed;
  });

  it('throws a failure that is not a lost session', async () => {
    sdk.getAccessTokenSilently.mockRejectedValueOnce(
      Object.assign(new Error('Timeout'), { error: 'timeout' }),
    );

    await expect(renderAuth().current.getAccessToken()).rejects.toThrow('Timeout');
  });

  it('gives no token when signed out or when the renewal fails', async () => {
    sdk.getAccessTokenSilently.mockRejectedValueOnce(
      Object.assign(new Error('Login required'), { error: 'login_required' }),
    );
    expect(await renderAuth().current.getAccessToken({ forceRefresh: true })).toBeUndefined();

    sdk.state = { ...sdk.state, isAuthenticated: false, user: undefined };
    expect(await renderAuth().current.getAccessToken()).toBeUndefined();
  });
});
describe('Auth0AuthProvider returning user', () => {
  afterEach(() => localStorage.clear());

  it('remembers on the device that someone signed in', () => {
    const result = renderAuth();

    expect(result.current.isReturning).toBe(true);
    sdk.state = { ...sdk.state, isAuthenticated: false, user: undefined };
    expect(renderAuth().current.isReturning).toBe(true);
  });

  it('is not returning on a device where nobody signed in', () => {
    sdk.state = { ...sdk.state, isAuthenticated: false, user: undefined };

    expect(renderAuth().current.isReturning).toBe(false);
  });

  it('forgets it on sign-out', async () => {
    const result = renderAuth();

    await result.current.signOut({ local: true });
    sdk.state = { ...sdk.state, isAuthenticated: false, user: undefined };

    expect(renderAuth().current.isReturning).toBe(false);
  });
});
