import { useTranslation } from 'react-i18next';
import { formatMeters } from '../../domain/format/distance';

/**
 * An elevation gain, the value of its own stat: "↗ 450 m", the arrow left
 * unspoken. It counts for the total elevation gain category, in no time,
 * distance nor elimination ranking.
 */
export function ElevationGain({ meters }: { meters: number }) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'fr';

  return (
    <>
      <span aria-hidden="true">↗ </span>
      {formatMeters(meters, locale)}
    </>
  );
}
