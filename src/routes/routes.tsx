import type { RouteObject } from 'react-router';
import { CallbackPage } from '../pages/CallbackPage';
import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RootLayout } from './RootLayout';

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/callback', element: <CallbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
