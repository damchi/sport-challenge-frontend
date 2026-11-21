import type { LazyRouteFunction, RouteObject } from 'react-router';
import { Page } from '../components/Page';
import { LoadingState } from '../components/states/LoadingState';
import { CallbackPage } from '../pages/CallbackPage';
import { HomePage } from '../pages/HomePage';
import { AppShell } from './AppShell';
import { ProfileGate } from './ProfileGate';
import { RequireAuth } from './RequireAuth';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';
import type { RouteHandle } from './routeHandle';

const title = (titleKey: string): RouteHandle => ({ titleKey });

// Each page is a chunk of its own, loaded when its route is first opened. The
// home page, the usual first page, and the callback, which every sign-in
// passes through, stay in the main bundle: no extra request.
const pages = {
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
  notFound: () => import('../pages/NotFoundPage').then((m) => ({ Component: m.NotFoundPage })),
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
  pending: () =>
    import('../features/challenges/detail/TabPending').then((m) => ({ Component: m.TabPending })),
} satisfies Record<string, LazyRouteFunction<RouteObject>>;

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    // A page whose code fails to load; rendering errors stay in RootLayout's boundary.
    errorElement: <RouteError />,
    // While the code of the page opened first loads.
    hydrateFallbackElement: (
      <Page>
        <LoadingState />
      </Page>
    ),
    children: [
      // Public: it finishes the sign-in.
      { path: '/callback', element: <CallbackPage />, handle: title('auth.callback.title') },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <ProfileGate />,
            children: [
              {
                path: '/onboarding',
                lazy: pages.onboarding,
                handle: title('onboarding.title'),
              },
              {
                element: <AppShell />,
                children: [
                  { path: '/', element: <HomePage />, handle: title('nav.challenges') },
                  {
                    path: '/challenges/new',
                    lazy: pages.challengeCreate,
                    handle: title('challengeCreate.title'),
                  },
                  {
                    // Sections of the challenge: the leaderboard is its first page.
                    path: '/challenges/:challengeId',
                    lazy: pages.challenge,
                    handle: title('challengeDetail.title'),
                    children: [
                      { index: true, lazy: pages.leaderboard },
                      { path: 'participants', lazy: pages.participants },
                      { path: 'participants/:userId', lazy: pages.participantActivities },
                      { path: 'activities', lazy: pages.pending },
                    ],
                  },
                  {
                    path: '/activities',
                    lazy: pages.activities,
                    handle: title('activities.title'),
                  },
                  {
                    path: '/activities/new',
                    lazy: pages.activityCreate,
                    handle: title('activityForm.title'),
                  },
                  {
                    path: '/activities/:activityId/edit',
                    lazy: pages.activityEdit,
                    handle: title('activityEdit.title'),
                  },
                  {
                    // The token is in the fragment: never sent to the host.
                    path: '/invite',
                    lazy: pages.invite,
                    handle: title('invitationPage.title'),
                  },
                  { path: '/me', lazy: pages.profile, handle: title('nav.profile') },
                  { path: '*', lazy: pages.notFound, handle: title('notFound.title') },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
