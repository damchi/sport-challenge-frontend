import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

const TABS = [
  { key: 'leaderboard', path: '' },
  { key: 'participants', path: '/participants' },
  { key: 'activities', path: '/activities' },
] as const;

const TAB = 'flex h-11 flex-1 items-center justify-center rounded-tab px-2 text-sm font-semibold';
const TAB_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const TAB_OFF = 'text-muted';

/** Sections of a challenge, one address each (the current one is marked aria-current). */
export function ChallengeTabs({ challengeId }: { challengeId: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('challengeDetail.tabs.label')}>
      <ul className="flex rounded-row bg-segment p-1">
        {TABS.map(({ key, path }) => (
          <li key={key} className="flex flex-1">
            <NavLink
              to={`/challenges/${challengeId}${path}`}
              // A participant's page stays under the Participants tab.
              end={path === ''}
              className={({ isActive }) => `${TAB} ${isActive ? TAB_ON : TAB_OFF}`}
            >
              {t(`challengeDetail.tabs.${key}`)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
