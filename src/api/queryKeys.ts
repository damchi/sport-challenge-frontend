// Query keys of the whole app, in one place. They are hierarchical: invalidating
// a key also invalidates every key that starts with it (a challenge, then its
// leaderboards). Each ticket adds the keys of its hooks.

export const queryKeys = {
  me: ['me'] as const,
  challenges: {
    list: (scope: string, status: string | undefined) =>
      ['challenges', 'list', scope, status ?? 'all'] as const,
    detail: (challengeId: string) => ['challenges', challengeId] as const,
    leaderboard: (challengeId: string, categoryId: string) =>
      ['challenges', challengeId, 'leaderboard', categoryId] as const,
  },
};
