import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ApiError, errorMessage } from '../../api/errors';
import { useChallenge } from '../../api/hooks/useChallenges';
import { useDeleteMe } from '../../api/hooks/useMe';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { challengeIdList } from '../../domain/challenge';
import { useAccountDeleted } from '../../lib/auth/accountDeleted';

const CONSEQUENCES = ['challenges', 'profile', 'signIn', 'final'] as const;

/** A challenge the user must hand over first, named once it is loaded. */
function BlockingChallenge({ challengeId }: { challengeId: string }) {
  const { t } = useTranslation();
  const { data: challenge } = useChallenge(challengeId);
  return (
    <li>
      <Link
        to={`/challenges/${encodeURIComponent(challengeId)}`}
        className="inline-flex min-h-11 items-center font-semibold break-words underline"
      >
        {challenge?.title ?? t('profile.deleteAccount.challengeFallback')}
      </Link>
    </li>
  );
}

/**
 * Deletes the account, after a confirmation that says what it does and asks
 * the user to tick that they understand it is final. Deleted: the app ends
 * the session, also when a retry finds it already gone (`account_deleted`).
 * Refused because the user is the last creator of challenges
 * not finished: those challenges are listed, to hand them over first.
 */
export function DeleteAccount() {
  const { t, i18n } = useTranslation();
  const deleteMe = useDeleteMe();
  const onDeleted = useAccountDeleted();
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);

  const error =
    deleteMe.error instanceof ApiError
      ? deleteMe.error
      : deleteMe.error
        ? new ApiError('unknown', 0)
        : undefined;
  const message = error && errorMessage(error, (candidate) => i18n.exists(candidate));
  const blocking = error?.code === 'last_creator' ? challengeIdList(error.params.challenges) : [];

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button
        type="button"
        // Not `disabled`: the focus comes back here when the dialog closes,
        // and a disabled button would drop it while the deletion is sent.
        aria-disabled={deleteMe.isPending}
        onClick={() => {
          if (deleteMe.isPending) return;
          // A new attempt: the previous refusal goes away.
          deleteMe.reset();
          setUnderstood(false);
          setConfirming(true);
        }}
        className="h-11 rounded-full border border-border bg-surface px-6 text-button font-bold aria-disabled:opacity-60"
      >
        {deleteMe.isPending ? t('profile.deleteAccount.busy') : t('profile.deleteAccount.button')}
      </button>
      {message && (
        <div role="alert" className="text-sm text-risk-fg">
          <p>{t(message.key, message.values)}</p>
          {blocking.length > 0 && (
            <>
              <p className="mt-2">{t('profile.deleteAccount.blocking')}</p>
              <ul className="mt-1 flex flex-col">
                {blocking.map((challengeId) => (
                  <BlockingChallenge key={challengeId} challengeId={challengeId} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirming}
        title={t('profile.deleteAccount.title')}
        message={t('profile.deleteAccount.message')}
        details={
          <ul className="mt-2 list-disc pl-5">
            {CONSEQUENCES.map((consequence) => (
              <li key={consequence}>{t(`profile.deleteAccount.consequences.${consequence}`)}</li>
            ))}
          </ul>
        }
        confirmDisabled={!understood}
        confirmLabel={t('profile.deleteAccount.confirm')}
        cancelLabel={t('profile.deleteAccount.cancel')}
        onConfirm={() => {
          setConfirming(false);
          deleteMe.mutate(undefined, {
            onSuccess: onDeleted,
            // A retry after a 500 that came once the account was deleted.
            onError: (failure) => {
              if (failure instanceof ApiError && failure.code === 'account_deleted') onDeleted();
            },
          });
        }}
        onCancel={() => setConfirming(false)}
      >
        <label className="mt-4 flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            className="size-5 flex-none"
          />
          {t('profile.deleteAccount.understood')}
        </label>
      </ConfirmDialog>
    </div>
  );
}
