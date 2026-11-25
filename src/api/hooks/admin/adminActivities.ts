import type { ApiClient } from '../../client';
import type { components } from '../../generated/schema';
import type { CorrectionBody } from './useAdminCorrection';

/** The fields of an activity an admin writes, besides the reason and the preview. */
export type AdminActivityFields = Omit<
  components['schemas']['AdminActivityWrite'],
  'reason' | 'dry_run'
>;

/** What an admin does to an account's activity, in any week. */
export type AdminActivityChange =
  | { kind: 'add'; userId: string; activity: AdminActivityFields }
  | { kind: 'edit'; activityId: string; activity: AdminActivityFields }
  | { kind: 'delete'; activityId: string };

/**
 * Makes a change to an account's activity, as `RecomputeFlow` sends it:
 * previewed (`dry_run`), then made with the reason. Locked weeks and finished
 * challenges refuse nothing; the server judges again every challenge where
 * the activity counts, and says which.
 */
export async function sendAdminActivityChange(
  client: ApiClient,
  change: AdminActivityChange,
  body: CorrectionBody,
) {
  switch (change.kind) {
    case 'add': {
      const { data } = await client.POST('/api/v1/admin/users/{userId}/activities', {
        params: { path: { userId: change.userId } },
        body: { ...change.activity, ...body },
      });
      return data;
    }
    case 'edit': {
      const { data } = await client.PATCH('/api/v1/admin/activities/{activityId}', {
        params: { path: { activityId: change.activityId } },
        body: { ...change.activity, ...body },
      });
      return data;
    }
    case 'delete': {
      // The reason goes in the body of the DELETE, as the contract asks.
      const { data } = await client.DELETE('/api/v1/admin/activities/{activityId}', {
        params: { path: { activityId: change.activityId } },
        body,
      });
      return data;
    }
  }
}
