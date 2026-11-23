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
    mine: (sport?: string) => ['activities', 'mine', sport ?? 'all'] as const,
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
    list: (scope: string, status: string | undefined) =>
      ['challenges', 'list', scope, status ?? 'all'] as const,
    detail: (challengeId: string) => ['challenges', challengeId] as const,
    participants: (challengeId: string) => ['challenges', challengeId, 'participants'] as const,
    leaderboard: (challengeId: string) => ['challenges', challengeId, 'leaderboard'] as const,
    // Under the challenge: it reloads with the challenges once an activity changes.
    participantActivities: (challengeId: string, userId: string) =>
      ['challenges', challengeId, 'participants', userId, 'activities'] as const,
    // Every participant's: under the challenge as well.
    activities: (challengeId: string) => ['challenges', challengeId, 'activities'] as const,
  },
};
