import { useTranslation } from 'react-i18next';

/**
 * Loading skeleton: placeholder cards (no fake text), announced once to
 * screen readers. No animation when the user asks for reduced motion.
 */
const PLACEHOLDERS = 3;

export function LoadingState() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3">
      <span className="sr-only">{t('states.loading')}</span>
      {Array.from({ length: PLACEHOLDERS }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="h-28 rounded-card bg-track motion-safe:animate-pulse"
        />
      ))}
    </div>
  );
}
