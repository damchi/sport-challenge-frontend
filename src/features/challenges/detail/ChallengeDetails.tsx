import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { shownFactors } from '../../../domain/challenge';
import { sortSportsByName } from '../../../domain/challengeCreate';
import { challengePeriod, timeZoneName } from '../../../domain/format/challengeDates';
import { formatFactor } from '../../../domain/format/distance';
import { useSportName } from '../create/useSportName';

const CARD = 'rounded-card border border-border bg-surface p-4 lg:p-5';

/**
 * « Détails »: period, duration (the server's week_count), time zone,
 * visibility, who invites and the reference sport, then the distance factors
 * when the challenge has some, the reference sport first.
 */
export function ChallengeDetails({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const period = challengePeriod(
    challenge.starts_at,
    challenge.ends_at,
    challenge.timezone,
    locale,
  );
  const factors = shownFactors(challenge.categories);
  const reference = challenge.reference_sport;
  const rows = [
    [t('challengeCreate.recap.period'), t('challenges.period', period)],
    [
      t('challengeDetail.upcoming.details.duration'),
      t('challengeDetail.upcoming.details.weeks', { count: challenge.week_count }),
    ],
    [t('challengeDetail.upcoming.details.zone'), timeZoneName(challenge.timezone, locale)],
    [t('challengeDetail.edit.visibility'), t(`challenges.visibility.${challenge.visibility}`)],
    [
      t('challengeCreate.recap.invitations'),
      challenge.members_can_invite
        ? t('challengeCreate.recap.membersCanInvite')
        : t('challengeCreate.recap.creatorsInvite'),
    ],
    [t('challengeDetail.upcoming.details.reference'), sportName(reference)],
  ];
  const others = factors
    ? sortSportsByName(
        Object.entries(factors)
          .filter(([code]) => code !== reference)
          .map(([code, factor]) => ({ code, factor })),
        sportName,
        locale,
      )
    : [];

  return (
    <section aria-labelledby="upcoming-details" className={CARD}>
      <h2 id="upcoming-details" className="font-display text-lg font-bold">
        {t('challengeDetail.upcoming.details.title')}
      </h2>
      <dl className="mt-3">
        {rows.map(([term, value]) => (
          <div
            key={term}
            // The value wraps below its term when the text is enlarged.
            className="flex flex-wrap justify-between gap-x-4 border-t border-border py-2.5"
          >
            <dt className="text-muted">{term}</dt>
            <dd className="ml-auto text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {factors && (
        <>
          <h3 className="mt-4 font-bold">{t('challengeDetail.upcoming.details.factors')}</h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm font-semibold">
            <li className="rounded-full bg-accent px-3 py-1 text-on-accent">
              {`${sportName(reference)} ${formatFactor(1, locale)}`}
            </li>
            {others.map(({ code, factor }) => (
              <li key={code} className="rounded-full bg-segment px-3 py-1">
                {`${sportName(code)} ${formatFactor(factor, locale)}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            {t('challengeDetail.categories.reference', {
              sport: sportName(reference).toLocaleLowerCase(locale),
              factor: formatFactor(1, locale),
            })}
          </p>
        </>
      )}
    </section>
  );
}
