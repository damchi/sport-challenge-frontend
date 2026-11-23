import { useTranslation } from 'react-i18next';
import { hoursAndMinutes } from '../../domain/format/duration';
import { useSpokenDuration } from '../activities/useSpokenDuration';

/**
 * A total time in hours and minutes, the seconds dropped: shown ("14 h 30",
 * "14 h", "45 min" in French) and read out ("14 heures 30 minutes").
 */
export function useTotalTime(): (seconds: number) => { shown: string; spoken: string } {
  const { t, i18n } = useTranslation();
  const spoken = useSpokenDuration();
  return (seconds) => {
    const number = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'fr');
    const { hours, minutes } = hoursAndMinutes(seconds);
    const shown =
      hours === 0
        ? t('profile.stats.minutes', { minutes })
        : minutes === 0
          ? t('profile.stats.hours', { hours: number.format(hours) })
          : t('profile.stats.hoursMinutes', {
              hours: number.format(hours),
              minutes,
              paddedMinutes: String(minutes).padStart(2, '0'),
            });
    return { shown, spoken: spoken(seconds) };
  };
}
