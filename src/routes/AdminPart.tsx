import { lazy, Suspense } from 'react';
import { LoadingState } from '../components/states/LoadingState';

// Each part of the admin section is a chunk of its own, loaded on render:
// only once RequireAdmin has let the admin in (a router `lazy` would load it
// on matching the path, for anyone).
const PARTS = {
  dashboard: lazy(() =>
    import('../pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
  ),
  challenges: lazy(() =>
    import('../pages/AdminChallengesPage').then((m) => ({ default: m.AdminChallengesPage })),
  ),
  challenge: lazy(() =>
    import('../pages/AdminChallengePage').then((m) => ({ default: m.AdminChallengePage })),
  ),
  users: lazy(() => import('../pages/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))),
  user: lazy(() => import('../pages/AdminUserPage').then((m) => ({ default: m.AdminUserPage }))),
  journal: lazy(() =>
    import('../pages/AdminJournalPage').then((m) => ({ default: m.AdminJournalPage })),
  ),
};

/** A part of the admin section, under its navigation. */
export function AdminPart({ name }: { name: keyof typeof PARTS }) {
  const Part = PARTS[name];
  return (
    <Suspense
      fallback={
        <div className="mt-6">
          <LoadingState />
        </div>
      }
    >
      <Part />
    </Suspense>
  );
}
