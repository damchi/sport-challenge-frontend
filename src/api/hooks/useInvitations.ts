import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../ApiClientContext';
import { ApiError } from '../errors';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

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

/**
 * Opens an invitation link: the challenge it leads to, which the user may
 * then read (`useChallenge`) and join. Opening again changes nothing, so it
 * is not sent again while the page stays open. The token goes in the body,
 * never in a URL, and leaves the memory with the page (gcTime 0). Every
 * invalid link answers the same 404 `invitation_invalid`.
 */
export function useOpenInvitation(token: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.invitations.open(token),
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const { data } = await client.POST('/api/v1/invitations/open', {
        body: { token },
        signal,
      });
      if (!data) throw new Error('Empty invitation preview');
      return data;
    },
  });
}

/**
 * Accepts an invitation: joins its challenge, whose page then shows the
 * answer, and the lists and leaderboards reload with the new participant.
 * Its errors are shown by the page, not the global banner; the challenge
 * then reloads, so the page says why joining is no longer possible. A
 * profile the server finds incomplete reloads the profile: the profile gate
 * then leads to onboarding, and back to the invitation.
 */
export function useAcceptInvitation(challengeId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    // The token it was sent with leaves the memory with the page.
    gcTime: 0,
    mutationFn: async (token: string) => {
      const { data } = await client.POST('/api/v1/invitations/accept', { body: { token } });
      if (!data) throw new Error('Empty challenge response');
      return data;
    },
    onSuccess: (challenge) => {
      queryClient.setQueryData(queryKeys.challenges.detail(challenge.id), challenge);
      // The summary counts the challenges joined (profile).
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.challenges.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activities.summaries }),
      ]);
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code === 'profile_incomplete') {
        return queryClient.invalidateQueries({ queryKey: queryKeys.me });
      }
      // The challenge of a link no longer valid may be out of sight: no reload.
      if (code === 'invitation_invalid') return undefined;
      return queryClient.invalidateQueries({
        queryKey: queryKeys.challenges.detail(challengeId),
      });
    },
  });
}
