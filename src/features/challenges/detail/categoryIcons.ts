import { Flag, Route, Star, Timer, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ChallengeDetail } from '../../../api/hooks/useChallenges';

/** The icon of each category, wherever it is named with one. */
export const CATEGORY_ICONS: Record<ChallengeDetail['categories'][number]['type'], LucideIcon> = {
  cumulative_time: Timer,
  cumulative_distance: Route,
  elimination: Flag,
  points: Star,
  cumulative_elevation: TrendingUp,
};
