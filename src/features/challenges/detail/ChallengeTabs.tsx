import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

const TABS = [
  { key: 'leaderboard', path: '' },
  { key: 'participants', path: '/participants' },
  { key: 'activities', path: '/activities' },
] as const;

const TAB =
  'flex min-h-11 flex-1 items-center justify-center rounded-tab px-2 text-sm font-semibold';
const TAB_ON = 'bg-segment-active text-ink shadow-[0_1px_3px_rgba(22,24,29,.12)]';
const TAB_OFF = 'text-muted hover-ink';

/**
 * Sections of a challenge, one address each (the current one is marked
 * aria-current). Without `activities` (a visitor, who may not read them),
 * no Activities tab.
 */
export function ChallengeTabs({
  challengeId,
  activities,
}: {
  challengeId: string;
  activities: boolean;
}) {
  const { t } = useTranslation();
  const tabs = activities ? TABS : TABS.filter(({ key }) => key !== 'activities');
  return (
    <nav aria-label={t('challengeDetail.tabs.label')}>
      {/* The tabs share a line, and wrap when the text is enlarged. */}
      <ul className="flex flex-wrap rounded-row bg-segment p-1">
        {tabs.map(({ key, path }) => (
          <li key={key} className="flex min-w-fit flex-1">
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
