import { useTranslation } from 'react-i18next';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';
import { useSportName } from '../create/useSportName';

type CategoryType = ChallengeDetail['categories'][number]['type'];

/** Translation key of the name of each category but the elimination. */
const CATEGORY_NAMES: Record<Exclude<CategoryType, 'elimination'>, string> = {
  cumulative_time: 'challengeCreate.categories.time.name',
  cumulative_distance: 'challengeCreate.categories.distance.name',
  points: 'challengeDetail.categories.points',
  cumulative_elevation: 'challengeCreate.categories.elevation.name',
};

/**
 * Name of a category of a challenge. The elimination names the sport it is
 * run in, the challenge's reference sport ("Vélo avec élimination"); without
 * it (the challenge list does not give it yet), "Élimination".
 */
export function useCategoryName(
  referenceSport: string | undefined,
): (type: CategoryType) => string {
  const { t } = useTranslation();
  const sportName = useSportName();
  return (type) => {
    if (type !== 'elimination') return t(CATEGORY_NAMES[type]);
    return referenceSport === undefined
      ? t('challengeDetail.categories.eliminationGeneric')
      : t('challengeDetail.categories.elimination', { sport: sportName(referenceSport) });
  };
}

/** Translation key of the sentence that says what a category ranks (its {{sport}}: the reference sport). */
export const CATEGORY_EXPLANATIONS: Record<CategoryType, string> = {
  cumulative_time: 'challengeCreate.categories.time.explanation',
  cumulative_distance: 'challengeCreate.categories.distance.explanation',
  elimination: 'challengeCreate.categories.elimination.explanation',
  points: 'challengeCreate.categories.points.explanation',
  cumulative_elevation: 'challengeCreate.categories.elevation.explanation',
};
