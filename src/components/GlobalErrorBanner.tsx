import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../api/errors';

interface GlobalErrorBannerProps {
  error: unknown;
  onDismiss: () => void;
}

/** Translated message of an error no screen shows by itself (failed action, failed refresh). */
export function GlobalErrorBanner({ error, onDismiss }: GlobalErrorBannerProps) {
  const { t, i18n } = useTranslation();
  const { key, values } =
    error instanceof ApiError
      ? errorMessage(error, (candidate) => i18n.exists(candidate))
      : { key: 'errors.unknown', values: {} };

  return (
    <div
      role="alert"
      className="mx-auto mt-3 flex max-w-page items-center lg:max-w-wide gap-2 rounded-row bg-surface-raised py-1 pr-1 pl-4 text-on-raised"
    >
      <p className="flex-1 text-sm">{t(key, values)}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('globalError.dismiss')}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl hover-fill-raised"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
