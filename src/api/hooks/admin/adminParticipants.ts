import type { ParticipantChange } from '../../../domain/adminParticipants';
import type { ApiClient } from '../../client';
import type { CorrectionBody } from './useAdminCorrection';

/** What an admin may do to an account in a challenge: add it, or change its part. */
export type AdminParticipantChange = 'add' | ParticipantChange;

/**
 * Makes a change to an account in a challenge, as `RecomputeFlow` sends it:
 * previewed (`dry_run`), then made with the reason. Each judges the
 * challenge again; the server says what it did.
 */
export async function sendAdminParticipantChange(
  client: ApiClient,
  change: AdminParticipantChange,
  challengeId: string,
  userId: string,
  body: CorrectionBody,
) {
  const path = { challengeId, userId };
  switch (change) {
    case 'add': {
      const { data } = await client.POST('/api/v1/admin/challenges/{challengeId}/participants', {
        params: { path: { challengeId } },
        body: { user_id: userId, ...body },
      });
      return data;
    }
    case 'exclude': {
      // The reason goes in the body of the DELETE, as the contract asks.
      const { data } = await client.DELETE(
        '/api/v1/admin/challenges/{challengeId}/participants/{userId}',
        { params: { path }, body },
      );
      return data;
    }
    case 'reinstate': {
      const { data } = await client.POST(
        '/api/v1/admin/challenges/{challengeId}/participants/{userId}/reinstate',
        { params: { path }, body },
      );
      return data;
    }
    case 'makeCreator': {
      const { data } = await client.PUT(
        '/api/v1/admin/challenges/{challengeId}/creators/{userId}',
        { params: { path }, body },
      );
      return data;
    }
    case 'removeCreator': {
      const { data } = await client.DELETE(
        '/api/v1/admin/challenges/{challengeId}/creators/{userId}',
        { params: { path }, body },
      );
      return data;
    }
  }
}
