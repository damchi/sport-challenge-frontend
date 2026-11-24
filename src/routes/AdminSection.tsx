import { lazy, Suspense } from 'react';
import { LoadingState } from '../components/states/LoadingState';

// Each part of the admin section is a chunk of its own, loaded on render: only
// once RequireAdmin has let the admin in (a router `lazy` would load it on
// matching the path, for anyone).
const SECTIONS = {
  dashboard: lazy(() =>
    import('../pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
  ),
};

/** A part of the admin section, under its navigation. */
export function AdminSection({ name }: { name: keyof typeof SECTIONS }) {
  const Section = SECTIONS[name];
  return (
    <Suspense
      fallback={
        <div className="mt-6">
          <LoadingState />
        </div>
      }
    >
      <Section />
    </Suspense>
  );
}
