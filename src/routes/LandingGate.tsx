import { lazy, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';
import { LoadingState } from '../components/states/LoadingState';
import { Page } from '../components/Page';
import { useAuth } from '../lib/auth/auth';

// Its own chunk: the signed-in app never loads it.
const LandingPage = lazy(() =>
  import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);

function Loading() {
  return (
    <Page>
      <LoadingState />
    </Page>
  );
}

/**
 * `/` shows the public landing page to a visitor; a signed-in user, or one who
 * signed in on this device and did not sign out, goes on to their challenges
 * (signed in again if needed, by RequireAuth). Every other path is protected
 * as before: a deep link signs in, then comes back.
 */
export function LandingGate() {
  const auth = useAuth();
  const { pathname } = useLocation();

  if (pathname !== '/' || auth.isAuthenticated || auth.isReturning || auth.hasError) {
    return <Outlet />;
  }
  // The session may still come back (silent sign-in): no landing page flash.
  if (auth.isLoading) return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <LandingPage />
    </Suspense>
  );
}
