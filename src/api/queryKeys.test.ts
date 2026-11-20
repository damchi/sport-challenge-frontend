import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('nests a leaderboard under its challenge', () => {
    expect(queryKeys.challenges.leaderboard('c1')).toEqual(['challenges', 'c1', 'leaderboard']);
    expect(queryKeys.challenges.detail('c1')).toEqual(['challenges', 'c1']);
  });

  it('invalidates a challenge with its leaderboards, and only that challenge', async () => {
    const client = new QueryClient();
    const keys = {
      detail: queryKeys.challenges.detail('c1'),
      leaderboard: queryKeys.challenges.leaderboard('c1'),
      other: queryKeys.challenges.leaderboard('c2'),
    };
    for (const key of Object.values(keys)) client.setQueryData(key, { items: [] });

    await client.invalidateQueries({ queryKey: queryKeys.challenges.detail('c1') });

    expect(client.getQueryState(keys.detail)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.leaderboard)?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.other)?.isInvalidated).toBe(false);
  });
});
