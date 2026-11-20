import type { RouteObject } from 'react-router';
import { ChallengeParticipants } from '../features/challenges/detail/ChallengeParticipants';
import { ChallengeLeaderboard } from '../features/leaderboard/ChallengeLeaderboard';
import { TabPending } from '../features/challenges/detail/TabPending';
import { ParticipantActivities } from '../features/activities/ParticipantActivities';
import { ActivitiesPage } from '../pages/ActivitiesPage';
import { ActivityCreatePage } from '../pages/ActivityCreatePage';
import { ActivityEditPage } from '../pages/ActivityEditPage';
import { CallbackPage } from '../pages/CallbackPage';
import { ChallengeCreatePage } from '../pages/ChallengeCreatePage';
import { ChallengePage } from '../pages/ChallengePage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AppShell } from './AppShell';
import { ProfileGate } from './ProfileGate';
import { RequireAuth } from './RequireAuth';
import { RootLayout } from './RootLayout';
import type { RouteHandle } from './routeHandle';

const title = (titleKey: string): RouteHandle => ({ titleKey });

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
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
                element: <OnboardingPage />,
                handle: title('onboarding.title'),
              },
              {
                element: <AppShell />,
                children: [
                  { path: '/', element: <HomePage />, handle: title('nav.challenges') },
                  {
                    path: '/challenges/new',
                    element: <ChallengeCreatePage />,
                    handle: title('challengeCreate.title'),
                  },
                  {
                    // Sections of the challenge: the leaderboard is its first page.
                    path: '/challenges/:challengeId',
                    element: <ChallengePage />,
                    handle: title('challengeDetail.title'),
                    children: [
                      { index: true, element: <ChallengeLeaderboard /> },
                      { path: 'participants', element: <ChallengeParticipants /> },
                      { path: 'participants/:userId', element: <ParticipantActivities /> },
                      { path: 'activities', element: <TabPending /> },
                    ],
                  },
                  {
                    path: '/activities',
                    element: <ActivitiesPage />,
                    handle: title('activities.title'),
                  },
                  {
                    path: '/activities/new',
                    element: <ActivityCreatePage />,
                    handle: title('activityForm.title'),
                  },
                  {
                    path: '/activities/:activityId/edit',
                    element: <ActivityEditPage />,
                    handle: title('activityEdit.title'),
                  },
                  { path: '/me', element: <ProfilePage />, handle: title('nav.profile') },
                  { path: '*', element: <NotFoundPage />, handle: title('notFound.title') },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
