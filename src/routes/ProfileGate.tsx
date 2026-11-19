import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ApiError, errorMessage } from '../api/errors';
import { useMe } from '../api/hooks/useMe';
import { safeReturnTo } from '../lib/auth/auth';

const ONBOARDING = '/onboarding';

/**
 * The app needs a complete profile (a pseudo): until then every page leads
 * to /onboarding, which then opens the page first asked for. Creating or
 * joining a challenge is thus out of reach while the profile is incomplete.
 */
export function ProfileGate() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const location = useLocation();
  const onOnboarding = location.pathname === ONBOARDING;

  if (me.isPending) {
    return (
      <main className="mx-auto max-w-page px-5 py-8">
        <p role="status" className="text-muted">
          {t('profile.loading')}
        </p>
      </main>
    );
  }
  if (me.isError) {
    const { key, values } =
      me.error instanceof ApiError
        ? errorMessage(me.error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    return (
      <main className="mx-auto max-w-page px-5 py-8">
        <p role="alert" className="text-muted">
          {t(key, values)}
        </p>
        <button
          type="button"
          onClick={() => void me.refetch()}
          className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
        >
          {t('errorPage.retry')}
        </button>
      </main>
    );
  }

  if (!me.data.profile_complete && !onOnboarding) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={ONBOARDING} replace state={{ returnTo }} />;
  }
  if (me.data.profile_complete && onOnboarding) {
    const state: unknown = location.state;
    const returnTo =
      typeof state === 'object' && state !== null && 'returnTo' in state ? state.returnTo : '/';
    return <Navigate to={safeReturnTo(returnTo, window.location.origin)} replace />;
  }
  return <Outlet />;
}
