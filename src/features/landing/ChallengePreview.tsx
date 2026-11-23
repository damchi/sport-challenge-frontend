import { Timer, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { challengeWeekEnd } from '../../domain/format/challengeDates';
import { formatKm } from '../../domain/format/distance';
import { StatusPill } from '../../components/StatusPill';
import { initials } from '../../domain/avatar';

// The example podium: Marc and Sofia tied for second (design.md avatar colours).
const PODIUM = [
  {
    person: 'julie',
    rank: 1,
    minutes: 400,
    tied: false,
    tone: 'bg-avatar-1-bg text-avatar-1-fg',
  },
  {
    person: 'marc',
    rank: 2,
    minutes: 355,
    tied: true,
    tone: 'bg-avatar-2-bg text-avatar-2-fg',
  },
  {
    person: 'sofia',
    rank: 2,
    minutes: 355,
    tied: true,
    tone: 'bg-avatar-3-bg text-avatar-3-fg',
  },
] as const;

// The example challenge: Montréal, its week 3 of 4 ending Saturday at midnight.
const TIME_ZONE = 'America/Toronto';
const WEEK_ENDS_AT = '2026-11-28T05:00:00Z';
const PARTICIPANTS = 8;

const ROW = 'flex items-center justify-between gap-3 border-t border-border py-3 text-sm';

/**
 * An example of a challenge, as the app shows it: the card of « Défis » and a
 * podium. An illustration, not data: hidden from screen readers, whom the
 * page's text tells the same.
 */
export function ChallengePreview() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const number = new Intl.NumberFormat(locale);
  const rank = (value: number) =>
    t('challenges.rank', {
      rank: t('leaderboard.rank', { count: value, ordinal: true }),
      count: PARTICIPANTS,
    });
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <div className="rounded-card border-2 border-risk-border bg-surface p-4 lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg font-bold">{t('landing.preview.title')}</p>
          <StatusPill label={t('landing.preview.atRisk')} Icon={TriangleAlert} tone="risk" />
        </div>
        <p className="mt-1 text-sm text-muted">{t('landing.preview.meta')}</p>
        <p className="mt-3 flex items-center gap-3 rounded-row bg-surface-raised px-4 py-3 text-sm font-semibold text-on-raised">
          <Timer size={18} strokeWidth={2} className="shrink-0 text-risk-bar" />
          {t('challenges.card.week', {
            week: 3,
            count: 4,
            date: challengeWeekEnd(WEEK_ENDS_AT, TIME_ZONE, locale, 'long'),
          })}
        </p>
        <div className="mt-3">
          <p className={ROW}>
            {t('challengeCreate.categories.time.name')}
            <span className="font-bold tabular-nums">{rank(4)}</span>
          </p>
          <p className={ROW}>
            {t('challengeCreate.categories.distance.name')}
            <span className="font-bold tabular-nums">{rank(2)}</span>
          </p>
          <div className="border-t border-border py-3 text-sm">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span>{t('challengeDetail.categories.eliminationGeneric')}</span>
              <span className="flex items-center gap-2">
                <StatusPill label={t('landing.preview.atRisk')} Icon={TriangleAlert} tone="risk" />
                <span className="font-bold tabular-nums">
                  {number.format(18)} / {formatKm(25, locale)}
                </span>
              </span>
            </p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-track">
              <span className="block h-full w-[72%] rounded-full bg-risk-bar" />
            </span>
          </div>
          <div className={`${ROW} pb-0`}>
            <span>
              {t('challengeDetail.categories.points')}
              <span className="block text-xs text-muted">{t('landing.preview.pointsNote')}</span>
            </span>
            <span className="font-bold tabular-nums">{rank(2)}</span>
          </div>
        </div>
      </div>
      <div className="rounded-card border border-border bg-surface p-4 lg:ml-6 lg:p-5">
        <p className="font-bold">{t('landing.preview.podiumTitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('landing.preview.podiumNote')}</p>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {PODIUM.map((entry) => {
            const name = t(`landing.preview.people.${entry.person}`);
            const hours = Math.floor(entry.minutes / 60);
            const minutes = entry.minutes % 60;
            return (
              <li
                key={entry.person}
                className="flex min-w-0 flex-col items-center gap-1 rounded-row border border-border px-1 py-3 text-center"
              >
                <span className="font-display text-xl font-bold">
                  {t('leaderboard.rank', { count: entry.rank, ordinal: true })}
                </span>
                <span className="min-h-4 text-xs text-muted">
                  {entry.tied ? t('landing.preview.exAequo') : ''}
                </span>
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${entry.tone}`}
                >
                  {initials(name)}
                </span>
                <span className="text-sm font-semibold">{name}</span>
                <span className="text-sm font-bold tabular-nums">
                  {t('profile.stats.hoursMinutes', {
                    hours,
                    minutes,
                    paddedMinutes: String(minutes).padStart(2, '0'),
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
