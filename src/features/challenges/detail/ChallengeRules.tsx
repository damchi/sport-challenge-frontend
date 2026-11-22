import { ChevronDown, Globe, Lock } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { sortSportsByName } from '../../../domain/challengeCreate';
import { challengePeriod, otherTimeZoneName } from '../../../domain/format/challengeDates';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { useSportName } from '../create/useSportName';
import { CATEGORY_EXPLANATIONS, useCategoryName } from './categoryNames';

type Category = ChallengeDetail['categories'][number];

/**
 * Distance factors, by sport name, in two columns, then the reference sport
 * (×1, API contract) the distances are brought back to.
 */
function FactorList({
  factors,
  referenceSport,
}: {
  factors: Record<string, number>;
  referenceSport: string;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();
  const sports = sortSportsByName(
    Object.entries(factors).map(([code, factor]) => ({ code, factor })),
    sportName,
    locale,
  );
  return (
    <>
      <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {sports.map(({ code, factor }) => (
          <li key={code} className="flex justify-between gap-2">
            <span className="min-w-0 break-words">{sportName(code)}</span>
            <span className="font-bold tabular-nums">{formatFactor(factor, locale)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-muted">
        {t('challengeDetail.categories.reference', {
          sport: sportName(referenceSport).toLocaleLowerCase(locale),
          factor: formatFactor(1, locale),
        })}
      </p>
    </>
  );
}

/** Settings of a category, frozen at creation, as the server sends them. */
function CategoryParams({
  category,
  referenceSport,
  showFactors,
}: {
  category: Category;
  referenceSport: string;
  /** The factors are not listed by another category. */
  showFactors: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { params } = category;

  if (category.type === 'cumulative_distance') {
    return <FactorList factors={params.factors ?? {}} referenceSport={referenceSport} />;
  }
  if (category.type === 'elimination' && params.step_meters !== undefined) {
    return (
      <span className="mt-1 block text-sm text-muted">
        {t('challengeCreate.recap.step', {
          step: formatKm(params.step_meters / 1000, locale),
        })}
      </span>
    );
  }
  if (category.type === 'points') {
    return (
      <>
        <ul className="mt-1 text-sm text-muted">
          {(params.criteria ?? []).map((criterion) => (
            <li key={criterion}>
              {t(`challengeDetail.categories.pointsParams.criteria.${criterion}`)}
            </li>
          ))}
          {params.podium !== undefined && (
            <li>{t(`challengeDetail.categories.pointsParams.podium_${params.podium}`)}</li>
          )}
          {/* Only the number of sessions has a minimum duration. */}
          {params.criteria?.includes('session_count') &&
            params.min_session_seconds !== undefined && (
              <li>
                {t('challengeDetail.categories.pointsParams.minSession', {
                  minutes: Math.round(params.min_session_seconds / 60),
                })}
              </li>
            )}
        </ul>
        {/* The longest session by distance uses the challenge's factors:
            listed here when no total distance lists them already. */}
        {showFactors && params.factors && params.criteria?.includes('longest_distance') && (
          <FactorList factors={params.factors} referenceSport={referenceSport} />
        )}
      </>
    );
  }
  return null;
}

/**
 * « Règles des catégories »: the period and visibility of a challenge (in
 * its time zone, named when the user's differs), then each of its categories
 * (1 to 4), what it ranks and its settings, read only: they never change
 * after the creation. A side card from `lg`; below, a section to unfold.
 */
export function ChallengeRules({
  challenge,
  className = '',
}: {
  challenge: ChallengeDetail;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const wide = useMediaQuery('(min-width: 1024px)');
  const headingId = useId();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { categories, reference_sport: referenceSport, timezone } = challenge;
  const categoryName = useCategoryName(referenceSport);
  const sportName = useSportName();
  const period = challengePeriod(challenge.starts_at, challenge.ends_at, timezone, locale);
  const zone = otherTimeZoneName(
    timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const ordered = [...categories].sort((a, b) => a.position - b.position);
  const hasTotalDistance = categories.some(({ type }) => type === 'cumulative_distance');
  const VisibilityIcon = challenge.visibility === 'public' ? Globe : Lock;
  const title = t('challengeDetail.categories.title');

  const body = (
    <>
      <p className="mt-1 text-sm text-muted">{t('challengeDetail.categories.frozen')}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm font-semibold">
        <span>{t('challenges.period', period)}</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <VisibilityIcon aria-hidden="true" size={14} strokeWidth={2} />
          {t(`challenges.visibility.${challenge.visibility}`)}
        </span>
      </p>
      {zone && <p className="text-sm text-muted">{t('challengeDetail.timeZone', { zone })}</p>}
      <ol className="mt-4 flex flex-col gap-4">
        {ordered.map((category) => (
          <li key={category.type}>
            <h3 className="font-bold">{categoryName(category.type)}</h3>
            <p className="mt-1 text-sm text-muted">
              {t(CATEGORY_EXPLANATIONS[category.type], { sport: sportName(referenceSport) })}
            </p>
            <CategoryParams
              category={category}
              referenceSport={referenceSport}
              showFactors={!hasTotalDistance}
            />
          </li>
        ))}
      </ol>
    </>
  );

  if (wide) {
    return (
      <section
        aria-labelledby={headingId}
        className={`rounded-card border border-border bg-surface p-4 lg:p-5 ${className}`}
      >
        <h2 id={headingId} className="font-display text-lg font-bold">
          {title}
        </h2>
        {body}
      </section>
    );
  }
  return (
    <details className={`group rounded-card border border-border bg-surface ${className}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-lg font-bold">{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className="flex-none transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-4 pb-4">{body}</div>
    </details>
  );
}
