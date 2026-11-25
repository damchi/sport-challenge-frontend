import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../ApiClientContext';
import type { components } from '../../generated/schema';

/** The profile fields an admin changes, as `PATCH /admin/users/{userId}` takes them. */
export type AdminProfileUpdate = Omit<components['schemas']['AdminUserUpdate'], 'reason'>;

/** A change an admin makes to an account, with the reason the journal keeps. */
export type AdminAccountChange =
  | { kind: 'update'; update: AdminProfileUpdate }
  | { kind: 'block' }
  | { kind: 'unblock' }
  | { kind: 'delete' };

/**
 * Changes an account for the admin: its pseudo and names, blocked or not,
 * or deleted (with the effect of deleting one's own account). None judges a
 * challenge again, hence no preview. Once made, every cached answer is read
 * again: a deletion takes the account out of its challenges. Its errors are
 * shown where the change was asked, not by the global banner.
 */
export function useAdminAccountChange(userId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    meta: { handlesError: true },
    mutationFn: async ({ change, reason }: { change: AdminAccountChange; reason: string }) => {
      const params = { path: { userId } };
      switch (change.kind) {
        case 'update':
          await client.PATCH('/api/v1/admin/users/{userId}', {
            params,
            body: { ...change.update, reason },
          });
          return;
        case 'block':
          await client.POST('/api/v1/admin/users/{userId}/block', { params, body: { reason } });
          return;
        case 'unblock':
          await client.POST('/api/v1/admin/users/{userId}/unblock', { params, body: { reason } });
          return;
        case 'delete':
          // The reason goes in the body of the DELETE, as the contract asks.
          await client.DELETE('/api/v1/admin/users/{userId}', { params, body: { reason } });
          return;
      }
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
