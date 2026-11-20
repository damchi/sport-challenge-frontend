import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ApiError, errorMessage } from '../api/errors';
import { useMe } from '../api/hooks/useMe';
import { safeReturnTo } from '../lib/auth/auth';
import { Page } from '../components/Page';

const ONBOARDING = '/onboarding';

/**
 * The app needs a complete profile, as the server says (pseudo, first and
 * last name): until then every page leads to /onboarding, which then opens
 * the page first asked for. A profile made before the names were asked goes
 * back there too. Creating or joining a challenge is thus out of reach while
 * the profile is incomplete.
 */
export function ProfileGate() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const location = useLocation();
  const onOnboarding = location.pathname === ONBOARDING;

  // The language kept in the profile wins over the device's.
  const profileLanguage = me.data?.language;
  useEffect(() => {
    if (profileLanguage && profileLanguage !== i18n.language)
      void i18n.changeLanguage(profileLanguage);
  }, [profileLanguage, i18n]);

  if (me.isPending) {
    return (
      <Page>
        <p role="status" className="text-muted">
          {t('profile.loading')}
        </p>
      </Page>
    );
  }
  if (me.isError) {
    const { key, values } =
      me.error instanceof ApiError
        ? errorMessage(me.error, (candidate) => i18n.exists(candidate))
        : { key: 'errors.unknown', values: {} };
    return (
      <Page>
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
      </Page>
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
