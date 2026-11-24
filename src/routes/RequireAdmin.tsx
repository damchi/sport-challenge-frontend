import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '../api/hooks/useMe';
import { DocumentTitle } from '../components/DocumentTitle';
import { Page } from '../components/Page';
import { LoadingState } from '../components/states/LoadingState';
import { NotFoundPage } from '../pages/NotFoundPage';

// Loaded on render, past the check below: a router `lazy` would be loaded on
// matching the path, before any check, so for a non-admin too.
const AdminPage = lazy(() => import('../pages/AdminPage').then((m) => ({ default: m.AdminPage })));

/**
 * The admin section, for the accounts the server says are admins; anyone else
 * gets the app's not found page, as if the section did not exist. Only a
 * convenience: the API itself answers 404 to a non-admin.
 */
export function RequireAdmin() {
  const { t } = useTranslation();
  // The profile gate above has loaded it.
  const { data: me } = useMe();
  if (!me?.is_admin) {
    return (
      <>
        {/* Over the title of the admin route. */}
        <DocumentTitle title={`${t('notFound.title')} · ${t('home.title')}`} />
        <NotFoundPage />
      </>
    );
  }
  return (
    <Suspense
      fallback={
        <Page>
          <LoadingState />
        </Page>
      }
    >
      <AdminPage />
    </Suspense>
  );
}
