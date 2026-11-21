import { useEffect } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router';
import { MainNav } from '../components/MainNav';
import { Page } from '../components/Page';
import { LoadingState } from '../components/states/LoadingState';
import { inBackground } from '../lib/background';
import { isWithin, usePendingPath } from '../lib/pendingNavigation';
import { preloadPages } from './pages';

/**
 * Pages of the signed-in app, with the main navigation first in the page
 * (keyboard order), shown at the top of a large screen and fixed at the
 * bottom of a phone. While the code of the next page loads (pages are
 * loaded on demand, and preloaded once signed in), the page gives way to the
 * loading state. Within a challenge, its sections swap below its header
 * instead (ChallengeDetailView): the page stays.
 */
export function AppShell() {
  const pending = usePendingPath();
  const challenge = matchPath(
    { path: '/challenges/:challengeId', end: false },
    useLocation().pathname,
  );
  const loading =
    pending !== undefined && !(challenge && isWithin(pending, challenge.pathnameBase));
  // Signed in, past the profile: the code of the other pages comes in the
  // background. A signed-out visitor, sent to sign in, downloads none of it.
  useEffect(() => inBackground(preloadPages), []);
  return (
    <div className="min-h-dvh">
      <MainNav />
      {/* Room for the fixed bottom bar on a phone. */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        {loading ? (
          <Page>
            <LoadingState />
          </Page>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
