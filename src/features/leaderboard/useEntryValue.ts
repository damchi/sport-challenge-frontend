import { useTranslation } from 'react-i18next';
import type { Leaderboard } from '../../api/hooks/useChallenges';
import { formatKm, formatMeters } from '../../domain/format/distance';
import { formatDuration } from '../../domain/format/duration';
import { useSportName } from '../challenges/create/useSportName';

type CategoryType = Leaderboard['categories'][number]['type'];

/**
 * The value of a category: h:mm, km equivalent to the reference sport, km
 * done in the reference sport (elimination), points acquired, or real meters
 * climbed ("1 250 m D+"). Without the reference sport (not known yet), the
 * cumulative distance is the km alone.
 */
export function useEntryValue(
  type: CategoryType,
  value: number | null,
  referenceSport: string | undefined,
): string {
  const { t, i18n } = useTranslation();
  const sportName = useSportName();
  if (value === null) return '';
  if (type === 'cumulative_time') return formatDuration(value);
  if (type === 'points') return t('leaderboard.points', { count: value });
  const locale = i18n.resolvedLanguage ?? 'fr';
  if (type === 'cumulative_elevation') {
    return t('leaderboard.elevation', { elevation: formatMeters(value, locale) });
  }
  const distance = formatKm(value / 1000, locale);
  if (type !== 'cumulative_distance' || referenceSport === undefined) return distance;
  // Inside a sentence: "12,5 km éq. vélo".
  const sport = sportName(referenceSport).toLocaleLowerCase(locale);
  return t('leaderboard.equivalent', { distance, sport });
}
