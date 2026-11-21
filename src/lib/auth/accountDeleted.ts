import { createContext, useContext } from 'react';
import type { Auth } from './auth';
import type { SessionEnd } from './useHandleLostSession';

/** Called once the user deleted their account: provided by the app. */
export const AccountDeletedContext = createContext<(() => void) | undefined>(undefined);

export function useAccountDeleted(): () => void {
  const onDeleted = useContext(AccountDeletedContext);
  if (!onDeleted) throw new Error('useAccountDeleted must be used inside the app');
  return onDeleted;
}

/**
 * Ends the session of an account the user just deleted: their data is
 * dropped, the app shows the account is gone and signs out locally; the
 * screen's button then ends the Auth0 session too.
 */
export function accountDeletedHandler(
  auth: Auth,
  { clearCache, onSessionEnd }: { clearCache: () => void; onSessionEnd: (end: SessionEnd) => void },
): () => void {
  return () => {
    clearCache();
    onSessionEnd({ reason: 'account_deleted_by_user', returnTo: '/' });
    // A local sign-out only drops the tokens kept in memory: the screen is
    // shown either way, and its button signs out for good.
    auth.signOut({ local: true }).catch(() => undefined);
  };
}
