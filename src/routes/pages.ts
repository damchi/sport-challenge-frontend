import type { LazyRouteFunction, RouteObject } from 'react-router';

// Each page is a chunk of its own, loaded when its route is first opened. The
// home page, the usual first page, the callback, which every sign-in passes
// through, and the not found page, which the admin guard shows too, stay in
// the main bundle: no extra request.
export const pages = {
  activities: () =>
    import('../pages/ActivitiesPage').then((m) => ({ Component: m.ActivitiesPage })),
  activityCreate: () =>
    import('../pages/ActivityCreatePage').then((m) => ({ Component: m.ActivityCreatePage })),
  activityEdit: () =>
    import('../pages/ActivityEditPage').then((m) => ({ Component: m.ActivityEditPage })),
  challenge: () => import('../pages/ChallengePage').then((m) => ({ Component: m.ChallengePage })),
  challengeCreate: () =>
    import('../pages/ChallengeCreatePage').then((m) => ({ Component: m.ChallengeCreatePage })),
  invite: () => import('../pages/InvitePage').then((m) => ({ Component: m.InvitePage })),
  onboarding: () =>
    import('../pages/OnboardingPage').then((m) => ({ Component: m.OnboardingPage })),
  profile: () => import('../pages/ProfilePage').then((m) => ({ Component: m.ProfilePage })),
  leaderboard: () =>
    import('../features/leaderboard/ChallengeLeaderboard').then((m) => ({
      Component: m.ChallengeLeaderboard,
    })),
  participants: () =>
    import('../features/challenges/detail/ChallengeParticipants').then((m) => ({
      Component: m.ChallengeParticipants,
    })),
  participantActivities: () =>
    import('../features/activities/ParticipantActivities').then((m) => ({
      Component: m.ParticipantActivities,
    })),
  challengeActivities: () =>
    import('../features/activities/ChallengeActivities').then((m) => ({
      Component: m.ChallengeActivities,
    })),
} satisfies Record<string, LazyRouteFunction<RouteObject>>;

/** Loads the code of every page, so that opening one later does not wait for it. */
export function preloadPages(): void {
  for (const load of Object.values(pages)) {
    // A failure is left to the route: opened, it shows RouteError, whose retry
    // reloads the app.
    load().catch(() => undefined);
  }
}
