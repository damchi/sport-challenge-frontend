import { Activity, Trophy, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { AppMark } from './AppMark';
import { HOME_PATH } from '../lib/paths';

// A tab stays active on the pages under it (design.md, « Barre de
// navigation »): the challenges tab on a challenge and on its creation, the
// profile tab on the admin section, opened from the profile.
const TABS: { to: string; labelKey: string; Icon: LucideIcon; under: string[] }[] = [
  { to: HOME_PATH, labelKey: 'nav.challenges', Icon: Trophy, under: [HOME_PATH] },
  { to: '/activities', labelKey: 'nav.activities', Icon: Activity, under: ['/activities'] },
  { to: '/me', labelKey: 'nav.profile', Icon: User, under: ['/me', '/admin'] },
];

const isUnder = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

/**
 * Main navigation (design.md). Phone: a 72 px bar fixed at the bottom, icon
 * above the label. From `md`: a 64 px bar at the top, the app name first,
 * then the tabs (icon left of the label, the active one on accent-soft).
 */
export function MainNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:border-b md:pb-0"
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center md:min-h-16 md:gap-x-6 md:px-5 lg:max-w-wide lg:px-8">
        <Link
          to={HOME_PATH}
          className="-ml-2 hidden h-11 items-center gap-3 rounded-tab px-2 font-display text-xl font-bold hover-fill md:flex"
        >
          <AppMark />
          {t('home.title')}
        </Link>
        <ul className="flex flex-1 md:flex-none md:gap-1">
          {TABS.map(({ to, labelKey, Icon, under }) => {
            const isActive = under.some((path) => isUnder(pathname, path));
            return (
              <li key={to} className="flex-1 md:flex-none">
                <Link
                  to={to}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex h-18 flex-col items-center justify-center gap-1 text-nav md:h-11 md:flex-row md:gap-2 md:rounded-tab md:px-3.5 md:text-sm ${
                    isActive
                      ? 'font-bold text-accent md:bg-accent-soft'
                      : 'font-semibold text-muted hover-fill'
                  }`}
                >
                  <Icon aria-hidden="true" size={22} strokeWidth={2} />
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
