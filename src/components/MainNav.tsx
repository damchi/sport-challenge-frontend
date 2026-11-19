import { Activity, Trophy, User, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

const TABS: { to: string; labelKey: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', labelKey: 'nav.challenges', Icon: Trophy, end: true },
  { to: '/activities', labelKey: 'nav.activities', Icon: Activity },
  { to: '/me', labelKey: 'nav.profile', Icon: User },
];

/**
 * Main navigation: a bar at the bottom of a phone, at the top of a large
 * screen. The active tab is in the accent colour and marked aria-current.
 */
export function MainNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:static md:border-t-0 md:border-b md:pb-0"
    >
      <ul className="mx-auto flex max-w-page">
        {TABS.map(({ to, labelKey, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-18 flex-col items-center justify-center gap-1 text-nav md:h-14 md:flex-row md:gap-2 md:text-sm ${
                  isActive ? 'font-bold text-accent' : 'font-semibold text-muted'
                }`
              }
            >
              <Icon aria-hidden="true" size={22} strokeWidth={2} />
              {t(labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
