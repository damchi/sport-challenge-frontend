import { Activity, Trophy, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';

const TABS: { to: string; labelKey: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', labelKey: 'nav.challenges', Icon: Trophy, end: true },
  { to: '/activities', labelKey: 'nav.activities', Icon: Activity },
  { to: '/me', labelKey: 'nav.profile', Icon: User },
];

/**
 * Main navigation (design.md). Phone: a 72 px bar fixed at the bottom, icon
 * above the label. From `md`: a 64 px bar at the top, the app name first,
 * then the tabs (icon left of the label, the active one on accent-soft).
 */
export function MainNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:border-b md:pb-0"
    >
      <div className="mx-auto flex max-w-page flex-wrap items-center md:min-h-16 md:gap-x-6 md:px-5 lg:max-w-wide lg:px-8">
        <Link
          to="/"
          className="hidden h-11 items-center gap-3 font-display text-xl font-bold md:flex"
        >
          <span className="flex size-8 items-center justify-center rounded-tab bg-accent text-on-accent">
            <Trophy aria-hidden="true" size={18} strokeWidth={2} />
          </span>
          {t('home.title')}
        </Link>
        <ul className="flex flex-1 md:flex-none md:gap-1">
          {TABS.map(({ to, labelKey, Icon, end }) => (
            <li key={to} className="flex-1 md:flex-none">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-18 flex-col items-center justify-center gap-1 text-nav md:h-11 md:flex-row md:gap-2 md:rounded-tab md:px-3.5 md:text-sm ${
                    isActive
                      ? 'font-bold text-accent md:bg-accent-soft'
                      : 'font-semibold text-muted'
                  }`
                }
              >
                <Icon aria-hidden="true" size={22} strokeWidth={2} />
                {t(labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
