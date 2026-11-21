import { Outlet, useNavigation } from 'react-router';
import { MainNav } from '../components/MainNav';
import { Page } from '../components/Page';
import { LoadingState } from '../components/states/LoadingState';

/**
 * Pages of the signed-in app, with the main navigation first in the page
 * (keyboard order), shown at the top of a large screen and fixed at the
 * bottom of a phone. While the code of the next page loads (pages are
 * loaded on demand, and preloaded once the app is idle), the page gives way
 * to the loading state; without loaders, nothing else makes a navigation wait.
 */
export function AppShell() {
  const loading = useNavigation().state === 'loading';
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
