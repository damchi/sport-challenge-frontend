import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from './auth';

/**
 * Signs out after dropping the user's data: the query cache now (the app
 * keeps no other local data). The sign-out page then leaves the app.
 */
export function useSignOut(): () => Promise<void> {
  const auth = useAuth();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    queryClient.clear();
    await auth.signOut();
  }, [auth, queryClient]);
}
