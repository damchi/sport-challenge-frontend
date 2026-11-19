import type { Auth } from '../lib/auth/auth';

/** Test double of the authentication: signed out unless overridden. */
export function createFakeAuth(overrides: Partial<Auth> = {}): Auth {
  return {
    isLoading: false,
    isAuthenticated: false,
    user: undefined,
    hasError: false,
    signIn: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    getAccessToken: vi.fn(() => Promise.resolve(undefined)),
    ...overrides,
  };
}
