import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../ApiClientContext';
import type { ApiClient } from '../../client';
import type { components } from '../../generated/schema';

export type AdminCorrection = components['schemas']['AdminCorrection'];
export type AdminChallengePreview = components['schemas']['AdminChallengePreview'];
export type AdminEliminationChange = components['schemas']['AdminEliminationChange'];

/**
 * What every admin change that judges a challenge again sends, besides its
 * own fields. No reason for a preview (asked from the API: SC-API-176,
 * damchi/sport-challenge-api#337): it is given once the preview is seen.
 */
export interface CorrectionBody {
  reason?: string;
  /** Preview the change: the server rolls everything back. */
  dry_run: boolean;
}

/**
 * Sends an admin change that judges challenges again: `send` makes its
 * request with `dry_run` and, for the change itself, the reason, and gives the server's answer.
 * Once a change is made (not a preview), every cached answer is read
 * again: it may move any ranking, challenge or account. Its errors are shown
 * by the reason dialog, not the global banner.
 */
export function useAdminCorrection(
  send: (client: ApiClient, body: CorrectionBody) => Promise<AdminCorrection | undefined>,
) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async (body: CorrectionBody) => {
      const data = await send(client, body);
      if (!data) throw new Error('Empty admin correction');
      return data;
    },
    onSuccess: async (_correction, body) => {
      if (!body.dry_run) await queryClient.invalidateQueries();
    },
  });
}
