import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { useSportName } from '../create/useSportName';

type CategoryType = ChallengeDetail['categories'][number]['type'];

/** Translation key of the name of each category but the elimination. */
const CATEGORY_NAMES: Record<Exclude<CategoryType, 'elimination'>, string> = {
  cumulative_time: 'challengeCreate.categories.time.name',
  cumulative_distance: 'challengeCreate.categories.distance.name',
  points: 'challengeDetail.categories.points',
};

/**
 * Name of a category of a challenge. The elimination names the sport it is
 * run in, the challenge's reference sport ("Vélo avec élimination").
 */
export function useCategoryName(referenceSport: string): (type: CategoryType) => string {
  const { t } = useTranslation();
  const sportName = useSportName();
  return (type) =>
    type === 'elimination'
      ? t('challengeDetail.categories.elimination', { sport: sportName(referenceSport) })
      : t(CATEGORY_NAMES[type]);
}
