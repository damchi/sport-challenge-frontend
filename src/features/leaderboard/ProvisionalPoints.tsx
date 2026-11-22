import { useTranslation } from 'react-i18next';

/**
 * The points of the weeks not locked yet, apart from those acquired: they
 * count in neither the value nor the rank. The server gives none once
 * every started week is locked, nor in the final results.
 */
export function ProvisionalPoints({ points }: { points: number | null }) {
  const { t } = useTranslation();
  if (points === null || points === 0) return null;
  // The space keeps the two values apart when read as one text.
  return (
    <>
      {' '}
      <span className="block text-xs font-semibold text-muted tabular-nums">
        {t('leaderboard.provisional', { count: points })}
      </span>
    </>
  );
}
