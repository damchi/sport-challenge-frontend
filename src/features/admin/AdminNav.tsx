import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

const PARTS: { to: string; labelKey: string; end?: boolean }[] = [
  { to: '/admin', labelKey: 'admin.nav.dashboard', end: true },
  { to: '/admin/challenges', labelKey: 'admin.nav.challenges' },
  { to: '/admin/users', labelKey: 'admin.nav.users' },
  { to: '/admin/journal', labelKey: 'admin.nav.journal' },
];

/**
 * The parts of the admin section (design.md), one address each (the current
 * one is marked aria-current). Phone: the segmented control of a challenge's
 * tabs, which wraps when the text is enlarged. From `md`: the tabs
 * of the navigation bar, the active one in accent on accent-soft. A part
 * stays active on its pages below (a challenge under Challenges).
 */
export function AdminNav() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('admin.nav.label')} className="mt-6">
      <ul className="flex flex-wrap rounded-row bg-segment p-1 md:gap-1 md:bg-transparent md:p-0">
        {PARTS.map(({ to, labelKey, end }) => (
          <li key={to} className="flex min-w-fit flex-1 md:flex-none">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 flex-1 items-center justify-center rounded-tab px-2 text-sm md:px-3.5 ${
                  isActive
                    ? 'bg-segment-active font-bold text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)] md:bg-accent-soft md:text-accent md:shadow-none'
                    : 'font-semibold text-muted hover-ink md:hover-fill'
                }`
              }
            >
              {t(labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
