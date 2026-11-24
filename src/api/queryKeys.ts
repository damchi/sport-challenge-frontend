// Query keys of the whole app, in one place. They are hierarchical: invalidating
// a key also invalidates every key that starts with it (a challenge, then its
// leaderboards). Each ticket adds the keys of its hooks.

export const queryKeys = {
  me: ['me'] as const,
  sports: ['sports'] as const,
  activities: {
    // Reloaded once an activity is recorded, changed or deleted.
    all: ['activities'] as const,
    // Of one sport, or of every sport (`undefined`).
    // One cache per page size (10, 50, all).
    mine: (sport: string | undefined, size: string) =>
      ['activities', 'mine', sport ?? 'all', size] as const,
    // Every zone's summary: it also counts the challenges joined, so joining,
    // accepting an invitation or deleting a challenge reloads it.
    summaries: ['activities', 'summary'] as const,
    // Weeks and days cut in `timeZone`.
    summary: (timeZone: string) => ['activities', 'summary', timeZone] as const,
    weeks: (timeZone: string, sport?: string) =>
      ['activities', 'weeks', timeZone, sport ?? 'all'] as const,
  },
  invitations: {
    // The preview of a link; the token stays in memory only (gcTime 0).
    open: (token: string) => ['invitations', 'open', token] as const,
  },
  challenges: {
    all: ['challenges'] as const,
    // One cache per page size (10, 50, all).
    list: (scope: string, status: string | undefined, size: string) =>
      ['challenges', 'list', scope, status ?? 'all', size] as const,
    detail: (challengeId: string) => ['challenges', challengeId] as const,
    // One cache per page size; an object, so that it never reads as a user id.
    participants: (challengeId: string, size: string) =>
      ['challenges', challengeId, 'participants', { size }] as const,
    leaderboard: (challengeId: string) => ['challenges', challengeId, 'leaderboard'] as const,
    // One category, one cache per page size, under the leaderboard: invalidating
    // the leaderboard reloads them too. Their data is paged (infinite query),
    // not a whole Leaderboard: never read them by the leaderboard's prefix.
    leaderboardCategory: (challengeId: string, category: string, size: string) =>
      ['challenges', challengeId, 'leaderboard', category, { size }] as const,
    // Where the grand prix points of a participant come from, under the
    // leaderboard: it reloads with it, so that both always add up. Not a
    // category either: never read it by the leaderboard's prefix.
    participantPoints: (challengeId: string, userId: string) =>
      ['challenges', challengeId, 'leaderboard', 'breakdown', userId] as const,
    // Under the challenge: it reloads with the challenges once an activity changes.
    participantActivities: (challengeId: string, userId: string, size: string) =>
      ['challenges', challengeId, 'participants', userId, 'activities', size] as const,
    // Every participant's: under the challenge as well.
    activities: (challengeId: string, size: string) =>
      ['challenges', challengeId, 'activities', size] as const,
  },
  admin: {
    // Stale at once (useAdminStats): read again on each opening of the dashboard.
    stats: ['admin', 'stats'] as const,
  },
};
