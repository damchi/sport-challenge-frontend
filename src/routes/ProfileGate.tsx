import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router';
import { ApiError, errorMessage } from '../api/errors';
import { useMe } from '../api/hooks/useMe';
import { safeReturnTo } from '../lib/auth/auth';
import { Page } from '../components/Page';
import { HOME_PATH } from '../lib/paths';

const ONBOARDING = '/onboarding';
const INVITE = '/invite';

/**
 * Where a profile just completed goes: the home page, whatever page was first
 * asked for, unless onboarding broke into an invitation, which opens again
 * (its token in the fragment) to be accepted. The page asked for stays within
 * the app either way.
 */
function afterOnboarding(returnTo: unknown): string {
  const origin = window.location.origin;
  const target = safeReturnTo(returnTo, origin);
  return new URL(target, origin).pathname === INVITE ? target : HOME_PATH;
}

/**
 * The app needs a complete profile, as the server says (first and last
 * name): until then every page leads to /onboarding, which then opens the
 * home page, or the invitation it broke into. A profile made before the names
 * were asked goes back there too. Creating or joining a challenge is thus out
 * of reach while the profile is incomplete.
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
  // A failed refresh keeps the profile loaded: the global banner says so.
  if (!me.data) {
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
          className="mt-6 h-13 rounded-full bg-accent hover-accent px-6 text-button font-bold text-on-accent"
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
      typeof state === 'object' && state !== null && 'returnTo' in state
        ? state.returnTo
        : HOME_PATH;
    return <Navigate to={afterOnboarding(returnTo)} replace />;
  }
  return <Outlet />;
}
