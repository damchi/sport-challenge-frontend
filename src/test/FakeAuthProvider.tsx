import type { ReactNode } from 'react';
import { AuthContext, type Auth } from '../lib/auth/auth';

/** Provides a test double of the authentication (see createFakeAuth). */
export function FakeAuthProvider({ auth, children }: { auth: Auth; children: ReactNode }) {
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
