import { lazy, Suspense } from 'react';
import { LoadingState } from '../components/states/LoadingState';

// A chunk of its own, loaded on render: only once RequireAdmin has let the
// admin in (a router `lazy` would load it on matching the path, for anyone).
const AdminDashboardPage = lazy(() =>
  import('../pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);

/** The dashboard, first part of the admin section, under its navigation. */
export function AdminDashboardRoute() {
  return (
    <Suspense
      fallback={
        <div className="mt-6">
          <LoadingState />
        </div>
      }
    >
      <AdminDashboardPage />
    </Suspense>
  );
}
