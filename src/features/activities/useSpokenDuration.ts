import { useTranslation } from 'react-i18next';

/**
 * A duration read out in words, for the totals shown as h:mm: "2 heures
 * 36 minutes", "45 minutes", "0 minute". Whole minutes, as h:mm shows them.
 */
export function useSpokenDuration(): (seconds: number) => string {
  const { t } = useTranslation();
  return (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const parts = [
      ...(hours > 0 ? [t('activities.spoken.hours', { count: hours })] : []),
      ...(minutes % 60 > 0 || hours === 0
        ? [t('activities.spoken.minutes', { count: minutes % 60 })]
        : []),
    ];
    return parts.join(' ');
  };
}
