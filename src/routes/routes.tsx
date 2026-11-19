import type { RouteObject } from 'react-router';
import { CallbackPage } from '../pages/CallbackPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { ProfileGate } from './ProfileGate';
import { RequireAuth } from './RequireAuth';
import { RootLayout } from './RootLayout';

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      // Public: it finishes the sign-in.
      { path: '/callback', element: <CallbackPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <ProfileGate />,
            children: [
              { path: '/', element: <HomePage /> },
              { path: '/onboarding', element: <OnboardingPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
