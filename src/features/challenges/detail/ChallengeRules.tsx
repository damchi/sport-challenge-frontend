import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { sortSportsByName } from '../../../domain/challengeCreate';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import { useSportName } from '../create/useSportName';
import { useCategoryName } from './categoryNames';

type Category = ChallengeDetail['categories'][number];

/** Distance factors, the reference sport first at ×1 (API contract). */
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
  const others = sortSportsByName(
    Object.entries(factors)
      .filter(([code]) => code !== referenceSport)
      .map(([code, factor]) => ({ code, factor })),
    sportName,
    locale,
  );
  return (
    <ul className="mt-1 text-sm text-muted">
      <li>
        {t('challengeCreate.recap.referenceFactor', {
          sport: sportName(referenceSport),
          factor: formatFactor(1, locale),
        })}
      </li>
      {others.map(({ code, factor }) => (
        <li key={code}>{`${sportName(code)} ${formatFactor(factor, locale)}`}</li>
      ))}
    </ul>
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
 * The categories of a challenge (1 to 4), read only: they never change after
 * the creation.
 */
export function ChallengeCategories({
  categories,
  referenceSport,
  className = '',
}: {
  categories: Category[];
  referenceSport: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName(referenceSport);
  const ordered = [...categories].sort((a, b) => a.position - b.position);
  const hasTotalDistance = categories.some(({ type }) => type === 'cumulative_distance');
  return (
    <section
      aria-labelledby="challenge-categories"
      className={`rounded-card border border-border bg-surface p-4 lg:p-5 ${className}`}
    >
      <h2 id="challenge-categories" className="font-display text-lg font-bold">
        {t('challengeDetail.categories.title')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('challengeDetail.categories.frozen')}</p>
      <ol className="mt-3 flex flex-col gap-3">
        {ordered.map((category) => (
          <li key={category.type}>
            <span className="font-semibold">{categoryName(category.type)}</span>
            <CategoryParams
              category={category}
              referenceSport={referenceSport}
              showFactors={!hasTotalDistance}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
