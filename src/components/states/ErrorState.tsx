import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../api/errors';

/** A screen could not load: translated message (never the server's) and a retry. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t, i18n } = useTranslation();
  const { key, values } =
    error instanceof ApiError
      ? errorMessage(error, (candidate) => i18n.exists(candidate))
      : { key: 'errors.unknown', values: {} };
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p role="alert" className="text-muted">
        {t(key, values)}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-11 rounded-full border border-border bg-surface px-5 font-bold"
      >
        {t('errorPage.retry')}
      </button>
    </div>
  );
}
