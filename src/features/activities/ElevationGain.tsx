import { useTranslation } from 'react-i18next';
import { formatMeters } from '../../domain/format/distance';

/**
 * The elevation gain written beside a distance: "↗ 450 m", heard
 * ", elevation gain 450 m". Display only: it counts in no ranking.
 */
export function ElevationGain({ meters }: { meters: number }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';

  return (
    // A plain space before it, so that it starts flush when it wraps below
    // the distance in a narrow column.
    <>
      <span className="sr-only">,</span>{' '}
      <span className="inline-block whitespace-nowrap">
        <span className="sr-only">{t('activities.elevationGain')} </span>
        <span aria-hidden="true">↗ </span>
        {formatMeters(meters, locale)}
      </span>
    </>
  );
}
