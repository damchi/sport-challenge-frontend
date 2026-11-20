import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import type { components } from '../generated/schema';

export type InvitationCreated = components['schemas']['InvitationCreated'];

/**
 * Creates an invitation link to a challenge, reusable until the end of week 1
 * (expires_at). The token is answered once: it stays in this mutation, never
 * in the query cache, and is never logged. Its errors (not allowed,
 * registration closed) are shown by the page, not the global banner.
 */
export function useCreateInvitation(challengeId: string) {
  const client = useApiClient();
  return useMutation({
    meta: { handlesError: true },
    // The token leaves the memory as soon as the invitation is no longer shown.
    gcTime: 0,
    mutationFn: async () => {
      const { data } = await client.POST('/api/v1/challenges/{challengeId}/invitations', {
        params: { path: { challengeId } },
      });
      if (!data) throw new Error('Empty invitation response');
      return data;
    },
  });
}
