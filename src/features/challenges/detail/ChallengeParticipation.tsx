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
 * why the user cannot join, read from their participation: abandoned for
 * good, or registration closed (the only reason left to a user who sees the
 * challenge); an active participant reads it in the header's pill, and here
 * only right after joining. Abandoning, asked from the page's menu
 * (`abandoning`), takes a confirmation saying it is final; `onAbandonClose`
 * gives the focus back.
 */
export function ChallengeParticipation({
  challenge,
  abandoning,
  onAbandonClose,
}: {
  challenge: ChallengeDetail;
  abandoning: boolean;
  onAbandonClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const join = useJoinChallenge(challenge.id);
  const abandon = useAbandonChallenge(challenge.id);
  const [joining, setJoining] = useState(false);
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
    // After a join or an abandon, the focus moves to the outcome, which is
    // announced. A refused join is said by the reloaded challenge's reason,
    // in place of the error, which would repeat it.
    const answered = join.isSuccess || join.isError || abandon.isSuccess;
    // A refused abandon (challenge ended) says why: the reloaded challenge
    // would not. It takes the focus once the dialog is closed.
    const abandonError = translateError(abandon.error);
    const showsReason = challenge.my_status !== 'active' || answered;
    return (
      <>
        {abandonError && (
          <p
            ref={(element) => focusOnce(element, 'abandonError')}
            tabIndex={-1}
            role="alert"
            className="mt-4 font-semibold"
          >
            {t(abandonError.key, abandonError.values)}
          </p>
        )}
        {/* The dialog is closed: the abandon being sent is said, and announced. */}
        {/* Always there, so that its text is announced when it comes. */}
        <p role="status" className="mt-4 text-sm text-muted empty:hidden">
          {abandon.isPending && t('challengeDetail.abandon.busy')}
        </p>
        {showsReason && (
          <p
            ref={(element) => {
              if (answered) focusOnce(element, abandon.isSuccess ? 'abandon' : 'join');
            }}
            tabIndex={answered ? -1 : undefined}
            role={join.isError ? 'alert' : answered ? 'status' : undefined}
            className="mt-4 text-sm text-muted"
          >
            {reason}
          </p>
        )}
        <ConfirmDialog
          open={abandoning}
          variant="danger"
          title={t('challengeDetail.abandon.title', { title: challenge.title })}
          message={t('challengeDetail.abandon.message')}
          confirmLabel={t('challengeDetail.abandon.confirm')}
          cancelLabel={t('challengeDetail.abandon.cancel')}
          onConfirm={() => {
            onAbandonClose();
            if (abandon.isPending) return;
            // A new attempt: its refusal takes the focus again.
            focusedOutcome.current = null;
            abandon.mutate();
          }}
          onCancel={() => {
            // Given up: a previous refusal goes away, as for the deletion.
            if (!abandon.isPending) abandon.reset();
            onAbandonClose();
          }}
        />
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
            if (!join.isPending) setJoining(true);
          }}
          className="h-13 flex-none rounded-full bg-accent hover-accent px-6 text-button font-bold text-on-accent aria-disabled:opacity-60"
        >
          {join.isPending ? t('challengeDetail.join.busy') : t('challengeDetail.join.button')}
        </button>
        {/* Joining from the page asks first, saying the activities are seen
            by the other participants: a public challenge gathers strangers.
            A link joins at once (owner's decisions, 2026-11-23 and
            2026-11-26, README §2 « Participation »). */}
        <ConfirmDialog
          open={joining}
          title={t('challengeDetail.join.title', { title: challenge.title })}
          message={t('challengeDetail.join.message')}
          confirmLabel={t('challengeDetail.join.confirm')}
          cancelLabel={t('challengeDetail.join.cancel')}
          onConfirm={() => {
            setJoining(false);
            join.mutate();
          }}
          onCancel={() => setJoining(false)}
        />
      </div>
    </>
  );
}
