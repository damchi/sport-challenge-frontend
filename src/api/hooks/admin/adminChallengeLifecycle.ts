import type { ApiClient } from '../../client';
import type { CorrectionBody } from './useAdminCorrection';

/** Delete a challenge, or restore a deleted one. */
export type AdminChallengeLifecycleChange = 'delete' | 'restore';

/**
 * Deletes or restores a challenge for the admin, with the reason the journal
 * keeps (`dry_run` for the preview of a restore). The server says what it did.
 */
export async function sendAdminChallengeLifecycleChange(
  client: ApiClient,
  change: AdminChallengeLifecycleChange,
  challengeId: string,
  body: CorrectionBody,
) {
  const params = { path: { challengeId } };
  if (change === 'delete') {
    // The reason goes in the body of the DELETE, as the contract asks.
    const { data } = await client.DELETE('/api/v1/admin/challenges/{challengeId}', {
      params,
      body,
    });
    return data;
  }
  const { data } = await client.POST('/api/v1/admin/challenges/{challengeId}/restore', {
    params,
    body,
  });
  return data;
}
