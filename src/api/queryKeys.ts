// Query keys of the whole app, in one place. They are hierarchical: invalidating
// a key also invalidates every key that starts with it (a challenge, then its
// leaderboards). Each ticket adds the keys of its hooks.

export const queryKeys = {
  me: ['me'] as const,
  sports: ['sports'] as const,
  activities: {
    // Reloaded once an activity is recorded; the lists of activities nest under it.
    all: ['activities'] as const,
  },
  challenges: {
    all: ['challenges'] as const,
    list: (scope: string, status: string | undefined) =>
      ['challenges', 'list', scope, status ?? 'all'] as const,
    detail: (challengeId: string) => ['challenges', challengeId] as const,
    participants: (challengeId: string) => ['challenges', challengeId, 'participants'] as const,
    leaderboard: (challengeId: string) => ['challenges', challengeId, 'leaderboard'] as const,
  },
};
