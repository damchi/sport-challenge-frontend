import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, errorMessage } from '../../../api/errors';
import { useJoinChallenge, type ChallengeDetail } from '../../../api/hooks/useChallenges';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { challengeInstant, otherTimeZoneName } from '../../../domain/format/challengeDates';

/**
 * Joining a challenge, as the server allows it (can_join): the deadline and
 * the button, which asks for a confirmation saying the activities will be
 * seen by the other participants. Otherwise, why the user cannot join, read
 * from their participation: in, abandoned for good, or registration closed
 * (the only reason left to a user who sees the challenge).
 */
export function ChallengeJoin({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const join = useJoinChallenge(challenge.id);
  const [confirming, setConfirming] = useState(false);
  // The outcome takes the focus once, not again on each refresh.
  const outcomeFocused = useRef(false);
  const locale = i18n.resolvedLanguage ?? 'fr';
  const zone = otherTimeZoneName(
    challenge.timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale,
  );
  const deadline = {
    date: challengeInstant(challenge.registration_deadline, challenge.timezone, locale),
    zone,
    context: zone && 'zone',
  };

  if (!challenge.can_join) {
    const reason =
      challenge.my_status === 'active'
        ? t('challengeDetail.join.participant')
        : challenge.my_status === 'abandoned'
          ? t('challengeDetail.join.abandoned')
          : t('challengeDetail.join.closed', deadline);
    // After a join, the button is gone: the focus moves to the outcome, which
    // is announced. A refusal is said by the reloaded challenge's reason, in
    // place of the error, which would repeat it.
    const answered = join.isSuccess || join.isError;
    return (
      <p
        ref={(element) => {
          if (!answered || !element || outcomeFocused.current) return;
          outcomeFocused.current = true;
          element.focus();
        }}
        tabIndex={answered ? -1 : undefined}
        role={join.isError ? 'alert' : join.isSuccess ? 'status' : undefined}
        className="mt-4 text-sm text-muted"
      >
        {reason}
      </p>
    );
  }

  const joinError =
    join.error instanceof ApiError
      ? errorMessage(join.error, (candidate) => i18n.exists(candidate))
      : join.error
        ? { key: 'errors.unknown', values: {} }
        : undefined;

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
            if (!join.isPending) setConfirming(true);
          }}
          className="h-13 flex-none rounded-full bg-accent px-6 text-button font-bold text-on-accent aria-disabled:opacity-60"
        >
          {join.isPending ? t('challengeDetail.join.busy') : t('challengeDetail.join.button')}
        </button>
        <ConfirmDialog
          open={confirming}
          title={t('challengeDetail.join.title', { title: challenge.title })}
          message={t('challengeDetail.join.message')}
          confirmLabel={t('challengeDetail.join.confirm')}
          cancelLabel={t('challengeDetail.join.cancel')}
          onConfirm={() => {
            setConfirming(false);
            join.mutate();
          }}
          onCancel={() => setConfirming(false)}
        />
      </div>
    </>
  );
}
