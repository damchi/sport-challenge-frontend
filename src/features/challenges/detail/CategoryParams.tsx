import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { formatKm } from '../../../domain/format/distance';

type Category = ChallengeDetail['categories'][number];

/**
 * Settings of a category, frozen at creation, as the server sends them: the
 * elimination's X, the Grand prix's criteria, scale and minimum session. The
 * distance factors are listed once, in the challenge's details.
 */
export function CategoryParams({ category }: { category: Category }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';
  const { params } = category;

  if (category.type === 'elimination' && params.step_meters !== undefined) {
    return (
      <p className="text-sm text-muted">
        {t('challengeCreate.recap.step', {
          step: formatKm(params.step_meters / 1000, locale),
        })}
      </p>
    );
  }
  if (category.type === 'points') {
    return (
      <ul className="text-sm text-muted">
        {(params.criteria ?? []).map((criterion) => (
          <li key={criterion}>
            {t(`challengeDetail.categories.pointsParams.criteria.${criterion}`)}
          </li>
        ))}
        {params.podium !== undefined && (
          <li>{t(`challengeDetail.categories.pointsParams.podium_${params.podium}`)}</li>
        )}
        {/* Only the number of sessions has a minimum duration. */}
        {params.criteria?.includes('session_count') && params.min_session_seconds !== undefined && (
          <li>
            {t('challengeDetail.categories.pointsParams.minSession', {
              minutes: Math.round(params.min_session_seconds / 60),
            })}
          </li>
        )}
      </ul>
    );
  }
  return null;
}
