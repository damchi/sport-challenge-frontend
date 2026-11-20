import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { sortSportsByName } from '../../../domain/challengeCreate';
import { formatFactor, formatKm } from '../../../domain/format/distance';
import { useSportName } from '../create/useSportName';
import { CATEGORY_NAMES } from './categoryNames';

type Category = ChallengeDetail['categories'][number];

/** Settings of a category, frozen at creation, as the server sends them. */
function CategoryParams({ category }: { category: Category }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const sportName = useSportName();

  if (category.type === 'cumulative_distance') {
    // The run is the reference and always counts ×1 (API contract).
    const factors = sortSportsByName(
      Object.entries(category.params.factors ?? {})
        .filter(([code]) => code !== 'run')
        .map(([code, factor]) => ({ code, factor })),
      sportName,
      locale,
    );
    return (
      <ul className="mt-1 text-sm text-muted">
        <li>{t('challengeCreate.recap.runFactor', { factor: formatFactor(1, locale) })}</li>
        {factors.map(({ code, factor }) => (
          <li key={code}>{`${sportName(code)} ${formatFactor(factor, locale)}`}</li>
        ))}
      </ul>
    );
  }
  if (category.type === 'run_elimination' && category.params.step_meters !== undefined) {
    return (
      <span className="mt-1 block text-sm text-muted">
        {t('challengeCreate.recap.step', {
          step: formatKm(category.params.step_meters / 1000, locale),
        })}
      </span>
    );
  }
  return null;
}

/** The 3 categories of a challenge, read only: they never change after the creation. */
export function ChallengeCategories({
  categories,
  className = '',
}: {
  categories: Category[];
  className?: string;
}) {
  const { t } = useTranslation();
  const ordered = [...categories].sort((a, b) => a.position - b.position);
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
            <span className="font-semibold">{t(CATEGORY_NAMES[category.type])}</span>
            <CategoryParams category={category} />
          </li>
        ))}
      </ol>
    </section>
  );
}
