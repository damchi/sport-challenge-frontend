import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionEnd } from '../lib/auth/useHandleLostSession';
import { Page, PageTitle } from '../components/Page';

interface SessionEndPageProps {
  reason: SessionEnd['reason'];
  /** Account deleted: ends the Auth0 session too. Unavailable: tries again. */
  onAction: () => Promise<void>;
}

/** Shown in place of the app when the session ended for good. */
export function SessionEndPage({ reason, onAction }: SessionEndPageProps) {
  const { t } = useTranslation();
  // The action could not start (network...): the button stays to try again.
  const [failed, setFailed] = useState(false);
  // One action at a time: a double click must not sign out or redirect twice.
  const [pending, setPending] = useState(false);
  const act = () => {
    setFailed(false);
    setPending(true);
    onAction().catch(() => {
      setFailed(true);
      setPending(false);
    });
  };
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
    <Page>
      <PageTitle>{texts.title}</PageTitle>
      <p role="alert" className="mt-2 text-muted">
        {failed ? t('auth.callback.error') : texts.message}
      </p>
      <button
        type="button"
        onClick={act}
        disabled={pending}
        className="mt-6 h-13 rounded-full bg-accent px-6 text-button font-bold text-on-accent disabled:opacity-60"
      >
        {texts.action}
      </button>
    </Page>
  );
}
