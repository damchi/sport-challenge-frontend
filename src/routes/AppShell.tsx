import { Outlet } from 'react-router';
import { MainNav } from '../components/MainNav';

/**
 * Pages of the signed-in app, with the main navigation first in the page
 * (keyboard order), shown at the top of a large screen and fixed at the
 * bottom of a phone.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh">
      <MainNav />
      {/* Room for the fixed bottom bar on a phone. */}
      <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </div>
    </div>
  );
}
