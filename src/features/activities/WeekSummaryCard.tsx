import { useTranslation } from 'react-i18next';
import { useMyActivitySummary } from '../../api/hooks/useActivities';
import { ErrorState } from '../../components/states/ErrorState';
import { addToDate, localDate } from '../../domain/challengeWindow';
import { weekDays, weekdayLetter, weekdayName } from '../../domain/format/activityDates';
import { formatKm } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';
import { useSpokenDuration } from './useSpokenDuration';

/**
 * "This week · 23–29 Nov": the sessions, time and distance of the user's
 * current week, then a bar a day, Monday to Sunday, as high as its time
 * against the longest day (today in bold). All from the server, cut in
 * `timeZone`. Nothing before the first activity.
 */
export function WeekSummaryCard({ timeZone, now }: { timeZone: string; now: Date }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const summary = useMyActivitySummary(timeZone);
  const spoken = useSpokenDuration();

  if (summary.isPending) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="h-56 rounded-card bg-track motion-safe:animate-pulse lg:h-36"
      >
        <span className="sr-only">{t('states.loading')}</span>
      </div>
    );
  }
  if (!summary.data) {
    return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  }
  if (summary.data.total === 0) return null;

  const week = summary.data.current_week;
  const monday = localDate(new Date(week.starts_at), timeZone);
  const today = localDate(now, timeZone);
  const longest = Math.max(...week.days.map((day) => day.duration_seconds));
  const figures = [
    {
      value: String(week.sessions),
      spoken: undefined,
      label: t('activities.summary.sessions', { count: week.sessions }),
    },
    {
      value: formatDuration(week.duration_seconds),
      // h:mm read out in words.
      spoken: spoken(week.duration_seconds),
      label: t('activities.summary.moving'),
    },
    {
      value: formatKm(week.distance_meters / 1000, locale),
      spoken: undefined,
      label: t('activities.summary.covered'),
    },
  ];

  return (
    <section
      aria-label={t('activities.summary.label')}
      className="rounded-card border border-border bg-surface p-5 lg:flex lg:items-end lg:gap-10 lg:p-6"
    >
      <div className="lg:flex-1">
        <h2 className="font-display text-lg font-bold">
          {t('activities.thisWeek')}
          <span className="font-sans text-base font-normal text-muted">
            {' · '}
            {weekDays(monday, addToDate(monday, { days: 6 }), locale, false)}
          </span>
        </h2>
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-3">
          {figures.map(({ value, spoken: words, label }) => (
            <p key={label} className="min-w-0">
              <span
                aria-hidden={words ? true : undefined}
                className="block font-display text-2xl font-bold tabular-nums lg:text-3xl"
              >
                {value}
              </span>
              {words && <span className="sr-only">{words}</span>}{' '}
              <span className="text-sm text-muted">{label}</span>
            </p>
          ))}
        </div>
      </div>
      <ul
        aria-label={t('activities.summary.days')}
        className="mt-6 grid grid-cols-7 gap-2 lg:mt-0 lg:w-96"
      >
        {week.days.map((day) => {
          const isToday = day.date === today;
          const name = weekdayName(day.date, locale);
          return (
            <li
              key={day.date}
              aria-current={isToday ? 'date' : undefined}
              className="flex flex-col items-center gap-2"
            >
              <div aria-hidden="true" className="flex h-24 w-full items-end">
                <div
                  className={`w-full rounded-md ${day.duration_seconds > 0 ? 'bg-accent' : 'bg-track'}`}
                  style={{
                    height:
                      day.duration_seconds > 0
                        ? `${Math.max(8, (day.duration_seconds / longest) * 100)}%`
                        : '6px',
                  }}
                />
              </div>
              <span
                aria-hidden="true"
                className={`text-sm ${isToday ? 'font-bold text-ink' : 'text-muted'}`}
              >
                {weekdayLetter(day.date, locale)}
              </span>
              <span className="sr-only">
                {day.duration_seconds > 0
                  ? t('activities.summary.day', {
                      day: name,
                      duration: spoken(day.duration_seconds),
                    })
                  : t('activities.summary.dayEmpty', { day: name })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
