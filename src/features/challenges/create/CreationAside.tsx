import { CalendarClock, Globe, Lock, Timer } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../../../components/StatusPill';
import { isTimeZone } from '../../../domain/challengeWindow';
import type { ChallengeCreateInput } from '../../../domain/schemas/challenge';
import { otherTimeZoneName } from '../../../domain/format/challengeDates';
import { useSportName } from './useSportName';
import { windowPreview } from './windowPreview';

/**
 * The challenge as the list of challenges will show it, from what is entered
 * so far: each piece once it is there. Ongoing if it starts today, else
 * upcoming (decision of 2026-11-22). `now` dates "today".
 */
export function CreationPreview({ now }: { now: Date }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const { control } = useFormContext<ChallengeCreateInput>();
  const [title, visibility, weeks, startDate, timeZone, reference, distance, elimination, points] =
    useWatch({
      control,
      name: [
        'title',
        'visibility',
        'weeks',
        'start_date',
        'timezone',
        'reference_sport',
        'cumulative_distance',
        'elimination',
        'points',
      ],
    });
  const period = isTimeZone(timeZone)
    ? windowPreview(startDate, weeks, timeZone, now, locale)
    : undefined;
  // Read once per render, like the cards of the list.
  const zone =
    period && otherTimeZoneName(timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, locale);
  const categories = [
    t('challengeCreate.categories.time.name'),
    ...(distance ? [t('challengeCreate.categories.distance.name')] : []),
    ...(elimination
      ? [t('challengeDetail.categories.elimination', { sport: sportName(reference) })]
      : []),
    ...(points ? [t('challengeDetail.categories.points')] : []),
  ];

  return (
    <section aria-labelledby="creation-preview-title">
      <h3
        id="creation-preview-title"
        className="text-sm font-bold tracking-[0.6px] text-muted uppercase"
      >
        {t('challengeCreate.preview.title')}
      </h3>
      <div className="mt-3 rounded-card border border-border bg-surface p-5">
        {(period || visibility) && (
          <div className="mb-3 flex flex-wrap gap-1">
            {period && (
              <StatusPill
                label={t(`challenges.challengeStatus.${period.started ? 'ongoing' : 'upcoming'}`)}
                Icon={period.started ? Timer : CalendarClock}
                tone="neutral"
              />
            )}
            {visibility && (
              <StatusPill
                label={t(`challenges.visibility.${visibility}`)}
                Icon={visibility === 'public' ? Globe : Lock}
                tone="neutral"
              />
            )}
          </div>
        )}
        {title.trim() !== '' && (
          <p className="font-display text-xl font-bold break-words">{title.trim()}</p>
        )}
        {period && (
          <p className="mt-2 text-muted">
            {/* The challenge's time zone, named when it is not the device's. */}
            {t('challengeCreate.preview.period', {
              start: period.short.start,
              end: period.short.end,
              weeks: t('challengeCreate.preview.weeks', { count: weeks }),
            })}
            {zone && <span className="block text-sm">{zone}</span>}
          </p>
        )}
        <ul className="mt-3 flex flex-col gap-1.5 font-semibold">
          {categories.map((name) => (
            <li key={name} className="flex items-center gap-3">
              <span aria-hidden="true" className="size-2 flex-none rounded-full bg-accent" />
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted">
          {t('challengeCreate.preview.reference', { sport: sportName(reference) })}
        </p>
      </div>
    </section>
  );
}

/** "Bon à savoir": what helps with the step, beside it. */
export function CreationTip({ children }: { children: string }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="creation-tip-title" className="rounded-card bg-accent-soft p-5">
      <h3 id="creation-tip-title" className="font-bold text-accent">
        {t('challengeCreate.tips.title')}
      </h3>
      <p className="mt-1">{children}</p>
    </section>
  );
}
