import { useTranslation } from 'react-i18next';
import type { SessionEnd } from '../lib/auth/useHandleLostSession';

interface SessionEndPageProps {
  reason: SessionEnd;
  /** Account deleted: ends the Auth0 session too. Unavailable: tries again. */
  onAction: () => void;
}

/** Shown in place of the app when the session ended for good. */
export function SessionEndPage({ reason, onAction }: SessionEndPageProps) {
  const { t } = useTranslation();
  const texts =
    reason === 'account_deleted'
      ? {
          title: t('auth.accountDeleted.title'),
          message: t('auth.accountDeleted.message'),
          action: t('auth.accountDeleted.finish'),
        }
      : {
          title: t('auth.sessionUnavailable.title'),
          message: t('auth.sessionUnavailable.message'),
          action: t('errorPage.retry'),
        };

  return (
    <main className="mx-auto max-w-page px-5 py-8">
      <h1 className="font-display text-title font-bold tracking-title">{texts.title}</h1>
      <p role="alert" className="mt-2 text-muted">
        {texts.message}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent"
      >
        {texts.action}
      </button>
    </main>
  );
}
