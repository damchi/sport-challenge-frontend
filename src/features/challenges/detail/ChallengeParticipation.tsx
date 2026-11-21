import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../../api/errors';
import {
  useAbandonChallenge,
  useJoinChallenge,
  type ChallengeDetail,
} from '../../../api/hooks/useChallenges';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useJoinCopy } from './useJoinCopy';

/**
 * The user's participation in a challenge. Joining, as the server allows it
 * (can_join): the deadline and the button, which asks for a confirmation
 * saying the activities will be seen by the other participants. Otherwise,
 * why the user cannot join, read from their participation: in, abandoned for
 * good, or registration closed (the only reason left to a user who sees the
 * challenge). An active participant of a challenge not finished can abandon
 * it, after a confirmation saying it is final.
 */
export function ChallengeParticipation({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const join = useJoinChallenge(challenge.id);
  const abandon = useAbandonChallenge(challenge.id);
  const [confirming, setConfirming] = useState<'join' | 'abandon' | null>(null);
  // Each outcome takes the focus once, not again on each refresh. One ref is
  // enough: a join and an abandon never show their outcomes together.
  const focusedOutcome = useRef<string | null>(null);
  const { deadline, reason } = useJoinCopy(challenge);
  const translateError = (error: Error | null) =>
    error instanceof ApiError
      ? errorMessage(error, (candidate) => i18n.exists(candidate))
      : error
        ? { key: 'errors.unknown', values: {} }
        : undefined;
  const focusOnce = (element: HTMLElement | null, outcome: string) => {
    if (!element || focusedOutcome.current === outcome) return;
    focusedOutcome.current = outcome;
    element.focus();
  };

  if (!challenge.can_join) {
    // The status is the server's: a finished challenge cannot be abandoned.
    const canAbandon = challenge.my_status === 'active' && challenge.status !== 'finished';
    // After a join or an abandon, the button is gone: the focus moves to the
    // outcome, which is announced. A refused join is said by the reloaded
    // challenge's reason, in place of the error, which would repeat it.
    const answered = join.isSuccess || join.isError || abandon.isSuccess;
    // A refused abandon (challenge ended) says why: the reloaded challenge
    // would not. The error takes the focus once the button is gone.
    const abandonError = translateError(abandon.error);
    return (
      <>
        {abandonError && (
          <p
            ref={(element) => {
              if (!canAbandon) focusOnce(element, 'abandonError');
            }}
            tabIndex={canAbandon ? undefined : -1}
            role="alert"
            className="mt-4 font-semibold"
          >
            {t(abandonError.key, abandonError.values)}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p
            ref={(element) => {
              if (answered) focusOnce(element, abandon.isSuccess ? 'abandon' : 'join');
            }}
            tabIndex={answered ? -1 : undefined}
            role={join.isError ? 'alert' : answered ? 'status' : undefined}
            className="text-sm text-muted"
          >
            {reason}
          </p>
          {canAbandon && (
            <>
              <button
                type="button"
                // Not `disabled`: the focus comes back here when the dialog
                // closes, and a disabled button would drop it while sending.
                aria-disabled={abandon.isPending}
                onClick={() => {
                  if (!abandon.isPending) setConfirming('abandon');
                }}
                className="h-13 flex-none rounded-full border border-border bg-surface px-6 font-bold aria-disabled:opacity-60"
              >
                {abandon.isPending
                  ? t('challengeDetail.abandon.busy')
                  : t('challengeDetail.abandon.button')}
              </button>
              <ConfirmDialog
                open={confirming === 'abandon'}
                title={t('challengeDetail.abandon.title', { title: challenge.title })}
                message={t('challengeDetail.abandon.message')}
                confirmLabel={t('challengeDetail.abandon.confirm')}
                cancelLabel={t('challengeDetail.abandon.cancel')}
                onConfirm={() => {
                  setConfirming(null);
                  abandon.mutate();
                }}
                onCancel={() => setConfirming(null)}
              />
            </>
          )}
        </div>
      </>
    );
  }

  const joinError = translateError(join.error);

  return (
    <>
      {joinError && (
        <p role="alert" className="mt-4 font-semibold">
          {t(joinError.key, joinError.values)}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p>{t('challengeDetail.registrationOpen', deadline)}</p>
        <button
          type="button"
          // Not `disabled`: the focus comes back here when the dialog closes,
          // and a disabled button would drop it while the join is sent.
          aria-disabled={join.isPending}
          onClick={() => {
            if (!join.isPending) setConfirming('join');
          }}
          className="h-13 flex-none rounded-full bg-accent px-6 text-button font-bold text-on-accent aria-disabled:opacity-60"
        >
          {join.isPending ? t('challengeDetail.join.busy') : t('challengeDetail.join.button')}
        </button>
        <ConfirmDialog
          open={confirming === 'join'}
          title={t('challengeDetail.join.title', { title: challenge.title })}
          message={t('challengeDetail.join.message')}
          confirmLabel={t('challengeDetail.join.confirm')}
          cancelLabel={t('challengeDetail.join.cancel')}
          onConfirm={() => {
            setConfirming(null);
            join.mutate();
          }}
          onCancel={() => setConfirming(null)}
        />
      </div>
    </>
  );
}
