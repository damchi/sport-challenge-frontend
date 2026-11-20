import type { ChallengeDetail } from '../../../api/hooks/useChallenges';

type CategoryType = ChallengeDetail['categories'][number]['type'];

/** Translation key of each category's name. */
export const CATEGORY_NAMES: Record<CategoryType, string> = {
  cumulative_time: 'challengeCreate.categories.time.name',
  cumulative_distance: 'challengeCreate.categories.distance.name',
  run_elimination: 'challengeCreate.categories.elimination.name',
};
