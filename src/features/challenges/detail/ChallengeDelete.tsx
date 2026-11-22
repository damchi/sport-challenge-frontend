import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../../../api/errors';
import { useDeleteChallenge, type ChallengeDetail } from '../../../api/hooks/useChallenges';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { inputClass } from '../create/fields';

// Stable: called once per element, not again on each render.
function focusOnMount(element: HTMLElement | null) {
  element?.focus();
}

/**
 * Deletes a challenge, for its creators (the server's role), at any time,
 * finished included. The confirmation says that everything disappears for
 * every participant, and asks to type the challenge's title before it
 * deletes. Deleted: back to the home page.
 */
export function ChallengeDelete({ challenge }: { challenge: ChallengeDetail }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteChallenge(challenge.id);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const inputId = useId();

  if (challenge.my_role !== 'creator') return null;

  const message =
    remove.error instanceof ApiError
      ? errorMessage(remove.error, (candidate) => i18n.exists(candidate))
      : remove.error
        ? { key: 'errors.unknown', values: {} }
        : undefined;
  const matches = typed.trim() === challenge.title.trim();

  return (
    <div className="mt-8 flex flex-col gap-3 md:items-start">
      <button
        type="button"
        // Not `disabled`: the focus comes back here when the dialog closes,
        // and a disabled button would drop it while the deletion is sent.
        aria-disabled={remove.isPending}
        onClick={() => {
          if (remove.isPending) return;
          // A new attempt: the previous refusal goes away.
          remove.reset();
          setTyped('');
          setConfirming(true);
        }}
        className="h-11 rounded-full border border-border bg-surface px-6 text-button font-bold aria-disabled:opacity-60"
      >
        {remove.isPending ? t('challengeDetail.delete.busy') : t('challengeDetail.delete.button')}
      </button>
      {message && (
        // The dialog is closed: the refusal takes the focus, once (a new
        // attempt clears it first).
        <p
          ref={focusOnMount}
          tabIndex={-1}
          role="alert"
          className="text-sm font-semibold text-risk-fg"
        >
          {t(message.key, message.values)}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title={t('challengeDetail.delete.title', { title: challenge.title })}
        message={t('challengeDetail.delete.message')}
        confirmDisabled={!matches}
        confirmLabel={t('challengeDetail.delete.confirm')}
        cancelLabel={t('challengeDetail.delete.cancel')}
        onConfirm={() => {
          setConfirming(false);
          remove.mutate(undefined, {
            onSuccess: () => void navigate('/', { replace: true }),
          });
        }}
        onCancel={() => setConfirming(false)}
      >
        <div className="mt-4">
          <label htmlFor={inputId} className="block text-sm font-semibold text-ink break-words">
            {t('challengeDetail.delete.typeTitle', { title: challenge.title })}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={`${inputId}-hint`}
            className={`${inputClass} h-11 w-full`}
          />
          <p id={`${inputId}-hint`} className="mt-1 text-sm text-muted">
            {t('challengeDetail.delete.typeTitleHint')}
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
